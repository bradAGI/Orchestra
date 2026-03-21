# Git Tab Redesign — Phase 1: Core Staging, Diff Viewer & Commit Workflow

**Issue:** #65
**Scope:** Phase 1 of 4 — the daily-driver staging/commit workflow
**Approach:** Rewrite in place (replace existing widget files)

## Layout

Two-panel layout within the Git tab:

```
┌─────────────────────────────────────────────────────┐
│ ⎇ branch-name  ↑2 ahead ↓0 behind  [Push] [Pull] [Fetch] │
├─────────────────────────────────────────────────────┤
│ [Changes]  History  GitHub                          │
├──────────────┬──┬───────────────────────────────────┤
│ UNSTAGED (4) │  │ Diff: src/components/Auth.tsx     │
│  M Auth.tsx  │  │ [Unified] Split                   │
│  A validate  │◄►│                                   │
│  D old-auth  │  │ @@ -1,8 +1,12 @@                 │
│  ? routes    │  │  import React from 'react';       │
├──────────────┤  │+ import { validate } from ...     │
│ STAGED (2)   │  │- export function Auth({ legacy }) │
│  M README    │  │+ export function Auth({ onSuccess │
│  M package   │  │                                   │
├──────────────┤  │                                   │
│ [commit msg] │  │                                   │
│    [Commit]  │  │                                   │
└──────────────┴──┴───────────────────────────────────┘
```

- **Left panel (~300px, resizable):** Stacked vertically — Unstaged files (top), Staged files (bottom), Commit bar (pinned at bottom)
- **Right panel (flex):** Diff viewer, full height
- **Resizable split:** Vertical drag handle between left and right panels
- **Branch bar:** Top of Git tab — branch name, ahead/behind counts, Push/Pull/Fetch buttons
- **Sub-tabs:** Changes | History | GitHub — only Changes is implemented in Phase 1; History and GitHub remain as-is

## Components

### `GitTab.tsx` — Shell container

Rewritten. Manages top-level state and orchestrates child components.

**State:**
- `currentBranch: string` — from `fetchProjectGitBranches()`
- `aheadBehind: { ahead: number, behind: number }` — from git status
- `status: { unstaged: GitStatusEntry[], staged: GitStatusEntry[] }` — from `fetchProjectGitStatus()`
- `selectedFile: string | null` — path of file selected for diff
- `diffData: string | null` — raw diff for selected file
- `activeSubTab: 'changes' | 'history' | 'github'`

**Behavior:**
- Fetches branch, status, ahead/behind on mount
- Refreshes status after any mutation (stage, unstage, commit, push, pull)
- When `selectedFile` changes, calls `fetchProjectGitDiff({ file })` and updates `diffData`
- Renders branch bar, sub-tabs, and `ResizableSplit` containing `StagingArea` + `DiffViewer`

### `StagingArea.tsx` — Left panel (new, replaces `ChangesList.tsx`)

Two stacked file lists with drag-and-drop between them.

**Props:**
- `unstaged: GitStatusEntry[]`
- `staged: GitStatusEntry[]`
- `selectedFile: string | null`
- `onFileSelect: (path: string) => void`
- `onStage: (path: string) => void`
- `onUnstage: (path: string) => void`
- `onStageAll: () => void`
- `onUnstageAll: () => void`

**UI elements:**
- Unstaged section: header with count badge + "Stage All ↓" button, scrollable file list
- Staged section: header with count badge + "↑ Unstage All" button, scrollable file list
- Each file row: status letter (M/A/D/R/? with color), file path, drag handle (⠿)
- Selected file highlighted with blue left border
- Deleted files shown with strikethrough

**Drag and drop:**
- Uses `@dnd-kit/core` + `@dnd-kit/sortable`
- Each file row is a `Draggable`, each section (unstaged/staged) is a `Droppable`
- On drop across sections: calls `onStage(path)` or `onUnstage(path)`
- Visual feedback: ghost element while dragging, drop zone highlight on hover

**Status colors:**
- M (modified): yellow `#fbbf24`
- A (added): green `#34d399`
- D (deleted): red `#f87171`
- R (renamed): blue `#60a5fa`
- ? (untracked): purple `#a78bfa`

### `CommitBar.tsx` — Commit input (new, extracted from `ChangesList.tsx`)

Pinned at the bottom of the left panel.

**Props:**
- `stagedCount: number`
- `onCommit: (message: string) => void`

**UI elements:**
- Subject line input (single line, placeholder "Commit message...")
- Character count display (0/72), warns (yellow) at >72
- "click to expand body" text that reveals a textarea for extended description
- Commit button (disabled when staged count is 0 or message is empty)
- Ctrl+Enter keyboard shortcut triggers commit

### `DiffViewer.tsx` — Right panel (rewrite)

Displays the diff for the selected file.

**Props:**
- `filePath: string | null`
- `diff: string | null`
- `mode: 'unified' | 'split'`
- `onModeChange: (mode: 'unified' | 'split') => void`

**UI elements:**
- Header bar: file status badge, file path, Unified/Split toggle
- Diff body: parsed hunks with line numbers
- Hunk headers (`@@ ... @@`) as section dividers
- Collapsible context: "↕ Show N unchanged lines..." between hunks
- Empty state when no file is selected: "Select a file to view its diff"

**Diff rendering:**
- Additions: green background `#1a2332`, green text `#aff5b4`, `+` prefix
- Deletions: red background `#2a1c1f`, red text `#ffa198`, `-` prefix
- Context lines: neutral background, muted text
- Line numbers column (width: 70px) on the left
- Split mode: two columns, old on left, new on right

**Parsing:** Reuse and improve the existing `parseDiff()` function from the current `DiffViewer.tsx`.

### `ResizableSplit.tsx` — Utility (new)

Generic resizable split container.

**Props:**
- `left: ReactNode`
- `right: ReactNode`
- `defaultLeftWidth: number` (default: 300)
- `minLeftWidth: number` (default: 200)
- `maxLeftWidth: number` (default: 500)

**Behavior:**
- Renders left child, drag handle, right child in a flex row
- Drag handle: 6px wide, `cursor: col-resize`, subtle visual indicator
- Mouse drag updates left panel width, right fills remaining space
- Persists width to localStorage

## Data Flow

```
GitTab (state owner)
  ├── BranchBar (branch info, push/pull/fetch actions)
  ├── ResizableSplit
  │     ├── Left Panel
  │     │     ├── StagingArea (file lists, drag-drop → stage/unstage API calls → refresh)
  │     │     └── CommitBar (commit message → commit API call → refresh)
  │     └── Right Panel
  │           └── DiffViewer (receives diff data, display only)
```

1. `GitTab` mounts → fetches branches + status
2. User clicks a file in `StagingArea` → `GitTab.onFileSelect(path)` → fetches diff → passes to `DiffViewer`
3. User drags file from unstaged to staged → `StagingArea.onStage(path)` → `GitTab` calls `gitStage(projectId, path)` → refreshes status
4. User types commit message + clicks Commit → `CommitBar.onCommit(msg)` → `GitTab` calls `gitCommit(projectId, msg)` → refreshes status, clears message
5. User clicks Push → `GitTab` calls `gitPush(projectId)` → refreshes status + ahead/behind

## API Endpoints Used (all existing)

| Action | Method | Endpoint |
|--------|--------|----------|
| Get status | GET | `/api/v1/projects/{id}/git/status` |
| Get diff | GET | `/api/v1/projects/{id}/git/diff` |
| Get branches | GET | `/api/v1/projects/{id}/git/branches` |
| Stage file | POST | `/api/v1/projects/{id}/git/stage` |
| Unstage file | POST | `/api/v1/projects/{id}/git/unstage` |
| Commit | POST | `/api/v1/projects/{id}/git/commit` |
| Push | POST | `/api/v1/projects/{id}/git/push` |
| Pull | POST | `/api/v1/projects/{id}/git/pull` |

No new backend endpoints needed for Phase 1.

## New Dependency

- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop library for React. Lightweight, accessible, widely used.

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `widgets/git/GitTab.tsx` | Rewrite | New shell with branch bar, sub-tabs, ResizableSplit |
| `widgets/git/ChangesList.tsx` | Delete | Replaced by StagingArea + CommitBar |
| `widgets/git/StagingArea.tsx` | Create | Two-pane stacked file lists with drag-and-drop |
| `widgets/git/CommitBar.tsx` | Create | Extracted commit input |
| `widgets/git/DiffViewer.tsx` | Rewrite | Improved diff rendering, unified/split toggle |
| `widgets/git/ResizableSplit.tsx` | Create | Generic resizable split container |
| `widgets/git/BranchBar.tsx` | Keep | Minor updates — add ahead/behind display, push/pull/fetch buttons |
| `widgets/git/CommitTimeline.tsx` | Keep | Unchanged, used by History sub-tab later |
| `widgets/git/GitHubPanel.tsx` | Keep | Unchanged, used by GitHub sub-tab later |
| `widgets/git/PRReviewView.tsx` | Keep | Unchanged |
| `widgets/git/index.ts` | Update | Export new components |

## Out of Scope (later phases)

- Hunk-level staging
- Stash management
- Conflict resolution UI
- Commit history with graph visualization
- GitHub repo creation & publish
- PR creation from branch
- Cherry-pick, revert, reset
