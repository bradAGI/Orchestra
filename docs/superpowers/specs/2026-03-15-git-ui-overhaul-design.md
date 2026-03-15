# Git UI/UX Overhaul — Design Spec

## Overview

Complete redesign of the Git integration in Orchestra's desktop app. Replace the current monolithic `ProjectDetailView.tsx` (1,629 lines) with focused, composable components that provide full Git + GitHub functionality with a branch-centric layout optimized for the agent orchestration workflow.

## Goals

1. **Branch-per-task isolation** — branches are first-class, one-click switching between agent workstreams
2. **Full staging workflow** — stage/unstage individual files, inline commit, commit & push
3. **Professional diff viewer** — split/unified toggle, syntax highlighting, line numbers
4. **Complete GitHub integration** — PR creation, review workflow (approve/request changes), inline comments, merge, CI status
5. **Conflict resolution** — visual side-by-side conflict resolver with accept/reject hunks
6. **Clean architecture** — split into focused components, each < 300 lines

## Component Architecture

```
src/widgets/git/
  GitTab.tsx              — Main container, layout orchestration, state coordination
  BranchBar.tsx           — Branch pills, create/switch/delete, stash button
  ChangesList.tsx         — Staged/unstaged file tree, stage/unstage actions, commit form
  CommitTimeline.tsx      — Scrollable commit history with author, hash, message
  DiffViewer.tsx          — Split/unified toggle, syntax highlighting, line numbers, hunk actions
  GitHubPanel.tsx         — Collapsible bottom panel: issues, PRs, CI status
  PRReviewView.tsx        — PR detail with file diffs, inline comments, approve/merge
  ConflictResolver.tsx    — Side-by-side conflict resolution UI
```

## Layout

### Main Git Tab (Branch-Centric Timeline)

```
┌─────────────────────────────────────────────────────────┐
│ [main] [fetch-1●] [fetch-2] [+ New]           [Stash ↓]│  BranchBar
├──────────────────────────┬──────────────────────────────┤
│ ● 5 uncommitted changes  │                              │
│ ┌─ + manager.ts       ⊕  │  ┌─ DIFF ─────── [Split|Uni]│
│ ├─ + permissions.ts   ⊕  │  │ src/tools/manager.ts      │
│ ├─ M registry.ts      ⊕  │  │                           │
│ ├─ M types.ts         ⊕  │  │  1│+export class TM {     │  DiffViewer
│ └─ M index.ts         ⊕  │  │  2│+  private map = ...   │
│                           │  │  3│+  register(t) { }     │
│ [Stage All] ┌──────────┐ │  │                           │
│             │ message...│ │  │  45│-old import           │
│             └──────────┘ │  │  45│+new import            │
│ [Commit]  [Commit & Push] │  └───────────────────────────│
│───────────────────────────│                              │
│ abc1234 Fix types    2m ▸ │                              │
│ def5678 Add TM       5m ▸ │                              │  CommitTimeline
│ ghi9012 Init perm    8m ▸ │                              │
│ jkl3456 Initial     12m ▸ │                              │
├──────────────────────────┴──────────────────────────────┤
│ ▼ GITHUB  Issues (3)  PRs (1)  Actions (✓ passing)      │  GitHubPanel
│   #17 Tool Manager ● Review  │  PR #4 fetch-1→main Open │
└─────────────────────────────────────────────────────────┘
```

### Key Interactions

- **Click branch pill** → checkout branch, refresh file list and history
- **Click ⊕ on file** → stage file (moves from unstaged to staged)
- **Click ⊖ on staged file** → unstage
- **Click file name** → show diff in right panel
- **Click commit in timeline** → show that commit's diff in right panel
- **Click PR in GitHub panel** → open PRReviewView
- **Drag branch pill** → reorder (cosmetic)

## Component Specs

### BranchBar.tsx

**Props:** `projectId, config, currentBranch, branches, onBranchChange, onStash`

**Features:**
- Horizontal pill bar with all branches
- Current branch has green dot indicator
- Agent branches (matching issue identifiers) show agent icon
- `+ New` button opens inline input for branch name
- Right-click branch → delete (with confirmation)
- Stash button (dropdown: stash, pop, list)

**Backend endpoints needed:**
- `POST /git/branches` — `{name: string}` → creates and checks out
- `POST /git/checkout` — `{branch: string}` → switches branch
- `DELETE /git/branches/{name}` — deletes branch
- `POST /git/stash` — stash current changes
- `POST /git/stash/pop` — pop last stash

### ChangesList.tsx

**Props:** `files, staged, onStage, onUnstage, onStageAll, onCommit, onCommitAndPush, onFileSelect`

**Features:**
- Two sections: Staged (green header) and Unstaged (amber header)
- Each file row: status icon (M/A/D/R), file path, ⊕/⊖ button
- Status colors: M=blue, A/??=green, D=red, R=purple
- Stage All / Unstage All buttons
- Inline commit message textarea (always visible, no modal)
- Commit button + Commit & Push button
- File count badges on section headers

**Backend changes:**
- `POST /git/commit` needs to accept `{message, files[]}` for selective staging
- Or add `POST /git/stage` — `{files: string[]}` and `POST /git/unstage` — `{files: string[]}`

### CommitTimeline.tsx

**Props:** `commits, onSelectCommit, selectedHash`

**Features:**
- Scrollable vertical list
- Each entry: author avatar (2-letter), message (truncated), relative time, short hash
- Click selects and shows diff in DiffViewer
- Selected commit highlighted with primary color border
- Search/filter input at top (searches commit messages)

### DiffViewer.tsx

**Props:** `diff, fileName, mode ('split' | 'unified'), onModeChange`

**Features:**
- Toggle button: Split | Unified
- **Split mode:** two columns, old on left, new on right, line numbers on both
- **Unified mode:** single column with +/- prefix, green/red backgrounds
- Syntax highlighting based on file extension (not just "diff" language)
- Line numbers in gutter
- Expand/collapse context sections (show ±3 lines around changes by default)
- Copy button per hunk
- Scrollable with sticky header showing file name

### GitHubPanel.tsx

**Props:** `projectId, config, githubToken, issues, prs, onRefresh`

**Features:**
- Collapsible bottom panel (click header to expand/collapse)
- Three sub-tabs: Issues | PRs | Actions
- **Issues:** filter bar (open/closed/all), create button, list with status dots
- **PRs:** list with status (open/merged/closed), reviewers, CI badge
- **Actions:** CI workflow status (pass/fail/pending with links)
- Click issue → expand inline with description + close/reopen/import buttons
- Click PR → open PRReviewView overlay

### PRReviewView.tsx

**Props:** `projectId, config, pr, onClose, onMerge`

**Features:**
- Full overlay view (replaces git tab content)
- **Header:** PR title, #number, status badge, author, base←head
- **Tabs:** Conversation | Files Changed | Checks
- **Conversation tab:** timeline of comments, review submissions, status changes
- **Files Changed tab:** file list sidebar + DiffViewer, add inline comment on any line
- **Checks tab:** CI status checks with pass/fail/pending icons
- **Action bar:** Approve, Request Changes, Comment (dropdown), Merge (with strategy: merge/squash/rebase)
- **Merge button:** disabled if checks failing or reviews pending

**Backend endpoints needed:**
- `GET /github/pulls/{number}/reviews` — list reviews
- `POST /github/pulls/{number}/reviews` — submit review (approve/request_changes/comment)
- `POST /github/pulls/{number}/merge` — merge with strategy
- `GET /github/pulls/{number}/comments` — list inline comments
- `POST /github/pulls/{number}/comments` — add inline comment

### ConflictResolver.tsx

**Props:** `projectId, config, conflictFiles, onResolve`

**Features:**
- Shown when `git status` reports merge conflicts
- Side-by-side view: "ours" (left) vs "theirs" (right)
- Accept Ours / Accept Theirs / Accept Both buttons per hunk
- Manual edit mode for complex resolutions
- Mark as Resolved button per file
- "Resolve All" to mark remaining conflicts

## Backend API Additions

### New Git Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/git/branches` | Create branch `{name}` |
| POST | `/git/checkout` | Switch branch `{branch}` |
| DELETE | `/git/branches/{name}` | Delete branch |
| POST | `/git/stage` | Stage files `{files: string[]}` |
| POST | `/git/unstage` | Unstage files `{files: string[]}` |
| POST | `/git/stash` | Stash changes |
| POST | `/git/stash/pop` | Pop stash |

### New GitHub Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/github/pulls/{n}/reviews` | List PR reviews |
| POST | `/github/pulls/{n}/reviews` | Submit review |
| POST | `/github/pulls/{n}/merge` | Merge PR |
| GET | `/github/pulls/{n}/comments` | List inline comments |
| POST | `/github/pulls/{n}/comments` | Add inline comment |
| GET | `/github/actions` | CI workflow runs status |

## Styling

- Follow existing app dark theme (bg-card, border-border, text-foreground)
- Use same icon library (lucide-react)
- Consistent with kanban card styling (rounded-xl, border-border/60)
- Diff colors: additions #22c55e20 bg + #4ade80 text, deletions #ef444420 bg + #f87171 text
- Branch pills match agent badge styling
- Resizable split panes where applicable

## Migration Path

1. Create new `src/widgets/git/` directory with all components
2. Build GitTab.tsx as the entry point
3. Replace the git section in ProjectDetailView.tsx with `<GitTab />`
4. Move git-related state from ProjectDetailView into GitTab
5. Keep Overview and Files tabs in ProjectDetailView (they're fine)
6. Delete the old git sections from ProjectDetailView (~700 lines removed)

## Out of Scope

- Git submodules
- Git LFS
- Rebase/cherry-pick (too complex for v1)
- Multi-remote management
- SSH key management
