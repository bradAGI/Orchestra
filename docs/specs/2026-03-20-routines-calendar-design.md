# Routines — Scheduled Agent Execution Design Specification

**Date:** 2026-03-20
**Status:** Draft

---

## 1. Overview

Routines are recurring scheduled tasks that directly invoke an agent at a configured time — daily, weekly, or monthly. Unlike issues, routines bypass the tracker/issue pipeline entirely. They are stored in the database, managed through a dedicated UI, and executed by a backend scheduler goroutine.

### Core Concepts

| Concept | Description |
|---------|-------------|
| Routine | A named, recurring scheduled agent invocation with prompt, provider, and schedule |
| Routine Run | A single execution record with status, output, tokens, and timing |
| Scheduler | Backend goroutine that ticks every 60s and dispatches due routines |

---

## 2. Data Model

### `routines` table

```sql
routines (
  id              TEXT PRIMARY KEY,    -- UUID
  name            TEXT NOT NULL,       -- "Nightly Ops Review"
  prompt          TEXT NOT NULL,       -- agent instructions
  provider        TEXT NOT NULL,       -- "CLAUDE", "CODEX", "OPENCODE", "GEMINI"
  project_id      TEXT,                -- optional FK to projects (gives agent a workspace)
  schedule_type   TEXT NOT NULL,       -- "daily", "weekly", "monthly"
  schedule_days   TEXT,                -- JSON array: [1,2,3,4,5] for weekdays (0=Sun, 6=Sat)
  schedule_time   TEXT NOT NULL,       -- "07:00" (HH:MM, 24hr, UTC)
  schedule_day    INTEGER,             -- day of month for monthly schedules (1-31)
  label           TEXT DEFAULT '',     -- tag name: "ops", "creative", "finance"
  label_color     TEXT DEFAULT '',     -- hex color: "#4ade80"
  enabled         BOOLEAN DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
)
```

### `routine_runs` table

```sql
routine_runs (
  id              TEXT PRIMARY KEY,    -- UUID
  routine_id      TEXT NOT NULL REFERENCES routines(id),
  started_at      TEXT NOT NULL,       -- RFC3339
  finished_at     TEXT,                -- RFC3339, NULL while running
  status          TEXT NOT NULL,       -- "running", "completed", "failed"
  output          TEXT DEFAULT '',
  error           TEXT DEFAULT '',
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  provider        TEXT NOT NULL
)
```

### Schedule semantics

- **daily:** Runs every day at `schedule_time`. `schedule_days` and `schedule_day` ignored.
- **weekly:** Runs on days specified in `schedule_days` at `schedule_time`. `schedule_days` is a JSON array of day numbers (0=Sunday, 6=Saturday). `schedule_day` ignored.
- **monthly:** Runs on `schedule_day` of each month at `schedule_time`. `schedule_days` ignored. If the month has fewer days than `schedule_day`, runs on the last day.

All times are UTC. The desktop UI converts to/from the user's local timezone for display.

---

## 3. Backend Architecture

### Package: `apps/backend/internal/routines/`

Three components:

#### 3.1 Store

DB access layer for `routines` and `routine_runs` CRUD operations.

```go
type Store struct {
    db *db.DB
}

func (s *Store) ListRoutines(ctx context.Context) ([]Routine, error)
func (s *Store) GetRoutine(ctx context.Context, id string) (Routine, error)
func (s *Store) CreateRoutine(ctx context.Context, r Routine) error
func (s *Store) UpdateRoutine(ctx context.Context, r Routine) error
func (s *Store) DeleteRoutine(ctx context.Context, id string) error
func (s *Store) CreateRun(ctx context.Context, run Run) error
func (s *Store) UpdateRun(ctx context.Context, run Run) error
func (s *Store) ListRuns(ctx context.Context, routineID string, limit int) ([]Run, error)
func (s *Store) LastRunForRoutine(ctx context.Context, routineID string) (*Run, error)
```

#### 3.2 Scheduler

A goroutine started in `run.go` alongside the existing refresh and execution workers.

```go
func startRoutineScheduler(
    store *routines.Store,
    registry *agents.Registry,
    provider agents.Provider,
    providerName string,
    workspaceRoot string,
    pubsub *observability.PubSub,
    logger zerolog.Logger,
)
```

**Tick loop (every 60 seconds):**

1. Query all enabled routines from DB.
2. For each routine, evaluate if it is due:
   - Parse `schedule_type`, `schedule_days`, `schedule_time`, `schedule_day` against current UTC time.
   - Check that the current minute matches `schedule_time` (HH:MM granularity).
   - For weekly: check current day of week is in `schedule_days`.
   - For monthly: check current day of month matches `schedule_day`.
3. Deduplicate: query `routine_runs` for the routine — skip if a run already exists for this time window (same calendar minute).
4. If due:
   - Insert a `routine_runs` record with status `"running"`.
   - Publish `ROUTINE_STARTED` event to SSE.
   - Invoke the agent via `registry.RunTurn()` with the routine's prompt and provider.
   - If the routine has a `project_id`, resolve the project's `root_path` as the workspace directory.
   - Update the run record with status, output, tokens, and `finished_at`.
   - Publish `ROUTINE_COMPLETED` or `ROUTINE_FAILED` event to SSE.

**Execution is single-threaded.** One routine runs at a time. If a routine is still running when the next tick fires, it is skipped. No concurrency management for v1.

#### 3.3 API Routes

All routes under `/api/v1/routines`, protected by the existing auth middleware.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/routines` | List all routines |
| `POST` | `/api/v1/routines` | Create a routine |
| `PATCH` | `/api/v1/routines/{id}` | Update a routine |
| `DELETE` | `/api/v1/routines/{id}` | Delete a routine (cascades to runs) |
| `GET` | `/api/v1/routines/{id}/runs` | List execution history for a routine |
| `POST` | `/api/v1/routines/{id}/trigger` | Manually trigger a routine now |

**Create/Update request body:**

```json
{
  "name": "Nightly Ops Review",
  "prompt": "Review all open issues and summarize status...",
  "provider": "CLAUDE",
  "project_id": null,
  "schedule_type": "weekly",
  "schedule_days": [1, 2, 3, 4, 5],
  "schedule_time": "07:00",
  "schedule_day": null,
  "label": "ops",
  "label_color": "#4ade80",
  "enabled": true
}
```

**Trigger response:**

```json
{
  "run_id": "uuid",
  "status": "running"
}
```

---

## 4. SSE Integration

Routine lifecycle events published to the existing SSE pubsub stream:

| Event Type | Payload |
|------------|---------|
| `ROUTINE_STARTED` | `{ routine_id, routine_name, provider }` |
| `ROUTINE_COMPLETED` | `{ routine_id, routine_name, provider, input_tokens, output_tokens, duration_ms }` |
| `ROUTINE_FAILED` | `{ routine_id, routine_name, provider, error }` |

These appear in the desktop's activity timeline alongside existing `RUN_STARTED`/`RUN_FAILED` events. No special handling needed — the existing SSE stream and timeline component render arbitrary event types.

---

## 5. Desktop UI

### 5.1 Sidebar Section

New "Routines" section in the sidebar navigation, positioned after WAREHOUSE. Uses the `CalendarClock` lucide icon.

### 5.2 Calendar View (Default)

Weekly grid inspired by Google Calendar:

- **Columns:** Monday through Sunday.
- **Rows:** Time slots (hourly or half-hourly).
- **Routine blocks:** Colored pills positioned at their scheduled time, using `label_color` for the background. Display the routine name (truncated if needed).
- **Current day:** Column highlighted.
- **Navigation:** Left/right arrows to move between weeks. "Today" button to jump back.
- **Click a pill:** Opens the edit panel for that routine.
- **Click an empty slot:** Opens the create panel with the clicked day/time pre-filled.

### 5.3 Agenda View

Toggle between calendar and agenda (list) view.

Flat table of all routines sorted by next scheduled time:

| Column | Content |
|--------|---------|
| Name | Routine name |
| Schedule | Human-readable: "Weekdays at 7:00 AM" |
| Label | Colored tag chip |
| Provider | Agent provider name |
| Last Run | Status badge + relative time |
| Enabled | Toggle switch |
| Actions | Edit, Trigger Now, Delete |

### 5.4 Create/Edit Panel

Slide-out panel with fields:

- **Name** — text input
- **Prompt** — multiline textarea (the agent instructions)
- **Provider** — dropdown (CLAUDE, CODEX, OPENCODE, GEMINI)
- **Project** — optional dropdown populated from existing projects
- **Schedule type** — radio group (Daily / Weekly / Monthly)
- **Days** — checkbox group for weekly (Mon–Sun), shown only when schedule_type is "weekly"
- **Day of month** — number input for monthly, shown only when schedule_type is "monthly"
- **Time** — time picker (HH:MM)
- **Label** — text input + color picker
- **Enabled** — toggle switch

### 5.5 Execution History

Expandable section within the edit panel showing recent runs from `routine_runs`:

- Status badge (completed/failed/running)
- Started at (relative time)
- Duration
- Token usage (input/output)
- Output preview (expandable)
- Error message (if failed)

---

## 6. Scope Summary

| Layer | Changes |
|-------|---------|
| **DB** | 2 new tables: `routines`, `routine_runs` |
| **Backend** | New `internal/routines/` package (store, scheduler, API handlers). ~6 API routes. Scheduler goroutine wired into `run.go` |
| **Desktop** | New "Routines" sidebar section. Calendar view + agenda view. Create/edit panel. Execution history |
| **Integration** | Direct agent invocation via `agents.Registry.RunTurn()`. SSE lifecycle events (`ROUTINE_STARTED`, `ROUTINE_COMPLETED`, `ROUTINE_FAILED`) |

---

## 7. Not in Scope (Future)

- Chaining routines (trigger routine B on completion of routine A)
- Auto-creating issues on failure
- Cron expression support (advanced scheduling)
- Timezone-aware scheduling per routine (v1 is UTC only, desktop converts for display)
- Routine templates / presets
- Concurrent routine execution
