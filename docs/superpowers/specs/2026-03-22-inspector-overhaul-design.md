# Issue Inspector UX Overhaul — Design Spec

**Issue:** #69
**Scope:** Plan rendering + persistence, session UI redesign, per-task changes isolation

## 1. Plan Markdown Rendering + Persistence

### Problem
Plan items render as plain text. Markdown formatting doesn't work. Plan disappears when inspector closes.

### Solution

**Markdown rendering:** Replace `<span>{item.text}</span>` with `<ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>` in the plan item rendering (IssueDetailView.tsx ~line 581). Apply the same prose styling used elsewhere in the app.

**Plan cache:** Create `apps/desktop/src/widgets/issue-detail/planCache.ts`:

```typescript
const cache = new Map<string, PlanItem[]>()

export function getCachedPlan(identifier: string): PlanItem[] {
  return cache.get(identifier) || []
}

export function setCachedPlan(identifier: string, items: PlanItem[]) {
  if (items.length > 0) cache.set(identifier, items)
}
```

In IssueDetailView, after plan extraction:
- Call `setCachedPlan(identifier, planItems)` when items are found
- On mount, initialize with `getCachedPlan(identifier)` before async fetch
- Show cached plan immediately, replace with fresh data when it arrives

## 2. Session UI — Vertical Timeline

### Problem
The Session tab renders raw JSONL events as a flat list with inconsistent styling. It looks out of place compared to the rest of the app.

### Solution

Create `apps/desktop/src/widgets/issue-detail/SessionTimeline.tsx` — a new component that renders agent activity as a vertical timeline.

**Props:**
```typescript
interface SessionTimelineProps {
  logs: string           // Raw JSONL session logs
  loading: boolean
}
```

**Visual design:**
- Vertical timeline line (2px, `bg-border/20`) on the left
- Colored dots per event type:
  - Purple (`bg-violet-500`) — agent messages, reasoning
  - Green (`bg-emerald-500`) — file reads, writes
  - Amber (`bg-amber-500`) — bash commands, tool calls
  - Red (`bg-red-500`) — errors
- Agent messages rendered with `<ReactMarkdown>` in a subtle card
- Tool calls as compact inline rows: `[TYPE] path/or/command [result indicator]`
- Tool results collapsed by default, expandable on click
- Timestamps as relative time on each entry

**JSONL parsing:**
Parse each line as JSON. Categorize by `type` field:
- `assistant` / `text` → agent message (purple dot, render content with markdown)
- `tool_use` / `tool_result` → tool call (green/amber dot based on tool name)
- `error` → error (red dot)
- `system` → skip or dim

**Scrolling:** Auto-scroll to bottom when new entries appear (while agent is running). Stop auto-scroll when user scrolls up.

## 3. Per-Task Changes Isolation

### Problem
The Changes tab sometimes shows changes from other tasks on the same project.

### Current State
The backend `GetIssueDiff` handler in `state.go` already reads `base_sha` and `branch_name` from the issue's database record and runs `git diff <base_sha>...<branch>`. This should scope changes per task.

### Solution
Verify the existing backend scoping works correctly. The likely issue is that `base_sha` or `branch_name` is not populated for certain issue creation paths (e.g., tasks created through the UI vs imported from GitHub).

**Investigation needed:**
- Check if `base_sha` is set when a task moves to Todo (when the agent first dispatches and creates a worktree/branch)
- Check if `branch_name` is set on the issue record
- If either is missing, ensure the orchestrator populates them during dispatch

**Frontend:** Ensure `fetchIssueDiff` passes the issue `provider` param so the backend can locate the correct session/worktree for the diff. No new params needed — the backend reads from the DB.

## 4. File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/desktop/src/widgets/issue-detail/SessionTimeline.tsx` | Create | Vertical timeline session renderer |
| `apps/desktop/src/widgets/issue-detail/SessionTimeline.test.tsx` | Create | Tests |
| `apps/desktop/src/widgets/issue-detail/planCache.ts` | Create | Plan persistence cache |
| `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` | Modify | Use SessionTimeline, plan cache, markdown plan items, scoped diff |
| `apps/desktop/src/lib/orchestra-client.ts` | Verify | Ensure provider param passed to fetchIssueDiff |
| `apps/backend/internal/api/state.go` | Verify | Confirm base_sha/branch_name populated during dispatch |

## Out of Scope

- Step grouping / logical step detection (option C from brainstorming)
- Full session replay
- Plan editing from the UI
- Multi-file diff viewer in Changes tab
