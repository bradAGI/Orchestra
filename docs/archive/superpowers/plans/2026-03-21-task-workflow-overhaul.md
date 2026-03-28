# Task Workflow State Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a strict Backlog→Todo→InProgress→Review→Done state machine with gates, field locking, automated agent dispatch, and feedback loops.

**Architecture:** Backend-first — add state transition validation and a Stop endpoint to the Go API, then update the frontend to enforce the same rules in the UI. Backend is the source of truth; frontend provides a good UX but the server rejects invalid transitions regardless.

**Tech Stack:** Go (chi router, SQLite), React 19, TypeScript, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-task-workflow-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/backend/internal/db/schema.go` | Modify | Add feedback column migration |
| `apps/backend/internal/api/state.go` | Modify | State transition validation in PatchIssue, Stop endpoint |
| `apps/backend/internal/api/router.go` | Modify | Register Stop route |
| `apps/backend/internal/orchestrator/state.go` | Modify | Planning mode dispatch, auto-Review on completion |
| `apps/desktop/src/lib/orchestra-client.ts` | Modify | Add stopIssue client function |
| `apps/desktop/src/widgets/kanban/KanbanBoard.tsx` | Modify | Drag validation, remove non-Backlog create buttons |
| `apps/desktop/src/components/tasks/CreateTaskDialog.tsx` | Modify | Enforce all fields required, lock to Backlog |
| `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` | Modify | Field locking, Review approve/reject, Stop confirmation |
| `apps/desktop/src/widgets/issue-detail/FeedbackDialog.tsx` | Create | Rejection feedback modal |
| `apps/desktop/src/widgets/issue-detail/FeedbackDialog.test.tsx` | Create | Tests |
| `apps/desktop/src/widgets/kanban/KanbanBoard.test.tsx` | Create | Drag validation tests |

---

### Task 1: Backend — Add Feedback Column

**Files:**
- Modify: `apps/backend/internal/db/schema.go:44-61`

- [ ] **Step 1: Add migration for feedback column**

In `apps/backend/internal/db/schema.go`, find the migrations array (or the `migrate.go` file). Add an ALTER TABLE migration:

```go
"ALTER TABLE issues ADD COLUMN feedback TEXT"
```

Follow the existing migration pattern in `apps/backend/internal/db/migrate.go` — read it first to see how migrations are registered and applied.

- [ ] **Step 2: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/db/
git commit -m "feat(backend): add feedback column to issues table"
```

---

### Task 2: Backend — State Transition Validation in PatchIssue

**Files:**
- Modify: `apps/backend/internal/api/state.go:432` (PatchIssue handler)

- [ ] **Step 1: Read the current PatchIssue handler**

Read `apps/backend/internal/api/state.go` starting at line 432 to understand the full handler.

- [ ] **Step 2: Add transition validation function**

Add a function before PatchIssue:

```go
// validTransitions defines the allowed state changes.
var validTransitions = map[string][]string{
	"Backlog":     {"Todo"},
	"Todo":        {"In Progress", "Backlog"},
	"In Progress": {"Review", "Backlog"},
	"Review":      {"Done", "Todo", "Backlog"},
	// Done is terminal — no transitions out
}

// lockedFields defines fields that cannot be updated in non-Backlog states.
var lockedFields = map[string]bool{
	"title":       true,
	"description": true,
	"project_id":  true,
	"assignee_id": true,
}

func validateStateTransition(current, next string, issue *tracker.Issue, updates map[string]any) error {
	allowed, ok := validTransitions[current]
	if !ok {
		return fmt.Errorf("cannot transition from %s", current)
	}

	found := false
	for _, s := range allowed {
		if strings.EqualFold(s, next) {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("cannot move from %s to %s", current, next)
	}

	// Gate: Backlog → Todo requires title + description + assignee + project
	if strings.EqualFold(current, "Backlog") && strings.EqualFold(next, "Todo") {
		if issue.Title == "" {
			return fmt.Errorf("title required before moving to Todo")
		}
		if issue.Description == "" {
			return fmt.Errorf("description required before moving to Todo")
		}
		if issue.AssigneeID == "" || strings.EqualFold(issue.AssigneeID, "unassigned") {
			return fmt.Errorf("agent must be assigned before moving to Todo")
		}
		if issue.ProjectID == "" {
			return fmt.Errorf("project required before moving to Todo")
		}
	}

	// Gate: Review → Todo requires feedback
	if strings.EqualFold(current, "Review") && strings.EqualFold(next, "Todo") {
		feedback, _ := updates["feedback"].(string)
		if feedback == "" {
			return fmt.Errorf("feedback required when rejecting from Review")
		}
	}

	return nil
}
```

- [ ] **Step 3: Add field locking validation**

Add a function:

```go
func validateFieldLocking(currentState string, updates map[string]any) error {
	if strings.EqualFold(currentState, "Backlog") {
		return nil // All fields editable in Backlog
	}
	for field := range lockedFields {
		if _, exists := updates[field]; exists {
			return fmt.Errorf("cannot update %s when task is in %s state", field, currentState)
		}
	}
	return nil
}
```

- [ ] **Step 4: Wire validation into PatchIssue**

In the PatchIssue handler (line ~432), after decoding the updates and before calling `s.orchestrator.UpdateIssue()`:

```go
// Get current issue for validation
issue, err := s.orchestrator.GetIssue(ctx, identifier)
if err != nil {
    writeJSONError(w, http.StatusNotFound, "not_found", "issue not found")
    return
}

// Validate field locking
if err := validateFieldLocking(issue.State, updates); err != nil {
    writeJSONError(w, http.StatusBadRequest, "field_locked", err.Error())
    return
}

// Validate state transition if state is being changed
if newState, ok := updates["state"].(string); ok && newState != "" {
    if err := validateStateTransition(issue.State, newState, issue, updates); err != nil {
        writeJSONError(w, http.StatusBadRequest, "invalid_transition", err.Error())
        return
    }
}
```

- [ ] **Step 5: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/internal/api/state.go
git commit -m "feat(backend): add state transition validation and field locking to PatchIssue"
```

---

### Task 3: Backend — Add Stop Endpoint

**Files:**
- Modify: `apps/backend/internal/api/state.go`
- Modify: `apps/backend/internal/api/router.go`

- [ ] **Step 1: Add Stop handler**

Add a new handler in `state.go`:

```go
func (s *Server) PostIssueStop(w http.ResponseWriter, r *http.Request) {
	identifier := chi.URLParam(r, "issue_identifier")
	if identifier == "" {
		writeJSONError(w, http.StatusBadRequest, "missing_identifier", "issue identifier required")
		return
	}

	// Stop any running session
	s.orchestrator.StopAllSessionsForIssue(identifier)

	// Reset to Backlog, clear feedback
	updates := map[string]any{
		"state":    "Backlog",
		"feedback": "",
	}

	// Bypass normal transition validation — Stop is a special reset
	issue, err := s.orchestrator.UpdateIssue(r.Context(), identifier, updates)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "stop_failed", err.Error())
		return
	}

	// Clear plan data and worktree
	s.orchestrator.ClearIssuePlan(r.Context(), identifier)

	writeJSON(w, http.StatusOK, issue)
}
```

Note: Read the existing `DeleteIssueSession` handler (line 745) to understand how session stopping works, and follow the same patterns.

- [ ] **Step 2: Register route**

In `router.go`, add:

```go
protected.Post("/api/v1/issues/{issue_identifier}/stop", server.PostIssueStop)
```

- [ ] **Step 3: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/api/state.go apps/backend/internal/api/router.go
git commit -m "feat(backend): add POST /issues/{id}/stop endpoint for full task reset"
```

---

### Task 4: Backend — Orchestrator Planning Mode & Auto-Review

**Files:**
- Modify: `apps/backend/internal/orchestrator/state.go`

- [ ] **Step 1: Read the orchestrator state management**

Read `apps/backend/internal/orchestrator/state.go` to understand how agents are dispatched. Key areas:
- `activeStates` (line ~151) — currently only `"in progress"`
- `ClaimNextRunnable` (line ~1178) — claims next issue for dispatch
- `PerformRefresh` (line ~639) — main orchestration cycle

- [ ] **Step 2: Add Todo to active states for planning mode**

Update the `activeStates` initialization (line ~151) to include Todo:

```go
activeStates: []string{"todo", "in progress"},
```

This means the orchestrator will pick up Todo issues for dispatch (planning mode).

- [ ] **Step 3: Add planning mode flag to dispatch**

When dispatching a Todo issue, the orchestrator should pass a planning flag. Find where `RunningEntry` is created during dispatch and add logic:

```go
// When creating a RunningEntry for a "Todo" state issue:
// Set a flag or modify the description to indicate plan-only mode
if strings.EqualFold(entry.State, "Todo") {
    // Append planning instruction to the agent prompt
    entry.Description = entry.Description + "\n\n---\nMODE: PLAN ONLY. Create a detailed execution plan with checkboxes. Do NOT write code or make changes. Only plan."
}
```

The exact implementation depends on how the agent receives instructions — read the dispatch code to find where the description/prompt is assembled.

- [ ] **Step 4: Add auto-Review transition on agent completion**

Find where the orchestrator handles agent session completion (look for where state is set to "Done" or where a run completes). Add logic to move In Progress → Review instead of Done:

```go
// When agent completes execution (In Progress state):
if strings.EqualFold(currentState, "In Progress") {
    // Move to Review instead of Done — human must approve
    s.UpdateIssue(ctx, identifier, map[string]any{"state": "Review"})
}
```

Similarly, when a Todo planning run completes, keep it in Todo (don't auto-advance):
```go
// When agent completes planning (Todo state):
if strings.EqualFold(currentState, "Todo") {
    // Stay in Todo — user must drag to In Progress after reviewing plan
    // Just mark the run as complete, don't change state
}
```

- [ ] **Step 5: Add ClearIssuePlan method**

Add a method that the Stop endpoint calls to clean up plan data:

```go
func (s *Service) ClearIssuePlan(ctx context.Context, identifier string) {
    // Remove worktree if exists
    s.mu.Lock()
    for i, entry := range s.running {
        if entry.IssueIdentifier == identifier && entry.WorktreePath != "" {
            os.RemoveAll(entry.WorktreePath)
            s.running = append(s.running[:i], s.running[i+1:]...)
            break
        }
    }
    s.mu.Unlock()

    // Clear run history for this issue
    s.db.DeleteRunsByIssueID(ctx, identifier)
}
```

Read the existing code to find the exact data structures and methods available. The implementation should follow existing patterns.

- [ ] **Step 6: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/internal/orchestrator/state.go
git commit -m "feat(backend): add planning mode dispatch, auto-Review, and ClearIssuePlan"
```

---

### Task 5: Frontend — Add Stop and Feedback Client Functions

**Files:**
- Modify: `apps/desktop/src/lib/orchestra-client.ts`

- [ ] **Step 1: Add stopIssue function**

Near the existing `stopIssueSession` function (~line 382):

```typescript
export async function stopIssue(config: BackendConfig, issueIdentifier: string): Promise<IssueListItem> {
  const id = normalizeIdentifier(issueIdentifier)
  if (!id) throw new Error('issue identifier is required')
  return requestJSON<IssueListItem>(config, `/api/v1/issues/${encodeURIComponent(id)}/stop`, { method: 'POST' })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/lib/orchestra-client.ts
git commit -m "feat(desktop): add stopIssue client function"
```

---

### Task 6: Frontend — Create FeedbackDialog Component

**Files:**
- Create: `apps/desktop/src/widgets/issue-detail/FeedbackDialog.tsx`
- Create: `apps/desktop/src/widgets/issue-detail/FeedbackDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/src/widgets/issue-detail/FeedbackDialog.test.tsx`:

Tests:
1. Renders textarea with placeholder
2. Renders Cancel and Submit buttons
3. Disables Submit when feedback is empty
4. Enables Submit when feedback has text
5. Calls onSubmit with feedback text
6. Calls onCancel when Cancel clicked
7. Clears textarea after submit

**IMPORTANT:** No `@testing-library/jest-dom`. Use `toBeTruthy()`, `(el as HTMLButtonElement).disabled`, etc.

- [ ] **Step 2: Run tests to verify fail**

```bash
cd apps/desktop && npx vitest run src/widgets/issue-detail/FeedbackDialog.test.tsx
```

- [ ] **Step 3: Write implementation**

```typescript
import { useState } from 'react'

interface FeedbackDialogProps {
  onSubmit: (feedback: string) => void
  onCancel: () => void
}

export function FeedbackDialog({ onSubmit, onCancel }: FeedbackDialogProps) {
  const [feedback, setFeedback] = useState('')

  const handleSubmit = () => {
    if (!feedback.trim()) return
    onSubmit(feedback.trim())
    setFeedback('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border/40 rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-sm font-bold text-foreground mb-3">Reject & Send Back</h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Describe what needs to change. The agent will re-plan based on your feedback.
        </p>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What needs to change?"
          rows={4}
          autoFocus
          className="w-full bg-muted/10 border border-border/40 rounded-lg px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/40 resize-none outline-none focus:border-primary/60"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg text-muted-foreground hover:text-foreground transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!feedback.trim()}
            className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Reject & Send Back
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/desktop && npx vitest run src/widgets/issue-detail/FeedbackDialog.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/FeedbackDialog.tsx apps/desktop/src/widgets/issue-detail/FeedbackDialog.test.tsx
git commit -m "feat(desktop): add FeedbackDialog for Review rejection"
```

---

### Task 7: Frontend — Update CreateTaskDialog

**Files:**
- Modify: `apps/desktop/src/components/tasks/CreateTaskDialog.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/desktop/src/components/tasks/CreateTaskDialog.tsx` fully.

- [ ] **Step 2: Force state to Backlog**

Remove the `initialState` prop usage. Replace:
```typescript
const [state, setState] = useState(initialState)
```
with:
```typescript
const state = 'Backlog' // Tasks are always created in Backlog
```

Remove the `useEffect` that syncs `initialState` (line ~57).

- [ ] **Step 3: Make description required**

Update the submit button disabled condition (line ~274) from:
```typescript
disabled={!title.trim() || !projectID}
```
to:
```typescript
disabled={!title.trim() || !description.trim() || !projectID || !assigneeID || assigneeID === 'unassigned'}
```

- [ ] **Step 4: Add validation error for missing fields**

In the `handleSubmit` function, add validation before the existing title/description validators:

```typescript
if (!description.trim()) {
  setDescError('Description is required')
  return
}
if (!assigneeID || assigneeID === 'unassigned') {
  setSubmitError('Agent must be assigned')
  return
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/desktop && npx vitest run src/components/tasks/CreateTaskDialog.test.tsx
```

Fix any failing tests due to the new required fields — update test mocks to include description and assignee.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/tasks/CreateTaskDialog.tsx apps/desktop/src/components/tasks/CreateTaskDialog.test.tsx
git commit -m "feat(desktop): enforce all fields required in task creation, lock to Backlog"
```

---

### Task 8: Frontend — Update KanbanBoard Drag Validation

**Files:**
- Modify: `apps/desktop/src/widgets/kanban/KanbanBoard.tsx`
- Create: `apps/desktop/src/widgets/kanban/KanbanBoard.test.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/desktop/src/widgets/kanban/KanbanBoard.tsx` fully. Pay attention to `handleDrop` (line ~125) and `handleCreateClick` (line ~66).

- [ ] **Step 2: Remove non-Backlog create buttons**

In `handleCreateClick` (line ~66), only allow creation from Backlog:

```typescript
function handleCreateClick(columnId: string) {
  if (columnId !== 'backlog') return // Only create in Backlog
  onCreateIssue('Backlog')
}
```

Remove the "+" header button for non-backlog columns. Find where columns render the "+" button (line ~344) and add a condition:

```typescript
{column.id === 'backlog' && (
  <button onClick={() => handleCreateClick(column.id)} ...>
    <Plus size={10} />
  </button>
)}
```

Also update the empty column "CLICK TO ADD TASK" button (line ~366) to only show in Backlog:

```typescript
{column.id === 'backlog' && (
  <button onClick={() => handleCreateClick(column.id)} ...>
    CLICK TO ADD TASK
  </button>
)}
```

For non-backlog empty columns, show a different empty state message like "No tasks" or nothing.

- [ ] **Step 3: Add drag validation in handleDrop**

Replace the existing `handleDrop` logic with validated transitions:

```typescript
const allowedDragTransitions: Record<string, string[]> = {
  backlog: ['todo'],
  todo: ['progress'],
  progress: [], // Auto-moves to review, no manual drag
  review: ['done'],
  done: [],
}

function handleDrop(e: React.DragEvent, targetColumnId: string) {
  e.preventDefault()
  const issueIdentifier = e.dataTransfer.getData('text/plain')
  if (!issueIdentifier) return

  // Find the issue's current column
  const issue = issues.find(i => i.identifier === issueIdentifier)
  if (!issue) return

  const currentColumnId = Object.entries(stateToColumn).find(
    ([, colId]) => colId === stateToColumnId(issue.state)
  )?.[1] || ''

  // Check if this transition is allowed
  const allowed = allowedDragTransitions[currentColumnId] || []
  if (!allowed.includes(targetColumnId)) {
    // Show error toast
    // For backward drags: "Cannot drag tasks backward"
    // For skipping: "Tasks must move through each state in order"
    return
  }

  // Gate check for Backlog → Todo
  if (currentColumnId === 'backlog' && targetColumnId === 'todo') {
    if (!issue.description?.trim() || !issue.assignee_id || issue.assignee_id === 'unassigned' || !issue.project_id) {
      // Show toast: "Requires description, agent, and project"
      return
    }
  }

  const nextState = stateMap[targetColumnId]
  if (nextState) {
    onIssueUpdate(issueIdentifier, { state: nextState })
  }
}
```

- [ ] **Step 4: Write tests**

Create `apps/desktop/src/widgets/kanban/KanbanBoard.test.tsx` with basic tests:
1. Renders Backlog create button
2. Does not render create buttons in Todo/InProgress/Review/Done
3. Shows 5 columns

- [ ] **Step 5: Run tests**

```bash
cd apps/desktop && npx vitest run src/widgets/kanban/KanbanBoard.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/widgets/kanban/KanbanBoard.tsx apps/desktop/src/widgets/kanban/KanbanBoard.test.tsx
git commit -m "feat(desktop): enforce drag validation and Backlog-only task creation"
```

---

### Task 9: Frontend — Update IssueDetailView

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` fully. Key areas: title input (~383), description editor (~391), state dropdown (~403), Stop button (~279).

- [ ] **Step 2: Lock fields based on state**

Add a helper at the top of the component:

```typescript
const isEditable = localState === 'Backlog'
```

Wrap the title input — when not editable, render as read-only text:

```typescript
{isEditable ? (
  <input value={localTitle} onChange={...} onBlur={...} />
) : (
  <span className="text-sm font-medium text-foreground">{localTitle}</span>
)}
```

Do the same for description — when not editable, render markdown preview only (no edit button):

```typescript
{isEditable ? (
  <DescriptionEditor ... />
) : (
  <div className="prose prose-invert prose-sm">
    <ReactMarkdown>{localDescription || 'No description'}</ReactMarkdown>
  </div>
)}
```

Hide agent and project selectors when not in Backlog.

- [ ] **Step 3: Replace state dropdown with workflow buttons**

Remove the free-form state dropdown. Replace with context-appropriate buttons based on current state:

```typescript
{/* Backlog: no action buttons (user drags to Todo) */}
{localState === 'Backlog' && (
  <span className="text-[10px] text-muted-foreground">Draft — drag to Todo when ready</span>
)}

{/* Todo: show Stop button */}
{localState === 'Todo' && (
  <button onClick={handleStop} className="...">Stop & Reset</button>
)}

{/* In Progress: show Stop button */}
{localState === 'In Progress' && (
  <button onClick={handleStop} className="...">Stop & Reset</button>
)}

{/* Review: Approve + Reject buttons */}
{localState === 'Review' && (
  <div className="flex gap-2">
    <button onClick={() => handleStateChange('Done')} className="bg-emerald-500/10 text-emerald-400 ...">
      Approve
    </button>
    <button onClick={() => setShowFeedback(true)} className="bg-red-500/10 text-red-400 ...">
      Reject
    </button>
    <button onClick={handleStop} className="...">Stop & Reset</button>
  </div>
)}

{/* Done: read-only */}
{localState === 'Done' && (
  <span className="text-[10px] text-emerald-400">Completed</span>
)}
```

- [ ] **Step 4: Add Stop handler with confirmation**

```typescript
const [showStopConfirm, setShowStopConfirm] = useState(false)

const handleStop = async () => {
  setShowStopConfirm(true)
}

const confirmStop = async () => {
  if (!config) return
  await stopIssue(config, identifier)
  setShowStopConfirm(false)
  setLocalState('Backlog')
  onUpdate?.({ state: 'Backlog' })
}
```

Render confirmation dialog when `showStopConfirm` is true:
```typescript
{showStopConfirm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-card border border-border/40 rounded-xl shadow-lg p-6 max-w-sm">
      <h3 className="text-sm font-bold mb-2">Stop & Reset Task?</h3>
      <p className="text-[11px] text-muted-foreground mb-4">
        This will clear the plan and all changes. The task will return to Backlog for editing.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setShowStopConfirm(false)} className="...">Cancel</button>
        <button onClick={confirmStop} className="bg-red-500/10 text-red-400 ...">Stop & Reset</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Add feedback dialog for Review rejection**

```typescript
const [showFeedback, setShowFeedback] = useState(false)

const handleReject = async (feedback: string) => {
  setShowFeedback(false)
  onUpdate?.({ state: 'Todo', feedback })
}
```

Render:
```typescript
{showFeedback && (
  <FeedbackDialog
    onSubmit={handleReject}
    onCancel={() => setShowFeedback(false)}
  />
)}
```

Import `FeedbackDialog` and `stopIssue`.

- [ ] **Step 6: Run full test suite**

```bash
cd apps/desktop && npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "feat(desktop): add field locking, workflow buttons, Stop confirmation, Review reject"
```

---

### Task 10: Integration Test & Verification

**Files:**
- All modified files

- [ ] **Step 1: Run full frontend test suite**

```bash
cd apps/desktop && npx vitest run
```

All tests should pass.

- [ ] **Step 2: Build backend**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/desktop && npx tsc --noEmit
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(desktop): address integration test issues"
```
