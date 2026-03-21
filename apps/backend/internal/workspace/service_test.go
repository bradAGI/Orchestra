package workspace

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// initTestRepo creates a temp dir with a git repo containing one commit.
func initTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	for _, args := range [][]string{
		{"git", "init"},
		{"git", "config", "user.email", "test@test.com"},
		{"git", "config", "user.name", "Test"},
	} {
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v failed: %v\n%s", args, err, out)
		}
	}
	// Create a file and commit it
	if err := os.WriteFile(filepath.Join(dir, "README"), []byte("init"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{
		{"git", "add", "."},
		{"git", "commit", "-m", "initial"},
	} {
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v failed: %v\n%s", args, err, out)
		}
	}
	return dir
}

func TestEnsureWorktree_CreatesNewWorktree(t *testing.T) {
	repo := initTestRepo(t)
	root := t.TempDir()
	svc := Service{Root: root}

	wtPath, baseSHA, created, err := svc.EnsureWorktree(repo, "proj1", "feature-a", Hooks{})
	if err != nil {
		t.Fatalf("EnsureWorktree: %v", err)
	}
	if !created {
		t.Fatal("expected created=true for new worktree")
	}
	if baseSHA == "" {
		t.Fatal("expected non-empty baseSHA")
	}
	if _, err := os.Stat(wtPath); err != nil {
		t.Fatalf("worktree path should exist: %v", err)
	}
	expected := filepath.Join(root, "proj1", "feature-a")
	if wtPath != expected {
		t.Fatalf("expected path %s, got %s", expected, wtPath)
	}
}

func TestEnsureWorktree_ReusesExisting(t *testing.T) {
	repo := initTestRepo(t)
	root := t.TempDir()
	svc := Service{Root: root}

	_, _, created1, err := svc.EnsureWorktree(repo, "proj1", "feature-b", Hooks{})
	if err != nil {
		t.Fatalf("first EnsureWorktree: %v", err)
	}
	if !created1 {
		t.Fatal("expected first call to create")
	}

	wtPath2, baseSHA2, created2, err := svc.EnsureWorktree(repo, "proj1", "feature-b", Hooks{})
	if err != nil {
		t.Fatalf("second EnsureWorktree: %v", err)
	}
	if created2 {
		t.Fatal("expected second call to reuse, got created=true")
	}
	if baseSHA2 != "" {
		t.Fatalf("expected empty baseSHA on reuse, got %q", baseSHA2)
	}
	expected := filepath.Join(root, "proj1", "feature-b")
	if wtPath2 != expected {
		t.Fatalf("expected path %s, got %s", expected, wtPath2)
	}
}

func TestRemoveWorktree(t *testing.T) {
	repo := initTestRepo(t)
	root := t.TempDir()
	svc := Service{Root: root}

	wtPath, _, _, err := svc.EnsureWorktree(repo, "proj1", "feature-rm", Hooks{})
	if err != nil {
		t.Fatalf("EnsureWorktree: %v", err)
	}

	if err := svc.RemoveWorktree(repo, wtPath, Hooks{}); err != nil {
		t.Fatalf("RemoveWorktree: %v", err)
	}

	if _, err := os.Stat(wtPath); !os.IsNotExist(err) {
		t.Fatalf("expected worktree removed, stat err=%v", err)
	}
}

func TestWorktreePath(t *testing.T) {
	svc := Service{Root: "/tmp/worktrees"}
	got := svc.WorktreePath("myproject", "fix-123")
	want := "/tmp/worktrees/myproject/fix-123"
	if got != want {
		t.Fatalf("WorktreePath = %q, want %q", got, want)
	}
}

func TestEnsureIssueWorkspaceCreatesAndRunsAfterCreateOnce(t *testing.T) {
	root := t.TempDir()
	service := Service{Root: root, HookTimeout: 2 * time.Second}

	workspacePath, created, _, err := service.EnsureIssueWorkspace("MT-101", "codex", Hooks{AfterCreate: "echo hello > created.txt"})
	if err != nil {
		t.Fatalf("expected workspace creation success, got err=%v", err)
	}
	if !created {
		t.Fatalf("expected first ensure to create workspace")
	}

	content, err := os.ReadFile(filepath.Join(workspacePath, "created.txt"))
	if err != nil {
		t.Fatalf("expected hook output file: %v", err)
	}
	if string(content) != "hello\n" {
		t.Fatalf("unexpected hook output: %q", string(content))
	}

	if _, secondCreated, _, err := service.EnsureIssueWorkspace("MT-101", "codex", Hooks{AfterCreate: "echo nope > created.txt"}); err != nil {
		t.Fatalf("expected second ensure success, got err=%v", err)
	} else if secondCreated {
		t.Fatalf("expected second ensure not to recreate workspace")
	}

	content, err = os.ReadFile(filepath.Join(workspacePath, "created.txt"))
	if err != nil {
		t.Fatalf("expected hook output file on second check: %v", err)
	}
	if string(content) != "hello\n" {
		t.Fatalf("expected original hook output to remain, got=%q", string(content))
	}
}

func TestEnsureIssueWorkspaceReplacesStaleFilePath(t *testing.T) {
	root := t.TempDir()
	service := Service{Root: root}

	stalePath, err := WorkspacePath(root, "MT-201", "codex")
	if err != nil {
		t.Fatalf("expected workspace path, got err=%v", err)
	}

	if err := os.WriteFile(stalePath, []byte("stale"), 0o644); err != nil {
		t.Fatalf("write stale file: %v", err)
	}

	workspacePath, created, _, err := service.EnsureIssueWorkspace("MT-201", "codex", Hooks{})
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}
	if !created {
		t.Fatalf("expected stale file replacement to count as created")
	}
	if workspacePath != stalePath {
		t.Fatalf("expected same path reused, got=%s want=%s", workspacePath, stalePath)
	}

	info, err := os.Stat(workspacePath)
	if err != nil {
		t.Fatalf("stat workspace: %v", err)
	}
	if !info.IsDir() {
		t.Fatalf("expected workspace to be directory")
	}
}

func TestRemoveIssueWorkspacesContinuesWhenBeforeRemoveFails(t *testing.T) {
	root := t.TempDir()
	service := Service{Root: root, HookTimeout: 2 * time.Second}

	workspacePath, _, _, err := service.EnsureIssueWorkspace("MT-301", "codex", Hooks{})
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}

	err = service.RemoveIssueWorkspaces("MT-301", "codex", Hooks{BeforeRemove: "echo fail && exit 17"})
	if err != nil {
		t.Fatalf("expected remove workspace success despite hook failure, got err=%v", err)
	}

	if _, statErr := os.Stat(workspacePath); !os.IsNotExist(statErr) {
		t.Fatalf("expected workspace removed, statErr=%v", statErr)
	}
}

func TestRemoveIssueWorkspacesRunsBeforeRemoveHook(t *testing.T) {
	root := t.TempDir()
	service := Service{Root: root, HookTimeout: 2 * time.Second}

	workspacePath, _, _, err := service.EnsureIssueWorkspace("MT-401", "codex", Hooks{})
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}

	marker := filepath.Join(root, "before-remove.txt")
	script := "echo ran > \"" + marker + "\""
	err = service.RemoveIssueWorkspaces("MT-401", "codex", Hooks{BeforeRemove: script})
	if err != nil {
		t.Fatalf("expected remove workspace success, got err=%v", err)
	}

	if _, statErr := os.Stat(workspacePath); !os.IsNotExist(statErr) {
		t.Fatalf("expected workspace removed, statErr=%v", statErr)
	}

	content, readErr := os.ReadFile(marker)
	if readErr != nil {
		t.Fatalf("expected marker file from before_remove hook: %v", readErr)
	}
	if string(content) != "ran\n" {
		t.Fatalf("unexpected marker content: %q", string(content))
	}
}

func TestRunBeforeRunHookReturnsErrorOnFailure(t *testing.T) {
	root := t.TempDir()
	service := Service{Root: root, HookTimeout: 2 * time.Second}

	workspacePath, _, _, err := service.EnsureIssueWorkspace("MT-501", "codex", Hooks{})
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}

	_, err = service.RunBeforeRunHook(workspacePath, Hooks{BeforeRun: "exit 23"})
	if err == nil {
		t.Fatalf("expected before_run hook error")
	}
}

func TestRunAfterRunHookIgnoresFailureButRunsHook(t *testing.T) {
	root := t.TempDir()
	service := Service{Root: root, HookTimeout: 2 * time.Second}

	workspacePath, _, _, err := service.EnsureIssueWorkspace("MT-601", "codex", Hooks{})
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}

	marker := filepath.Join(root, "after-run.txt")
	_, err = service.RunAfterRunHook(workspacePath, Hooks{AfterRun: "echo ran > \"" + marker + "\"; exit 17"})
	if err != nil {
		t.Fatalf("expected after_run hook failure to be ignored, got err=%v", err)
	}

	content, readErr := os.ReadFile(marker)
	if readErr != nil {
		t.Fatalf("expected marker file from after_run hook: %v", readErr)
	}
	if string(content) != "ran\n" {
		t.Fatalf("unexpected marker content: %q", string(content))
	}
}

func TestRemoveIssueWorkspacesNoopForEmptyIdentifier(t *testing.T) {
	service := Service{Root: t.TempDir(), HookTimeout: 2 * time.Second}
	if err := service.RemoveIssueWorkspaces("", "codex", Hooks{BeforeRemove: "exit 1"}); err != nil {
		t.Fatalf("expected empty identifier remove to be no-op, got err=%v", err)
	}
}

func TestRemoveIssueWorkspacesNoopWhenWorkspaceMissing(t *testing.T) {
	root := t.TempDir()
	service := Service{Root: root, HookTimeout: 2 * time.Second}

	marker := filepath.Join(root, "before-remove-should-not-run.txt")
	err := service.RemoveIssueWorkspaces("MT-999", "codex", Hooks{BeforeRemove: "echo ran > \"" + marker + "\""})
	if err != nil {
		t.Fatalf("expected missing workspace remove to be no-op, got err=%v", err)
	}
	if _, statErr := os.Stat(marker); !os.IsNotExist(statErr) {
		t.Fatalf("expected before_remove hook not to run for missing workspace, statErr=%v", statErr)
	}
}
