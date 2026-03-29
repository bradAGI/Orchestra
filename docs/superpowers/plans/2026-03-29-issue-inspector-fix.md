# Issue Inspector Fix — Restore Subprocess Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the issue inspector so the full lifecycle works: subprocess execution with JSON event parsing, Session tab showing filtered events, plan extraction from structured messages, auto-advance through states, and correct worktree diffs.

**Architecture:** Agents run in subprocess mode (`claude -p {{prompt}} --output-format stream-json`). The orchestrator captures stdout, parses JSON events, records them to DB, and publishes via SSE. The inspector's Session tab shows these events via `SessionTimeline`. The Terminal section (sidebar) remains for manual agent launches only — it does NOT show issue sessions. The `filterAgentOutput()` function is restored for the Terminal section's issue-scoped sessions.

**Tech Stack:** Go backend, React/TypeScript frontend

---

## Current State (What's Broken)

1. **terminal.go** — WebSocket handler polls for PTY session that doesn't exist (subprocess mode doesn't create one), then closes the connection. Issue terminals are broken.
2. **IssueDetailView.tsx Session tab** — renamed to "Terminal", tries to embed a TerminalView that connects to a non-existent PTY session.
3. **Plan extraction** — filter includes `stdout`/`pty`/`stderr`/`output` kinds that don't exist in subprocess mode. The contiguous group finder is overly complex.
4. **registry.go** — terminal manager not attached to specialized runners (intentional for subprocess mode, but terminal.go still expects PTY sessions).

## File Map

| File | Change |
|------|--------|
| `apps/backend/internal/api/terminal.go` | Restore simple session creation for issue terminals (no PTY polling) |
| `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` | Revert Session tab to SessionTimeline, restore original plan extraction |
| No other files need changes | Commands and registry are already correct for subprocess mode |

---

### Task 1: Fix terminal.go — restore simple session handling

**Files:**
- Modify: `apps/backend/internal/api/terminal.go:65-98`

The current code polls for a PTY session that subprocess mode never creates. Revert to simple behavior: for issue sessions, create a bash shell in the worktree directory (for manual use). For non-issue sessions, same as now.

- [ ] **Step 1: Replace the PTY polling block with simple session creation**

In `apps/backend/internal/api/terminal.go`, replace lines 65-98:

```go
// CURRENT (broken — polls for PTY that doesn't exist):
if strings.HasPrefix(sessionID, "issue-") {
    for attempt := 0; attempt < 10; attempt++ {
        existing := s.termManager.GetSession(sessionID)
        ...20 second polling loop...
    }
    if session == nil {
        conn.WriteMessage(...)
        conn.Close()
        return
    }
} else {
    session, err = s.termManager.CreateSession(sessionID, dir, "/bin/bash")
    ...
}

// REPLACE WITH:
session, err = s.termManager.CreateSession(sessionID, dir, "/bin/bash")
if err != nil {
    s.logger.Error().Err(err).Msg("failed to create terminal session")
    return
}
```

Also remove the `"time"` import if no longer used, and remove the `terminal` package import if `terminal.Session` is no longer referenced directly.

- [ ] **Step 2: Restore filterAgentOutput for issue sessions**

The `filterAgentOutput` function still exists in terminal.go (line 190+). Re-add the filtering in the WebSocket handler's output handler. After the session creation, the handler should be:

```go
// Send data to client — filter JSON noise for agent sessions
isAgentSession := strings.HasPrefix(sessionID, "issue-")
handlerID := session.AddHandler(func(data []byte) {
    if isAgentSession {
        filtered := filterAgentOutput(data)
        if len(filtered) == 0 {
            return
        }
        data = filtered
    }
    err := conn.WriteMessage(websocket.BinaryMessage, data)
    if err != nil {
        // Don't log as error, it just means client disconnected
    }
})
```

- [ ] **Step 3: Verify Go compiles**

Run: `cd apps/backend && go vet ./internal/api/...`
Expected: No errors

- [ ] **Step 4: Build backend**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/api/terminal.go
git commit -m "fix(backend): restore simple terminal session handling for subprocess mode"
```

---

### Task 2: Revert Session tab to SessionTimeline

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx:389-394` (tab label)
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx:711-727` (tab content)

- [ ] **Step 1: Rename tab from "Terminal" back to "Session"**

At line 392, change:
```tsx
// CURRENT:
{ id: 'output' as const, label: 'Terminal', icon: Terminal, count: undefined },

// CHANGE TO:
{ id: 'output' as const, label: 'Session', icon: Terminal, count: undefined },
```

- [ ] **Step 2: Replace TerminalView embed with SessionTimeline**

At lines 711-727, replace the current terminal embed:

```tsx
// CURRENT:
{bottomTab === 'output' && (
  <div className="h-full">
    {config && localState !== 'Backlog' ? (
      <div className="w-full h-full px-2 py-1">
        <TerminalView
          sessionId={`issue-${identifier}`}
          projectId={projectId}
          baseUrl={config.baseUrl}
          apiToken={config.apiToken}
          theme={theme}
        />
      </div>
    ) : (
      <SessionTimeline logs={logs} loading={logsLoading} />
    )}
  </div>
)}

// REPLACE WITH:
{bottomTab === 'output' && (
  <SessionTimeline logs={logs} loading={logsLoading} />
)}
```

- [ ] **Step 3: Remove unused TerminalView import**

At the imports section, remove:
```tsx
import { TerminalView } from '@/components/terminal/TerminalView'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: No new errors (pre-existing App.tsx errors OK)

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "fix(desktop): revert Session tab to SessionTimeline — remove TerminalView embed"
```

---

### Task 3: Fix plan extraction for subprocess JSON events

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx:168-211`

The plan extraction currently has a complex contiguous-group finder with `stdout`/`pty`/`stderr`/`output` kinds that don't exist in subprocess mode. Subprocess mode emits events with kinds like `message`, `assistant`, `content_block_delta`, `result`. Restore the simple approach.

- [ ] **Step 1: Simplify the plan event filter and extraction**

Replace lines 168-211 with:

```tsx
const planItems: PlanItem[] = useMemo(() => {
    // In subprocess mode, events have structured kinds: message, assistant, result, etc.
    // Filter for events that contain agent text messages.
    const PLAN_EVENT_KINDS = new Set([
      'message', 'agent_message', 'item.completed', 'assistant',
      'result/end_turn', 'result', 'stdout', 'pty',
    ])
    const messageEvents = issueHistory.filter(e =>
      PLAN_EVENT_KINDS.has(e.kind) && e.message
    )

    let historyPlan: PlanItem[] = []
    let logsPlan: PlanItem[] = []

    // Source 1: issue history — scan newest-first for the most recent
    // message with 3+ checkboxes (the agent restates the plan with updates)
    if (messageEvents.length > 0) {
      for (const entry of [...messageEvents].reverse()) {
        const items = extractPlanFromText(entry.message!)
        if (items.length >= 3) { historyPlan = items; break }
      }
    }
```

Keep the rest of the function (Source 2: logs, bestPlan selection, fallbacks) as-is — just remove the contiguous-group-finder block.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "fix(desktop): simplify plan extraction for subprocess JSON events"
```

---

### Task 4: Verify the pipeline end-to-end via API

No code changes — just testing.

- [ ] **Step 1: Restart orchestrad**

```bash
pkill -f orchestrad; sleep 2
cd apps/backend
ORCHESTRA_API_TOKEN=dev-token ORCHESTRA_WORKSPACE_ROOT=/tmp/orchestra ./orchestrad &
sleep 3
curl -s -H "Authorization: Bearer dev-token" http://localhost:3284/api/v1/state | python3 -c "import json,sys; print('OK:', json.load(sys.stdin).get('generated_at','?'))"
```

If port 3284 doesn't respond, try 4010.

- [ ] **Step 2: Create an issue via API**

```bash
curl -s -X POST -H "Authorization: Bearer dev-token" -H "Content-Type: application/json" \
  http://localhost:4010/api/v1/issues \
  -d '{"title":"API pipeline test","description":"Create a hello world function","state":"Backlog","project_id":"PROJECT_ID_HERE","assignee_id":"agent-claude","provider":"claude"}'
```

Replace PROJECT_ID_HERE with an actual project ID from `GET /api/v1/projects`.

- [ ] **Step 3: Move to Todo and watch for auto-advance**

```bash
curl -s -X PATCH -H "Authorization: Bearer dev-token" -H "Content-Type: application/json" \
  http://localhost:4010/api/v1/issues/IDENTIFIER/state \
  -d '{"state":"Todo"}'

# Watch state every 10s:
for i in $(seq 1 18); do sleep 10; echo "$((i*10))s: $(curl -s ...state)"; done
```

Expected: issue advances from Todo → InProgress → Review within 2-5 minutes.

- [ ] **Step 4: Check events were recorded**

```bash
curl -s -H "Authorization: Bearer dev-token" http://localhost:4010/api/v1/issues/IDENTIFIER/history
```

Expected: Multiple events with kinds like `message`, `assistant`, `result`, containing agent output text.

- [ ] **Step 5: Check that plan checkboxes exist in events**

```bash
curl ... | python3 -c "..." # filter for messages containing '- ['
```

Expected: Checkbox items in event messages.

---

### Task 5: Verify the UI via expect-cli

- [ ] **Step 1: Create task and move through lifecycle**

```bash
EXPECT_BASE_URL=http://localhost:5173 expect-cli -m "
Create task 'UI pipeline test' with description, project, Claude agent.
Move to Todo. Wait 60s. Check:
1. Session tab: shows event timeline with agent messages
2. Plan tab: shows checkboxes
3. State auto-advanced to InProgress or Review
" -y
```

- [ ] **Step 2: Verify Review state buttons**

```bash
EXPECT_BASE_URL=http://localhost:5173 expect-cli -m "
Open the task in Review state.
Verify: Create PR, Request Changes, Close buttons.
No 'Merge & Close'.
" -y
```

- [ ] **Step 3: Commit test results**

If all passes, update the E2E test doc with results.
