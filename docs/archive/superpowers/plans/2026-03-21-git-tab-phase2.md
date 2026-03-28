# Git Tab Phase 2: Branch Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the BranchBar into a proper branch management UI with dropdown selector, fetch, delete, merge, and remote branch visibility.

**Architecture:** Rewrite BranchBar.tsx as a richer component with a dropdown branch selector and action buttons. Add one new backend endpoint (fetch). The rest uses existing endpoints.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest

**Spec:** Issue #65, Phase 2 scope from `docs/superpowers/specs/2026-03-21-git-tab-phase1-design.md` (out-of-scope section)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/backend/internal/api/projects.go` | Modify | Add fetch handler |
| `apps/backend/internal/api/router.go` | Modify | Register fetch route |
| `apps/backend/internal/utils/git/git.go` | Modify | Add Fetch function |
| `apps/desktop/src/lib/orchestra-client.ts` | Modify | Add gitFetch client function, update fetchProjectGitBranches for remote branches |
| `apps/desktop/src/widgets/git/BranchBar.tsx` | Rewrite | Dropdown selector, fetch/delete/merge actions |
| `apps/desktop/src/widgets/git/BranchBar.test.tsx` | Create | Tests for new BranchBar |
| `apps/desktop/src/widgets/git/GitTab.tsx` | Modify | Wire up fetch and merge handlers |

---

### Task 1: Backend — Add Git Fetch Endpoint

**Files:**
- Modify: `apps/backend/internal/utils/git/git.go`
- Modify: `apps/backend/internal/api/projects.go`
- Modify: `apps/backend/internal/api/router.go`

- [ ] **Step 1: Add Fetch function to git utils**

In `apps/backend/internal/utils/git/git.go`, add after the `Pull` function:

```go
func Fetch(ctx context.Context, dir string) error {
	cmd := exec.CommandContext(ctx, "git", "fetch", "--all", "--prune")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git fetch: %s: %w", string(out), err)
	}
	return nil
}
```

- [ ] **Step 2: Add fetch handler in projects.go**

Add a new handler after the existing `PostGitPull` handler:

```go
func (s *Server) PostGitFetch(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	if !s.isAuthorizedPath(project.RootPath) {
		writeJSONError(w, http.StatusForbidden, "forbidden", "path not authorized")
		return
	}
	if err := git.Fetch(r.Context(), project.RootPath); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "git_fetch_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
```

- [ ] **Step 3: Register route**

In `router.go`, add alongside the other git routes:

```go
protected.Post("/api/v1/projects/{project_id}/git/fetch", server.PostGitFetch)
```

- [ ] **Step 4: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/
git commit -m "feat(backend): add git fetch endpoint"
```

---

### Task 2: Backend — Return Remote Branches from GetProjectGitBranches

**Files:**
- Modify: `apps/backend/internal/api/projects.go` — the `GetProjectGitBranches` handler

- [ ] **Step 1: Update the handler to include remote branches**

Find the `GetProjectGitBranches` handler. It currently runs `git branch --list` for local branches only. Update it to also return remote branches:

After getting local branches, also run:
```go
remoteCmd := exec.CommandContext(r.Context(), "git", "branch", "-r", "--list")
remoteCmd.Dir = project.RootPath
```

Parse the remote branch output (strip leading whitespace, skip `origin/HEAD ->` entries).

Update the response to:
```go
writeJSON(w, http.StatusOK, map[string]any{
    "current":  currentBranch,
    "branches": localBranches,
    "remotes":  remoteBranches,
})
```

- [ ] **Step 2: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/api/projects.go
git commit -m "feat(backend): include remote branches in git branches response"
```

---

### Task 3: Frontend — Update API Client

**Files:**
- Modify: `apps/desktop/src/lib/orchestra-client.ts`

- [ ] **Step 1: Add gitFetch function**

```typescript
export async function gitFetch(config: BackendConfig, projectId: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/fetch`, { method: 'POST' })
}
```

- [ ] **Step 2: Update GitBranches type for remote branches**

```typescript
export type GitBranches = {
  current: string
  branches: string[]
  remotes?: string[]
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/orchestra-client.ts
git commit -m "feat(desktop): add gitFetch client function and remote branches type"
```

---

### Task 4: Rewrite BranchBar with Dropdown and Actions

**Files:**
- Rewrite: `apps/desktop/src/widgets/git/BranchBar.tsx`
- Create: `apps/desktop/src/widgets/git/BranchBar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/src/widgets/git/BranchBar.test.tsx`:

Tests to cover:
1. Renders current branch name
2. Opens dropdown on click showing all branches
3. Shows remote branches in a separate section
4. Calls onCheckout when selecting a different branch
5. Shows create branch input when "New" clicked
6. Calls onCreateBranch with name on submit
7. Shows delete option on right-click / context menu for non-current branches
8. Calls onDeleteBranch when delete confirmed
9. Shows merge option for non-current branches
10. Shows Fetch / Pull / Push buttons
11. Disables checkout for current branch

**IMPORTANT:** No `@testing-library/jest-dom` — use `toBeTruthy()`, `.disabled`, `.textContent`, `.className`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/desktop && npx vitest run src/widgets/git/BranchBar.test.tsx
```

- [ ] **Step 3: Rewrite BranchBar.tsx**

The new BranchBar should have:

**Props (updated):**
```typescript
interface BranchBarProps {
  projectId: string
  config: BackendConfig
  currentBranch: string
  branches: string[]
  remoteBranches?: string[]
  aheadBehind?: { ahead: number; behind: number }
  onBranchChange: () => void
  onPush?: () => void
  onPull?: () => void
  onFetch?: () => void
  onMerge?: (branch: string) => void
  onDeleteBranch?: (branch: string) => void
}
```

**Layout:**
```
[⎇ current-branch ▼] [Fetch] [Pull ↓N] [Push ↑N] [Stash ▼]
```

- Current branch displayed as a dropdown trigger button
- Clicking opens a dropdown with:
  - **Local branches** section — each branch clickable to checkout
  - **Remote branches** section (collapsed by default) — each with a "checkout" action that creates a local tracking branch
  - **"+ New branch"** row at the bottom (inline input)
  - Non-current local branches show a "..." menu (delete, merge into current)
- Fetch button (calls onFetch)
- Pull/Push buttons with counts (already exist, keep them)
- Stash dropdown (already exists, keep it)

**Dropdown behavior:**
- Opens on click of the branch name button
- Closes on outside click or Escape
- Selected branch has a green dot indicator
- Delete shows a confirmation prompt (inline "Delete?" / "Cancel" buttons, no browser confirm())
- Merge shows a confirmation prompt similarly

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/desktop && npx vitest run src/widgets/git/BranchBar.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/git/BranchBar.tsx apps/desktop/src/widgets/git/BranchBar.test.tsx
git commit -m "feat(desktop): rewrite BranchBar with dropdown selector and branch actions"
```

---

### Task 5: Wire Up GitTab for Phase 2

**Files:**
- Modify: `apps/desktop/src/widgets/git/GitTab.tsx`

- [ ] **Step 1: Add fetch and merge handlers**

```typescript
import { gitFetch, gitMerge, gitDeleteBranch } from '@/lib/orchestra-client'

const handleFetch = useCallback(async () => {
  if (!config) return
  await gitFetch(config, project.id)
  loadAll()
}, [config, project.id, loadAll])

const handleMerge = useCallback(async (branch: string) => {
  if (!config) return
  await gitMerge(config, project.id, branch)
  loadAll()
}, [config, project.id, loadAll])

const handleDeleteBranch = useCallback(async (branch: string) => {
  if (!config) return
  await gitDeleteBranch(config, project.id, branch)
  loadAll()
}, [config, project.id, loadAll])
```

- [ ] **Step 2: Update BranchBar props in render**

Pass the new callbacks and remote branches to BranchBar:

```tsx
<BranchBar
  projectId={project.id}
  config={config}
  currentBranch={currentBranch}
  branches={branches}
  remoteBranches={remoteBranches}
  aheadBehind={aheadBehind}
  onBranchChange={loadAll}
  onPush={handlePush}
  onPull={handlePull}
  onFetch={handleFetch}
  onMerge={handleMerge}
  onDeleteBranch={handleDeleteBranch}
/>
```

- [ ] **Step 3: Store remote branches in state**

Add `remoteBranches` state and populate from `fetchProjectGitBranches` response:

```typescript
const [remoteBranches, setRemoteBranches] = useState<string[]>([])

// In loadAll:
setRemoteBranches(branchData.remotes || [])
```

- [ ] **Step 4: Run full test suite**

```bash
cd apps/desktop && npx vitest run
```

- [ ] **Step 5: Build backend**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/widgets/git/GitTab.tsx
git commit -m "feat(desktop): wire up fetch, merge, delete branch in GitTab"
```
