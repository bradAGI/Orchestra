package agents

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"time"

	"github.com/orchestra/orchestra/apps/backend/internal/unsandbox"
)

// ProviderUnsandbox identifies the Unsandbox remote container execution backend.
const ProviderUnsandbox Provider = "UNSANDBOX"

// UnsandboxRunner executes agent turns inside unsandbox.com containers.
//
// Bootstrap flow (mirrors unfirehose /api/boot):
//  1. Create a persistent session (ubuntu:24.04, semitrusted network)
//  2. Sync credentials into the container (umask 077, chmod 600)
//  3. Clone the git repo if workspace has a remote
//  4. Install the agent CLI if needed
//  5. Run the agent command with the prompt
type UnsandboxRunner struct {
	client  *unsandbox.Client
	command string
	network string // "semitrusted" or "zerotrust"
}

// NewUnsandboxRunner creates a runner that dispatches to unsandbox.
// command is the agent CLI template (e.g. "claude -p {{prompt}} --output-format json").
// If command is empty, the prompt is executed as a bash script.
func NewUnsandboxRunner(client *unsandbox.Client, command string) *UnsandboxRunner {
	return &UnsandboxRunner{
		client:  client,
		command: strings.TrimSpace(command),
		network: "semitrusted",
	}
}

// WithNetwork sets the network mode ("semitrusted" or "zerotrust").
func (r *UnsandboxRunner) WithNetwork(network string) *UnsandboxRunner {
	r.network = network
	return r
}

// RunTurn creates an Unsandbox container session, bootstraps it with credentials
// and project files, executes the agent command, retrieves session artifacts, and
// returns the result.
func (r *UnsandboxRunner) RunTurn(ctx context.Context, request TurnRequest, onEvent EventHandler) (TurnResult, error) {
	sessionID := request.SessionID
	if sessionID == "" {
		sessionID = fmt.Sprintf("unsandbox-%s-%d", request.IssueIdentifier, time.Now().UnixNano())
	}

	emit := func(kind, message string, raw map[string]any) {
		if onEvent != nil {
			onEvent(Event{
				Provider:  ProviderUnsandbox,
				SessionID: sessionID,
				Kind:      kind,
				Message:   message,
				Raw:       raw,
				Timestamp: time.Now().UTC(),
			})
		}
	}

	// 1. Create unsandbox session
	emit("session_creating", fmt.Sprintf("creating unsandbox session (network: %s)", r.network), nil)

	unsandboxSession, err := r.client.CreateSession(ctx, "bash", r.network)
	if err != nil {
		emit("error", fmt.Sprintf("session creation failed: %s", err), nil)
		return TurnResult{Provider: ProviderUnsandbox, SessionID: sessionID, ExitCode: 1, Output: err.Error()}, err
	}

	remoteSessionID := unsandboxSession.ID
	emit("session_created", fmt.Sprintf("unsandbox session %s ready", remoteSessionID), map[string]any{"unsandbox_session_id": remoteSessionID})

	// 2. Bootstrap: sync credentials, inject project files, install agent
	emit("bootstrap_started", "bootstrapping container", nil)

	// Sync credentials
	if credScript := syncCredentials(); credScript != "" {
		if _, err := r.client.ShellSession(ctx, remoteSessionID, credScript); err != nil {
			emit("bootstrap_warning", fmt.Sprintf("credential sync failed: %s", err), nil)
		}
	}

	// Inject project files into container
	repoName := "project"
	if request.Workspace != "" {
		repoName = filepath.Base(request.Workspace)
	}
	workDir := "/workspace/" + repoName

	if request.Workspace != "" {
		repoURL := detectGitRemote(request.Workspace)
		if repoURL != "" {
			// Public/SSH repo — clone it
			emit("bootstrap", fmt.Sprintf("cloning %s", repoURL), nil)
			cloneCmd := fmt.Sprintf("git clone %s %s 2>&1 || mkdir -p %s", shellQuote(repoURL), shellQuote(workDir), shellQuote(workDir))
			if _, err := r.client.ShellSession(ctx, remoteSessionID, cloneCmd); err != nil {
				emit("bootstrap_warning", fmt.Sprintf("git clone failed: %s", err), nil)
			}
		} else {
			// No remote — tar + base64 + inject via chunked heredoc
			emit("bootstrap", "uploading project files via tarball", nil)
			if err := r.client.InjectDirectory(ctx, remoteSessionID, request.Workspace, workDir); err != nil {
				emit("bootstrap_warning", fmt.Sprintf("project upload failed: %s", err), nil)
				// Create empty dir as fallback
				r.client.ShellSession(ctx, remoteSessionID, fmt.Sprintf("mkdir -p %s", shellQuote(workDir)))
			} else {
				emit("bootstrap", "project files uploaded", nil)
			}
		}
	} else {
		r.client.ShellSession(ctx, remoteSessionID, fmt.Sprintf("mkdir -p %s", shellQuote(workDir)))
	}

	// Install claude CLI if needed
	if strings.Contains(r.command, "claude") {
		installCmd := strings.Join([]string{
			`export PATH="$HOME/.local/bin:$PATH"`,
			"if ! command -v claude >/dev/null 2>&1; then",
			"  curl -fsSL https://claude.ai/install.sh | bash 2>&1",
			"fi",
			`grep -q ".local/bin" ~/.bashrc 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc`,
		}, "\n")
		if _, err := r.client.ShellSession(ctx, remoteSessionID, installCmd); err != nil {
			emit("bootstrap_warning", fmt.Sprintf("claude install failed: %s", err), nil)
		}
	}

	// Symlink claude JSONL output to /root/output so unsandbox makes it downloadable.
	// Claude writes sessions to ~/.claude/projects/ — link the whole tree.
	// Also link any unfirehose output dirs that agents may create.
	symlinkCmd := strings.Join([]string{
		"mkdir -p /root/output",
		"ln -sf ~/.claude/projects /root/output/claude-sessions 2>/dev/null; true",
		"ln -sf ~/.claude/todos /root/output/claude-todos 2>/dev/null; true",
	}, " && ")
	r.client.ShellSession(ctx, remoteSessionID, symlinkCmd)

	emit("bootstrap_completed", "container ready", nil)

	// 3. Build and execute the agent command inside the workspace
	finalPrompt := strings.TrimSpace(request.Prompt)
	commandLine := r.command
	if strings.TrimSpace(request.CommandOverride) != "" {
		commandLine = strings.TrimSpace(request.CommandOverride)
	}

	var agentCmd string
	if commandLine != "" {
		agentCmd = strings.ReplaceAll(commandLine, "{{prompt}}", shellQuote(finalPrompt))
	} else {
		agentCmd = finalPrompt
	}

	// Wrap in cd to workspace + PATH setup
	agentCmd = fmt.Sprintf("export PATH=\"$HOME/.local/bin:$PATH\" && cd %s && %s", shellQuote(workDir), agentCmd)

	emit("RUN_STARTED", "executing agent in unsandbox", nil)

	result, err := r.client.ShellSession(ctx, remoteSessionID, agentCmd)
	if err != nil {
		emit("error", err.Error(), nil)
		return TurnResult{
			Provider:  ProviderUnsandbox,
			SessionID: sessionID,
			ExitCode:  1,
			Output:    err.Error(),
		}, err
	}

	// 4. Parse output and emit events
	output := result.Output
	if result.Error != "" && output == "" {
		output = result.Error
	}

	collector := &outputCollector{}
	if output != "" {
		scanner := bufio.NewScanner(strings.NewReader(output))
		for scanner.Scan() {
			line := scanner.Text()
			collector.append(line)

			event := parseLineToEvent(ProviderUnsandbox, "stdout", line)
			event.SessionID = sessionID
			if onEvent != nil {
				onEvent(event)
			}
			collector.mergeUsage(event.Usage)
		}
	}

	// 5. Retrieve JSONL artifacts from /root/output before session ends.
	// Claude writes full session JSONL inside the container at ~/.claude/projects/.
	// The bootstrap symlinked this to /root/output/claude-sessions.
	// We tar it, base64 stream it back, and extract into the LOCAL ~/.claude/projects/
	// so unfirehose's existing ingest pipeline (claude-code adapter) picks it up
	// automatically — no separate Go transformer needed.
	emit("artifacts", "retrieving session JSONL from container", nil)
	extractCmd := "cd /root/output && tar czf - claude-sessions claude-todos 2>/dev/null | base64"
	tarResult, tarErr := r.client.ShellSession(ctx, remoteSessionID, extractCmd)
	if tarErr == nil && tarResult != nil && tarResult.Output != "" {
		tarData, decErr := base64.StdEncoding.DecodeString(strings.TrimSpace(tarResult.Output))
		if decErr == nil && len(tarData) > 0 {
			u, _ := user.Current()
			if u != nil {
				// Extract claude-sessions/ into ~/.claude/projects/ (where ingest reads from).
				// The tar contains "claude-sessions/{project-slug}/{session}.jsonl" which is
				// actually a symlink to ~/.claude/projects/ — so the real files are at that
				// path inside the container. We extract and remap.
				claudeDir := filepath.Join(u.HomeDir, ".claude", "projects")
				os.MkdirAll(claudeDir, 0755)
				extractTarGz(tarData, claudeDir)
				emit("artifacts", fmt.Sprintf("extracted %d bytes of session JSONL into %s for ingest", len(tarData), claudeDir), nil)

				// Also save a copy to orchestra's own dir for provenance tracking
				artifactDir := filepath.Join(u.HomeDir, ".orchestra", "unfirehose", "artifacts", sessionID)
				os.MkdirAll(artifactDir, 0755)
				extractTarGz(tarData, artifactDir)
			}
		}
	}

	// 6. Emit completion
	exitCode := 0
	if result.Status == "error" || result.Error != "" {
		exitCode = 1
	}

	completionRaw := map[string]any{
		"status":               result.Status,
		"unsandbox_session_id": remoteSessionID,
	}
	if result.JobID != "" {
		completionRaw["job_id"] = result.JobID
	}
	emit("turn.completed", fmt.Sprintf("unsandbox execution %s", result.Status), completionRaw)

	return TurnResult{
		Provider:  ProviderUnsandbox,
		SessionID: sessionID,
		ExitCode:  exitCode,
		Output:    output,
		Usage:     collector.usage(),
	}, nil
}


// syncCredentials reads local Claude credentials and returns shell commands
// to inject them into the container with secure permissions.
func syncCredentials() string {
	u, err := user.Current()
	if err != nil {
		return ""
	}

	credFile := filepath.Join(u.HomeDir, ".claude", ".credentials.json")
	data, err := os.ReadFile(credFile)
	if err != nil {
		return ""
	}

	b64 := base64.StdEncoding.EncodeToString(data)
	lines := []string{
		"umask 077 && mkdir -p ~/.claude",
		fmt.Sprintf("printf '%%s' %s | base64 -d > ~/.claude/.credentials.json", shellQuote(b64)),
		"chmod 600 ~/.claude/.credentials.json",
		"chmod 700 ~/.claude",
	}

	// Settings files (non-fatal)
	for _, name := range []string{"settings.json", "settings.local.json"} {
		settingsPath := filepath.Join(u.HomeDir, ".claude", name)
		sData, err := os.ReadFile(settingsPath)
		if err != nil {
			continue
		}
		sB64 := base64.StdEncoding.EncodeToString(sData)
		lines = append(lines, fmt.Sprintf("printf '%%s' %s | base64 -d > ~/.claude/%s", shellQuote(sB64), shellQuote(name)))
	}

	return strings.Join(lines, "\n")
}

// extractTarGz extracts a gzipped tarball into a directory.
func extractTarGz(data []byte, destDir string) error {
	gr, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer gr.Close()

	tr := tar.NewReader(gr)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		target := filepath.Join(destDir, filepath.Clean(header.Name))
		// Prevent path traversal
		if !strings.HasPrefix(target, filepath.Clean(destDir)+string(os.PathSeparator)) && target != filepath.Clean(destDir) {
			continue
		}

		switch header.Typeflag {
		case tar.TypeDir:
			os.MkdirAll(target, 0755)
		case tar.TypeReg:
			os.MkdirAll(filepath.Dir(target), 0755)
			f, err := os.Create(target)
			if err != nil {
				continue
			}
			io.Copy(f, tr)
			f.Close()
		case tar.TypeSymlink:
			os.MkdirAll(filepath.Dir(target), 0755)
			os.Symlink(header.Linkname, target)
		}
	}
	return nil
}

// detectGitRemote tries to find the origin remote URL for a workspace path.
func detectGitRemote(workspacePath string) string {
	// Read .git/config and find the origin remote URL
	gitConfig := filepath.Join(workspacePath, ".git", "config")
	data, err := os.ReadFile(gitConfig)
	if err != nil {
		return ""
	}

	lines := strings.Split(string(data), "\n")
	inOrigin := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == `[remote "origin"]` {
			inOrigin = true
			continue
		}
		if inOrigin && strings.HasPrefix(trimmed, "url = ") {
			return strings.TrimPrefix(trimmed, "url = ")
		}
		if strings.HasPrefix(trimmed, "[") {
			inOrigin = false
		}
	}
	return ""
}
