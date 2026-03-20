# Orchestra — Implementation Plan for All Review Issues

> **Last reviewed:** 2026-03-20. Items marked with ~~strikethrough~~ are complete.

## Phase 1: Critical Security Fixes

### 1.1 Shell Injection Prevention (`apps/backend/internal/agents/unsandbox_runner.go`)

**Problem:** User-controlled values interpolated into shell commands via `fmt.Sprintf` with single-quote wrapping (lines 107, 167, 277, 290). A value containing `'` breaks out of quoting.

**Changes:**
- Add a `shellQuote()` helper in `internal/agents/shell.go` that properly escapes single quotes (`'` → `'\''`)
- Replace all `fmt.Sprintf("...%s...")` shell interpolation at lines 107, 167, 277, 290 with calls to `shellQuote()`
- For base64 payloads (lines 277, 290), pipe from stdin instead of embedding in command string:
  ```go
  // Before: fmt.Sprintf("echo '%s' | base64 -d > file", b64)
  // After:  send b64 via stdin to avoid shell exposure
  ```

**Files:** `apps/backend/internal/agents/unsandbox_runner.go`, new `apps/backend/internal/agents/shell.go`

### ~~1.2 Error Message Leakage~~ — DONE

All `writeJSONError` calls now use generic user-facing messages; `err.Error()` is logged server-side only.

### ~~1.3 Silent DB Migration Errors~~ — DONE

`migrate.go` implements `migrateColumn()` with `PRAGMA table_info` checks and proper error propagation. No `schema_version` table (uses column-existence checks instead).

### ~~1.4 GitHub Token Storage~~ — DONE

`crypto.go` implements AES-256-GCM encryption via `ORCHESTRA_TOKEN_KEY`. Backward-compatible with existing plaintext tokens.

---

## Phase 2: Backend Error Handling & Hardening

### 2.1 JSON Encoder Error Handling — PARTIAL

`writeJSONError` helper exists in `router.go`. Success-path responses still use raw `json.NewEncoder(w).Encode()` with discarded errors. A universal `writeJSON` helper for success responses is still needed.

### ~~2.2 Silent Hook Failures~~ — DONE

`before_remove` errors logged as warnings; `after_run` errors intentionally swallowed to avoid blocking the pipeline. `before_run` and `after_create` propagate errors.

### ~~2.3 Configurable Log Path~~ — DONE

Reads `ORCHESTRA_LOG_FILE` env var, defaults to `~/.orchestra/orchestrad.log`, falls back to `/tmp/orchestrad.log`.

### ~~2.4 API Rate Limiting~~ — DONE

`ratelimit.go` implements per-IP token bucket (20 req/s sustained, 60 burst). OAuth endpoints use separate `RateLimit(5, 10)`.

### ~~2.5 Default Branch Detection~~ — DONE

`git.DefaultBranch()` uses `git symbolic-ref refs/remotes/origin/HEAD` with `"main"` fallback.

---

## Phase 3: Desktop App Improvements

### ~~3.1 Extract Custom Hooks from App.tsx~~ — DONE

Hooks extracted: `useBackendConfig`, `useIssueLookup`, `useNotifications`, `useWorkspaceMigration`. App.tsx reduced to ~1,352 lines. `useRuntimeSync` and `useBoardState` live in `lib/` as `runtime-sync.ts` and `runtime-store.ts`.

### ~~3.2 Input Validation~~ — DONE

`src/lib/validation.ts` with reusable validators for task title, description, URL, base URL, and project path.

### ~~3.3 URL Parameter Sanitization~~ — DONE

`orchestra-client.ts` now uses `encodeURIComponent()` extensively (50+ call sites).

### ~~3.4 Add Error Boundaries Per Section~~ — DONE

`src/components/ui/section-error-boundary.tsx` exists with test file.

### 3.5 Add Pagination Support

**Status:** Not started. `fetchIssues()`, `searchIssues()`, `fetchSessions()` still return all results.

### ~~3.6 Fix AudioContext Leak~~ — DONE

Moved into `useNotifications` hook.

### 3.7 Remove Unused Dependency

**Status:** `react-grab` (`^0.1.28`) is still in `package.json` dependencies.

**Changes:**
- Remove `"react-grab": "^0.1.25"` from devDependencies
- Remove the dev-only import from `index.html` if present
- Run `npm ci` to verify clean install

**Files:** `apps/desktop/package.json`, `apps/desktop/index.html`

---

## Phase 4: Infrastructure & Ops Hardening

### ~~4.1 Docker Security~~ — DONE

Distroless image with `nonroot:nonroot` user and HEALTHCHECK.

### 4.2 Systemd Sandboxing (`ops/systemd/orchestrad.service`)

**Status:** Not started. Security directives (`PrivateTmp`, `NoNewPrivileges`, etc.) still missing.

### ~~4.3 CI: Race Detector on PRs~~ — DONE

Race tests now run on both push and pull_request events (no PR exclusion condition).

### 4.4 CI: TUI Tests (`.github/workflows/make-all.yml`)

**Problem:** Workflow only runs `make build`, no tests.

**Changes:**
- Add test step after build: `cd apps/tui && go test -race ./...`
- Depends on TUI tests being written (Phase 5.1)

**Files:** `.github/workflows/make-all.yml`

---

## Phase 5: Test Coverage

### 5.1 TUI Unit Tests (`apps/tui/`)

**Problem:** Zero test files for 3 Go files managing concurrent processes.

**Changes — create 2 test files:**

**`apps/tui/manager_test.go`** (Critical):
- Test `Service.Start()` launches a process and captures logs
- Test `Service.Stop()` sends SIGTERM then SIGKILL
- Test log buffer rotation (max 200 lines)
- Test concurrent access with `-race` flag
- Use mock `exec.Cmd` or test with `echo` commands

**`apps/tui/main_test.go`**:
- Test `initialModel()` returns correct defaults
- Test `Update()` handles key messages: q (quit), tab (switch), f (follow toggle), s (start/stop)
- Test `View()` renders expected layout
- Use BubbleTea `teatest` package for model testing

**Files:** new `apps/tui/manager_test.go`, new `apps/tui/main_test.go`

### 5.2 Desktop Component Tests

**Problem:** 7 test files for 79 source files (~9% coverage). Zero component tests.

**Changes — add tests for critical components:**

1. **`src/widgets/kanban/KanbanBoard.test.tsx`** — Render columns, issue cards, drag-drop, filter
2. **`src/components/settings/SettingsCard.test.tsx`** — Tab switching, profile CRUD, validation errors
3. **`src/components/tasks/CreateTaskDialog.test.tsx`** — Form validation, submit, cancel

**Testing approach:** Use Vitest + React Testing Library (already in devDeps). Test user interactions, not implementation details.

**Files:** 3 new test files in respective component directories

### 5.3 Backend Integration Tests

**Problem:** No HTTP integration tests validating full request/response cycles.

**Changes:**
- Create `apps/backend/internal/api/integration_test.go`
- Test full routes with `httptest.NewServer` and real SQLite (in-memory)
- Cover: auth middleware, CRUD operations, error responses, SSE streaming
- Add to CI pipeline

**Files:** new `apps/backend/internal/api/integration_test.go`

---

## Phase 6: Documentation

### 6.1 Production Deployment Runbook

**Changes:** Create `docs/ops/deployment.md` covering:
- systemd setup with security directives
- Docker deployment with compose example
- Reverse proxy (nginx/caddy) configuration
- Environment variable reference
- Backup/restore for SQLite database
- Monitoring recommendations

**Files:** new `docs/ops/deployment.md`

### 6.2 Schema Migration Guide

**Changes:** Create `docs/ops/migrations.md` covering:
- How schema versioning works (after Phase 1.3)
- How to add new migrations
- How to verify schema state

**Files:** new `docs/ops/migrations.md`

---

## Execution Order

| # | Item | Status |
|---|------|--------|
| 1 | 1.1 Shell injection fix | **TODO** |
| 2 | ~~1.2 Error leakage fix~~ | Done |
| 3 | ~~1.3 DB migration errors~~ | Done |
| 4 | 2.1 JSON encoder errors | **Partial** |
| 5 | ~~2.2 Hook error handling~~ | Done |
| 6 | ~~2.3 Configurable log path~~ | Done |
| 7 | ~~1.4 Token encryption~~ | Done |
| 8 | ~~4.1 Docker security~~ | Done |
| 9 | 4.2 Systemd sandboxing | **TODO** |
| 10 | ~~4.3 CI race detector on PRs~~ | Done |
| 11 | ~~3.3 URL param sanitization~~ | Done |
| 12 | ~~3.2 Input validation~~ | Done |
| 13 | ~~3.4 Error boundaries~~ | Done |
| 14 | 3.7 Remove react-grab | **TODO** |
| 15 | ~~3.1 Extract custom hooks~~ | Done |
| 16 | ~~3.6 AudioContext fix~~ | Done |
| 17 | ~~2.4 Rate limiting~~ | Done |
| 18 | ~~2.5 Default branch detection~~ | Done |
| 19 | 3.5 Pagination | **TODO** |
| 20 | 5.1 TUI tests | **TODO** |
| 21 | 5.2 Desktop component tests | **TODO** |
| 22 | 5.3 Backend integration tests | **TODO** |
| 23 | 4.4 CI TUI tests | **TODO** (depends on 5.1) |
| 24 | 6.1 Deployment runbook | **TODO** |
| 25 | 6.2 Migration guide | **TODO** |

**Progress: 15/25 done, 1 partial, 9 remaining.**
