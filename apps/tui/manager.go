package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

// ServiceStatus represents the lifecycle state of a managed service.
type ServiceStatus int

const (
	// StatusStopped indicates the service is not running.
	StatusStopped ServiceStatus = iota
	// StatusStarting indicates the service is in the process of starting.
	StatusStarting
	// StatusRunning indicates the service is actively running.
	StatusRunning
	// StatusError indicates the service encountered an error.
	StatusError
)

// String returns the human-readable name of the service status.
func (s ServiceStatus) String() string {
	switch s {
	case StatusStopped:
		return "STOPPED"
	case StatusStarting:
		return "STARTING"
	case StatusRunning:
		return "RUNNING"
	case StatusError:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

// Service represents a managed subprocess with lifecycle control, log capture,
// and event notification for the TUI dashboard.
type Service struct {
	Name    string
	Cmd     string
	Cwd     string
	Env     []string
	Status  ServiceStatus
	Logs    []string
	mu      sync.Mutex
	cancel  context.CancelFunc
	cmd     *exec.Cmd
	done    chan struct{}
	onEvent func()
}

// Start launches the service subprocess in the background. The onEvent callback
// is invoked whenever the service state changes or new log output is received.
func (s *Service) Start(onEvent func()) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Status == StatusRunning || s.Status == StatusStarting {
		return
	}

	s.Status = StatusStarting
	s.onEvent = onEvent
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.done = make(chan struct{})

	go s.run(ctx)
}

func (s *Service) run(ctx context.Context) {
	defer func() {
		s.mu.Lock()
		done := s.done
		s.done = nil
		s.cmd = nil
		s.cancel = nil
		s.mu.Unlock()
		if done != nil {
			close(done)
		}
	}()

	cmd := exec.CommandContext(ctx, "bash", "-c", s.Cmd)
	cmd.Dir = s.Cwd
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, s.Env...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	s.mu.Lock()
	s.cmd = cmd
	s.mu.Unlock()

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		s.mu.Lock()
		s.Status = StatusError
		s.Logs = append(s.Logs, fmt.Sprintf("Error starting: %v", err))
		s.mu.Unlock()
		s.onEvent()
		return
	}

	s.mu.Lock()
	s.Status = StatusRunning
	s.Logs = append(s.Logs, fmt.Sprintf(">>> %s process started: %s", s.Name, s.Cmd))
	s.mu.Unlock()
	s.onEvent()

	var wg sync.WaitGroup
	wg.Add(2)

	captureLogs := func(r io.Reader) {
		defer wg.Done()
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			s.mu.Lock()
			line := scanner.Text()
			s.Logs = append(s.Logs, line)
			if len(s.Logs) > 200 {
				s.Logs = s.Logs[1:]
			}
			s.mu.Unlock()
			s.onEvent()
		}
	}

	go captureLogs(stdout)
	go captureLogs(stderr)

	_ = cmd.Wait()
	wg.Wait()

	s.mu.Lock()
	if s.Status != StatusError && s.Status != StatusStopped {
		s.Status = StatusStopped
	}
	s.mu.Unlock()
	s.onEvent()
}

// Stop terminates the service subprocess by sending SIGTERM followed by SIGKILL
// after a grace period.
func (s *Service) Stop() {
	s.mu.Lock()
	done := s.done
	cmd := s.cmd
	cancel := s.cancel
	if s.cancel != nil {
		cancel()
	}
	if cmd != nil && cmd.Process != nil {
		// Send SIGTERM first for graceful shutdown (releases port)
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
	}
	s.Status = StatusStopped
	s.Logs = append(s.Logs, fmt.Sprintf(">>> %s stopped", s.Name))
	s.onEvent()
	s.mu.Unlock()

	if done == nil {
		return
	}

	select {
	case <-done:
		return
	case <-time.After(2 * time.Second):
		if cmd != nil && cmd.Process != nil {
			_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		select {
		case <-done:
		case <-time.After(1 * time.Second):
		}
	}
}
