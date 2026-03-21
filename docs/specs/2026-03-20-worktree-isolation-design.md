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

Worktrees persist until the issue reaches a terminal state (Done, Cancelled) or is deleted. Cleanup runs `git worktree remove`. If uncommitted changes exist, cleanup logs a warning and leaves the worktree intact.

Issues are always tied to a project — dispatch requires a project with a valid git repo. Issues without a project are not dispatchable.

### Diff Calculation

`GetIssueDiff` reads `issue.base_sha` and `issue.branch_name` from the database and computes:

```bash
# Committed changes on the branch since it was created
git diff {base_sha}...{branch_name}
```

Three-dot diff: shows only commits reachable from `branch_name` that aren't reachable from `base_sha`.

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

1. **Require project** — if `entry.ProjectID` is empty or the project has no valid `RootPath` with a `.git` directory, log an error and move the issue to error state.

2. **Create worktree** — replace `workspacePath = project.RootPath` and the branch creation block:
   - Compute `worktreePath = {WorktreeRoot}/{project.ID}/{branch-name}`
   - If worktree doesn't exist: capture `base_sha` from project repo HEAD, run `git worktree add`, store `base_sha` and `branch_name` on the issue.
   - If worktree already exists (re-run): reuse it.

3. **Run agent in worktree** — `workspacePath` points to the worktree, not `project.RootPath`.

4. **Remove EnsureIssueWorkspace** — no longer called. Replaced by worktree logic.

5. **Cleanup on terminal state** — when an issue moves to Done/Cancelled/Deleted:
   - Run `git worktree remove {path}`.
   - If the issue is deleted, also delete the branch. Otherwise keep the branch for merge/PR.

No additional per-project locking — worktrees are isolated, and the orchestrator's existing `MaxConcurrent` controls concurrency.

### Validation and Error Handling

**Dispatch-time:**
- Project must exist with a valid `RootPath` containing a `.git` directory.
- If `git worktree add` fails (disk, permissions, detached HEAD), move issue to error state with descriptive message.
- If branch name conflicts with an existing branch, attempt checkout of the existing branch in the worktree.

**Cleanup failures:**
- `git worktree remove` fails on uncommitted changes: log warning, leave worktree intact.
- On startup, run `git worktree prune` for each project to clean stale references.

**Legacy issues:**
- Existing issues with `base_sha`/`branch_name` from the old model continue to work — `GetIssueDiff` falls back to current behavior when no worktree path exists.
- No data migration required.

### Out of Scope

- Merge conflict detection between concurrent issues (parallel branches, resolve at merge time).
- Worktree disk quota or limits.
- Frontend changes to `parseDiff` — backend returns correct data.
- PR creation flow changes (covered by #62).

## Files Changed

| File | Change |
|------|--------|
| `apps/backend/internal/app/run.go` | Replace workspace selection + branch creation with worktree creation. Remove `EnsureIssueWorkspace` call. Require project with git repo. |
| `apps/backend/internal/api/state.go` | Rewrite `GetIssueDiff` to use `base_sha...branch_name` + worktree uncommitted changes. |
| `apps/backend/internal/workspace/service.go` | Replace `EnsureIssueWorkspace` with `EnsureWorktree(projectRoot, projectID, branchName)` and `RemoveWorktree`. Add `PruneWorktrees` for startup cleanup. |
| `apps/backend/internal/utils/git/git.go` | Add `WorktreeAdd`, `WorktreeRemove`, `WorktreePrune`, `WorktreeList` helpers. |
| `apps/backend/internal/orchestrator/state.go` | Store worktree path on running entries so `GetIssueDiff` can locate uncommitted changes. |
| `apps/backend/internal/config/types.go` | Add `WorktreeRoot` field (default `~/.orchestra/worktrees`). |

**Removed:**
- `workspace/service.go`: `EnsureIssueWorkspace`, `WorkspacePath` helper.
- `workspace/hooks.go`: Workspace hooks adapted to work with worktree paths.

**No changes:**
- `apps/desktop/` — frontend receives correct diffs without code changes.
- `apps/backend/internal/db/` — `base_sha` and `branch_name` columns already exist.
- `apps/backend/internal/agents/` — agents receive `workspacePath`, implementation-agnostic.
