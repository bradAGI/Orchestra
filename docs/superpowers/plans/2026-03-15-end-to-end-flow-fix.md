# End-to-End Flow Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Backlog → Done flow practically usable by ensuring clean git state between tasks, auto-committing agent work, and providing a one-click "Merge & Close" action.

**Architecture:** Three backend changes (auto-commit on completion, checkout main before new task, merge branch on close) and one frontend change (Merge & Close button replaces separate Commit/Close).

**Tech Stack:** Go (backend), React + TypeScript (frontend)

---

## The Problem

Tasks accumulate changes because:
1. Agent finishes but doesn't commit — changes sit uncommitted
2. Next task starts on dirty working tree — sees previous task's files
3. Changes tab shows everything because nothing was committed per-task
4. No clean handoff between tasks

## The Fix

```
BEFORE (broken):
  FETCH-1 runs → leaves uncommitted files → FETCH-2 starts → sees FETCH-1's mess

AFTER (fixed):
  FETCH-1 runs → auto-commits on branch → checkout main → FETCH-2 starts clean
  Human reviews FETCH-1 → clicks "Merge & Close" → branch merged to main → done
```

---

### Task 1: Auto-commit agent work when moving to Review

When the agent finishes and `RecordRunSuccess` is called, automatically commit all changes on the task's branch before moving to Review.

**Files:**
- Modify: `apps/backend/internal/app/run.go` (after RecordRunSuccess, before moving to Review)

- [ ] **Step 1: Add auto-commit after agent completion**

In `processExecutionTick`, after `service.RecordRunSuccess()` and before the Review state transition, add:

```go
// Auto-commit agent work on the task branch
if workspacePath != "" {
    commitMsg := fmt.Sprintf("feat(%s): %s\n\nImplemented by %s agent via Orchestra",
        entry.IssueIdentifier, entry.Title, activeProviderName)
    if commitErr := gitutil.Commit(context.Background(), workspacePath, commitMsg); commitErr != nil {
        logger.Warn().Err(commitErr).Str("issue_id", entry.IssueID).Msg("auto-commit failed (may have no changes)")
    } else {
        logger.Info().Str("issue_id", entry.IssueID).Msg("auto-committed agent work")
    }
}
```

- [ ] **Step 2: Build and test**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/app/run.go apps/backend/orchestrad
git commit -m "feat(backend): auto-commit agent work when task moves to Review"
```

---

### Task 2: Checkout main before starting a new task

When a new task starts (turn 0), checkout main first to ensure a clean working tree, THEN create the task branch.

**Files:**
- Modify: `apps/backend/internal/app/run.go` (in the TurnCount == 0 block, before branch creation)

- [ ] **Step 1: Add checkout main before branch creation**

Before the branch creation code, add:

```go
// Start from main to ensure clean state
if workspacePath != "" {
    if checkoutErr := gitutil.Checkout(context.Background(), workspacePath, "main"); checkoutErr != nil {
        logger.Warn().Err(checkoutErr).Msg("could not checkout main before creating task branch")
    }
}
```

- [ ] **Step 2: Build and test**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/app/run.go apps/backend/orchestrad
git commit -m "feat(backend): checkout main before creating task branch for clean state"
```

---

### Task 3: Add "Merge & Close" button to Review state

Replace the separate Commit and Close buttons with a single "Merge & Close" that:
1. Merges the task branch into main
2. Closes the GitHub issue
3. Moves the task to Done
4. Deletes the task branch

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` (Review state buttons)
- Modify: `apps/desktop/src/lib/orchestra-client.ts` (add gitMerge client function if needed)

- [ ] **Step 1: Add git merge client function**

In `orchestra-client.ts`:

```typescript
export async function gitMergeBranch(config: BackendConfig, projectId: string, branch: string): Promise<void> {
  // Checkout main, merge branch, delete branch
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/checkout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch: 'main' }),
  })
  // Use git merge via a new endpoint or shell
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/merge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch }),
  })
}
```

- [ ] **Step 2: Add git merge backend endpoint**

In `apps/backend/internal/utils/git/git.go`:

```go
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
```

In `apps/backend/internal/api/projects.go`:

```go
func (s *Server) PostGitMerge(w http.ResponseWriter, r *http.Request) {
    // standard project lookup + validation
    var req struct { Branch string `json:"branch"` }
    // decode, call git.Merge, return ok
}
```

In `apps/backend/internal/api/router.go`:

```go
protected.Post("/api/v1/projects/{project_id}/git/merge", server.PostGitMerge)
```

- [ ] **Step 3: Replace Review buttons with Merge & Close**

In the Review state section of `IssueDetailView.tsx`, replace the separate Commit/Close buttons with:

```tsx
{localState === 'Review' && config && projectId && (
  <button
    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
    onClick={async () => {
      try {
        // 1. Merge branch to main
        const branchName = (typed.branch_name as string) || ''
        if (branchName && branchName !== 'main') {
          await gitMergeBranch(config, projectId, branchName)
          // Delete the task branch after merge
          await gitDeleteBranch(config, projectId, branchName)
        }
        // 2. Close GitHub issue
        if (typed.url && typeof typed.url === 'string') {
          const match = (typed.url as string).match(/\/issues\/(\d+)/)
          if (match) {
            await updateProjectGitHubIssue(config, projectId, parseInt(match[1]), { state: 'closed' })
          }
        }
        // 3. Move to Done
        if (onUpdate) await onUpdate({ state: 'Done' })
        setLocalState('Done')
      } catch (err) {
        console.error('Merge & Close failed:', err)
      }
    }}
  >
    <GitPullRequest size={14} />
    Merge & Close
  </button>
)}
```

Keep the Draft PR button for when the user wants to do a GitHub PR instead of direct merge.

- [ ] **Step 4: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/backend/ apps/desktop/
git commit -m "feat: add Merge & Close button — merges branch, closes GH issue, moves to Done"
```

---

### Task 4: Push after auto-commit (optional but recommended)

After auto-committing, push the branch to remote so the PR/review flow works with GitHub.

**Files:**
- Modify: `apps/backend/internal/app/run.go`

- [ ] **Step 1: Add push after auto-commit**

After the auto-commit block:

```go
// Push the branch to remote
if entry.ProjectID != "" {
    branchName := strings.ToLower(strings.ReplaceAll(entry.IssueIdentifier, " ", "-"))
    if pushErr := gitutil.Push(context.Background(), workspacePath, "origin", branchName); pushErr != nil {
        logger.Warn().Err(pushErr).Msg("auto-push failed (remote may not be configured)")
    } else {
        logger.Info().Str("branch", branchName).Msg("auto-pushed task branch")
    }
}
```

- [ ] **Step 2: Build, commit, push**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
git add apps/backend/
git commit -m "feat(backend): auto-push task branch after agent commits"
git push origin main
```

---

### Task 5: Verify end-to-end

- [ ] **Step 1: Restart backend**
- [ ] **Step 2: Clean project state** — `cd /home/traves/Development/Fetch && git checkout main && git clean -fd`
- [ ] **Step 3: Reset an issue to Backlog**
- [ ] **Step 4: Assign agent, move to In Progress**
- [ ] **Step 5: Wait for agent to finish**
- [ ] **Step 6: Verify**: task in Review, changes auto-committed on branch, Changes tab shows only this task's work
- [ ] **Step 7: Click Merge & Close**
- [ ] **Step 8: Verify**: branch merged to main, GitHub issue closed, task in Done
- [ ] **Step 9: Start another task — verify it starts clean on a new branch**
