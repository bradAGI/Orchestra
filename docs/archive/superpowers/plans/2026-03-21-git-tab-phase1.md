# Git Tab Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Git tab with a two-panel layout: stacked file lists + commit bar on the left, diff viewer on the right, with drag-and-drop staging.

**Architecture:** Rewrite in place — replace existing widget files under `apps/desktop/src/widgets/git/`. GitTab.tsx is the shell managing state; StagingArea, CommitBar, DiffViewer, and ResizableSplit are child components. Two backend changes: add `--branch` flag to git status, add `?file=` and `?staged=` params to git diff.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, @dnd-kit/core + @dnd-kit/sortable, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-21-git-tab-phase1-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/backend/internal/api/projects.go` | Modify | Add `--branch` to git status, add `?file=`/`?staged=` to git diff |
| `apps/desktop/src/lib/orchestra-client.ts` | Modify | Update `fetchProjectGitDiff` signature, add `parseAheadBehind` |
| `apps/desktop/src/widgets/git/ResizableSplit.tsx` | Create | Generic resizable horizontal split container |
| `apps/desktop/src/widgets/git/ResizableSplit.test.tsx` | Create | Tests for resize behavior |
| `apps/desktop/src/widgets/git/CommitBar.tsx` | Create | Commit message input + commit button |
| `apps/desktop/src/widgets/git/CommitBar.test.tsx` | Create | Tests for commit bar |
| `apps/desktop/src/widgets/git/StagingArea.tsx` | Create | Two stacked file lists with drag-and-drop |
| `apps/desktop/src/widgets/git/StagingArea.test.tsx` | Create | Tests for staging area |
| `apps/desktop/src/widgets/git/DiffViewer.tsx` | Rewrite | Improved diff rendering with header bar |
| `apps/desktop/src/widgets/git/DiffViewer.test.tsx` | Create | Tests for diff viewer |
| `apps/desktop/src/widgets/git/GitTab.tsx` | Rewrite | New shell with branch bar, sub-tabs, ResizableSplit |
| `apps/desktop/src/widgets/git/GitTab.test.tsx` | Create | Integration tests for GitTab |
| `apps/desktop/src/widgets/git/ChangesList.tsx` | Delete | Replaced by StagingArea + CommitBar |
| `apps/desktop/src/widgets/git/BranchBar.tsx` | Modify | Add ahead/behind display, Push/Pull buttons |
| `apps/desktop/src/widgets/git/index.ts` | Modify | Update exports |

---

### Task 1: Backend — Add `--branch` Flag to Git Status

**Files:**
- Modify: `apps/backend/internal/api/projects.go:536` (the `git status --porcelain` command)

- [ ] **Step 1: Update git status command**

In `apps/backend/internal/api/projects.go`, find the `GetProjectGitStatus` handler (line ~536). Change:

```go
cmd := exec.CommandContext(r.Context(), "git", "status", "--porcelain")
```

to:

```go
cmd := exec.CommandContext(r.Context(), "git", "status", "--porcelain", "--branch")
```

- [ ] **Step 2: Parse the branch tracking line**

The `--branch` flag adds a first line like `## main...origin/main [ahead 2, behind 1]`. Update the parsing loop to extract this. Replace the existing parsing block (the `for _, line := range lines` loop and the `status` slice declaration above it) with:

```go
var status []map[string]string
branchInfo := map[string]interface{}{
    "ahead":  0,
    "behind": 0,
}

for _, line := range lines {
    if strings.HasPrefix(line, "## ") {
        // Parse branch tracking: ## main...origin/main [ahead 2, behind 1]
        if idx := strings.Index(line, "["); idx != -1 {
            tracking := line[idx:]
            if m := regexp.MustCompile(`ahead (\d+)`).FindStringSubmatch(tracking); m != nil {
                if n, err := strconv.Atoi(m[1]); err == nil {
                    branchInfo["ahead"] = n
                }
            }
            if m := regexp.MustCompile(`behind (\d+)`).FindStringSubmatch(tracking); m != nil {
                if n, err := strconv.Atoi(m[1]); err == nil {
                    branchInfo["behind"] = n
                }
            }
        }
        continue
    }
    if len(line) < 4 {
        continue
    }
    status = append(status, map[string]string{
        "status": line[:2],
        "path":   strings.TrimSpace(line[3:]),
    })
}
```

Note: The `status` field now preserves the raw 2-char porcelain code (no TrimSpace on status) so the frontend can distinguish index vs worktree changes. Also update the response to include branch info:

```go
writeJSON(w, http.StatusOK, map[string]interface{}{
    "files":  status,
    "branch": branchInfo,
})
```

- [ ] **Step 3: Add regexp import**

Add `"regexp"` and `"strconv"` to the import block at the top of `projects.go` if not already present.

- [ ] **Step 4: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

Expected: builds successfully with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/api/projects.go
git commit -m "feat(backend): add --branch flag to git status for ahead/behind tracking"
```

---

### Task 2: Backend — Add `?file=` and `?staged=` to Git Diff

**Files:**
- Modify: `apps/backend/internal/api/projects.go:624-652` (the `GetProjectGitDiff` handler)

- [ ] **Step 1: Update the diff handler**

Replace the `GetProjectGitDiff` handler body (after the project lookup) with:

```go
var cmd *exec.Cmd
if hash != "" {
    cmd = exec.CommandContext(r.Context(), "git", "show", hash)
} else {
    file := r.URL.Query().Get("file")
    staged := r.URL.Query().Get("staged") == "true"

    args := []string{"diff"}
    if staged {
        args = append(args, "--cached")
    }
    if file != "" {
        args = append(args, "--", file)
    }
    cmd = exec.CommandContext(r.Context(), "git", args...)
}
cmd.Dir = project.RootPath
out, err := cmd.CombinedOutput()
if err != nil {
    // For untracked files, git diff returns nothing. Try --no-index.
    file := r.URL.Query().Get("file")
    if file != "" && !strings.Contains(string(out), "diff") {
        cmd2 := exec.CommandContext(r.Context(), "git", "diff", "--no-index", "/dev/null", file)
        cmd2.Dir = project.RootPath
        out2, _ := cmd2.CombinedOutput()
        if len(out2) > 0 {
            w.Header().Set("Content-Type", "text/plain")
            w.Write(out2)
            return
        }
    }
    s.logger.Warn().Err(err).Str("project_id", projectID).Str("hash", hash).Msg("git diff failed")
    w.Header().Set("Content-Type", "text/plain")
    w.Write([]byte(""))
    return
}

w.Header().Set("Content-Type", "text/plain")
w.Write(out)
```

- [ ] **Step 2: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

Expected: builds successfully.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/api/projects.go
git commit -m "feat(backend): add file and staged query params to git diff endpoint"
```

---

### Task 3: Frontend — Update API Client

**Files:**
- Modify: `apps/desktop/src/lib/orchestra-client.ts`

- [ ] **Step 1: Update `fetchProjectGitDiff` signature**

Find `fetchProjectGitDiff` (~line 788). Replace:

```typescript
export async function fetchProjectGitDiff(config: BackendConfig, projectId: string, hash?: string): Promise<string> {
  const query = hash ? `?hash=${encodeURIComponent(hash)}` : ''
  return requestText(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/diff${query}`)
}
```

with:

```typescript
export async function fetchProjectGitDiff(
  config: BackendConfig,
  projectId: string,
  opts?: { hash?: string; file?: string; staged?: boolean }
): Promise<string> {
  const params = new URLSearchParams()
  if (opts?.hash) params.set('hash', opts.hash)
  if (opts?.file) params.set('file', opts.file)
  if (opts?.staged) params.set('staged', 'true')
  const query = params.toString() ? `?${params.toString()}` : ''
  return requestText(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/diff${query}`)
}
```

- [ ] **Step 2: Update `fetchProjectGitStatus` return type**

The backend now returns `{ files: [...], branch: { ahead, behind } }` instead of a flat array. Find `fetchProjectGitStatus` (~line 776). Replace:

```typescript
export async function fetchProjectGitStatus(config: BackendConfig, projectId: string): Promise<GitStatusEntry[]> {
  const data = await requestJSON<GitStatusEntry[]>(config, `/api/v1/projects/${projectId}/git/status`)
  return data || []
}
```

with:

```typescript
export type GitStatusResponse = {
  files: GitStatusEntry[]
  branch: { ahead: number; behind: number }
}

export async function fetchProjectGitStatus(config: BackendConfig, projectId: string): Promise<GitStatusResponse> {
  const data = await requestJSON<GitStatusResponse>(config, `/api/v1/projects/${projectId}/git/status`)
  return data || { files: [], branch: { ahead: 0, behind: 0 } }
}
```

- [ ] **Step 3: Fix all call sites**

Search for `fetchProjectGitStatus` usage. In `GitTab.tsx` (~line 46), the call currently expects `GitStatusEntry[]`. This will be updated in Task 7 (GitTab rewrite). For now, note this is a breaking change — the existing GitTab will need updating.

Also search for `fetchProjectGitDiff` calls. In `GitTab.tsx` (~line 64), update:
```typescript
fetchProjectGitDiff(config, project.id, selectedCommit)
```
to:
```typescript
fetchProjectGitDiff(config, project.id, { hash: selectedCommit })
```

And (~line 67):
```typescript
fetchProjectGitDiff(config, project.id)
```
to:
```typescript
fetchProjectGitDiff(config, project.id, {})
```

- [ ] **Step 4: Run typecheck**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: passes (or only errors in files we're about to rewrite).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/orchestra-client.ts apps/desktop/src/widgets/git/GitTab.tsx
git commit -m "feat(desktop): update git API client for file-level diffs and status response"
```

---

### Task 4: Install @dnd-kit

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/desktop && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "chore(desktop): add @dnd-kit for drag-and-drop staging"
```

---

### Task 5: Create ResizableSplit Component

**Files:**
- Create: `apps/desktop/src/widgets/git/ResizableSplit.tsx`
- Create: `apps/desktop/src/widgets/git/ResizableSplit.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/widgets/git/ResizableSplit.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResizableSplit } from './ResizableSplit'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('ResizableSplit', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('renders left and right children', () => {
    render(
      <ResizableSplit
        left={<div>Left Panel</div>}
        right={<div>Right Panel</div>}
      />
    )
    expect(screen.getByText('Left Panel')).toBeInTheDocument()
    expect(screen.getByText('Right Panel')).toBeInTheDocument()
  })

  it('renders the drag handle', () => {
    render(
      <ResizableSplit
        left={<div>Left</div>}
        right={<div>Right</div>}
      />
    )
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('applies default left width', () => {
    const { container } = render(
      <ResizableSplit
        left={<div>Left</div>}
        right={<div>Right</div>}
        defaultLeftWidth={350}
      />
    )
    const leftPanel = container.querySelector('[data-panel="left"]')
    expect(leftPanel).toHaveStyle({ width: '350px' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/desktop && npx vitest run src/widgets/git/ResizableSplit.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/desktop/src/widgets/git/ResizableSplit.tsx`:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'

interface ResizableSplitProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  storageKey?: string
}

export function ResizableSplit({
  left,
  right,
  defaultLeftWidth = 300,
  minLeftWidth = 200,
  maxLeftWidth = 500,
  storageKey = 'git-tab-split-width',
}: ResizableSplitProps) {
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= minLeftWidth && parsed <= maxLeftWidth) return parsed
    }
    return defaultLeftWidth
  })

  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, e.clientX - rect.left))
      setLeftWidth(newWidth)
    }

    function handleMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(storageKey, String(leftWidth))
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [leftWidth, maxLeftWidth, minLeftWidth, storageKey])

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden min-h-0">
      <div data-panel="left" className="shrink-0 overflow-hidden flex flex-col" style={{ width: `${leftWidth}px` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={handleMouseDown}
        className="w-1.5 shrink-0 bg-border/30 hover:bg-primary/30 cursor-col-resize transition-colors flex items-center justify-center"
      >
        <div className="h-10 w-0.5 bg-border/50 rounded-full" />
      </div>
      <div data-panel="right" className="flex-1 overflow-hidden min-w-0">
        {right}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/desktop && npx vitest run src/widgets/git/ResizableSplit.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/git/ResizableSplit.tsx apps/desktop/src/widgets/git/ResizableSplit.test.tsx
git commit -m "feat(desktop): add ResizableSplit component for git tab layout"
```

---

### Task 6: Create CommitBar Component

**Files:**
- Create: `apps/desktop/src/widgets/git/CommitBar.tsx`
- Create: `apps/desktop/src/widgets/git/CommitBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/desktop/src/widgets/git/CommitBar.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CommitBar } from './CommitBar'

describe('CommitBar', () => {
  it('renders commit message input', () => {
    render(<CommitBar stagedCount={1} onCommit={vi.fn()} onPush={vi.fn()} />)
    expect(screen.getByPlaceholderText('Commit message...')).toBeInTheDocument()
  })

  it('disables commit button when no staged files', () => {
    render(<CommitBar stagedCount={0} onCommit={vi.fn()} onPush={vi.fn()} />)
    expect(screen.getByRole('button', { name: /commit/i })).toBeDisabled()
  })

  it('disables commit button when message is empty', () => {
    render(<CommitBar stagedCount={2} onCommit={vi.fn()} onPush={vi.fn()} />)
    expect(screen.getByRole('button', { name: /commit/i })).toBeDisabled()
  })

  it('enables commit button when message and staged files present', async () => {
    const user = userEvent.setup()
    render(<CommitBar stagedCount={2} onCommit={vi.fn()} onPush={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Commit message...'), 'fix: resolve bug')
    expect(screen.getByRole('button', { name: /commit/i })).toBeEnabled()
  })

  it('calls onCommit with message when commit button clicked', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<CommitBar stagedCount={1} onCommit={onCommit} onPush={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Commit message...'), 'feat: new thing')
    await user.click(screen.getByRole('button', { name: /commit/i }))
    expect(onCommit).toHaveBeenCalledWith('feat: new thing')
  })

  it('clears input after commit', async () => {
    const user = userEvent.setup()
    render(<CommitBar stagedCount={1} onCommit={vi.fn()} onPush={vi.fn()} />)
    const input = screen.getByPlaceholderText('Commit message...')
    await user.type(input, 'fix: something')
    await user.click(screen.getByRole('button', { name: /commit/i }))
    expect(input).toHaveValue('')
  })

  it('shows character count', async () => {
    const user = userEvent.setup()
    render(<CommitBar stagedCount={1} onCommit={vi.fn()} onPush={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Commit message...'), 'hello')
    expect(screen.getByText('5/72')).toBeInTheDocument()
  })

  it('commits on Ctrl+Enter', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<CommitBar stagedCount={1} onCommit={onCommit} onPush={vi.fn()} />)
    const input = screen.getByPlaceholderText('Commit message...')
    await user.type(input, 'feat: shortcut')
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onCommit).toHaveBeenCalledWith('feat: shortcut')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/desktop && npx vitest run src/widgets/git/CommitBar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/desktop/src/widgets/git/CommitBar.tsx`:

```typescript
import { useState, useCallback } from 'react'
import { Send } from 'lucide-react'

interface CommitBarProps {
  stagedCount: number
  aheadCount?: number
  onCommit: (message: string) => void
  onPush: () => void
}

export function CommitBar({ stagedCount, aheadCount = 0, onCommit, onPush }: CommitBarProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showBody, setShowBody] = useState(false)

  const canCommit = subject.trim().length > 0 && stagedCount > 0

  const handleCommit = useCallback(() => {
    if (!canCommit) return
    const message = body.trim() ? `${subject.trim()}\n\n${body.trim()}` : subject.trim()
    onCommit(message)
    setSubject('')
    setBody('')
    setShowBody(false)
  }, [canCommit, subject, body, onCommit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleCommit()
    }
  }, [handleCommit])

  return (
    <div className="border-t border-border/40 p-3 bg-card/30 shrink-0">
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Commit message..."
        className="w-full bg-muted/10 border border-border/40 rounded-lg px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/60"
      />

      {showBody && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Extended description (optional)..."
          rows={3}
          className="w-full mt-1.5 bg-muted/10 border border-border/40 rounded-lg px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/40 resize-none outline-none focus:border-primary/60"
        />
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
          <span className={subject.length > 72 ? 'text-amber-400' : ''}>
            {subject.length}/72
          </span>
          {!showBody && (
            <button
              onClick={() => setShowBody(true)}
              className="hover:text-foreground transition-colors"
            >
              + body
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCommit}
            disabled={!canCommit}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Commit
          </button>
          {aheadCount > 0 && (
            <button
              onClick={onPush}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <Send size={10} />
              Push ↑{aheadCount}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/desktop && npx vitest run src/widgets/git/CommitBar.test.tsx
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/git/CommitBar.tsx apps/desktop/src/widgets/git/CommitBar.test.tsx
git commit -m "feat(desktop): add CommitBar component with subject/body and char count"
```

---

### Task 7: Create StagingArea Component

**Files:**
- Create: `apps/desktop/src/widgets/git/StagingArea.tsx`
- Create: `apps/desktop/src/widgets/git/StagingArea.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/desktop/src/widgets/git/StagingArea.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StagingArea } from './StagingArea'
import type { GitStatusEntry } from '@/lib/orchestra-client'

const unstaged: GitStatusEntry[] = [
  { path: 'src/app.tsx', status: 'M' },
  { path: 'src/new.ts', status: '?' },
  { path: 'src/deleted.ts', status: 'D' },
]

const staged: GitStatusEntry[] = [
  { path: 'README.md', status: 'M' },
]

describe('StagingArea', () => {
  const defaults = {
    unstaged,
    staged,
    selectedFile: null,
    onFileSelect: vi.fn(),
    onStage: vi.fn(),
    onUnstage: vi.fn(),
    onStageAll: vi.fn(),
    onUnstageAll: vi.fn(),
  }

  it('renders unstaged file count', () => {
    render(<StagingArea {...defaults} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/unstaged/i)).toBeInTheDocument()
  })

  it('renders staged file count', () => {
    render(<StagingArea {...defaults} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/staged/i)).toBeInTheDocument()
  })

  it('renders file paths', () => {
    render(<StagingArea {...defaults} />)
    expect(screen.getByText('src/app.tsx')).toBeInTheDocument()
    expect(screen.getByText('README.md')).toBeInTheDocument()
  })

  it('renders status badges', () => {
    render(<StagingArea {...defaults} />)
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('calls onFileSelect when clicking a file', () => {
    const onFileSelect = vi.fn()
    render(<StagingArea {...defaults} onFileSelect={onFileSelect} />)
    fireEvent.click(screen.getByText('src/app.tsx'))
    expect(onFileSelect).toHaveBeenCalledWith('src/app.tsx', false)
  })

  it('calls onFileSelect with staged=true for staged files', () => {
    const onFileSelect = vi.fn()
    render(<StagingArea {...defaults} onFileSelect={onFileSelect} />)
    fireEvent.click(screen.getByText('README.md'))
    expect(onFileSelect).toHaveBeenCalledWith('README.md', true)
  })

  it('calls onStageAll when Stage All clicked', () => {
    const onStageAll = vi.fn()
    render(<StagingArea {...defaults} onStageAll={onStageAll} />)
    fireEvent.click(screen.getByText(/stage all/i))
    expect(onStageAll).toHaveBeenCalled()
  })

  it('calls onUnstageAll when Unstage All clicked', () => {
    const onUnstageAll = vi.fn()
    render(<StagingArea {...defaults} onUnstageAll={onUnstageAll} />)
    fireEvent.click(screen.getByText(/unstage all/i))
    expect(onUnstageAll).toHaveBeenCalled()
  })

  it('highlights selected file', () => {
    const { container } = render(<StagingArea {...defaults} selectedFile="src/app.tsx" />)
    const selected = container.querySelector('[data-selected="true"]')
    expect(selected).toBeInTheDocument()
    expect(selected?.textContent).toContain('src/app.tsx')
  })

  it('shows strikethrough for deleted files', () => {
    render(<StagingArea {...defaults} />)
    const deletedFile = screen.getByText('src/deleted.ts')
    expect(deletedFile).toHaveClass('line-through')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/desktop && npx vitest run src/widgets/git/StagingArea.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/desktop/src/widgets/git/StagingArea.tsx`:

```typescript
import { useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import type { GitStatusEntry } from '@/lib/orchestra-client'

function statusColor(code: string): string {
  switch (code) {
    case 'M': return 'bg-amber-500/20 text-amber-400'
    case 'A': return 'bg-green-500/20 text-green-400'
    case 'D': return 'bg-red-500/20 text-red-400'
    case 'R': return 'bg-blue-500/20 text-blue-400'
    case '?': return 'bg-purple-500/20 text-purple-400'
    default: return 'bg-muted/20 text-muted-foreground'
  }
}

interface FileRowProps {
  entry: GitStatusEntry
  isStaged: boolean
  isSelected: boolean
  onSelect: (path: string, staged: boolean) => void
  id: string
}

function DraggableFileRow({ entry, isStaged, isSelected, onSelect, id }: FileRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-selected={isSelected}
      className={`flex items-center gap-2 px-3 py-1 hover:bg-muted/10 group cursor-pointer ${
        isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'border-l-2 border-transparent'
      }`}
      onClick={() => onSelect(entry.path, isStaged)}
    >
      <span className={`text-[9px] font-bold uppercase w-5 text-center rounded px-1 ${statusColor(entry.status)}`}>
        {entry.status}
      </span>
      <span
        className={`flex-1 text-[11px] truncate ${
          entry.status === 'D' ? 'line-through text-muted-foreground/50' : 'text-foreground'
        }`}
        title={entry.path}
      >
        {entry.path}
      </span>
      <span
        {...attributes}
        {...listeners}
        className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab"
        title="Drag to stage/unstage"
      >
        ⠿
      </span>
    </div>
  )
}

interface StagingAreaProps {
  unstaged: GitStatusEntry[]
  staged: GitStatusEntry[]
  selectedFile: string | null
  onFileSelect: (path: string, staged: boolean) => void
  onStage: (path: string) => void
  onUnstage: (path: string) => void
  onStageAll: () => void
  onUnstageAll: () => void
}

export function StagingArea({
  unstaged,
  staged,
  selectedFile,
  onFileSelect,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
}: StagingAreaProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeIdStr = String(active.id)
    const isFromUnstaged = activeIdStr.startsWith('unstaged-')
    const path = activeIdStr.replace(/^(un)?staged-/, '')

    const overIdStr = String(over.id)
    const isOverStaged = overIdStr === 'staged-drop' || overIdStr.startsWith('staged-')
    const isOverUnstaged = overIdStr === 'unstaged-drop' || overIdStr.startsWith('unstaged-')

    if (isFromUnstaged && isOverStaged) {
      onStage(path)
    } else if (!isFromUnstaged && isOverUnstaged) {
      onUnstage(path)
    }
  }, [onStage, onUnstage])

  const activePath = activeId?.replace(/^(un)?staged-/, '')
  const activeEntry = activeId
    ? [...unstaged, ...staged].find(e => e.path === activePath)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Unstaged */}
        <div className="flex-1 flex flex-col overflow-hidden border-b border-border/40 min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-red-500/5 shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">
              Unstaged{' '}
              <span className="bg-red-500/20 px-1.5 rounded-full text-[9px] ml-1">
                {unstaged.length}
              </span>
            </span>
            {unstaged.length > 0 && (
              <button
                onClick={onStageAll}
                className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Stage All ↓
              </button>
            )}
          </div>
          <div id="unstaged-drop" className="flex-1 overflow-y-auto min-h-0">
            {unstaged.map((entry) => (
              <DraggableFileRow
                key={`unstaged-${entry.path}`}
                id={`unstaged-${entry.path}`}
                entry={entry}
                isStaged={false}
                isSelected={selectedFile === entry.path}
                onSelect={onFileSelect}
              />
            ))}
            {unstaged.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/50">No unstaged files</div>
            )}
          </div>
        </div>

        {/* Staged */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-green-500/5 shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">
              Staged{' '}
              <span className="bg-green-500/20 px-1.5 rounded-full text-[9px] ml-1">
                {staged.length}
              </span>
            </span>
            {staged.length > 0 && (
              <button
                onClick={onUnstageAll}
                className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                ↑ Unstage All
              </button>
            )}
          </div>
          <div id="staged-drop" className="flex-1 overflow-y-auto min-h-0">
            {staged.map((entry) => (
              <DraggableFileRow
                key={`staged-${entry.path}`}
                id={`staged-${entry.path}`}
                entry={entry}
                isStaged={true}
                isSelected={selectedFile === entry.path}
                onSelect={onFileSelect}
              />
            ))}
            {staged.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/50">No staged files</div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeEntry ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-card border border-border/60 rounded shadow-lg">
            <span className={`text-[9px] font-bold uppercase w-5 text-center rounded px-1 ${statusColor(activeEntry.status)}`}>
              {activeEntry.status}
            </span>
            <span className="text-[11px] text-foreground">{activeEntry.path}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/desktop && npx vitest run src/widgets/git/StagingArea.test.tsx
```

Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/git/StagingArea.tsx apps/desktop/src/widgets/git/StagingArea.test.tsx
git commit -m "feat(desktop): add StagingArea component with drag-and-drop"
```

---

### Task 8: Rewrite DiffViewer Component

**Files:**
- Rewrite: `apps/desktop/src/widgets/git/DiffViewer.tsx`
- Create: `apps/desktop/src/widgets/git/DiffViewer.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/desktop/src/widgets/git/DiffViewer.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DiffViewer } from './DiffViewer'

const sampleDiff = `--- a/src/app.tsx
+++ b/src/app.tsx
@@ -1,4 +1,5 @@
 import React from 'react';
-import { old } from './old';
+import { new } from './new';
+import { extra } from './extra';

 function App() {`

describe('DiffViewer', () => {
  it('renders empty state when no diff', () => {
    render(<DiffViewer filePath={null} diff={null} mode="unified" onModeChange={vi.fn()} />)
    expect(screen.getByText(/select a file/i)).toBeInTheDocument()
  })

  it('renders file path in header', () => {
    render(<DiffViewer filePath="src/app.tsx" diff={sampleDiff} mode="unified" onModeChange={vi.fn()} />)
    expect(screen.getByText('src/app.tsx')).toBeInTheDocument()
  })

  it('renders unified/split toggle', () => {
    render(<DiffViewer filePath="src/app.tsx" diff={sampleDiff} mode="unified" onModeChange={vi.fn()} />)
    expect(screen.getByText('Unified')).toBeInTheDocument()
    expect(screen.getByText('Split')).toBeInTheDocument()
  })

  it('calls onModeChange when toggle clicked', () => {
    const onModeChange = vi.fn()
    render(<DiffViewer filePath="src/app.tsx" diff={sampleDiff} mode="unified" onModeChange={onModeChange} />)
    fireEvent.click(screen.getByText('Split'))
    expect(onModeChange).toHaveBeenCalledWith('split')
  })

  it('renders addition lines', () => {
    render(<DiffViewer filePath="src/app.tsx" diff={sampleDiff} mode="unified" onModeChange={vi.fn()} />)
    expect(screen.getByText(/import \{ extra \}/)).toBeInTheDocument()
  })

  it('renders deletion lines', () => {
    render(<DiffViewer filePath="src/app.tsx" diff={sampleDiff} mode="unified" onModeChange={vi.fn()} />)
    expect(screen.getByText(/import \{ old \}/)).toBeInTheDocument()
  })

  it('renders hunk header', () => {
    render(<DiffViewer filePath="src/app.tsx" diff={sampleDiff} mode="unified" onModeChange={vi.fn()} />)
    expect(screen.getByText(/@@ -1,4 \+1,5 @@/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/desktop && npx vitest run src/widgets/git/DiffViewer.test.tsx
```

Expected: FAIL — the existing DiffViewer has different props (`diff` is required string, no `filePath`).

- [ ] **Step 3: Rewrite the implementation**

Rewrite `apps/desktop/src/widgets/git/DiffViewer.tsx` — keep the existing `parseDiff` and `buildSplitRows` logic but update props and add the header bar:

```typescript
import { useMemo, useRef, useEffect } from 'react'

type DiffLine = {
  type: 'add' | 'del' | 'ctx'
  content: string
  oldNum: number | null
  newNum: number | null
}

type Hunk = {
  header: string
  lines: DiffLine[]
}

function parseDiff(raw: string): Hunk[] {
  const hunks: Hunk[] = []
  const lines = raw.split('\n')
  let current: Hunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)/)
    if (hunkMatch) {
      current = { header: line, lines: [] }
      hunks.push(current)
      oldLine = parseInt(hunkMatch[1], 10)
      newLine = parseInt(hunkMatch[2], 10)
      continue
    }

    if (!current) continue

    if (line.startsWith('+')) {
      current.lines.push({ type: 'add', content: line.slice(1), oldNum: null, newNum: newLine })
      newLine++
    } else if (line.startsWith('-')) {
      current.lines.push({ type: 'del', content: line.slice(1), oldNum: oldLine, newNum: null })
      oldLine++
    } else if (line.startsWith(' ') || line === '') {
      current.lines.push({ type: 'ctx', content: line.startsWith(' ') ? line.slice(1) : line, oldNum: oldLine, newNum: newLine })
      oldLine++
      newLine++
    }
  }
  return hunks
}

type SplitRow = {
  leftNum: number | null
  leftContent: string
  leftType: 'add' | 'del' | 'ctx' | 'empty'
  rightNum: number | null
  rightContent: string
  rightType: 'add' | 'del' | 'ctx' | 'empty'
}

function buildSplitRows(hunks: Hunk[]): SplitRow[] {
  const rows: SplitRow[] = []
  for (const hunk of hunks) {
    const lines = hunk.lines
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (line.type === 'ctx') {
        rows.push({
          leftNum: line.oldNum, leftContent: line.content, leftType: 'ctx',
          rightNum: line.newNum, rightContent: line.content, rightType: 'ctx',
        })
        i++
      } else if (line.type === 'del') {
        const dels: DiffLine[] = []
        while (i < lines.length && lines[i].type === 'del') { dels.push(lines[i]); i++ }
        const adds: DiffLine[] = []
        while (i < lines.length && lines[i].type === 'add') { adds.push(lines[i]); i++ }
        const max = Math.max(dels.length, adds.length)
        for (let j = 0; j < max; j++) {
          const d = dels[j]
          const a = adds[j]
          rows.push({
            leftNum: d?.oldNum ?? null, leftContent: d?.content ?? '', leftType: d ? 'del' : 'empty',
            rightNum: a?.newNum ?? null, rightContent: a?.content ?? '', rightType: a ? 'add' : 'empty',
          })
        }
      } else if (line.type === 'add') {
        rows.push({
          leftNum: null, leftContent: '', leftType: 'empty',
          rightNum: line.newNum, rightContent: line.content, rightType: 'add',
        })
        i++
      } else {
        i++
      }
    }
  }
  return rows
}

function lineStyle(type: 'add' | 'del' | 'ctx' | 'empty'): string {
  switch (type) {
    case 'add': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'del': return 'bg-red-500/10 text-red-600 dark:text-red-400'
    default: return ''
  }
}

interface DiffViewerProps {
  filePath: string | null
  diff: string | null
  mode: 'unified' | 'split'
  onModeChange: (mode: 'unified' | 'split') => void
}

export function DiffViewer({ filePath, diff, mode, onModeChange }: DiffViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hunks = useMemo(() => (diff ? parseDiff(diff) : []), [diff])
  const splitRows = useMemo(() => (mode === 'split' ? buildSplitRows(hunks) : []), [hunks, mode])

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [diff])

  if (!diff || !filePath) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a file to view its diff
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-card/30 shrink-0">
        <span className="font-mono text-[11px] text-foreground truncate mr-4">{filePath}</span>
        <div className="flex gap-1 ml-auto shrink-0">
          <button
            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded ${mode === 'unified' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => onModeChange('unified')}
          >
            Unified
          </button>
          <button
            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded ${mode === 'split' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => onModeChange('split')}
          >
            Split
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[11px] leading-5">
        {mode === 'unified' ? (
          <table className="w-full border-collapse">
            <tbody>
              {hunks.map((hunk, hi) => (
                <>{/* Fragment */}
                  <tr key={`h-${hi}`}>
                    <td colSpan={3} className="px-3 py-1 text-[10px] text-muted-foreground/60 bg-muted/10 select-none">
                      {hunk.header}
                    </td>
                  </tr>
                  {hunk.lines.map((line, li) => (
                    <tr key={`${hi}-${li}`} className={lineStyle(line.type)}>
                      <td className="w-10 text-right pr-2 text-muted-foreground/30 select-none align-top">{line.oldNum ?? ''}</td>
                      <td className="w-10 text-right pr-2 text-muted-foreground/30 select-none align-top">{line.newNum ?? ''}</td>
                      <td className="px-3 whitespace-pre-wrap break-all">
                        {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}{line.content}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {hunks.map((hunk, hi) => (
                <tr key={`sh-${hi}`}>
                  <td colSpan={4} className="px-3 py-1 text-[10px] text-muted-foreground/60 bg-muted/10 select-none">
                    {hunk.header}
                  </td>
                </tr>
              ))}
              {splitRows.map((row, ri) => (
                <tr key={ri}>
                  <td className={`w-10 text-right pr-1 select-none align-top text-muted-foreground/30 ${lineStyle(row.leftType)}`}>
                    {row.leftNum ?? ''}
                  </td>
                  <td className={`w-1/2 px-2 whitespace-pre-wrap break-all ${lineStyle(row.leftType)}`}>
                    {row.leftContent}
                  </td>
                  <td className={`w-10 text-right pr-1 select-none align-top text-muted-foreground/30 ${lineStyle(row.rightType)}`}>
                    {row.rightNum ?? ''}
                  </td>
                  <td className={`w-1/2 px-2 whitespace-pre-wrap break-all ${lineStyle(row.rightType)}`}>
                    {row.rightContent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/desktop && npx vitest run src/widgets/git/DiffViewer.test.tsx
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/git/DiffViewer.tsx apps/desktop/src/widgets/git/DiffViewer.test.tsx
git commit -m "feat(desktop): rewrite DiffViewer with filePath prop and header bar"
```

---

### Task 9: Rewrite GitTab Shell

**Files:**
- Rewrite: `apps/desktop/src/widgets/git/GitTab.tsx`
- Modify: `apps/desktop/src/widgets/git/BranchBar.tsx`
- Delete: `apps/desktop/src/widgets/git/ChangesList.tsx`
- Modify: `apps/desktop/src/widgets/git/index.ts`

- [ ] **Step 1: Update BranchBar to accept ahead/behind and push/pull**

Read `apps/desktop/src/widgets/git/BranchBar.tsx`. Add new props and Push/Pull buttons. Update the component props interface:

Add to the props:
```typescript
aheadBehind?: { ahead: number; behind: number }
onPush?: () => void
onPull?: () => void
```

Add Push/Pull buttons after the Stash button section, before the closing `</div>`:

```typescript
{onPull && (
  <button
    onClick={onPull}
    disabled={loading}
    className="rounded-md px-2.5 py-1 text-[10px] font-bold text-muted-foreground/50 bg-muted/10 border border-border/20 hover:bg-muted/30 hover:text-foreground transition-all"
  >
    Pull{aheadBehind && aheadBehind.behind > 0 ? ` ↓${aheadBehind.behind}` : ''}
  </button>
)}
```

- [ ] **Step 2: Rewrite GitTab.tsx**

Replace the entire contents of `apps/desktop/src/widgets/git/GitTab.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Project } from '@/lib/orchestra-types'
import type { BackendConfig, GitStatusEntry, GitHubPR } from '@/lib/orchestra-client'
import {
  fetchProjectGitHistory,
  fetchProjectGitStatus,
  fetchProjectGitDiff,
  fetchProjectGitBranches,
  gitStage,
  gitUnstage,
  gitCommit,
  gitPush,
  gitPull,
} from '@/lib/orchestra-client'

import { BranchBar } from './BranchBar'
import { StagingArea } from './StagingArea'
import { CommitBar } from './CommitBar'
import { CommitTimeline } from './CommitTimeline'
import { DiffViewer } from './DiffViewer'
import { GitHubPanel } from './GitHubPanel'
import { PRReviewView } from './PRReviewView'
import { ResizableSplit } from './ResizableSplit'

type SubTab = 'changes' | 'history' | 'github'

function classifyFiles(files: GitStatusEntry[]): { unstaged: GitStatusEntry[]; staged: GitStatusEntry[] } {
  const staged: GitStatusEntry[] = []
  const unstaged: GitStatusEntry[] = []

  for (const entry of files) {
    const s = entry.status
    if (s === '??' || s === '? ') {
      unstaged.push({ ...entry, status: '?' })
      continue
    }
    const indexCode = s.charAt(0)
    const wtCode = s.charAt(1)
    if (indexCode !== ' ' && indexCode !== '?') {
      staged.push({ ...entry, status: indexCode })
    }
    if (wtCode !== ' ' && wtCode !== '?') {
      unstaged.push({ ...entry, status: wtCode })
    }
  }

  return { staged, unstaged }
}

export function GitTab({
  project,
  config,
}: {
  project: Project
  config: BackendConfig | null
}) {
  const [currentBranch, setCurrentBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [files, setFiles] = useState<GitStatusEntry[]>([])
  const [aheadBehind, setAheadBehind] = useState({ ahead: 0, behind: 0 })
  const [commits, setCommits] = useState<import('@/lib/orchestra-client').GitCommit[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFileStaged, setSelectedFileStaged] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('changes')
  const [activePR, setActivePR] = useState<GitHubPR | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadAll = useCallback(async () => {
    if (!config) return
    setRefreshing(true)
    try {
      const [branchData, statusData, historyData] = await Promise.all([
        fetchProjectGitBranches(config, project.id),
        fetchProjectGitStatus(config, project.id),
        fetchProjectGitHistory(config, project.id),
      ])
      setCurrentBranch(branchData.current || '')
      setBranches(branchData.branches || [])
      setFiles(statusData.files || [])
      setAheadBehind(statusData.branch || { ahead: 0, behind: 0 })
      setCommits(historyData)
    } catch (err) {
      console.error('git load failed', err)
    } finally {
      setRefreshing(false)
    }
  }, [config, project.id])

  useEffect(() => { loadAll() }, [loadAll])

  // Fetch diff when file or commit is selected
  useEffect(() => {
    if (!config) return
    if (selectedCommit) {
      fetchProjectGitDiff(config, project.id, { hash: selectedCommit })
        .then(d => setDiff(d || null))
        .catch(() => setDiff(null))
    } else if (selectedFile) {
      fetchProjectGitDiff(config, project.id, { file: selectedFile, staged: selectedFileStaged })
        .then(d => setDiff(d || null))
        .catch(() => setDiff(null))
    } else {
      setDiff(null)
    }
  }, [config, project.id, selectedFile, selectedFileStaged, selectedCommit])

  const handleFileSelect = useCallback((path: string, staged: boolean) => {
    setSelectedFile(path)
    setSelectedFileStaged(staged)
    setSelectedCommit(null)
  }, [])

  const handleCommitSelect = useCallback((hash: string) => {
    setSelectedCommit(hash)
    setSelectedFile(null)
  }, [])

  const handleStage = useCallback(async (path: string) => {
    if (!config) return
    await gitStage(config, project.id, [path])
    loadAll()
  }, [config, project.id, loadAll])

  const handleUnstage = useCallback(async (path: string) => {
    if (!config) return
    await gitUnstage(config, project.id, [path])
    loadAll()
  }, [config, project.id, loadAll])

  const handleStageAll = useCallback(async () => {
    if (!config) return
    const { unstaged } = classifyFiles(files)
    await gitStage(config, project.id, unstaged.map(f => f.path))
    loadAll()
  }, [config, project.id, files, loadAll])

  const handleUnstageAll = useCallback(async () => {
    if (!config) return
    const { staged } = classifyFiles(files)
    await gitUnstage(config, project.id, staged.map(f => f.path))
    loadAll()
  }, [config, project.id, files, loadAll])

  const handleCommit = useCallback(async (message: string) => {
    if (!config) return
    await gitCommit(config, project.id, message)
    loadAll()
  }, [config, project.id, loadAll])

  const handlePush = useCallback(async () => {
    if (!config) return
    await gitPush(config, project.id)
    loadAll()
  }, [config, project.id, loadAll])

  const handlePull = useCallback(async () => {
    if (!config) return
    await gitPull(config, project.id)
    loadAll()
  }, [config, project.id, loadAll])

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Waiting for backend connection...
      </div>
    )
  }

  const { staged, unstaged } = classifyFiles(files)

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'changes', label: 'Changes' },
    { key: 'history', label: 'History' },
    ...(project.github_owner && project.github_repo ? [{ key: 'github' as SubTab, label: 'GitHub' }] : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Branch bar */}
      <div className="flex items-center border-b border-border/40 shrink-0 bg-card/30">
        <div className="flex-1 min-w-0 overflow-hidden">
          <BranchBar
            projectId={project.id}
            config={config}
            currentBranch={currentBranch}
            branches={branches}
            onBranchChange={loadAll}
            aheadBehind={aheadBehind}
            onPush={handlePush}
            onPull={handlePull}
          />
        </div>
        <button
          onClick={loadAll}
          disabled={refreshing}
          className="shrink-0 px-3 py-2.5 text-muted-foreground/40 hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-refresh-spin' : ''} />
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-border/40 shrink-0 bg-card/20">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              activeSubTab === tab.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground/50 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeSubTab === 'changes' && (
        <ResizableSplit
          left={
            <div className="flex flex-col h-full overflow-hidden">
              <StagingArea
                unstaged={unstaged}
                staged={staged}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onStage={handleStage}
                onUnstage={handleUnstage}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
              />
              <CommitBar
                stagedCount={staged.length}
                aheadCount={aheadBehind.ahead}
                onCommit={handleCommit}
                onPush={handlePush}
              />
            </div>
          }
          right={
            <DiffViewer
              filePath={selectedFile}
              diff={diff}
              mode={diffMode}
              onModeChange={setDiffMode}
            />
          }
        />
      )}

      {activeSubTab === 'history' && (
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-80 shrink-0 border-r border-border/40 overflow-hidden">
            <CommitTimeline
              commits={commits}
              selectedHash={selectedCommit}
              onSelectCommit={handleCommitSelect}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <DiffViewer
              filePath={selectedCommit ? `commit: ${selectedCommit.slice(0, 8)}` : null}
              diff={diff}
              mode={diffMode}
              onModeChange={setDiffMode}
            />
          </div>
        </div>
      )}

      {activeSubTab === 'github' && project.github_owner && project.github_repo && (
        <div className="flex-1 overflow-auto">
          <GitHubPanel
            projectId={project.id}
            config={config}
            githubToken={project.github_token ?? ''}
            onOpenPR={setActivePR}
          />
        </div>
      )}

      {/* PR Review overlay */}
      {activePR && (
        <PRReviewView
          projectId={project.id}
          config={config}
          pr={activePR}
          onClose={() => setActivePR(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Delete ChangesList.tsx**

```bash
rm apps/desktop/src/widgets/git/ChangesList.tsx
```

- [ ] **Step 4: Update index.ts**

Replace `apps/desktop/src/widgets/git/index.ts`:

```typescript
export { GitTab } from './GitTab'
export { DiffViewer } from './DiffViewer'
export { StagingArea } from './StagingArea'
export { CommitBar } from './CommitBar'
export { ResizableSplit } from './ResizableSplit'
```

- [ ] **Step 5: Run typecheck**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: passes. Fix any type errors if present — likely in BranchBar props (the new optional props should be backward-compatible).

- [ ] **Step 6: Run all tests**

```bash
cd apps/desktop && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A apps/desktop/src/widgets/git/
git commit -m "feat(desktop): rewrite GitTab with new two-panel layout and sub-tabs"
```

---

### Task 10: Final Integration Test

**Files:**
- Create: `apps/desktop/src/widgets/git/GitTab.test.tsx`

- [ ] **Step 1: Write integration smoke test**

Create `apps/desktop/src/widgets/git/GitTab.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitTab } from './GitTab'

// Mock all API calls
vi.mock('@/lib/orchestra-client', () => ({
  fetchProjectGitBranches: vi.fn().mockResolvedValue({ current: 'main', branches: ['main', 'dev'] }),
  fetchProjectGitStatus: vi.fn().mockResolvedValue({
    files: [
      { path: 'src/app.tsx', status: ' M' },
      { path: 'README.md', status: 'M ' },
    ],
    branch: { ahead: 1, behind: 0 },
  }),
  fetchProjectGitHistory: vi.fn().mockResolvedValue([
    { hash: 'abc123', message: 'initial commit', author: 'test', date: '2026-01-01' },
  ]),
  fetchProjectGitDiff: vi.fn().mockResolvedValue(''),
  gitStage: vi.fn().mockResolvedValue(undefined),
  gitUnstage: vi.fn().mockResolvedValue(undefined),
  gitCommit: vi.fn().mockResolvedValue(undefined),
  gitPush: vi.fn().mockResolvedValue(undefined),
  gitPull: vi.fn().mockResolvedValue(undefined),
}))

const mockProject = {
  id: 'proj-1',
  name: 'Test Project',
  root_path: '/tmp/test',
  github_owner: '',
  github_repo: '',
  github_token: '',
}

const mockConfig = {
  baseUrl: 'http://localhost:4010',
  apiToken: 'test-token',
}

describe('GitTab', () => {
  it('renders without crashing', async () => {
    render(<GitTab project={mockProject as any} config={mockConfig} />)
    // Should show the Changes tab
    expect(await screen.findByText('Changes')).toBeInTheDocument()
  })

  it('renders sub-tabs', async () => {
    render(<GitTab project={mockProject as any} config={mockConfig} />)
    expect(await screen.findByText('Changes')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  it('shows unstaged and staged sections after load', async () => {
    render(<GitTab project={mockProject as any} config={mockConfig} />)
    expect(await screen.findByText(/unstaged/i)).toBeInTheDocument()
    expect(screen.getByText(/staged/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the integration test**

```bash
cd apps/desktop && npx vitest run src/widgets/git/GitTab.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 3: Run full test suite**

```bash
cd apps/desktop && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Build the backend**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

Expected: builds successfully.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/git/GitTab.test.tsx
git commit -m "test(desktop): add GitTab integration smoke tests"
```
