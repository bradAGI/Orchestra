# Per-Issue Worktree Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared `project.RootPath` workspace model with per-issue git worktrees so each agent gets an isolated working tree and diffs are scoped to individual issues.

**Architecture:** New git worktree helpers in `utils/git/` provide `WorktreeAdd`, `WorktreeRemove`, `WorktreePrune`. The workspace service gains `EnsureWorktree` and `RemoveWorktree` that wrap these helpers with lifecycle hooks. The dispatch loop in `run.go` creates a worktree per issue instead of using the project root. `GetIssueDiff` uses `base_sha...branch_name` for branch-scoped diffs.

**Tech Stack:** Go 1.25, git CLI (worktree subcommand), SQLite (existing `base_sha`/`branch_name` columns)

**Spec:** `docs/specs/2026-03-20-worktree-isolation-design.md`

---

### Task 1: Add git worktree helpers

**Files:**
- Create: `apps/backend/internal/utils/git/worktree.go`
- Create: `apps/backend/internal/utils/git/worktree_test.go`

- [ ] **Step 1: Write failing tests for WorktreeAdd**

```go
// worktree_test.go
package git

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func initTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v\n%s", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "test@test.com")
	run("config", "user.name", "Test")
	os.WriteFile(filepath.Join(dir, "README.md"), []byte("init"), 0644)
	run("add", ".")
	run("commit", "-m", "initial")
	return dir
}

func TestWorktreeAdd_NewBranch(t *testing.T) {
	repo := initTestRepo(t)
	wtDir := filepath.Join(t.TempDir(), "wt")

	err := WorktreeAdd(context.Background(), repo, wtDir, "feature-x", true)
	if err != nil {
		t.Fatalf("WorktreeAdd failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(wtDir, "README.md")); err != nil {
		t.Fatal("worktree missing README.md")
	}
}

func TestWorktreeAdd_ExistingBranch(t *testing.T) {
	repo := initTestRepo(t)
	// Create branch in main repo
	exec.Command("git", "-C", repo, "branch", "existing-branch").Run()

	wtDir := filepath.Join(t.TempDir(), "wt")
	err := WorktreeAdd(context.Background(), repo, wtDir, "existing-branch", false)
	if err != nil {
		t.Fatalf("WorktreeAdd existing branch failed: %v", err)
	}
}

func TestWorktreeRemove(t *testing.T) {
	repo := initTestRepo(t)
	wtDir := filepath.Join(t.TempDir(), "wt")
	WorktreeAdd(context.Background(), repo, wtDir, "to-remove", true)

	err := WorktreeRemove(context.Background(), repo, wtDir)
	if err != nil {
		t.Fatalf("WorktreeRemove failed: %v", err)
	}

	if _, err := os.Stat(wtDir); !os.IsNotExist(err) {
		t.Fatal("worktree directory should not exist after remove")
	}
}

func TestWorktreePrune(t *testing.T) {
	repo := initTestRepo(t)
	err := WorktreePrune(context.Background(), repo)
	if err != nil {
		t.Fatalf("WorktreePrune failed: %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && go test ./internal/utils/git/ -run TestWorktree -v`
Expected: FAIL — `WorktreeAdd`, `WorktreeRemove`, `WorktreePrune` undefined

- [ ] **Step 3: Implement worktree helpers**

```go
// worktree.go
package git

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// WorktreeAdd creates a git worktree at wtDir for the given branch.
// If newBranch is true, creates a new branch (-b flag).
// If newBranch is false, checks out an existing branch.
func WorktreeAdd(ctx context.Context, repoDir, wtDir, branch string, newBranch bool) error {
	if err := os.MkdirAll(filepath.Dir(wtDir), 0o755); err != nil {
		return fmt.Errorf("create worktree parent: %w", err)
	}

	args := []string{"worktree", "add"}
	if newBranch {
		args = append(args, wtDir, "-b", branch)
	} else {
		args = append(args, wtDir, branch)
	}

	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = repoDir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git worktree add failed: %v - %s", err, stderr.String())
	}
	return nil
}

// WorktreeRemove removes a git worktree. Uses --force to handle locked worktrees
// (e.g., from crashed agents). Returns nil if the worktree doesn't exist.
func WorktreeRemove(ctx context.Context, repoDir, wtDir string) error {
	if _, err := os.Stat(wtDir); os.IsNotExist(err) {
		return nil
	}

	cmd := exec.CommandContext(ctx, "git", "worktree", "remove", "--force", wtDir)
	cmd.Dir = repoDir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git worktree remove failed: %v - %s", err, stderr.String())
	}
	return nil
}

// WorktreePrune removes stale worktree references.
func WorktreePrune(ctx context.Context, repoDir string) error {
	cmd := exec.CommandContext(ctx, "git", "worktree", "prune")
	cmd.Dir = repoDir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git worktree prune failed: %v - %s", err, stderr.String())
	}
	return nil
}

// WorktreeList returns paths of all worktrees for the given repo.
func WorktreeList(ctx context.Context, repoDir string) ([]string, error) {
	cmd := exec.CommandContext(ctx, "git", "worktree", "list", "--porcelain")
	cmd.Dir = repoDir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("git worktree list failed: %v - %s", err, stderr.String())
	}

	var paths []string
	for _, line := range strings.Split(stdout.String(), "\n") {
		if strings.HasPrefix(line, "worktree ") {
			paths = append(paths, strings.TrimPrefix(line, "worktree "))
		}
	}
	return paths, nil
}

// HeadSHA returns the HEAD commit SHA for the given directory.
func HeadSHA(ctx context.Context, dir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "rev-parse", "HEAD")
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git rev-parse HEAD failed: %v - %s", err, stderr.String())
	}
	return strings.TrimSpace(stdout.String()), nil
}

// BranchDiff returns the diff between baseSHA and branch (three-dot diff).
func BranchDiff(ctx context.Context, repoDir, baseSHA, branch string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "diff", baseSHA+"..."+branch)
	cmd.Dir = repoDir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git diff failed: %v - %s", err, stderr.String())
	}
	return stdout.String(), nil
}

// WorktreeDiff returns all uncommitted changes (staged + unstaged) in a worktree.
// Uses "git diff HEAD" which shows everything uncommitted relative to HEAD.
func WorktreeDiff(ctx context.Context, wtDir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "diff", "HEAD")
	cmd.Dir = wtDir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git diff HEAD failed: %v - %s", err, stderr.String())
	}
	return stdout.String(), nil
}

// IsGitRepo checks whether dir contains a .git directory or file (worktree).
func IsGitRepo(dir string) bool {
	info, err := os.Stat(filepath.Join(dir, ".git"))
	return err == nil && (info.IsDir() || info.Mode().IsRegular())
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && go test ./internal/utils/git/ -run TestWorktree -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/utils/git/worktree.go apps/backend/internal/utils/git/worktree_test.go
git commit -m "feat: add git worktree helpers (WorktreeAdd, Remove, Prune, List, BranchDiff)"
```

---

### Task 2: Add WorktreeRoot config field

**Files:**
- Modify: `apps/backend/internal/config/types.go:14-71`
- Modify: `apps/backend/internal/config/load.go`

- [ ] **Step 1: Add WorktreeRoot to Config struct**

In `types.go`, add after the `WorkspaceRoot` field (line 20):

```go
// WorktreeRoot is the directory where per-issue git worktrees are created.
WorktreeRoot string
```

- [ ] **Step 2: Load WorktreeRoot from environment in load.go**

After the `workspaceRoot` line (line 33), add:

```go
worktreeRoot := getenvOrEmpty("ORCHESTRA_WORKTREE_ROOT")
```

In the Config struct initialization, add:

```go
WorktreeRoot: worktreeRoot,
```

After the config is built, add a default if empty:

```go
if cfg.WorktreeRoot == "" {
    cfg.WorktreeRoot = filepath.Join(os.Getenv("HOME"), ".orchestra", "worktrees")
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && go build ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/config/types.go apps/backend/internal/config/load.go
git commit -m "feat: add ORCHESTRA_WORKTREE_ROOT config (default ~/.orchestra/worktrees)"
```

---

### Task 3: Add WorktreePath to RunningEntry

**Files:**
- Modify: `apps/backend/internal/orchestrator/state.go:39-61`

- [ ] **Step 1: Add WorktreePath field to RunningEntry**

After `SessionLogPath` (line 49):

```go
WorktreePath string `json:"worktree_path,omitempty"`
```

- [ ] **Step 2: Verify build**

Run: `cd apps/backend && go build ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/orchestrator/state.go
git commit -m "feat: add WorktreePath to RunningEntry for issue-scoped workspace resolution"
```

---

### Task 4: Replace EnsureIssueWorkspace with EnsureWorktree in workspace service

**Files:**
- Modify: `apps/backend/internal/workspace/service.go`
- Create: `apps/backend/internal/workspace/service_test.go`

- [ ] **Step 1: Write failing test for EnsureWorktree**

```go
// service_test.go
package workspace

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func initTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "test@test.com")
	run("config", "user.name", "Test")
	os.WriteFile(filepath.Join(dir, "README.md"), []byte("init"), 0644)
	run("add", ".")
	run("commit", "-m", "initial")
	return dir
}

func TestEnsureWorktree_CreatesNewWorktree(t *testing.T) {
	repo := initTestRepo(t)
	svc := Service{Root: t.TempDir()}

	wtPath, baseSHA, created, err := svc.EnsureWorktree(repo, "proj-1", "feature-x", Hooks{})
	if err != nil {
		t.Fatalf("EnsureWorktree: %v", err)
	}
	if !created {
		t.Fatal("expected created=true")
	}
	if baseSHA == "" {
		t.Fatal("expected non-empty baseSHA")
	}
	if _, err := os.Stat(filepath.Join(wtPath, "README.md")); err != nil {
		t.Fatal("worktree missing README.md")
	}
}

func TestEnsureWorktree_ReusesExisting(t *testing.T) {
	repo := initTestRepo(t)
	svc := Service{Root: t.TempDir()}

	path1, _, _, _ := svc.EnsureWorktree(repo, "proj-1", "reuse-branch", Hooks{})
	path2, _, created, _ := svc.EnsureWorktree(repo, "proj-1", "reuse-branch", Hooks{})

	if created {
		t.Fatal("expected created=false on reuse")
	}
	if path1 != path2 {
		t.Fatalf("paths differ: %s vs %s", path1, path2)
	}
}

func TestRemoveWorktree(t *testing.T) {
	repo := initTestRepo(t)
	svc := Service{Root: t.TempDir()}

	wtPath, _, _, _ := svc.EnsureWorktree(repo, "proj-1", "to-remove", Hooks{})
	err := svc.RemoveWorktree(repo, wtPath)
	if err != nil {
		t.Fatalf("RemoveWorktree: %v", err)
	}
	if _, err := os.Stat(wtPath); !os.IsNotExist(err) {
		t.Fatal("worktree should be removed")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && go test ./internal/workspace/ -run TestEnsureWorktree -v`
Expected: FAIL — `EnsureWorktree`, `RemoveWorktree` undefined

- [ ] **Step 3: Implement EnsureWorktree and RemoveWorktree**

Add to `service.go` (keep existing hook methods, remove `EnsureIssueWorkspace` and `RemoveIssueWorkspaces`):

```go
// EnsureWorktree creates or reuses a git worktree for the given project and branch.
// Returns the worktree path, the base SHA captured at creation, whether a new
// worktree was created, and any error.
func (s Service) EnsureWorktree(projectRoot, projectID, branchName string, hooks Hooks) (string, string, bool, error) {
	wtPath := filepath.Join(s.Root, projectID, branchName)

	// Reuse existing worktree
	if info, err := os.Stat(wtPath); err == nil && info.IsDir() {
		return wtPath, "", false, nil
	}

	// Capture base SHA before creating worktree
	baseSHA, err := git.HeadSHA(context.Background(), projectRoot)
	if err != nil {
		return "", "", false, fmt.Errorf("capture base SHA: %w", err)
	}

	// Try creating new branch
	err = git.WorktreeAdd(context.Background(), projectRoot, wtPath, branchName, true)
	if err != nil {
		// Branch may already exist — try checking out existing
		err2 := git.WorktreeAdd(context.Background(), projectRoot, wtPath, branchName, false)
		if err2 != nil {
			return "", "", false, fmt.Errorf("worktree add failed: new=%v, existing=%v", err, err2)
		}
	}

	// Run after_create hook if configured
	if hooks.AfterCreate != "" {
		if _, hookErr := RunHook("after_create", hooks.AfterCreate, wtPath, s.timeoutOrDefault()); hookErr != nil {
			// Hook failure should not block — log and continue
			fmt.Fprintf(os.Stderr, "WARN: after_create hook failed for %s: %v\n", wtPath, hookErr)
		}
	}

	return wtPath, baseSHA, true, nil
}

// RemoveWorktree removes a git worktree, running the before_remove hook first.
func (s Service) RemoveWorktree(projectRoot, wtPath string, hooks Hooks) error {
	if !exists(wtPath) {
		return nil
	}

	if hooks.BeforeRemove != "" {
		if _, err := RunHook("before_remove", hooks.BeforeRemove, wtPath, s.timeoutOrDefault()); err != nil {
			fmt.Fprintf(os.Stderr, "WARN: before_remove hook failed for %s: %v\n", wtPath, err)
		}
	}

	return git.WorktreeRemove(context.Background(), projectRoot, wtPath)
}

// PruneWorktrees cleans up stale worktree references for the given project repo.
func (s Service) PruneWorktrees(projectRoot string) error {
	return git.WorktreePrune(context.Background(), projectRoot)
}

// WorktreePath returns the deterministic worktree path for a project and branch.
func (s Service) WorktreePath(projectID, branchName string) string {
	return filepath.Join(s.Root, projectID, branchName)
}
```

Add the import for the git package at the top:
```go
import (
	"context"
	// ... existing imports ...
	"github.com/orchestra/orchestra/apps/backend/internal/utils/git"
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && go test ./internal/workspace/ -run "TestEnsureWorktree|TestRemoveWorktree" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/workspace/service.go apps/backend/internal/workspace/service_test.go
git commit -m "feat: add EnsureWorktree/RemoveWorktree to workspace service"
```

---

### Task 5: Wire WorktreeRoot into workspace Service and API Server

**Files:**
- Modify: `apps/backend/internal/app/run.go` (Service initialization)
- Modify: `apps/backend/internal/api/router.go` (Server struct)

- [ ] **Step 1: Update workspace.Service initialization in run.go**

Find where `workspace.Service{Root: ...}` is constructed. Change `Root` from `config.WorkspaceRoot` to `config.WorktreeRoot`.

- [ ] **Step 2: Add worktreeRoot to API Server struct**

In `router.go`, add `worktreeRoot string` to the `Server` struct. Wire it from `config.WorktreeRoot` during `NewServer` initialization. This is needed by `GetIssueDiff` (Task 6) and `PatchIssue` (Task 8).

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && go build ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/app/run.go apps/backend/internal/api/router.go
git commit -m "feat: wire WorktreeRoot config into workspace service and API server"
```

---

### Task 6: Rewrite GetIssueDiff to use branch-scoped diffs

**Files:**
- Modify: `apps/backend/internal/api/state.go:587-665`

- [ ] **Step 1: Write failing test for branch-scoped diff**

Create `apps/backend/internal/api/state_diff_test.go`:

```go
package api

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	gitutil "github.com/orchestra/orchestra/apps/backend/internal/utils/git"
)

func initDiffTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "test@test.com")
	run("config", "user.name", "Test")
	os.WriteFile(filepath.Join(dir, "base.txt"), []byte("base content"), 0644)
	run("add", ".")
	run("commit", "-m", "initial")
	return dir
}

func TestBranchDiff_OnlyShowsBranchChanges(t *testing.T) {
	repo := initDiffTestRepo(t)
	ctx := context.Background()

	// Capture base SHA
	baseSHA, err := gitutil.HeadSHA(ctx, repo)
	if err != nil {
		t.Fatal(err)
	}

	// Create worktree with branch
	wtDir := filepath.Join(t.TempDir(), "wt")
	if err := gitutil.WorktreeAdd(ctx, repo, wtDir, "feature-x", true); err != nil {
		t.Fatal(err)
	}

	// Make a change in the worktree and commit
	os.WriteFile(filepath.Join(wtDir, "feature.txt"), []byte("new feature"), 0644)
	exec.Command("git", "-C", wtDir, "add", ".").Run()
	exec.Command("git", "-C", wtDir, "commit", "-m", "add feature").Run()

	// Make a DIFFERENT change on main (should NOT appear in branch diff)
	os.WriteFile(filepath.Join(repo, "main-only.txt"), []byte("main change"), 0644)
	exec.Command("git", "-C", repo, "add", ".").Run()
	exec.Command("git", "-C", repo, "commit", "-m", "main change").Run()

	// Branch diff should only show feature.txt, not main-only.txt
	diff, err := gitutil.BranchDiff(ctx, repo, baseSHA, "feature-x")
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(diff, "feature.txt") {
		t.Error("diff should contain feature.txt")
	}
	if strings.Contains(diff, "main-only.txt") {
		t.Error("diff should NOT contain main-only.txt")
	}
}

func TestBranchDiff_IncludesUncommittedWorktreeChanges(t *testing.T) {
	repo := initDiffTestRepo(t)
	ctx := context.Background()

	baseSHA, _ := gitutil.HeadSHA(ctx, repo)
	wtDir := filepath.Join(t.TempDir(), "wt")
	gitutil.WorktreeAdd(ctx, repo, wtDir, "wip-branch", true)

	// Uncommitted change in worktree
	os.WriteFile(filepath.Join(wtDir, "wip.txt"), []byte("work in progress"), 0644)

	// WorktreeDiff should show the uncommitted file
	wtDiff, err := gitutil.WorktreeDiff(ctx, wtDir)
	if err != nil {
		t.Fatal(err)
	}

	// BranchDiff shows nothing (no commits on branch yet)
	branchDiff, _ := gitutil.BranchDiff(ctx, repo, baseSHA, "wip-branch")

	combined := branchDiff + wtDiff
	if !strings.Contains(combined, "wip.txt") {
		t.Error("combined diff should contain uncommitted wip.txt")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && go test ./internal/api/ -run "TestBranchDiff" -v`
Expected: FAIL — `BranchDiff`, `WorktreeDiff`, `HeadSHA` may not exist yet (depends on Task 1 completion)

- [ ] **Step 3: Rewrite GetIssueDiff**

Replace the body of `GetIssueDiff` (`state.go:587-665`) with:

```go
func (s *Server) GetIssueDiff(w http.ResponseWriter, r *http.Request) {
	identifier := chi.URLParam(r, "issue_identifier")

	// Look up issue for base_sha and branch_name
	issue, err := s.tracker.FetchIssueByIdentifier(r.Context(), identifier)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "issue_not_found", "issue not found")
		return
	}

	// Look up project for RootPath
	if issue.ProjectID == "" {
		writeJSONError(w, http.StatusBadRequest, "no_project", "issue has no project")
		return
	}
	project, err := s.db.GetProjectByID(r.Context(), issue.ProjectID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "project_lookup_failed", "failed to look up project")
		return
	}

	baseSHA := issue.BaseSHA
	branchName := issue.BranchName

	var allDiff string

	if baseSHA != "" && branchName != "" {
		// Branch-scoped diff: committed changes since base_sha
		branchDiff, err := gitutil.BranchDiff(r.Context(), project.RootPath, baseSHA, branchName)
		if err != nil {
			s.logger.Warn().Err(err).Msg("branch diff failed, falling back to legacy")
			allDiff = s.legacyDiff(r.Context(), project.RootPath)
		} else {
			allDiff = branchDiff
		}

		// Add uncommitted changes from worktree if it exists
		wtPath := filepath.Join(s.worktreeRoot, project.ID, branchName)
		if _, statErr := os.Stat(wtPath); statErr == nil {
			wtDiff, err := gitutil.WorktreeDiff(r.Context(), wtPath)
			if err == nil {
				allDiff += wtDiff
			}
		}
	} else {
		// Legacy fallback for issues without base_sha/branch_name
		allDiff = s.legacyDiff(r.Context(), project.RootPath)
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(allDiff))
}

// legacyDiff preserves the old behavior for issues created before worktree isolation.
func (s *Server) legacyDiff(ctx context.Context, repoDir string) string {
	// ... move current GetIssueDiff git commands here ...
}
```

Note: `s.worktreeRoot` needs to be added to the `Server` struct, wired from `config.WorktreeRoot` during initialization.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && go test ./internal/api/ -run "TestBranchDiff" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/api/state.go apps/backend/internal/api/state_diff_test.go
git commit -m "fix: scope GetIssueDiff to issue branch using base_sha...branch_name"
```

---

### Task 7: Replace workspace selection in dispatch loop

**Files:**
- Modify: `apps/backend/internal/app/run.go:290-404`

- [ ] **Step 1: Replace workspace selection block (lines 290-316)**

Replace the `if entry.ProjectID != ""` block that sets `workspacePath = project.RootPath` with:

1. Require project — if no ProjectID or invalid RootPath, move to error state
2. Validate `RootPath` is a git repo (contains `.git` directory, not IS `.git`)
3. Compute branch name from issue identifier
4. Call `workspaceService.EnsureWorktree(project.RootPath, project.ID, branchName, hooks)`
5. Set `workspacePath` to the returned worktree path
6. Store `base_sha` and `branch_name` on the issue if newly created

- [ ] **Step 2: Remove the old branch creation block (lines 374-404)**

The old code that does `git rev-parse HEAD`, `gitutil.CreateBranch`, `gitutil.Checkout` is replaced by `EnsureWorktree` which handles all of this.

- [ ] **Step 3: Set WorktreePath on RunningEntry**

When populating the RunningEntry in the orchestrator, set `WorktreePath` to the worktree path so `GetIssueDiff` and terminal can find it.

- [ ] **Step 4: Verify build and existing tests**

Run: `cd apps/backend && go build ./cmd/orchestrad/ && go test ./internal/app/ -v`
Expected: compiles clean, tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/app/run.go
git commit -m "feat: dispatch agents into per-issue git worktrees instead of project root"
```

---

### Task 8: Update PatchIssue auto-commit to use worktree path

**Files:**
- Modify: `apps/backend/internal/api/state.go:451-461`

- [ ] **Step 1: Update auto-commit path resolution**

The current code runs `git.Commit` against `project.RootPath`. Change it to:

1. Look up the issue's `branch_name` and `project_id`
2. Compute worktree path: `{WorktreeRoot}/{project.ID}/{branch_name}`
3. If worktree exists, run `git.Commit` against it
4. If no worktree (legacy), fall back to `project.RootPath`

- [ ] **Step 2: Verify build**

Run: `cd apps/backend && go build ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/api/state.go
git commit -m "fix: auto-commit on state change targets worktree, not project root"
```

---

### Task 9: Update post-completion diff stats in run.go

**Files:**
- Modify: `apps/backend/internal/app/run.go:751-773`

- [ ] **Step 1: Update diff stats gathering**

After agent run completes, diff stats are gathered from `project.RootPath`. Change to use `git.BranchDiff(ctx, project.RootPath, baseSHA, branchName)` or run diff commands against the worktree path (which is still available at this point).

- [ ] **Step 2: Verify build**

Run: `cd apps/backend && go build ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/app/run.go
git commit -m "fix: post-completion diff stats use worktree, not project root"
```

---

### Task 10: Update terminal CWD resolution

**Files:**
- Modify: `apps/backend/internal/api/terminal.go:34`

- [ ] **Step 1: Update terminal directory**

The terminal WebSocket handler sets `dir = project.RootPath`. When the terminal is opened for an issue-scoped session, resolve the worktree path from the issue's `project_id` + `branch_name` and use that as the CWD.

If no worktree exists (project-level terminal, not issue-scoped), keep `project.RootPath`.

- [ ] **Step 2: Verify build**

Run: `cd apps/backend && go build ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/api/terminal.go
git commit -m "fix: terminal CWD uses worktree path for issue-scoped sessions"
```

---

### Task 11: Update cleanup and garbage collection

**Files:**
- Modify: `apps/backend/internal/app/run.go:882-931`

- [ ] **Step 1: Replace cleanupTerminalWorkspaces (lines 882-900)**

Replace `workspaceService.RemoveIssueWorkspaces(...)` calls with:

1. Compute worktree path from issue `project_id` + `branch_name`
2. Look up project to get `RootPath`
3. Call `workspaceService.RemoveWorktree(project.RootPath, wtPath, hooks)`
4. If issue is being deleted, also force-delete the branch: `git branch -D {branchName}` (use `-D` not `-d` since the branch may have unmerged commits). Add a `ForceDeleteBranch` helper to `worktree.go` for this.

- [ ] **Step 2: Replace startGarbageCollector (lines 902-931)**

Instead of scanning `WorkspaceRoot` for orphaned directories, scan `WorktreeRoot`. For each project directory found:

1. Get the project's `RootPath` from the database
2. Call `workspaceService.PruneWorktrees(project.RootPath)`

- [ ] **Step 3: Add startup pruning in app/run.go Run()**

Near the start of `Run()`, after database initialization, iterate all known projects and call `PruneWorktrees` for each to clean stale references from previous crashes.

- [ ] **Step 4: Verify build**

Run: `cd apps/backend && go build ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/app/run.go
git commit -m "feat: cleanup and GC use worktree remove/prune instead of workspace removal"
```

---

### Task 12: Remove dead code

**Files:**
- Modify: `apps/backend/internal/workspace/service.go`

- [ ] **Step 1: Remove EnsureIssueWorkspace and RemoveIssueWorkspaces**

Delete the `EnsureIssueWorkspace` function (lines 29-72) and `RemoveIssueWorkspaces` function (lines 74-106). Also remove `WorkspacePath` helper from `path_guard.go` if it's only used by the removed functions.

- [ ] **Step 2: Remove GetDiff from service.go**

Delete the `GetDiff` method (lines 182-214) — diff calculation is now in the API layer using `git.BranchDiff`.

- [ ] **Step 3: Verify build and tests**

Run: `cd apps/backend && go build ./cmd/orchestrad/ && go test ./... 2>&1 | tail -20`
Expected: compiles clean, all tests pass. Fix any compilation errors from callers that referenced removed functions.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/workspace/
git commit -m "refactor: remove EnsureIssueWorkspace and legacy workspace code"
```

---

### Task 13: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd apps/backend && go test -race ./...`
Expected: all tests pass, no race conditions

- [ ] **Step 2: Build binary**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 3: Run desktop tests**

Run: `cd apps/desktop && npx vitest run`
Expected: all 84+ tests pass (no frontend changes, but verify nothing broke)

- [ ] **Step 4: Commit**

No commit needed — verification only.
