# Orchestra — Implementation Plan for All Review Issues

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

### 1.2 Error Message Leakage (`apps/backend/internal/api/projects.go`)

**Problem:** 11+ instances of `err.Error()` passed directly to `writeJSONError()`, leaking internal paths and system details to clients (lines 50, 99, 147, 923, 953, 990, 1022, 1059, 1096, 1120, 1144).

**Changes:**
- Replace each `err.Error()` in `writeJSONError` calls with a generic user-facing message
- Keep the existing `s.logger.Error().Err(err)` calls (already present) for server-side logging
- Example: `writeJSONError(w, 500, "git_commit_failed", err.Error())` → `writeJSONError(w, 500, "git_commit_failed", "operation failed")`
- Also fix `docs.go:36` same pattern

**Files:** `apps/backend/internal/api/projects.go`, `apps/backend/internal/api/docs.go`

### 1.3 Silent DB Migration Errors (`apps/backend/internal/db/db.go`)

**Problem:** 12 `ALTER TABLE` statements at lines 41-52 use `_, _ = db.Exec()`, silently discarding all errors including actual failures (not just "column already exists").

**Changes:**
- Create a `migrateColumn()` helper that:
  1. Checks if column exists via `PRAGMA table_info(tablename)`
  2. Only runs ALTER TABLE if column is missing
  3. Returns and logs real errors
- Add a `schema_version` table to track migration state
- Replace all 12 silent ALTER TABLE calls with `migrateColumn()` calls
- Add a `CREATE TABLE IF NOT EXISTS issue_history` migration (currently at lines 53-72)

**Files:** `apps/backend/internal/db/db.go`, new `apps/backend/internal/db/migrate.go`

### 1.4 GitHub Token Storage (`apps/backend/internal/db/`)

**Problem:** GitHub tokens stored as plaintext in the `projects` SQLite table.

**Changes:**
- Add a simple XOR-based obfuscation or AES encryption with a key derived from the API token
- Create `internal/db/crypto.go` with `encrypt(plaintext, key)` / `decrypt(ciphertext, key)` functions
- Update `InsertProject` and `GetProject*` to encrypt/decrypt the token field
- Migration: encrypt existing plaintext tokens on startup

**Files:** `apps/backend/internal/db/projects.go`, new `apps/backend/internal/db/crypto.go`

---

## Phase 2: Backend Error Handling & Hardening

### 2.1 JSON Encoder Error Handling (`apps/backend/internal/api/`)

**Problem:** 37 instances of `_ = json.NewEncoder(w).Encode(...)` across 10 API files silently discard encoding errors.

**Changes:**
- Create a `writeJSON(w http.ResponseWriter, status int, v any)` helper in `router.go` that:
  1. Sets Content-Type header
  2. Writes status code
  3. Encodes JSON and logs error if encoding fails
- Replace all 37 `_ = json.NewEncoder(w).Encode(...)` calls with `writeJSON(w, status, payload)`
- Files affected: `state.go` (19), `unsandbox.go` (6), `unsandbox_config.go` (3), `stt.go` (2), `workspace_migration.go` (2), `docs.go` (1), `telemetry.go` (1), `health.go` (1), `github_auth.go` (1), `router.go` (1)

**Files:** `apps/backend/internal/api/router.go` + all 10 handler files listed above

### 2.2 Silent Hook Failures (`apps/backend/internal/workspace/service.go`)

**Problem:** Hook execution errors discarded at lines 83 and 108.

**Changes:**
- Line 83 (`RemoveIssueWorkspaces`): Log the error as a warning, continue with removal
  ```go
  if _, err := RunHook(...); err != nil {
      s.logger.Warn().Err(err).Str("hook", "before_remove").Msg("hook failed")
  }
  ```
- Line 108 (`RunAfterRunHook`): Propagate the error to the caller
  ```go
  res, err := RunHook("after_run", hooks.AfterRun, workspacePath, s.timeoutOrDefault())
  return res, err
  ```

**Files:** `apps/backend/internal/workspace/service.go`

### 2.3 Configurable Log Path (`apps/backend/internal/logging/logger.go`)

**Problem:** Hardcoded `/tmp/orchestrad.log` with world-readable 0644 permissions (line 21).

**Changes:**
- Read log path from `ORCHESTRA_LOG_FILE` env var, default to `~/.orchestra/orchestrad.log`
- Change file permissions from `0644` to `0600`
- Create parent directory if it doesn't exist

**Files:** `apps/backend/internal/logging/logger.go`

### 2.4 API Rate Limiting (`apps/backend/internal/api/router.go`)

**Problem:** No rate limiting on any endpoint.

**Changes:**
- Add a simple token-bucket middleware using `golang.org/x/time/rate`
- Apply per-IP rate limit (e.g., 100 req/s burst, 50 req/s sustained)
- Add to the chi middleware chain before auth
- Configuration via `ORCHESTRA_RATE_LIMIT` env var (default: 100)

**Files:** `apps/backend/internal/api/router.go`, new `apps/backend/internal/api/ratelimit.go`

### 2.5 Default Branch Detection (`apps/backend/internal/api/projects.go`)

**Problem:** Hardcoded `"main"` default branch (line 139) breaks repos using `master`.

**Changes:**
- Add a `git.DefaultBranch(repoPath)` function that runs `git symbolic-ref refs/remotes/origin/HEAD`
- Fall back to `"main"` if detection fails
- Replace hardcoded `"main"` at line 139

**Files:** `apps/backend/internal/api/projects.go`, `apps/backend/internal/utils/` (git helpers)

---

## Phase 3: Desktop App Improvements

### 3.1 Extract Custom Hooks from App.tsx

**Problem:** App.tsx is 1,462 lines with 49 useState calls, making it unmaintainable.

**Changes — extract 6 custom hooks:**

1. **`src/hooks/useBackendConfig.ts`** — Lines 94, 99-103
   - `config`, `loadingConfig`, `savingConfig`, `profilesPending`, `backendProfiles`, `activeProfileId`
   - Profile CRUD logic, desktop bridge integration

2. **`src/hooks/useRuntimeSync.ts`** — Lines 95-98, 107-108
   - `snapshot`, `timeline`, `boardIssues`, `githubBacklogIssues`, `loadingState`, `usePolling`
   - SSE connection, polling fallback, snapshot/timeline handlers

3. **`src/hooks/useBoardState.ts`** — Lines 97-98, 403-407
   - `boardIssues`, `githubBacklogIssues`, `allBoardIssuesRef` pattern
   - Issue CRUD, state transitions, GitHub sync callbacks
   - Eliminates the `allBoardIssuesRef` workaround

4. **`src/hooks/useIssueLookup.ts`** — Lines 118-120, 126-129
   - `issueLookupId`, `issueLookupPending`, `issueLookupResult`, `issueLookupError`
   - `sessionLookupResult`, `sessionLookupPending`, `sessionLookupError`

5. **`src/hooks/useNotifications.ts`** — Lines 123-125, 465-471
   - `notifSound`, `notifMuted`, `notifVolume`
   - AudioContext management with proper cleanup
   - Fix the AudioContext leak (use singleton or close in finally)

6. **`src/hooks/useWorkspaceMigration.ts`** — Lines 114-117
   - `migrationFrom`, `migrationTo`, `migrationPlan`, `migrationPending`

**Result:** App.tsx reduced from ~1,462 to ~400 lines, just composing hooks and rendering sections.

**Files:** 6 new hook files in `src/hooks/`, edit `src/App.tsx`

### 3.2 Input Validation

**Problem:** No validation on settings forms or task creation.

**Changes:**

**SettingsCard.tsx:**
- Profile name: trim, max 50 chars, alphanumeric + spaces only
- Base URL: validate URL format with `new URL()`, require http/https protocol
- Access token: trim, min 1 char when provided
- Migration paths: trim, reject empty, warn on relative paths
- Unsandbox keys: trim, min length check

**CreateTaskDialog.tsx:**
- Title: trim, max 200 chars, required (not just whitespace)
- Description: max 10,000 chars

**Implementation:** Add a `src/lib/validation.ts` with reusable validators, use inline error messages under each input.

**Files:** `apps/desktop/src/lib/validation.ts` (new), `apps/desktop/src/components/settings/SettingsCard.tsx`, `apps/desktop/src/components/tasks/CreateTaskDialog.tsx`

### 3.3 URL Parameter Sanitization (`apps/desktop/src/lib/orchestra-client.ts`)

**Problem:** Inconsistent `encodeURIComponent` usage — 5 locations where path params are not encoded (lines 483, 532, 553, 639, 716).

**Changes:**
- Line 483: Encode `relPath` in artifact fetch
- Line 532: Encode `projectId` in file content fetch
- Line 553: Encode `projectId` in git diff fetch
- Line 639: Encode `path` in doc content fetch
- Line 716: Encode `number` in PR diff fetch
- Add a linting rule or helper `apiPath()` that enforces encoding

**Files:** `apps/desktop/src/lib/orchestra-client.ts`

### 3.4 Add Error Boundaries Per Section

**Problem:** Single CrashBoundary at root; dialog/section crashes are unrecoverable.

**Changes:**
- Create `src/components/ui/SectionErrorBoundary.tsx` with retry button and section name
- Wrap each major section in App.tsx: KanbanBoard, IssueDetailView, SettingsCard, ProjectDetailView, TerminalMultiplexer, AnalyticsDashboard
- Wrap each dialog: CreateTaskDialog, CreateProjectDialog, inspect dialogs

**Files:** new `src/components/ui/SectionErrorBoundary.tsx`, edit `src/App.tsx`

### 3.5 Add Pagination Support

**Problem:** `fetchIssues()`, `searchIssues()`, `fetchSessions()` return all results with no limit/offset.

**Changes:**
- Add `limit` and `offset` optional params to `fetchIssues`, `searchIssues`, `fetchSessions`, `fetchProjects`
- Pass as query parameters: `?limit=50&offset=0`
- Requires backend support — add `LIMIT ? OFFSET ?` to corresponding SQL queries in `apps/backend/internal/db/`
- Add "Load more" or infinite scroll to KanbanBoard and session lists

**Files:** `apps/desktop/src/lib/orchestra-client.ts`, `apps/backend/internal/db/projects.go`, `apps/backend/internal/api/state.go`

### 3.6 Fix AudioContext Leak

**Problem:** `new AudioContext()` created on each notification (App.tsx:466) but not reliably closed.

**Changes:**
- Use a module-level singleton AudioContext (created once, reused)
- Wrap playback in try/finally to ensure cleanup
- Move into `useNotifications` hook (Phase 3.1)

**Files:** Addressed as part of `src/hooks/useNotifications.ts` in Phase 3.1

### 3.7 Remove Unused Dependency

**Problem:** `react-grab` (package.json:73) only imported in dev mode in index.html, never used in app code.

**Changes:**
- Remove `"react-grab": "^0.1.25"` from devDependencies
- Remove the dev-only import from `index.html` if present
- Run `npm ci` to verify clean install

**Files:** `apps/desktop/package.json`, `apps/desktop/index.html`

---

## Phase 4: Infrastructure & Ops Hardening

### 4.1 Docker Security (`ops/docker/Dockerfile.backend`)

**Changes:**
- Add non-root user:
  ```dockerfile
  RUN adduser --disabled-password --gecos '' orchestra
  USER orchestra
  ```
- Add HEALTHCHECK:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=3s CMD ["/usr/local/bin/orchestrad", "healthz"]
  ```
  Or use wget/curl to hit `/healthz`
- Optimize layer caching: copy go.mod/go.sum first, run `go mod download`, then copy source

**Files:** `ops/docker/Dockerfile.backend`

### 4.2 Systemd Sandboxing (`ops/systemd/orchestrad.service`)

**Changes — add security directives:**
```ini
[Service]
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateDevices=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=yes
RestrictRealtime=yes
ReadWritePaths=/opt/orchestra /var/log/orchestra
```

**Files:** `ops/systemd/orchestrad.service`

### 4.3 CI: Race Detector on PRs (`.github/workflows/orchestra-backend.yml`)

**Problem:** Line 53: `if: github.event_name != 'pull_request'` excludes race detection from PRs.

**Changes:**
- Remove the `if` condition on the `backend-race-tests` job (line 53)
- Race tests now run on both push and pull_request events

**Files:** `.github/workflows/orchestra-backend.yml`

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

| Order | Phase | Effort | Risk | Dependency |
|-------|-------|--------|------|------------|
| 1 | 1.1 Shell injection fix | Small | High impact | None |
| 2 | 1.2 Error leakage fix | Small | High impact | None |
| 3 | 1.3 DB migration errors | Medium | High impact | None |
| 4 | 2.1 JSON encoder errors | Medium | Medium impact | None |
| 5 | 2.2 Hook error handling | Small | Low impact | None |
| 6 | 2.3 Configurable log path | Small | Low impact | None |
| 7 | 1.4 Token encryption | Medium | High impact | 1.3 |
| 8 | 4.1 Docker security | Small | Medium impact | None |
| 9 | 4.2 Systemd sandboxing | Small | Medium impact | None |
| 10 | 4.3 CI race detector on PRs | Small | Medium impact | None |
| 11 | 3.3 URL param sanitization | Small | Medium impact | None |
| 12 | 3.2 Input validation | Medium | Medium impact | None |
| 13 | 3.4 Error boundaries | Small | Low impact | None |
| 14 | 3.7 Remove react-grab | Small | Low impact | None |
| 15 | 3.1 Extract custom hooks | Large | Medium impact | None |
| 16 | 3.6 AudioContext fix | Small | Low impact | 3.1 |
| 17 | 2.4 Rate limiting | Medium | Medium impact | None |
| 18 | 2.5 Default branch detection | Small | Low impact | None |
| 19 | 3.5 Pagination | Large | Medium impact | Backend changes |
| 20 | 5.1 TUI tests | Medium | Low impact | None |
| 21 | 5.2 Desktop component tests | Medium | Low impact | 3.1 |
| 22 | 5.3 Backend integration tests | Large | Low impact | 2.1 |
| 23 | 4.4 CI TUI tests | Small | Low impact | 5.1 |
| 24 | 6.1 Deployment runbook | Medium | Low impact | 4.1, 4.2 |
| 25 | 6.2 Migration guide | Small | Low impact | 1.3 |

**Total: 25 work items across 6 phases.**
