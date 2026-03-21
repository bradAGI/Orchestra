# Per-Issue Worktree Isolation

**Date:** 2026-03-20
**Issue:** [#63](https://github.com/Traves-Theberge/Orchestra/issues/63)
**Status:** Design

## Problem

Agents share a single working tree (`project.RootPath`) for all issues in a project. This causes three defects:

1. **GetIssueDiff shows all project changes** — the endpoint runs `git diff` against the shared directory, so every issue's Changes tab shows changes from every agent.
2. **Concurrent agents corrupt each other** — two agents checking out different branches in the same directory race on the working tree.
3. **base_sha is captured but never used** — the diff anchor point is stored in the database but `GetIssueDiff` ignores it.

## Solution

Use git worktrees to give each issue its own isolated working tree backed by the project's shared `.git` directory. Fix `GetIssueDiff` to compute diffs using `base_sha` and `branch_name` instead of scanning the shared project root.

## Design

### Workspace Model

Every agent execution creates a git worktree from the project's repo:

```
~/.orchestra/worktrees/{project-id}/{branch-name}/
```

The branch name is derived from the issue identifier (kebab-case, lowercase) — same as today. Creation:

```bash
# New branch
git worktree add ~/.orchestra/worktrees/{project-id}/{branch-name} -b {branch-name}

# Existing branch (retry/re-run)
git worktree add ~/.orchestra/worktrees/{project-id}/{branch-name} {branch-name}
```

The project's `RootPath` is never used as an agent workspace. It remains the source repo that worktrees are created from.

`base_sha` is captured from the project repo's HEAD before worktree creation.

Worktrees persist until the issue reaches a terminal state (Done, Cancelled) or is deleted. Cleanup runs `git worktree remove`. If uncommitted changes exist, cleanup logs a warning and leaves the worktree intact. If a `.lock` file exists (crashed agent), remove the lock before attempting cleanup.

Issues are always tied to a project — dispatch requires a project with a valid git repo. Issues without a project are not dispatchable. This is a **breaking change** — any existing workflow that dispatches issues without a project association will see those issues move to error state instead of executing.

**Worktree path is deterministic**: `{WorktreeRoot}/{project.ID}/{branch-name}`. This means the path can be recomputed from the issue's `project_id` and `branch_name` without storing it in the database. If orchestrad restarts mid-run, the worktree is rediscovered.

**Disk cost**: each worktree is a full working copy minus `.git` objects (which are shared). For a 100MB repo, expect ~100MB per concurrent worktree. No disk quota enforced — noted as a future concern for large fleets.

### Diff Calculation

`GetIssueDiff` reads `issue.base_sha` and `issue.branch_name` from the database and computes:

```bash
# Committed changes on the branch since it was created
git diff {base_sha}...{branch_name}
```

Three-dot diff: shows only commits reachable from `branch_name` that aren't reachable from `base_sha`. Note: if the main branch advances and someone rebases, the merge-base shifts. This is an inherent limitation of three-dot diff, not a defect.

For running issues with potential uncommitted work, the endpoint also includes changes from the worktree:

```bash
# Staged changes in worktree
git -C {worktree_path} diff --cached

# Unstaged changes in worktree
git -C {worktree_path} diff HEAD
```

All three outputs are concatenated in the response. The frontend `parseDiff` requires no changes — the backend now returns only the correct files.

If `base_sha` or `branch_name` is missing (legacy issues), fall back to current behavior as a degraded path.

### Dispatch Flow

`run.go` `processExecutionTick` changes:

1. **Require project** — if `entry.ProjectID` is empty or the project has no valid `RootPath` with a `.git` directory (not a bare repo — validate `RootPath` contains `.git`, not IS `.git`), log an error and move the issue to error state.

2. **Create worktree** — replace `workspacePath = project.RootPath` and the branch creation block:
   - Compute `worktreePath = {WorktreeRoot}/{project.ID}/{branch-name}`
   - If worktree doesn't exist: capture `base_sha` from project repo HEAD, run `git worktree add`, store `base_sha` and `branch_name` on the issue.
   - If worktree already exists (re-run): reuse it.
   - If `git worktree add` fails because another worktree has the same branch checked out (branch name collision), append a short suffix and retry.

3. **Run agent in worktree** — `workspacePath` points to the worktree, not `project.RootPath`.

4. **Remove EnsureIssueWorkspace** — no longer called. Replaced by worktree logic.

5. **Cleanup on terminal state** — when an issue moves to Done/Cancelled/Deleted:
   - Remove `.lock` files if present (crashed agent).
   - Run `git worktree remove {path}`.
   - If the issue is deleted, also delete the branch. Otherwise keep the branch for merge/PR.

No additional per-project locking — worktrees are isolated, and the orchestrator's existing `MaxConcurrent` controls concurrency.

### Issue-Scoped Code Paths Using project.RootPath

The following code paths currently use `project.RootPath` in an issue-scoped context and must be updated to use the worktree path:

| Code path | File | Lines | Change |
|-----------|------|-------|--------|
| **PatchIssue auto-commit** | `state.go` | 451-461 | When issue moves to Review/Done, `git.Commit` runs against `project.RootPath`. Must run against the worktree path instead. Resolve worktree path from issue's `project_id` + `branch_name`. |
| **Post-completion diff stats** | `run.go` | 751-773 | After agent run, diff stats and changed file lists are gathered from `project.RootPath`. Must use `git diff base_sha...branch_name` or run against the worktree. |
| **Terminal WebSocket** | `terminal.go` | 34 | Sets `dir = project.RootPath` as terminal CWD. For issue-scoped terminals, should point to the worktree. |
| **cleanupTerminalWorkspaces** | `run.go` | 882-900 | Calls `workspaceService.RemoveIssueWorkspaces`. Must be replaced with `git worktree remove` + `git worktree prune`. |
| **startGarbageCollector** | `run.go` | 902-931 | Reads workspace root to find orphans. Must scan `WorktreeRoot` instead. |

### Project-Level Code Paths (No Changes)

These code paths use `project.RootPath` for project-level operations (not issue-scoped) and remain unchanged:

| Code path | File | Why unchanged |
|-----------|------|---------------|
| `projects.go` git operations (commit, push, pull, checkout, merge, branch, stage, unstage, stash) | `api/projects.go` | User-initiated project operations via UI, not agent workspace |
| Agent config lookups (`.mcp.json`, per-project CLAUDE.md) | `provider_config.go`, `provider_mcp.go` | Project-level config, not issue workspace |
| `GetIssue` log path resolution | `state.go:262-264` | Agent session logs are stored by the agent runner at the workspace path it receives — this already points to the worktree after the dispatch change |

### Validation and Error Handling

**Dispatch-time:**
- Project must exist with a valid `RootPath` containing a `.git` directory (not a bare repo).
- If `git worktree add` fails (disk, permissions, detached HEAD), move issue to error state with descriptive message.
- If branch name conflicts with an existing worktree on the same branch, append a suffix and retry once.

**Cleanup failures:**
- Remove `.lock` files from `.git/worktrees/{name}/locked` before attempting `git worktree remove`.
- `git worktree remove` fails on uncommitted changes: log warning, leave worktree intact.
- On startup, run `git worktree prune` for each known project to clean stale references.

**Legacy issues:**
- Existing issues with `base_sha`/`branch_name` from the old model continue to work — `GetIssueDiff` falls back to current behavior when no worktree exists at the computed path.
- No data migration required.

### Out of Scope

- Merge conflict detection between concurrent issues (parallel branches, resolve at merge time).
- Worktree disk quota or limits (noted as future concern).
- Frontend changes to `parseDiff` — backend returns correct data.
- PR creation flow changes (covered by #62).
- Submodule support — worktrees do not auto-initialize submodules. Projects with submodules will have empty submodule directories in worktrees.

## Files Changed

| File | Change |
|------|--------|
| `apps/backend/internal/app/run.go` | Replace workspace selection + branch creation with worktree creation (lines 290-404). Update post-completion diff stats (lines 751-773). Update `cleanupTerminalWorkspaces` (lines 882-900). Update `startGarbageCollector` (lines 902-931). Remove `EnsureIssueWorkspace` call. Require project with git repo. |
| `apps/backend/internal/api/state.go` | Rewrite `GetIssueDiff` (lines 587-665) to use `base_sha...branch_name` + worktree uncommitted changes. Update `PatchIssue` auto-commit (lines 451-461) to resolve worktree path. |
| `apps/backend/internal/api/terminal.go` | Update terminal CWD resolution (line 34) to use worktree path for issue-scoped sessions. |
| `apps/backend/internal/workspace/service.go` | Replace `EnsureIssueWorkspace` with `EnsureWorktree(projectRoot, projectID, branchName)` and `RemoveWorktree`. Add `PruneWorktrees` for startup cleanup. |
| `apps/backend/internal/utils/git/git.go` | Add `WorktreeAdd`, `WorktreeRemove`, `WorktreePrune`, `WorktreeList` helpers. |
| `apps/backend/internal/orchestrator/state.go` | Store worktree path on running entries so `GetIssueDiff` and terminal can locate them. |
| `apps/backend/internal/config/types.go` | Add `WorktreeRoot` field (default `~/.orchestra/worktrees`). |

**Removed:**
- `workspace/service.go`: `EnsureIssueWorkspace`, `WorkspacePath` helper.

**No changes needed:**
- `workspace/hooks.go` — hooks already receive a path parameter and are path-agnostic.
- `apps/desktop/` — frontend receives correct diffs without code changes.
- `apps/backend/internal/db/` — `base_sha` and `branch_name` columns already exist.
- `apps/backend/internal/agents/` — agents receive `workspacePath`, implementation-agnostic.
- `apps/backend/internal/api/projects.go` — project-level git operations, not issue-scoped.
- `apps/backend/internal/api/provider_config.go`, `provider_mcp.go` — project-level config lookups.
