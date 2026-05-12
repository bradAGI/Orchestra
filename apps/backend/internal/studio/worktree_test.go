package studio

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func initBareRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	must := func(name string, args ...string) {
		cmd := exec.Command(name, args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%s %v: %v\n%s", name, args, err, string(out))
		}
	}
	must("git", "init")
	must("git", "config", "user.email", "test@test")
	must("git", "config", "user.name", "test")
	if err := os.WriteFile(filepath.Join(dir, "README.md"), []byte("hello"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}
	must("git", "add", ".")
	must("git", "commit", "-m", "init")
	return dir
}

func TestCreateReadOnlyWorktree(t *testing.T) {
	repo := initBareRepo(t)
	wt, err := CreateReadOnlyWorktree(repo)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer func() { _ = wt.Cleanup() }()

	info, err := os.Stat(filepath.Join(wt.Path, "README.md"))
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if info.Mode().Perm()&0222 != 0 {
		t.Fatalf("file is writable: %v", info.Mode())
	}
}

func TestWorktreeCleanup(t *testing.T) {
	repo := initBareRepo(t)
	wt, err := CreateReadOnlyWorktree(repo)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	path := wt.Path
	if err := wt.Cleanup(); err != nil {
		t.Fatalf("cleanup: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("worktree still exists: %v", err)
	}
}
