# Inspector Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix plan markdown rendering + persistence, redesign session UI as vertical timeline, and verify per-task changes isolation.

**Architecture:** Three independent changes to IssueDetailView: (1) plan cache utility + ReactMarkdown for plan items, (2) new SessionTimeline component replacing the inline log parser, (3) verify diff scoping uses existing base_sha/branch_name fields.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, react-markdown, remark-gfm, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-inspector-overhaul-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/desktop/src/widgets/issue-detail/planCache.ts` | Create | Module-level plan persistence cache |
| `apps/desktop/src/widgets/issue-detail/SessionTimeline.tsx` | Create | Vertical timeline session renderer |
| `apps/desktop/src/widgets/issue-detail/SessionTimeline.test.tsx` | Create | Tests for SessionTimeline |
| `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` | Modify | Use plan cache, ReactMarkdown for plan items, use SessionTimeline |

---

### Task 1: Plan Cache + Markdown Rendering

**Files:**
- Create: `apps/desktop/src/widgets/issue-detail/planCache.ts`
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx`

- [ ] **Step 1: Create planCache.ts**

Create `apps/desktop/src/widgets/issue-detail/planCache.ts`:

```typescript
import type { PlanItem } from './IssueDetailUtils'

const cache = new Map<string, PlanItem[]>()

export function getCachedPlan(identifier: string): PlanItem[] {
  return cache.get(identifier) || []
}

export function setCachedPlan(identifier: string, items: PlanItem[]) {
  if (items.length > 0) cache.set(identifier, items)
}

export function clearCachedPlan(identifier: string) {
  cache.delete(identifier)
}
```

- [ ] **Step 2: Wire plan cache into IssueDetailView**

In `IssueDetailView.tsx`, import the cache:
```typescript
import { getCachedPlan, setCachedPlan, clearCachedPlan } from './planCache'
```

Find the `planItems` useMemo (~line 162). After the memo, add a cache write effect:
```typescript
useEffect(() => {
  if (identifier && planItems.length > 0) {
    setCachedPlan(identifier, planItems)
  }
}, [identifier, planItems])
```

At the start of the useMemo, before scanning history, check the cache:
```typescript
const planItems: PlanItem[] = useMemo(() => {
  // ... existing extraction logic ...

  // If nothing found from any source, use cached plan
  const cached = getCachedPlan(identifier)
  if (cached.length > 0) return cached

  return extractPlanFromText(description)
}, [issueHistory, timeline, issueId, identifier, description, logs])
```

Add cache clear in `handleStateChange` when resetting to Backlog:
```typescript
if (newState === 'Backlog') {
  clearCachedPlan(identifier)
  // ... existing clear logic
}
```

- [ ] **Step 3: Render plan items with ReactMarkdown**

Find the plan item rendering (~line 581). Replace the plain `<span>`:

```typescript
<span className={`text-sm leading-relaxed ${item.done ? 'text-muted-foreground/40 line-through' : 'text-foreground'}`}>{item.text}</span>
```

with:

```typescript
<div className={`text-sm leading-relaxed prose prose-sm prose-invert max-w-none ${item.done ? 'text-muted-foreground/40 line-through opacity-50' : 'text-foreground'}`}>
  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
</div>
```

`ReactMarkdown` and `remarkGfm` are already imported at lines 3-4.

- [ ] **Step 4: Run tests**

```bash
cd apps/desktop && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/planCache.ts apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "feat(desktop): add plan cache persistence and markdown rendering for plan items"
```

---

### Task 2: Create SessionTimeline Component

**Files:**
- Create: `apps/desktop/src/widgets/issue-detail/SessionTimeline.tsx`
- Create: `apps/desktop/src/widgets/issue-detail/SessionTimeline.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/src/widgets/issue-detail/SessionTimeline.test.tsx`:

Tests to cover:
1. Renders empty state when no logs
2. Renders agent message with purple dot
3. Renders tool call with green/amber dot
4. Renders error with red dot
5. Shows loading spinner when loading
6. Collapses tool results by default
7. Expands tool result on click

**IMPORTANT:** No `@testing-library/jest-dom`. Use `toBeTruthy()`, `.textContent`, `.className`.

- [ ] **Step 2: Run tests to verify fail**

```bash
cd apps/desktop && npx vitest run src/widgets/issue-detail/SessionTimeline.test.tsx
```

- [ ] **Step 3: Write the implementation**

Create `apps/desktop/src/widgets/issue-detail/SessionTimeline.tsx`:

```typescript
import { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react'

interface TimelineEntry {
  id: number
  kind: 'agent' | 'tool' | 'result' | 'error' | 'system'
  label: string
  content: string
  ts: string
  toolName?: string
  status?: string
}

interface SessionTimelineProps {
  logs: string
  loading: boolean
}

const DOT_COLORS: Record<string, string> = {
  agent: 'bg-violet-500',
  tool: 'bg-amber-500',
  result: 'bg-emerald-500',
  error: 'bg-red-500',
  system: 'bg-muted-foreground/30',
}

const LABEL_COLORS: Record<string, string> = {
  agent: 'text-violet-400',
  tool: 'text-amber-400',
  result: 'text-emerald-400',
  error: 'text-red-400',
  system: 'text-muted-foreground/40',
}

function parseSessionLogs(raw: string): TimelineEntry[] {
  if (!raw) return []
  const entries: TimelineEntry[] = []
  let idx = 0

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const obj = JSON.parse(line)
      const ts = obj.timestamp
        ? new Date(obj.timestamp as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : ''
      const type = (obj.type as string) || ''

      if (type === 'assistant' || type === 'message') {
        // Agent message
        const content = typeof obj.message?.content === 'string'
          ? obj.message.content
          : Array.isArray(obj.message?.content)
            ? obj.message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
            : obj.content || ''
        if (content) {
          entries.push({ id: idx++, kind: 'agent', label: 'Agent', content, ts })
        }
      } else if (type === 'tool_use') {
        const name = (obj.tool_name || obj.name || 'tool') as string
        const cmd = (obj.parameters?.command || obj.parameters?.file_path || obj.input?.command || obj.input?.file_path || '') as string
        entries.push({ id: idx++, kind: 'tool', label: name.toUpperCase(), content: cmd, ts, toolName: name })
      } else if (type === 'tool_result' || type === 'user') {
        const output = typeof obj.output === 'string' ? obj.output : typeof obj.content === 'string' ? obj.content : ''
        if (output && !output.startsWith('{"type":"tool_result"')) {
          entries.push({ id: idx++, kind: 'result', label: 'Result', content: output.slice(0, 500), ts, status: obj.status as string })
        }
      } else if (type === 'error') {
        entries.push({ id: idx++, kind: 'error', label: 'Error', content: obj.message || obj.error || 'Unknown error', ts })
      } else if (type === 'result') {
        const text = typeof obj.result === 'string' ? obj.result : ''
        if (text) entries.push({ id: idx++, kind: 'agent', label: 'Result', content: text, ts })
      } else if (type === 'content_block_delta') {
        const text = obj.delta?.text || ''
        if (text) entries.push({ id: idx++, kind: 'agent', label: 'Agent', content: text, ts })
      }
      // Skip system, init, lifecycle events
    } catch {
      // Non-JSON line — skip
    }
  }

  // Deduplicate consecutive identical entries
  return entries.filter((e, i) =>
    i === 0 || e.content !== entries[i - 1].content || e.kind !== entries[i - 1].kind
  )
}

export function SessionTimeline({ logs, loading }: SessionTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const entries = useMemo(() => parseSessionLogs(logs), [logs])

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary/30" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No session activity</p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="h-full overflow-auto p-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-border/20" />

        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-3 mb-1 relative">
            {/* Dot */}
            <div className={`w-4 h-4 rounded-full shrink-0 mt-1 ${DOT_COLORS[entry.kind]} ring-2 ring-background z-10`} />

            {/* Content */}
            <div className="flex-1 min-w-0 pb-3">
              {entry.kind === 'agent' ? (
                <div className="bg-card/50 border border-border/20 rounded-lg px-3 py-2">
                  <div className="text-[9px] text-muted-foreground/40 mb-1">{entry.ts}</div>
                  <div className="text-[12px] text-foreground/90 prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
                  </div>
                </div>
              ) : entry.kind === 'tool' || entry.kind === 'result' ? (
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="flex items-center gap-2 w-full text-left px-2 py-1 rounded-md hover:bg-muted/10 transition-colors group"
                >
                  {expandedIds.has(entry.id) ? (
                    <ChevronDown size={10} className="text-muted-foreground/30 shrink-0" />
                  ) : (
                    <ChevronRight size={10} className="text-muted-foreground/30 shrink-0" />
                  )}
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${LABEL_COLORS[entry.kind]} shrink-0`}>
                    {entry.label}
                  </span>
                  <span className="text-[11px] text-foreground/60 font-mono truncate">{entry.content}</span>
                  {entry.status === 'success' && <span className="text-[9px] text-emerald-500 ml-auto shrink-0">✓</span>}
                  <span className="text-[9px] text-muted-foreground/20 ml-auto shrink-0">{entry.ts}</span>
                </button>
              ) : entry.kind === 'error' ? (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                  <span className="text-[9px] font-bold uppercase text-red-400">Error</span>
                  <p className="text-[11px] text-red-300 mt-1">{entry.content}</p>
                </div>
              ) : null}

              {/* Expanded result content */}
              {expandedIds.has(entry.id) && (entry.kind === 'tool' || entry.kind === 'result') && entry.content && (
                <div className="mt-1 ml-5 px-3 py-2 bg-muted/5 border border-border/10 rounded-md">
                  <pre className="text-[10px] text-muted-foreground/60 font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-auto">
                    {entry.content}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/desktop && npx vitest run src/widgets/issue-detail/SessionTimeline.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/SessionTimeline.tsx apps/desktop/src/widgets/issue-detail/SessionTimeline.test.tsx
git commit -m "feat(desktop): add SessionTimeline component with vertical timeline design"
```

---

### Task 3: Wire SessionTimeline into IssueDetailView

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx`

- [ ] **Step 1: Import SessionTimeline**

```typescript
import { SessionTimeline } from './SessionTimeline'
```

- [ ] **Step 2: Replace the output tab content**

Find the output tab rendering (~line 600). Replace everything inside `{bottomTab === 'output' && (...)}` with:

```typescript
{bottomTab === 'output' && (
  <SessionTimeline logs={logs} loading={logsLoading} />
)}
```

This replaces the entire inline JSONL parser (lines ~600-850) with the new component.

- [ ] **Step 3: Run full test suite**

```bash
cd apps/desktop && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "feat(desktop): replace inline session log renderer with SessionTimeline component"
```

---

### Task 4: Verify Per-Task Changes Isolation

**Files:**
- Verify: `apps/backend/internal/api/state.go` — GetIssueDiff handler
- Verify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` — diff fetch

- [ ] **Step 1: Read the backend GetIssueDiff handler**

Read `apps/backend/internal/api/state.go` and find the `GetIssueDiff` handler. Verify it reads `base_sha` and `branch_name` from the issue record and runs `git diff <base_sha>...<branch>`.

- [ ] **Step 2: Check if base_sha and branch_name are populated**

```bash
curl -s -H "Authorization: Bearer dev-token" http://localhost:4010/api/v1/issues/FETCH-1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'base_sha={d.get(\"base_sha\",\"MISSING\")} branch={d.get(\"branch_name\",\"MISSING\")}')"
```

If either is MISSING, the orchestrator needs to populate them during dispatch. Read the dispatch code to find where `branch_name` and `base_sha` are set.

- [ ] **Step 3: Fix if needed**

If `base_sha` or `branch_name` is not being set, add the population logic in the orchestrator's dispatch flow. This will depend on what the investigation finds.

- [ ] **Step 4: Commit if changes were made**

```bash
git add -A
git commit -m "fix(backend): ensure base_sha and branch_name populated for per-task diff isolation"
```

---

### Task 5: Integration Test & Cleanup

- [ ] **Step 1: Run full test suite**

```bash
cd apps/desktop && npx vitest run
```

- [ ] **Step 2: Build backend**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 3: Remove dead code**

The inline log parser in IssueDetailView (~lines 600-850) should have been fully replaced by SessionTimeline. Verify no references remain to the old parsed log entries. Remove any unused imports.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(desktop): clean up dead session parser code"
```
