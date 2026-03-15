# Git Frontend Components — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 8 focused React components for the Git tab, replacing ~700 lines of monolithic code in ProjectDetailView.tsx with a branch-centric timeline layout that supports full Git + GitHub operations.

**Architecture:** Create `src/widgets/git/` directory with composable components. GitTab.tsx orchestrates state and layout. Each child component handles one concern (branches, changes, commits, diffs, GitHub). Wire into ProjectDetailView.tsx as a drop-in replacement for the old git section.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react icons, react-syntax-highlighter, OverlayScrollbars

**Depends on:** Plan A (Backend Git API) must be completed first.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/widgets/git/GitTab.tsx` | Create | Main container, state management, two-pane layout |
| `src/widgets/git/BranchBar.tsx` | Create | Branch pills, create/switch/delete, stash |
| `src/widgets/git/ChangesList.tsx` | Create | Staged/unstaged files, stage/unstage, commit form |
| `src/widgets/git/CommitTimeline.tsx` | Create | Scrollable commit history, search, click-to-diff |
| `src/widgets/git/DiffViewer.tsx` | Create | Split/unified toggle, syntax highlighting, line numbers |
| `src/widgets/git/GitHubPanel.tsx` | Create | Collapsible bottom panel: issues, PRs, CI |
| `src/widgets/git/PRReviewView.tsx` | Create | PR detail, file diffs, comments, approve, merge |
| `src/widgets/git/index.ts` | Create | Public exports |
| `src/lib/orchestra-client.ts` | Modify | Add new API client functions |
| `src/components/projects/ProjectDetailView.tsx` | Modify | Replace git section with `<GitTab />` |

---

### Task 1: Add frontend API client functions

**Files:**
- Modify: `apps/desktop/src/lib/orchestra-client.ts`

- [ ] **Step 1: Add git operation client functions**

Add after the existing `gitPull` function:

```typescript
export async function gitCheckout(config: BackendConfig, projectId: string, branch: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch }),
  })
}

export async function gitCreateBranch(config: BackendConfig, projectId: string, name: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function gitDeleteBranch(config: BackendConfig, projectId: string, branch: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/branches/${encodeURIComponent(branch)}`, {
    method: 'DELETE',
  })
}

export async function gitStage(config: BackendConfig, projectId: string, files: string[]): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })
}

export async function gitUnstage(config: BackendConfig, projectId: string, files: string[]): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/unstage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })
}

export async function gitStash(config: BackendConfig, projectId: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stash`, {
    method: 'POST',
  })
}

export async function gitStashPop(config: BackendConfig, projectId: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stash/pop`, {
    method: 'POST',
  })
}

export async function fetchPRReviews(config: BackendConfig, projectId: string, prNumber: number): Promise<any[]> {
  return requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${prNumber}/reviews`)
}

export async function submitPRReview(config: BackendConfig, projectId: string, prNumber: number, body: string, event: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${prNumber}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, event }),
  })
}

export async function mergePR(config: BackendConfig, projectId: string, prNumber: number, method: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method }),
  })
}

export async function fetchPRComments(config: BackendConfig, projectId: string, prNumber: number): Promise<any[]> {
  return requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${prNumber}/comments`)
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/orchestra-client.ts
git commit -m "feat(desktop): add git branch, stage, stash, PR review/merge client functions"
```

---

### Task 2: Create DiffViewer component

This is the most reusable component — needed by ChangesList, CommitTimeline, and PRReviewView.

**Files:**
- Create: `apps/desktop/src/widgets/git/DiffViewer.tsx`

- [ ] **Step 1: Create the DiffViewer component**

The DiffViewer parses a raw git diff string and renders it in either split or unified mode with syntax highlighting and line numbers.

Key features:
- `mode` prop: `'split' | 'unified'`
- Toggle button to switch modes
- File name header with copy button
- Line numbers on both sides (split) or left side (unified)
- Green/red background for additions/deletions
- Expand/collapse context sections
- Scrollable with sticky file name header

Component should be ~200 lines. Parse diff into hunks, render each hunk with proper line numbering.

- [ ] **Step 2: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/widgets/git/DiffViewer.tsx
git commit -m "feat(desktop): create DiffViewer component with split/unified toggle"
```

---

### Task 3: Create BranchBar component

**Files:**
- Create: `apps/desktop/src/widgets/git/BranchBar.tsx`

- [ ] **Step 1: Create the BranchBar component**

Props: `projectId, config, currentBranch, branches, onBranchChange, onRefresh`

Features:
- Horizontal row of branch pills
- Current branch has green dot + bold text
- Agent task branches (matching issue identifiers like `fetch-1`) get a bot icon
- `+ New` button opens inline text input for branch name
- Click pill → checkout branch (calls `gitCheckout`, then `onBranchChange`)
- Right section: Stash dropdown (Stash, Pop)
- Branch delete via small X on hover (non-current branches only)

Component should be ~150 lines.

- [ ] **Step 2: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/widgets/git/BranchBar.tsx
git commit -m "feat(desktop): create BranchBar component with pills, create, checkout, stash"
```

---

### Task 4: Create ChangesList component

**Files:**
- Create: `apps/desktop/src/widgets/git/ChangesList.tsx`

- [ ] **Step 1: Create the ChangesList component**

Props: `projectId, config, status, onFileSelect, onRefresh`

Features:
- Two collapsible sections: Staged (green) and Unstaged (amber)
- Each file row: status badge (M/A/D/??), file path, stage/unstage button (⊕/⊖)
- Click file name → calls `onFileSelect(path)` to show diff
- Stage All / Unstage All buttons on section headers
- Inline commit message textarea (always visible at bottom of staged section)
- Commit button + Commit & Push button
- File count badges on section headers
- Calls `gitStage`, `gitUnstage`, `gitCommit`, `gitPush` client functions

Component should be ~250 lines.

- [ ] **Step 2: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/widgets/git/ChangesList.tsx
git commit -m "feat(desktop): create ChangesList with staged/unstaged, per-file staging, commit"
```

---

### Task 5: Create CommitTimeline component

**Files:**
- Create: `apps/desktop/src/widgets/git/CommitTimeline.tsx`

- [ ] **Step 1: Create the CommitTimeline component**

Props: `commits, selectedHash, onSelectCommit`

Features:
- Scrollable vertical list of commits
- Each entry: author avatar (2-letter circle), message (truncated), relative time, short hash
- Selected commit highlighted with primary border
- Search input at top (filters commit messages)
- Click → calls `onSelectCommit(hash)` to show diff in DiffViewer

Component should be ~120 lines.

- [ ] **Step 2: Typecheck and commit**

```bash
git add apps/desktop/src/widgets/git/CommitTimeline.tsx
git commit -m "feat(desktop): create CommitTimeline with search and selection"
```

---

### Task 6: Create GitHubPanel component

**Files:**
- Create: `apps/desktop/src/widgets/git/GitHubPanel.tsx`

- [ ] **Step 1: Create the GitHubPanel component**

Props: `projectId, config, githubToken, onOpenPR`

Features:
- Collapsible bottom panel (click header to expand/collapse)
- Three sub-tabs: Issues | PRs | Actions
- Issues: filter buttons (open/closed/all), issue list with expand/collapse, create issue form, close/reopen buttons, import to board button
- PRs: status badges (open/merged/closed), click → calls `onOpenPR(pr)`
- Actions: placeholder for CI status (future implementation)
- Create PR button opens inline form with title, body, head/base branch selectors

Component should be ~300 lines (largest component due to three sub-tabs).

- [ ] **Step 2: Typecheck and commit**

```bash
git add apps/desktop/src/widgets/git/GitHubPanel.tsx
git commit -m "feat(desktop): create GitHubPanel with issues, PRs, and CI sub-tabs"
```

---

### Task 7: Create PRReviewView component

**Files:**
- Create: `apps/desktop/src/widgets/git/PRReviewView.tsx`

- [ ] **Step 1: Create the PRReviewView component**

Props: `projectId, config, pr, onClose, onMerge`

Features:
- Full overlay view (covers the git tab content)
- Header: PR title, #number, status badge, author, base←head
- Two tabs: Files Changed | Reviews
- Files Changed: file list sidebar + DiffViewer for each file
- Reviews: list of review comments with author, body, state (approved/changes_requested)
- Action bar at bottom:
  - Approve button (green)
  - Request Changes button (amber)
  - Merge button with dropdown (merge/squash/rebase)
  - Close button (back to git tab)
- Calls `fetchPRReviews`, `submitPRReview`, `mergePR` client functions

Component should be ~250 lines.

- [ ] **Step 2: Typecheck and commit**

```bash
git add apps/desktop/src/widgets/git/PRReviewView.tsx
git commit -m "feat(desktop): create PRReviewView with file diffs, reviews, approve, merge"
```

---

### Task 8: Create GitTab container and index

**Files:**
- Create: `apps/desktop/src/widgets/git/GitTab.tsx`
- Create: `apps/desktop/src/widgets/git/index.ts`

- [ ] **Step 1: Create index.ts exports**

```typescript
export { GitTab } from './GitTab'
export { DiffViewer } from './DiffViewer'
```

- [ ] **Step 2: Create GitTab container component**

Props: `project, config, snapshot, boardIssues, availableAgents, onIssueUpdate, onIssueDelete, onInspectIssue, onCreateIssue`

This is the orchestration component that:
- Manages all git state (branches, status, history, diffs, GitHub data)
- Renders the two-pane layout: left (ChangesList + CommitTimeline), right (DiffViewer)
- Renders BranchBar at top
- Renders GitHubPanel at bottom (collapsible)
- Renders PRReviewView as overlay when a PR is selected
- Coordinates data flow between child components
- Fetches data on mount and refreshes after operations

State variables:
```typescript
const [branches, setBranches] = useState<{current: string, branches: string[]}>({current: '', branches: []})
const [gitStatus, setGitStatus] = useState<GitStatusEntry[]>([])
const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
const [selectedFile, setSelectedFile] = useState<string | null>(null)
const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
const [diffContent, setDiffContent] = useState('')
const [diffMode, setDiffMode] = useState<'split' | 'unified'>('unified')
const [githubPanelOpen, setGithubPanelOpen] = useState(false)
const [selectedPR, setSelectedPR] = useState<GitHubPR | null>(null)
const [loading, setLoading] = useState(true)
```

Component should be ~250 lines.

- [ ] **Step 3: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/git/
git commit -m "feat(desktop): create GitTab container component with full state orchestration"
```

---

### Task 9: Wire GitTab into ProjectDetailView

**Files:**
- Modify: `apps/desktop/src/components/projects/ProjectDetailView.tsx`

- [ ] **Step 1: Import GitTab**

```typescript
import { GitTab } from '@/widgets/git'
```

- [ ] **Step 2: Replace the git section**

Find the section `{activeTab === 'git' && (` (around line 899) and replace everything until the closing `)}` (around line 1287) with:

```tsx
{activeTab === 'git' && (
  <GitTab
    project={project}
    config={config}
    snapshot={snapshot}
    boardIssues={boardIssues}
    availableAgents={availableAgents}
    onIssueUpdate={onIssueUpdate}
    onIssueDelete={onIssueDelete}
    onInspectIssue={onInspectIssue}
    onCreateIssue={onCreateIssue}
  />
)}
```

- [ ] **Step 3: Remove unused git state variables**

Remove from ProjectDetailView (they're now managed inside GitTab):
- `gitHistory, gitSubTab, branches, selectedBranch`
- `showCommitDialog, commitMessage, gitPending`
- `ghPulls, expandedPR, prDiff, prDiffLoading`
- `isDiffModalOpen, selectedDiff, diffLoading, diffFiles, activeDiffFile`
- `selectedCommitInfo, createPROpen, newPRTitle, newPRBody, newPRHead, newPRBase`

Keep: `githubIssues, ghIssueFilter, expandedIssue, createIssueOpen, newIssueTitle, newIssueBody, ghSubmitting, githubActionError` (used by overview tab GitHub issues section too — or move to GitHubPanel if overview doesn't need them)

- [ ] **Step 4: Remove the old git diff modal**

Delete the `GitDiffModal` section (around lines 1294-1420) since DiffViewer handles this now.

- [ ] **Step 5: Remove unused git handler functions**

Remove `handleViewDiff`, `handleGitAction` and any git-specific handlers that are now inside GitTab.

- [ ] **Step 6: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 7: Run frontend tests**

Run: `cd apps/desktop && npx vitest run`

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/components/projects/ProjectDetailView.tsx
git commit -m "refactor(desktop): replace monolithic git section with GitTab component (~700 lines removed)"
```

---

### Task 10: Final verification and push

- [ ] **Step 1: Full typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 2: Run tests**

Run: `cd apps/desktop && npx vitest run`

- [ ] **Step 3: Build backend**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`

- [ ] **Step 4: Push**

```bash
git push origin main
```
