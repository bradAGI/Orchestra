// Package workspace provides workspace lifecycle management including creation,
// removal, hook execution, artifact listing, and git diff retrieval for issue workspaces.
package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// Service manages issue workspaces under a configurable root directory.
type Service struct {
	Root        string
	HookTimeout time.Duration
}

// Hooks defines shell scripts to run at various points in the workspace lifecycle.
type Hooks struct {
	AfterCreate  string
	BeforeRemove string
	BeforeRun    string
	AfterRun     string
}

// EnsureIssueWorkspace creates or verifies the workspace directory for the given issue,
// returning the path, whether the workspace was newly created, and any hook result.
func (s Service) EnsureIssueWorkspace(issueIdentifier string, provider string, hooks Hooks) (string, bool, HookResult, error) {
	path, err := WorkspacePath(s.Root, issueIdentifier, provider)
	if err != nil {
		return "", false, HookResult{}, err
	}

	if err := os.MkdirAll(s.Root, 0o755); err != nil {
		return "", false, HookResult{}, fmt.Errorf("create workspace root: %w", err)
	}

	created := false
	info, statErr := os.Lstat(path)
	switch {
	case statErr == nil && info.IsDir():
		if err := ValidateWorkspacePath(s.Root, path); err != nil {
			return "", false, HookResult{}, err
		}
	case statErr == nil && !info.IsDir():
		if err := os.Remove(path); err != nil {
			return "", false, HookResult{}, fmt.Errorf("remove stale workspace path: %w", err)
		}
		if err := os.MkdirAll(path, 0o755); err != nil {
			return "", false, HookResult{}, fmt.Errorf("create workspace directory: %w", err)
		}
		created = true
	case statErr != nil:
		if !isNotExist(statErr) {
			return "", false, HookResult{}, fmt.Errorf("inspect workspace path: %w", statErr)
		}
		if err := os.MkdirAll(path, 0o755); err != nil {
			return "", false, HookResult{}, fmt.Errorf("create workspace directory: %w", err)
		}
		created = true
	}

	if created && hooks.AfterCreate != "" {
		res, err := RunHook("after_create", hooks.AfterCreate, path, s.timeoutOrDefault())
		return path, created, res, err
	}

	return path, created, HookResult{}, nil
}

// RemoveIssueWorkspaces deletes the workspace directory for the given issue,
// running the before_remove hook first if configured.
func (s Service) RemoveIssueWorkspaces(issueIdentifier string, provider string, hooks Hooks) error {
	if issueIdentifier == "" {
		return nil
	}

	path, err := WorkspacePath(s.Root, issueIdentifier, provider)
	if err != nil {
		return err
	}

	if !exists(path) {
		return nil
	}

	if hooks.BeforeRemove != "" {
		if _, err := RunHook("before_remove", hooks.BeforeRemove, path, s.timeoutOrDefault()); err != nil {
			// Log warning but continue with removal — hook failure should not block cleanup
			fmt.Fprintf(os.Stderr, "WARN: before_remove hook failed for %s: %v\n", path, err)
		}
	}

	if err := ValidateWorkspacePath(s.Root, path); err != nil {
		return err
	}

	if err := os.RemoveAll(path); err != nil {
		return fmt.Errorf("remove workspace: %w", err)
	}

	return nil
}

// RunBeforeRunHook executes the before_run hook script in the given workspace directory.
func (s Service) RunBeforeRunHook(workspacePath string, hooks Hooks) (HookResult, error) {
	if hooks.BeforeRun == "" {
		return HookResult{}, nil
	}
	return RunHook("before_run", hooks.BeforeRun, workspacePath, s.timeoutOrDefault())
}

// RunAfterRunHook executes the after_run hook script in the given workspace directory.
// Failures are intentionally swallowed so that after-run hooks never block the pipeline.
func (s Service) RunAfterRunHook(workspacePath string, hooks Hooks) (HookResult, error) {
	if hooks.AfterRun == "" {
		return HookResult{}, nil
	}
	result, _ := RunHook("after_run", hooks.AfterRun, workspacePath, s.timeoutOrDefault())
	return result, nil
}

// ListArtifacts returns relative paths of all files in the workspace for the given issue,
// excluding .git directories and the .orchestra marker file.
func (s Service) ListArtifacts(issueIdentifier string, provider string) ([]string, error) {
	path, err := WorkspacePath(s.Root, issueIdentifier, provider)
	if err != nil {
		return nil, err
	}

	if !exists(path) {
		return []string{}, nil
	}

	var artifacts []string
	err = filepath.WalkDir(path, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if d.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		rel, err := filepath.Rel(path, p)
		if err != nil {
			return err
		}

		if rel == ".orchestra" {
			return nil
		}

		artifacts = append(artifacts, rel)
		return nil
	})

	return artifacts, err
}

// GetArtifactContent reads and returns the content of a file at the given relative path
// within the issue workspace, validating that the path does not escape the workspace root.
func (s Service) GetArtifactContent(issueIdentifier string, provider string, relPath string) ([]byte, error) {
	root, err := WorkspacePath(s.Root, issueIdentifier, provider)
	if err != nil {
		return nil, err
	}

	fullPath := filepath.Join(root, relPath)
	if err := ValidateWorkspacePath(s.Root, fullPath); err != nil {
		return nil, err
	}

	return os.ReadFile(fullPath)
}

// GetDiff returns the git diff of changes in the workspace for the given issue.
// Returns an empty string if the workspace is not a git repository.
func (s Service) GetDiff(issueIdentifier string, provider string) (string, error) {
	path, err := WorkspacePath(s.Root, issueIdentifier, provider)
	if err != nil {
		return "", err
	}

	if !exists(path) {
		return "", nil
	}

	// Use git to get the diff of changes (including untracked files)
	// We check if it's a git repo first
	if !exists(filepath.Join(path, ".git")) {
		return "", nil
	}

	cmd := exec.Command("git", "diff", "HEAD")
	cmd.Dir = path
	out, err := cmd.CombinedOutput()
	if err != nil {
		// If HEAD doesn't exist yet (new repo), try just git diff
		cmd = exec.Command("git", "diff")
		cmd.Dir = path
		out, err = cmd.CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("git diff failed: %w (output: %s)", err, string(out))
		}
	}

	return string(out), nil
}

func (s Service) timeoutOrDefault() time.Duration {
	if s.HookTimeout <= 0 {
		return 60 * time.Second
	}
	return s.HookTimeout
}

func isNotExist(err error) bool {
	return err != nil && (os.IsNotExist(err) || isPathErrorNotExist(err))
}

func isPathErrorNotExist(err error) bool {
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		return os.IsNotExist(pathErr.Err)
	}
	return false
}

// MarkerPath returns the path to the .orchestra marker file within the given directory.
func MarkerPath(path string) string {
	return filepath.Join(path, ".orchestra")
}
