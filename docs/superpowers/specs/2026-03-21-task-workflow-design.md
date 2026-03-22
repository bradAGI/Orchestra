# Task Workflow State Machine — Design Spec

**Issue:** #66
**Scope:** Enforce a strict task lifecycle with gates, locked fields, and automated agent dispatch

## Problem

The current task board has no workflow enforcement. Tasks can be created in any column, dragged to any state, edited at any time, and dispatched without descriptions or assigned agents. This results in broken workflows and useless agent runs.

## State Machine

```
BACKLOG ──→ TODO ──→ IN PROGRESS ──→ REVIEW ──→ DONE
  ↑                                    │
  │              ← (feedback) ─────────┘
  │
  ← ── STOP (from any active state) ──
```

### States

**Backlog (Staging)**
- The only state where tasks can be created
- Title, description, agent, and project are all editable
- Tasks can be deleted
- This is a drafting area — nothing runs here

**Todo (Planning)**
- Agent is automatically dispatched in plan-only mode
- Agent reads the description, explores the codebase, creates a plan, then stops
- Title and description are locked (read-only)
- User reviews the plan in the Plan tab
- User drags to In Progress when the plan looks good

**In Progress (Execution)**
- Agent is dispatched to execute the plan
- All fields locked
- Live session output visible in Session tab
- Changes visible in Changes tab
- Stop button available (resets to Backlog)
- Automatically moves to Review when agent completes

**Review (Human QA)**
- All fields locked
- User reviews the plan execution, changes, and session output
- Two actions available:
  - **Approve** → moves to Done (drag or button)
  - **Reject with feedback** → moves back to Todo (feedback button only, not drag)
- Feedback is appended to the issue; branch and changes are preserved
- Agent re-plans incorporating the feedback on next Todo cycle

**Done (Completed)**
- All fields locked
- All tabs viewable (details, plan, session, changes)
- Branch is preserved
- User can go to the Git tab in the project to create a PR from the task's branch

### Stop Action

Pressing Stop from any active state (Todo, In Progress, Review):
- Kills the agent session (if running)
- Clears the plan data
- Clears changes / resets the branch
- Moves the task back to Backlog
- Task becomes fully editable again
- Requires confirmation dialog: "This will clear the plan and all changes. Are you sure?"

## Transition Rules

### Allowed Forward Transitions (drag-and-drop)

| From | To | Gate |
|------|----|------|
| Backlog | Todo | title + description + agent + project all required |
| Todo | In Progress | none (dispatches agent for execution) |
| Review | Done | none (human approval) |

### Special Transitions

| From | To | Trigger | Behavior |
|------|----|---------|----------|
| In Progress | Review | Agent completes | Automatic |
| Review | Todo | Feedback button | Appends feedback, keeps branch, agent re-plans |
| Any active | Backlog | Stop button | Clears plan + changes, kills session, full reset |

### Blocked Transitions

- No skipping states (e.g., Backlog → In Progress is blocked)
- No backward dragging (e.g., In Progress → Todo via drag is blocked)
- No forward drag from Review to Todo (must use feedback button)
- Tasks cannot be created in any column except Backlog

Invalid drag attempts snap back with an error toast explaining why.

## Backend Enforcement

### PatchIssue Validation

The `PatchIssue` handler validates all state transitions server-side:

```
Request: PATCH /api/v1/issues/{id} { "state": "Todo" }

Validation:
1. Get current state from DB
2. Check transition is allowed (Backlog → Todo)
3. Check gates pass (title, description, assignee_id, project_id non-empty)
4. If invalid: return 400 { "error": "missing_description", "message": "Description required before moving to Todo" }
5. If valid: update state, return 200
```

### Field Locking

When state is not Backlog, the PATCH handler rejects updates to:
- `title`
- `description`
- `project_id`

Only these fields are mutable after Backlog:
- `state` (with transition validation)
- `feedback` (for Review → Todo rejection)

`assignee_id` is only editable in Backlog — it is locked in all other states.

### Stop Endpoint

Add `POST /api/v1/issues/{id}/stop` (separate from session delete — Stop does more: resets state, clears plan, removes worktree):
- Kill active agent session
- Clear plan data (delete agent messages / plan content)
- Reset branch / remove worktree
- Set state to Backlog
- Clear `feedback` field

## Frontend Changes

### KanbanBoard.tsx

- Remove "CLICK TO ADD TASK" button from Todo, In Progress, Review, Done columns
- Keep "CLICK TO ADD TASK" only in Backlog
- Drag validation:
  - Only allow forward single-step transitions: Backlog→Todo, Todo→InProgress, Review→Done
  - On invalid drag: snap back card, show error toast
  - On Backlog→Todo drag with missing gates: show toast "Requires description, agent, and project"

### CreateTaskDialog.tsx

- Remove state selector — always creates in Backlog
- Make description field required (currently optional)
- Make agent assignment required (currently defaults to "Unassigned")
- Make project assignment required (already required)
- Disable Create button until all four fields are filled

### IssueDetailView.tsx

- **Backlog state:** all fields editable (current behavior)
- **Todo/In Progress/Review/Done:** title and description render as read-only text, agent and project selectors hidden
- **Review state:** add two buttons:
  - "Approve" — moves to Done
  - "Reject" — opens FeedbackDialog, on submit sends `{ state: "Todo", feedback: "..." }`
- **Any active state (Todo/In Progress/Review):** Stop button shows confirmation dialog, then resets to Backlog
- **Done state:** all tabs viewable, no action buttons except viewing

### New Component: FeedbackDialog.tsx

Simple modal for Review → Todo rejection:
- Textarea: "What needs to change?" (required, non-empty)
- Cancel button
- Submit button → PATCH issue with `{ state: "Todo", feedback: "..." }`

## Agent Behavior

### Planning Mode (Todo)

When a task enters Todo:
1. Orchestrator dispatches the agent with a planning flag
2. Agent receives the task description and project context
3. Agent explores the codebase, reads relevant files
4. Agent creates a structured plan (checkboxes in its output)
5. Agent stops — does not execute, does not write code
6. Plan is visible in the Plan tab

### Execution Mode (In Progress)

When a task enters In Progress:
1. Orchestrator dispatches the agent normally
2. Agent follows its plan and executes (reads, writes, tests, commits)
3. When complete, agent signals completion
4. Orchestrator moves task to Review automatically

### Re-planning (Review → Todo with feedback)

When a task is rejected:
1. Feedback is stored on the issue (appended or as a separate field)
2. Task moves to Todo
3. Agent is re-dispatched in planning mode
4. Agent sees: original description + previous plan + feedback + existing branch state
5. Agent creates an updated plan incorporating the feedback
6. Agent stops, user reviews new plan

## Database Changes

### Issues Table

Add column:
```sql
ALTER TABLE issues ADD COLUMN feedback TEXT;
```

The `feedback` field stores the most recent rejection feedback. Cleared on Stop (reset to Backlog). Preserved when task reaches Done (historical record of iterations).

### Transition History

The existing `issue_history` table already tracks state changes. No schema changes needed — the audit trail is automatic.

## Files Involved

**Backend:**
- `apps/backend/internal/api/state.go` — PatchIssue validation, Stop endpoint
- `apps/backend/internal/orchestrator/state.go` — planning mode dispatch, auto-Review on completion
- `apps/backend/internal/db/schema.go` — feedback column migration

**Frontend:**
- `apps/desktop/src/widgets/kanban/KanbanBoard.tsx` — drag validation, remove add buttons from non-Backlog columns
- `apps/desktop/src/components/tasks/CreateTaskDialog.tsx` — enforce all fields required, lock to Backlog
- `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` — field locking, Review approve/reject, Stop confirmation
- `apps/desktop/src/widgets/issue-detail/FeedbackDialog.tsx` — new component
- `apps/desktop/src/lib/orchestra-client.ts` — stop endpoint client function

## Out of Scope

- Priority ordering within columns
- WIP limits per state
- Blocking dependencies between tasks
- SLA / due date tracking
- Multi-agent collaboration on a single task
