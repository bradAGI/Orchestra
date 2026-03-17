package main

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestServiceInitialState(t *testing.T) {
	s := &Service{Name: "test"}
	if s.Status != StatusStopped {
		t.Errorf("expected initial status StatusStopped (0), got %d", s.Status)
	}
	if len(s.Logs) != 0 {
		t.Errorf("expected empty logs initially, got %d entries", len(s.Logs))
	}
}

func TestServiceStatusConstants(t *testing.T) {
	if StatusStopped != 0 {
		t.Errorf("expected StatusStopped=0, got %d", StatusStopped)
	}
	if StatusStarting != 1 {
		t.Errorf("expected StatusStarting=1, got %d", StatusStarting)
	}
	if StatusRunning != 2 {
		t.Errorf("expected StatusRunning=2, got %d", StatusRunning)
	}
	if StatusError != 3 {
		t.Errorf("expected StatusError=3, got %d", StatusError)
	}
}

func TestStartChangesStatus(t *testing.T) {
	s := &Service{
		Name: "test-echo",
		Cmd:  "echo hello",
		Cwd:  "/tmp",
	}

	eventCh := make(chan struct{}, 10)
	s.Start(func() {
		select {
		case eventCh <- struct{}{}:
		default:
		}
	})

	// Wait for process to start and finish
	timeout := time.After(5 * time.Second)
	for {
		select {
		case <-eventCh:
			s.mu.Lock()
			status := s.Status
			s.mu.Unlock()
			if status == StatusStopped {
				// Process started and completed
				return
			}
		case <-timeout:
			t.Fatal("timed out waiting for service to complete")
		}
	}
}

func TestStartSetsStartingStatus(t *testing.T) {
	// Use a command that takes a moment so we can observe StatusStarting
	s := &Service{
		Name: "test-sleep",
		Cmd:  "sleep 10",
		Cwd:  "/tmp",
	}

	s.Start(func() {})

	// The Start method sets StatusStarting synchronously before goroutine runs
	// Check immediately after Start returns
	s.mu.Lock()
	status := s.Status
	s.mu.Unlock()

	if status != StatusStarting && status != StatusRunning {
		t.Errorf("expected StatusStarting or StatusRunning after Start(), got %d", status)
	}

	s.Stop()
}

func TestStopChangesStatus(t *testing.T) {
	s := &Service{
		Name: "test-stop",
		Cmd:  "sleep 60",
		Cwd:  "/tmp",
	}

	started := make(chan struct{}, 5)
	s.Start(func() {
		select {
		case started <- struct{}{}:
		default:
		}
	})

	// Wait for it to be running
	timeout := time.After(5 * time.Second)
	for {
		select {
		case <-started:
			s.mu.Lock()
			running := s.Status == StatusRunning
			s.mu.Unlock()
			if running {
				goto stopIt
			}
		case <-timeout:
			t.Fatal("timed out waiting for service to start")
		}
	}

stopIt:
	s.Stop()

	s.mu.Lock()
	status := s.Status
	s.mu.Unlock()
	if status != StatusStopped {
		t.Errorf("expected StatusStopped after Stop(), got %d", status)
	}
}

func TestStopAppendsLog(t *testing.T) {
	s := &Service{
		Name: "test-log",
		Cmd:  "sleep 60",
		Cwd:  "/tmp",
	}

	started := make(chan struct{}, 5)
	s.Start(func() {
		select {
		case started <- struct{}{}:
		default:
		}
	})

	// Wait for running
	timeout := time.After(5 * time.Second)
	for {
		select {
		case <-started:
			s.mu.Lock()
			running := s.Status == StatusRunning
			s.mu.Unlock()
			if running {
				goto stopIt
			}
		case <-timeout:
			t.Fatal("timed out waiting for service to start")
		}
	}

stopIt:
	s.Stop()

	s.mu.Lock()
	defer s.mu.Unlock()

	found := false
	expected := fmt.Sprintf(">>> %s stopped", s.Name)
	for _, log := range s.Logs {
		if log == expected {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected stop log entry %q, logs: %v", expected, s.Logs)
	}
}

func TestStartGuardAgainstDuplicate(t *testing.T) {
	s := &Service{
		Name: "test-guard",
		Cmd:  "sleep 60",
		Cwd:  "/tmp",
	}

	started := make(chan struct{}, 10)
	onEvent := func() {
		select {
		case started <- struct{}{}:
		default:
		}
	}

	s.Start(onEvent)

	// Wait for running
	timeout := time.After(5 * time.Second)
	for {
		select {
		case <-started:
			s.mu.Lock()
			running := s.Status == StatusRunning
			s.mu.Unlock()
			if running {
				goto testDuplicate
			}
		case <-timeout:
			t.Fatal("timed out waiting for service to start")
		}
	}

testDuplicate:
	// Try to start again - should be a no-op
	s.Start(onEvent)

	s.mu.Lock()
	status := s.Status
	s.mu.Unlock()

	if status != StatusRunning {
		t.Errorf("expected status to remain StatusRunning after duplicate Start(), got %d", status)
	}

	s.Stop()
}

func TestStartGuardWhileStarting(t *testing.T) {
	s := &Service{
		Name: "test-guard-starting",
		Cmd:  "sleep 60",
		Cwd:  "/tmp",
	}

	s.Start(func() {})

	// Immediately try to start again while still in Starting state
	s.Start(func() {})

	s.mu.Lock()
	status := s.Status
	s.mu.Unlock()

	if status != StatusStarting && status != StatusRunning {
		t.Errorf("expected StatusStarting or StatusRunning, got %d", status)
	}

	s.Stop()
}

func TestLogBufferCapped(t *testing.T) {
	s := &Service{
		Name: "test-cap",
		Logs: make([]string, 0),
	}

	// Simulate the log capping logic from run()
	s.mu.Lock()
	for i := 0; i < 250; i++ {
		s.Logs = append(s.Logs, fmt.Sprintf("line %d", i))
		if len(s.Logs) > 200 {
			s.Logs = s.Logs[1:]
		}
	}
	logLen := len(s.Logs)
	s.mu.Unlock()

	if logLen != 200 {
		t.Errorf("expected log buffer capped at 200, got %d", logLen)
	}
}

func TestLogBufferCappedWithRealCommand(t *testing.T) {
	// Use seq to generate more than 200 lines
	s := &Service{
		Name: "test-cap-real",
		Cmd:  "seq 1 300",
		Cwd:  "/tmp",
	}

	var wg sync.WaitGroup
	wg.Add(1)

	done := false
	s.Start(func() {
		s.mu.Lock()
		stopped := s.Status == StatusStopped
		s.mu.Unlock()
		if stopped && !done {
			done = true
			wg.Done()
		}
	})

	waitCh := make(chan struct{})
	go func() {
		wg.Wait()
		close(waitCh)
	}()

	select {
	case <-waitCh:
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for seq command to finish")
	}

	s.mu.Lock()
	logLen := len(s.Logs)
	s.mu.Unlock()

	// The process started log + up to 200 lines from output
	// Due to the cap, total should never exceed 200
	if logLen > 200 {
		t.Errorf("expected log buffer capped at 200, got %d", logLen)
	}
}

func TestServiceStruct(t *testing.T) {
	s := &Service{
		Name: "myservice",
		Cmd:  "echo test",
		Cwd:  "/tmp",
		Env:  []string{"FOO=bar"},
	}

	if s.Name != "myservice" {
		t.Errorf("expected Name 'myservice', got %q", s.Name)
	}
	if s.Cmd != "echo test" {
		t.Errorf("expected Cmd 'echo test', got %q", s.Cmd)
	}
	if s.Cwd != "/tmp" {
		t.Errorf("expected Cwd '/tmp', got %q", s.Cwd)
	}
	if len(s.Env) != 1 || s.Env[0] != "FOO=bar" {
		t.Errorf("expected Env ['FOO=bar'], got %v", s.Env)
	}
}
