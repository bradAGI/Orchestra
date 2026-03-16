package git

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// ProjectInfo extracts the top-level repository path and the remote origin URL
func ProjectInfo(ctx context.Context, dir string) (rootPath string, remoteURL string, err error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	// 1. Get Top Level Path
	cmdRoot := exec.CommandContext(ctx, "git", "rev-parse", "--show-toplevel")
	cmdRoot.Dir = dir
	var outRoot, errRoot bytes.Buffer
	cmdRoot.Stdout = &outRoot
	cmdRoot.Stderr = &errRoot

	if err := cmdRoot.Run(); err != nil {
		return "", "", fmt.Errorf("git rev-parse failed (not a git repo?): %v - %s", err, errRoot.String())
	}
	rootPath = strings.TrimSpace(outRoot.String())

	// 2. Get Remote Origin URL
	cmdRemote := exec.CommandContext(ctx, "git", "remote", "get-url", "origin")
	cmdRemote.Dir = rootPath
	var outRemote, errRemote bytes.Buffer
	cmdRemote.Stdout = &outRemote
	cmdRemote.Stderr = &errRemote

	if err := cmdRemote.Run(); err != nil {
		// If origin doesn't exist, we just leave remote_url empty instead of failing
		remoteURL = ""
	} else {
		remoteURL = strings.TrimSpace(outRemote.String())
	}

	return rootPath, remoteURL, nil
}

// CurrentBranch returns the current active branch name
func CurrentBranch(ctx context.Context, dir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "branch", "--show-current")
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git branch --show-current failed: %v - %s", err, stderr.String())
	}
	return strings.TrimSpace(stdout.String()), nil
}

// Commit creates a new commit with the given message.
// Stages all changes first (git add -A) then commits.
func Commit(ctx context.Context, dir, message string) error {
	// Stage all changes first
	addCmd := exec.CommandContext(ctx, "git", "add", "-A")
	addCmd.Dir = dir
	if err := addCmd.Run(); err != nil {
		return fmt.Errorf("git add failed: %v", err)
	}
	cmd := exec.CommandContext(ctx, "git", "commit", "-m", message)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git commit failed: %v - %s", err, stderr.String())
	}
	return nil
}

// Push pushes the current branch to the given remote
func Push(ctx context.Context, dir, remote, branch string) error {
	cmd := exec.CommandContext(ctx, "git", "push", remote, branch)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git push failed: %v - %s", err, stderr.String())
	}
	return nil
}

// Pull pulls the given branch from the given remote
func Pull(ctx context.Context, dir, remote, branch string) error {
	cmd := exec.CommandContext(ctx, "git", "pull", remote, branch)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git pull failed: %v - %s", err, stderr.String())
	}
	return nil
}

// CreateBranch creates a new branch
func CreateBranch(ctx context.Context, dir, name string) error {
	cmd := exec.CommandContext(ctx, "git", "checkout", "-b", name)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git checkout -b failed: %v - %s", err, stderr.String())
	}
	return nil
}

// Checkout switches to the given branch
func Checkout(ctx context.Context, dir, branch string) error {
	cmd := exec.CommandContext(ctx, "git", "checkout", branch)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git checkout failed: %v - %s", err, stderr.String())
	}
	return nil
}

// DeleteBranch deletes the given branch
func DeleteBranch(ctx context.Context, dir, name string) error {
	cmd := exec.CommandContext(ctx, "git", "branch", "-d", name)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git branch -d failed: %v - %s", err, stderr.String())
	}
	return nil
}

// Stage adds the given files to the index
func Stage(ctx context.Context, dir string, files []string) error {
	args := append([]string{"add"}, files...)
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git add failed: %v - %s", err, stderr.String())
	}
	return nil
}

// Unstage removes the given files from the index
func Unstage(ctx context.Context, dir string, files []string) error {
	args := append([]string{"reset", "HEAD", "--"}, files...)
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git reset HEAD failed: %v - %s", err, stderr.String())
	}
	return nil
}

// Stash stashes uncommitted changes
func Stash(ctx context.Context, dir string) error {
	cmd := exec.CommandContext(ctx, "git", "stash")
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git stash failed: %v - %s", err, stderr.String())
	}
	return nil
}

// StashPop pops the most recent stash
func StashPop(ctx context.Context, dir string) error {
	cmd := exec.CommandContext(ctx, "git", "stash", "pop")
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git stash pop failed: %v - %s", err, stderr.String())
	}
	return nil
}

// Merge merges the given branch into the current branch with --no-ff
func Merge(ctx context.Context, dir, branch string) error {
	cmd := exec.CommandContext(ctx, "git", "merge", branch, "--no-ff", "-m",
		fmt.Sprintf("Merge branch '%s'", branch))
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git merge failed: %v - %s", err, stderr.String())
	}
	return nil
}

// ParseGitHubRemote extracts owner and repo from a GitHub URL
func ParseGitHubRemote(remoteURL string) (owner string, repo string, ok bool) {
	if remoteURL == "" {
		return "", "", false
	}

	// Remove .git suffix
	remoteURL = strings.TrimSuffix(remoteURL, ".git")

	// Handing SSH: git@github.com:owner/repo
	if strings.HasPrefix(remoteURL, "git@") {
		parts := strings.Split(remoteURL, ":")
		if len(parts) < 2 {
			return "", "", false
		}
		path := parts[len(parts)-1]
		pathParts := strings.Split(path, "/")
		if len(pathParts) < 2 {
			return "", "", false
		}
		return pathParts[0], pathParts[1], true
	}

	// Handling HTTPS: https://github.com/owner/repo
	if strings.Contains(remoteURL, "github.com/") {
		parts := strings.Split(remoteURL, "github.com/")
		if len(parts) < 2 {
			return "", "", false
		}
		path := parts[1]
		pathParts := strings.Split(path, "/")
		if len(pathParts) < 2 {
			return "", "", false
		}
		return pathParts[0], pathParts[1], true
	}

	return "", "", false
}
