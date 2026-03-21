# Git Tab Phase 4: Stash Management, Conflict Resolution & Commit History

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Git tab with stash list/apply/drop, merge conflict detection and resolution UI, and an improved commit history view.

**Architecture:** Add new backend endpoints for stash list and conflict detection. Upgrade the frontend with a StashPanel, ConflictBanner, and improved CommitTimeline. No new dependencies.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/backend/internal/utils/git/git.go` | Modify | Add StashList, StashApply, StashDrop functions |
| `apps/backend/internal/api/projects.go` | Modify | Add stash list/apply/drop handlers, conflict detection |
| `apps/backend/internal/api/router.go` | Modify | Register new routes |
| `apps/desktop/src/lib/orchestra-client.ts` | Modify | Add stash list/apply/drop, conflict check client functions |
| `apps/desktop/src/widgets/git/StashPanel.tsx` | Create | Stash list with apply/drop actions |
| `apps/desktop/src/widgets/git/StashPanel.test.tsx` | Create | Tests |
| `apps/desktop/src/widgets/git/ConflictBanner.tsx` | Create | Banner showing conflicted files with resolve actions |
| `apps/desktop/src/widgets/git/ConflictBanner.test.tsx` | Create | Tests |
| `apps/desktop/src/widgets/git/CommitTimeline.tsx` | Rewrite | Improved commit history with branch labels |
| `apps/desktop/src/widgets/git/CommitTimeline.test.tsx` | Create | Tests |
| `apps/desktop/src/widgets/git/BranchBar.tsx` | Modify | Replace stash dropdown with StashPanel trigger |
| `apps/desktop/src/widgets/git/GitTab.tsx` | Modify | Wire up stash panel, conflict banner, improved history |

---

### Task 1: Backend — Add Stash List, Apply, Drop

**Files:**
- Modify: `apps/backend/internal/utils/git/git.go`
- Modify: `apps/backend/internal/api/projects.go`
- Modify: `apps/backend/internal/api/router.go`

- [ ] **Step 1: Add git utility functions**

In `git.go`, add:

```go
func StashList(ctx context.Context, dir string) ([]map[string]string, error) {
	cmd := exec.CommandContext(ctx, "git", "stash", "list", "--format=%gd|%s")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("git stash list: %s: %w", string(out), err)
	}
	var stashes []map[string]string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "|", 2)
		entry := map[string]string{"ref": parts[0]}
		if len(parts) > 1 {
			entry["message"] = parts[1]
		}
		stashes = append(stashes, entry)
	}
	return stashes, nil
}

func StashApply(ctx context.Context, dir string, ref string) error {
	cmd := exec.CommandContext(ctx, "git", "stash", "apply", ref)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git stash apply: %s: %w", string(out), err)
	}
	return nil
}

func StashDrop(ctx context.Context, dir string, ref string) error {
	cmd := exec.CommandContext(ctx, "git", "stash", "drop", ref)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git stash drop: %s: %w", string(out), err)
	}
	return nil
}
```

- [ ] **Step 2: Add handlers in projects.go**

Three new handlers following existing patterns:

- `GetGitStashList` — GET, calls `git.StashList()`, returns array
- `PostGitStashApply` — POST with `{"ref": "stash@{0}"}`, calls `git.StashApply()`
- `PostGitStashDrop` — POST with `{"ref": "stash@{0}"}`, calls `git.StashDrop()`

- [ ] **Step 3: Register routes**

```go
protected.Get("/api/v1/projects/{project_id}/git/stash/list", server.GetGitStashList)
protected.Post("/api/v1/projects/{project_id}/git/stash/apply", server.PostGitStashApply)
protected.Post("/api/v1/projects/{project_id}/git/stash/drop", server.PostGitStashDrop)
```

- [ ] **Step 4: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/
git commit -m "feat(backend): add stash list, apply, drop endpoints"
```

---

### Task 2: Backend — Add Conflict Detection

**Files:**
- Modify: `apps/backend/internal/api/projects.go`
- Modify: `apps/backend/internal/api/router.go`

- [ ] **Step 1: Add conflict detection handler**

`GetGitConflicts` — GET endpoint that checks for merge conflicts:

```go
func (s *Server) GetGitConflicts(w http.ResponseWriter, r *http.Request) {
	// ... project lookup, path check ...

	// Check for conflicted files using git status
	cmd := exec.CommandContext(r.Context(), "git", "status", "--porcelain")
	cmd.Dir = project.RootPath
	out, err := cmd.CombinedOutput()
	// Parse: lines starting with "UU", "AA", "DD", "AU", "UA", "DU", "UD" are conflicts
	// Also check if we're in a merge state: .git/MERGE_HEAD exists

	mergeHeadCmd := exec.CommandContext(r.Context(), "git", "rev-parse", "--verify", "MERGE_HEAD")
	mergeHeadCmd.Dir = project.RootPath
	inMerge := mergeHeadCmd.Run() == nil

	// Return: { "in_merge": bool, "files": ["path1", "path2"] }
}
```

Also add `PostGitMergeAbort` — POST endpoint:
```go
// Runs: git merge --abort
```

And `PostGitConflictResolve` — POST endpoint that stages a resolved file:
```go
// Accepts: {"file": "path"}
// Runs: git add <file>
```

- [ ] **Step 2: Register routes**

```go
protected.Get("/api/v1/projects/{project_id}/git/conflicts", server.GetGitConflicts)
protected.Post("/api/v1/projects/{project_id}/git/merge/abort", server.PostGitMergeAbort)
protected.Post("/api/v1/projects/{project_id}/git/resolve", server.PostGitConflictResolve)
```

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

```bash
git add apps/backend/
git commit -m "feat(backend): add conflict detection and merge abort endpoints"
```

---

### Task 3: Frontend — Update API Client

**Files:**
- Modify: `apps/desktop/src/lib/orchestra-client.ts`

- [ ] **Step 1: Add stash client functions**

```typescript
export type StashEntry = { ref: string; message: string }

export async function gitStashList(config: BackendConfig, projectId: string): Promise<StashEntry[]> {
  const data = await requestJSON<StashEntry[]>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stash/list`)
  return data || []
}

export async function gitStashApply(config: BackendConfig, projectId: string, ref: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stash/apply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref })
  })
}

export async function gitStashDrop(config: BackendConfig, projectId: string, ref: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stash/drop`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref })
  })
}
```

- [ ] **Step 2: Add conflict client functions**

```typescript
export type ConflictStatus = { in_merge: boolean; files: string[] }

export async function gitGetConflicts(config: BackendConfig, projectId: string): Promise<ConflictStatus> {
  return requestJSON<ConflictStatus>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/conflicts`)
}

export async function gitMergeAbort(config: BackendConfig, projectId: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/merge/abort`, { method: 'POST' })
}

export async function gitConflictResolve(config: BackendConfig, projectId: string, file: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file })
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/orchestra-client.ts
git commit -m "feat(desktop): add stash and conflict client functions"
```

---

### Task 4: Create StashPanel Component

**Files:**
- Create: `apps/desktop/src/widgets/git/StashPanel.tsx`
- Create: `apps/desktop/src/widgets/git/StashPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Tests:
1. Renders stash list with entries
2. Shows "No stashes" when list is empty
3. Calls onApply with ref when Apply clicked
4. Calls onDrop with ref when Drop clicked
5. Calls onStash when "Stash Changes" clicked
6. Shows stash message for each entry

**IMPORTANT:** No `@testing-library/jest-dom`.

- [ ] **Step 2: Run tests to verify fail**

- [ ] **Step 3: Write implementation**

A dropdown panel (similar to the old stash dropdown but richer):

**Props:**
```typescript
interface StashPanelProps {
  stashes: StashEntry[]
  onStash: () => void
  onApply: (ref: string) => void
  onDrop: (ref: string) => void
  onClose: () => void
}
```

**UI:**
- Dropdown panel (absolute positioned, like BranchBar dropdown)
- Header: "Stashes" with count
- "Stash Changes" button at top
- List of stash entries, each showing:
  - Stash ref (e.g., `stash@{0}`) in muted text
  - Message
  - Apply button (green) + Drop button (red) on hover
- "No stashes" empty state

- [ ] **Step 4: Run tests to verify pass**

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/git/StashPanel.*
git commit -m "feat(desktop): add StashPanel component"
```

---

### Task 5: Create ConflictBanner Component

**Files:**
- Create: `apps/desktop/src/widgets/git/ConflictBanner.tsx`
- Create: `apps/desktop/src/widgets/git/ConflictBanner.test.tsx`

- [ ] **Step 1: Write failing tests**

Tests:
1. Renders nothing when no conflicts
2. Shows warning banner when in_merge with conflicts
3. Lists conflicted file paths
4. Calls onResolve with file path when "Mark Resolved" clicked
5. Calls onAbort when "Abort Merge" clicked
6. Shows conflict count

- [ ] **Step 2: Write implementation**

**Props:**
```typescript
interface ConflictBannerProps {
  conflicts: { in_merge: boolean; files: string[] }
  onResolve: (file: string) => void
  onAbort: () => void
}
```

**UI:**
- Only renders when `in_merge` is true and files.length > 0
- Yellow/amber warning banner at top of the Changes tab
- "Merge in progress — N conflicted files" header
- List of conflicted files, each with a "Mark Resolved" button
- "Abort Merge" button (red)

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/git/ConflictBanner.*
git commit -m "feat(desktop): add ConflictBanner component"
```

---

### Task 6: Improve CommitTimeline

**Files:**
- Rewrite: `apps/desktop/src/widgets/git/CommitTimeline.tsx`
- Create: `apps/desktop/src/widgets/git/CommitTimeline.test.tsx`

- [ ] **Step 1: Write failing tests**

Tests:
1. Renders commit messages
2. Renders commit hashes (short, 7 char)
3. Renders author names
4. Renders relative timestamps
5. Highlights selected commit
6. Calls onSelectCommit when clicked
7. Filters commits by search text
8. Shows "No commits" when empty

- [ ] **Step 2: Rewrite CommitTimeline**

Keep the existing functionality but improve:
- Better visual hierarchy: hash as monospace badge, message prominent, author + time secondary
- Vertical timeline line on the left (thin colored line connecting commits)
- Commit dot on the timeline line for each commit
- Search bar at top (already exists, keep it)
- Scroll to selected commit

**Props stay the same:**
```typescript
{ commits: GitCommit[]; selectedHash: string | null; onSelectCommit: (hash: string) => void }
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/git/CommitTimeline.*
git commit -m "feat(desktop): improve CommitTimeline with visual timeline"
```

---

### Task 7: Wire Everything into GitTab

**Files:**
- Modify: `apps/desktop/src/widgets/git/GitTab.tsx`
- Modify: `apps/desktop/src/widgets/git/BranchBar.tsx`
- Modify: `apps/desktop/src/widgets/git/index.ts`

- [ ] **Step 1: Add stash state and handlers to GitTab**

```typescript
const [stashes, setStashes] = useState<StashEntry[]>([])
const [conflicts, setConflicts] = useState<ConflictStatus>({ in_merge: false, files: [] })

// In loadAll, also fetch stash list and conflicts
const stashData = await gitStashList(config, project.id)
setStashes(stashData)
const conflictData = await gitGetConflicts(config, project.id)
setConflicts(conflictData)

// Handlers
const handleStashApply = useCallback(async (ref: string) => { ... loadAll() }, [...])
const handleStashDrop = useCallback(async (ref: string) => { ... loadAll() }, [...])
const handleConflictResolve = useCallback(async (file: string) => { ... loadAll() }, [...])
const handleMergeAbort = useCallback(async () => { ... loadAll() }, [...])
```

- [ ] **Step 2: Add ConflictBanner to Changes tab**

Render ConflictBanner at the top of the Changes tab content (above ResizableSplit):

```tsx
{activeSubTab === 'changes' && (
  <>
    <ConflictBanner conflicts={conflicts} onResolve={handleConflictResolve} onAbort={handleMergeAbort} />
    <ResizableSplit ... />
  </>
)}
```

- [ ] **Step 3: Update BranchBar to use StashPanel**

Replace the simple stash dropdown in BranchBar with a trigger that opens a StashPanel. Pass stash data and callbacks from GitTab through BranchBar props, or have BranchBar render StashPanel directly with the stash list.

Add to BranchBar props:
```typescript
stashes?: StashEntry[]
onStashApply?: (ref: string) => void
onStashDrop?: (ref: string) => void
```

- [ ] **Step 4: Update exports**

```typescript
export { StashPanel } from './StashPanel'
export { ConflictBanner } from './ConflictBanner'
```

- [ ] **Step 5: Run full test suite**

```bash
cd apps/desktop && npx vitest run
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/widgets/git/
git commit -m "feat(desktop): wire stash panel, conflict banner, improved history into GitTab"
```
