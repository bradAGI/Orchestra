# Test Registry

> **Last updated:** 2026-03-21
> **Total:** 52 files, 397 tests (267 backend, 25 TUI, 105 desktop)
> **Skipped:** 2 (desktop migration UI tests — feature removed)

---

## Backend (Go) — 267 tests across 36 files

### cmd/orchestra — CLI entry point (6 tests)

| Test | What it validates |
|------|-------------------|
| `TestRunCLIRequiresCommand` | Exits with error when no subcommand given |
| `TestRunCLIUnknownCommand` | Reports unrecognized subcommands |
| `TestRunCLICheckSuccess` | `orchestra check` passes for valid workflow |
| `TestRunCLICheckFailure` | `orchestra check` fails for invalid workflow |
| `TestRunCLICheckPRBodyRequiresPath` | `check-pr-body` requires file path argument |
| `TestRunCLICheckPRBodySuccess` | `check-pr-body` validates a well-formed PR body |

**File:** `apps/backend/cmd/orchestra/main_test.go`

---

### internal/agents — Agent runners (52 tests)

#### command_runner_test.go (32 tests)

| Test | What it validates |
|------|-------------------|
| `TestCommandRunnerParsesJSONUsageAndEvents` | Parses JSON usage and events from agent output |
| `TestCommandRunnerReplacesPromptTemplateToken` | `{{prompt}}` token replaced with shell-quoted prompt |
| `TestRegistrySupportsCodexClaudeAndOpenCode` | Registry supports all provider types |
| `TestParseLineToEventClaudeParsesNestedMessageAndUsage` | Parses Claude nested message format |
| `TestParseLineToEventOpenCodeSupportsSSEDataPrefix` | Handles `data:` prefix in SSE |
| `TestParseLineToEventExtractsMessageFromContentArray` | Extracts text from content array |
| `TestCommandRunnerReturnsApprovalRequiredFromStructuredEvent` | Returns approval error from structured event |
| `TestCommandRunnerReturnsInputRequiredFromStructuredEvent` | Returns input error from structured event |
| `TestCommandRunnerReturnsInputRequiredFromDotStyleEvent` | Handles dot-style event format |
| `TestCommandRunnerReturnsInputRequiredFromNestedNeedsInputPayload` | Detects nested requires_input flags |
| `TestCommandRunnerReturnsApprovalRequiredFromGenericApprovalEvent` | Handles generic approval events |
| `TestParseLineToEventExtractsUsageFromParamsEnvelope` | Extracts usage from params envelope |
| `TestParseLineToEventParsesSSEEventPrefix` | Parses SSE `event:` prefix |
| `TestParseLineToEventIgnoresSSEIDAndRetryPrefixes` | Ignores `id:` and `retry:` lines |
| `TestCommandRunnerAppliesSSEEventKindToDataPayload` | Applies SSE event kind to data |
| `TestCommandRunnerIgnoresSSECommentLines` | Ignores SSE comments |
| `TestParseLineToEventParsesJSONArrayEnvelope` | Parses JSON array envelopes |
| `TestParseLineToEventParsesJSONArrayEnvelopeMergesUsageAcrossItems` | Merges usage across array items |
| `TestParseLineToEventParsesJSONArrayEnvelopeReturnsBlockingEvent` | Returns blocking events from arrays |
| `TestCommandRunnerFlushesSSEDataAtEOF` | Flushes buffered SSE data at EOF |
| `TestCommandRunnerCombinesMultipleSSEDataLines` | Combines multi-line SSE data |
| `TestCommandRunnerReturnsTimeoutError` | Returns timeout error when deadline exceeded |
| `TestCommandRunnerReturnsParentContextCancellation` | Returns context canceled on parent cancel |
| `TestCommandRunnerIgnoresSSEDoneSentinel` | Ignores `[DONE]` sentinel |
| `TestCommandRunnerMergesPartialUsageAcrossEvents` | Merges partial token usage |
| `TestParseLineToEventDetectsNestedNeedsInputUnderArbitraryKeys` | Detects nested requires_input |
| `TestParseLineToEventDetectsStringTruthyNeedsInputFlags` | Detects truthy string flags |
| `TestParseLineToEventDoesNotBlockOnStringFalseNeedsInputFlags` | Ignores falsey string flags |
| `TestParseLineToEventDoesNotBlockOnZeroNumericNeedsInputFlag` | Ignores zero numeric flags |
| `TestShouldIgnoreScannerError` | Ignores expected scanner errors |
| `TestDetectBlockingEventPrefersApprovalOverInputSignals` | Approval takes precedence over input |
| `TestDetectBlockingEventDoesNotTreatApprovalSubstringAsApprovalMethod` | Substring not treated as approval |

**File:** `apps/backend/internal/agents/command_runner_test.go`

#### codex_appserver_test.go (17 tests)

| Test | What it validates |
|------|-------------------|
| `TestCodexAppServerRunner_RunTurn` | Full turn execution with tool invocation |
| `TestCodexAppServerRunner_ReturnsApprovalRequiredWhenAutoApproveDisabled` | Blocks on approval when auto-approve off |
| `TestCodexAppServerRunner_PrefersApprovalOverInputWhenBothPresent` | Approval takes precedence |
| `TestCodexAppServerRunner_TreatsApprovalSubstringMethodAsInputRequired` | Substring handled as input |
| `TestCodexAppServerRunner_ReturnsInputRequiredWhenAutoApproveDisabled` | Input required error |
| `TestToolRequestUserInputApprovalAnswersPrefersApproveSession` | Extracts "Approve this Session" |
| `TestToolRequestUserInputApprovalAnswersAllowsAllowPrefix` | Accepts allow-prefixed answers |
| `TestToolRequestUserInputUnavailableAnswersUsesNonInteractiveText` | Non-interactive answer |
| `TestNeedsInputMethodDetectsTruthyNestedSignals` | Detects truthy nested signals |
| `TestNeedsInputMethodIgnoresFalseySignals` | Ignores falsey signals |
| `TestCodexAppServerRunner_WrapsInitializeResponseErrors` | Wraps init errors |
| `TestCodexAppServerRunner_UsesOnRequestPolicyWhenAutoApproveDisabled` | Correct approval policy |
| `TestCodexAppServerRunner_IncludesTurnFailureDetails` | Includes failure reason |
| `TestCodexAppServerRunner_IgnoresProtocolJSONOnStderr` | Ignores stderr JSON |
| `TestCodexAppServerRunner_AdvertisesDynamicToolsOnThreadStart` | Advertises dynamic tools |
| `TestCodexAppServerRunner_WrapsThreadStartErrors` | Wraps thread/start errors |
| `TestCodexAppServerRunner_WrapsTurnStartErrors` | Wraps turn/start errors |

**File:** `apps/backend/internal/agents/codex_appserver_test.go`

#### registry_test.go (3 tests)

| Test | What it validates |
|------|-------------------|
| `TestNewRegistryNormalizesProviderKeys` | Provider key casing normalized |
| `TestNewRegistryUsesCodexAppServerRunnerWhenCommandIncludesAppServer` | Selects app-server runner |
| `TestRegistryRunTurnReturnsProviderNotConfiguredError` | Error for unconfigured provider |

**File:** `apps/backend/internal/agents/registry_test.go`

---

### internal/api — HTTP API handlers (48 tests)

#### projects_test.go (5 tests)

| Test | What it validates |
|------|-------------------|
| `TestGetProjects` | GET /api/v1/projects returns JSON array |
| `TestCreateProject` | POST /api/v1/projects creates project, returns 201 |
| `TestCreateProjectRejectsEmptyPath` | Empty root_path returns 400 |
| `TestDeleteProjectReturns204` | DELETE /api/v1/projects/{id} returns 204 |
| `TestGetProjectReturnsStats` | GET /api/v1/projects/{id} returns stats |

**File:** `apps/backend/internal/api/projects_test.go`

#### security_and_events_test.go (23 tests)

| Test | What it validates |
|------|-------------------|
| `TestProtectedEndpointsRequireBearerTokenWhenConfigured` | Auth required when token set |
| `TestProtectedEndpointsRequireBearerTokenOnLoopbackWhenConfigured` | Auth on loopback |
| `TestAPICorsPreflightAllowsLoopbackOrigin` | CORS preflight for loopback |
| `TestEventsEndpointStreamsSnapshotFrame` | SSE snapshot frame |
| `TestEventsEndpointSnapshotIncludesRateLimits` | Rate limits in snapshot |
| `TestEventsEndpointStreamingSnapshotReflectsUpdatedRateLimits` | Updated rate limits |
| `TestWorkspaceMigrationPlanEndpoint` | Migration plan endpoint |
| `TestEventsEndpointStreamsPubSubEvent` | SSE streams pubsub events |
| `TestEventsEndpointPublishesImmediateSnapshotAfterPubSubEvent` | Snapshot after event |
| `TestEventsEndpointStreamsLifecycleEvents` | Lifecycle event streaming |
| `TestEventsEndpointDoesNotSynthesizeRetryScheduled` | No synthetic retry events |
| `TestEventsEndpointStreamsRefreshLifecyclePair` | Refresh lifecycle pair |
| `TestWriteEventEnvelopeWrapsRawPayloadWithTypeDataAndTimestamp` | Event envelope structure |
| `TestWriteEventEnvelopePreservesProvidedEventTimestamp` | Preserves timestamp |
| `TestEventsEndpointNonSnapshotFramesUseStableEnvelopeShape` | Stable envelope shape |
| `TestEventsEndpointSnapshotFrameCarriesExpectedShape` | Snapshot frame shape |
| `TestEventsEndpointLifecycleEnvelopeCarriesExpectedDataFields` | Lifecycle data fields |
| `TestNotFoundReturnsJSONForAPIPaths` | JSON 404 for API paths |
| `TestNotFoundReturnsHTMLForNonAPIPaths` | HTML 404 for non-API |
| `TestMethodNotAllowedReturnsJSONForAPIPaths` | JSON 405 for API |
| `TestMethodNotAllowedReturnsHTMLForNonAPIPaths` | HTML 405 for non-API |
| `TestPostAPIRejectsNonJSONContentType` | Rejects non-JSON content-type |
| `TestPostAPIAcceptsJSONContentType` | Accepts JSON content-type |

**File:** `apps/backend/internal/api/security_and_events_test.go`

#### state_test.go (6 tests)

| Test | What it validates |
|------|-------------------|
| `TestGetState` | GET /api/v1/state returns snapshot |
| `TestHealthzEndpoints` | /healthz returns 200 |
| `TestPostRefresh` | POST /api/v1/refresh queues and coalesces |
| `TestMethodNotAllowedReturnsJSONEnvelope` | 405 JSON envelope |
| `TestGetIssueReturnsRunningIssue` | Issue detail for running issue |
| `TestGetIssueReturnsNotFoundEnvelope` | 404 for missing issue |

**File:** `apps/backend/internal/api/state_test.go`

#### ratelimit_test.go (6 tests)

| Test | What it validates |
|------|-------------------|
| `TestRateLimiter_AllowWithinBurst` | Allows within burst |
| `TestRateLimiter_RejectExceedingRate` | Rejects over limit |
| `TestRateLimiter_IndependentIPs` | Per-IP isolation |
| `TestRateLimiter_TokenRefill` | Token refill over time |
| `TestRateLimitMiddleware_Returns429` | 429 response |
| `TestRateLimitMiddleware_XForwardedFor` | Respects X-Forwarded-For |

**File:** `apps/backend/internal/api/ratelimit_test.go`

#### Other API tests (8 tests)

| File | Tests | What they cover |
|------|-------|----------------|
| `terminal_auth_test.go` | 4 | Token auth: unset, bearer, query, wrong |
| `static_test.go` | 2 | Dashboard HTML, live status sections |
| `workspace_migration_test.go` | 2 | Migration dry-run and apply |

---

### internal/orchestrator — State machine (59 tests)

| File | Tests | What they cover |
|------|-------|----------------|
| `dispatch_test.go` | 42 | Enqueuing, claiming, concurrency limits, retry scheduling, revalidation, blockers, token accumulation |
| `refresh_test.go` | 11 | Refresh reconciliation, stalled runs, blocked issues, retry backfill, assignment drops |
| `reconcile_test.go` | 3 | Terminal removal, state updates, token accumulation |
| `state_test.go` | 2 | Refresh coalescing, snapshot counts |
| `soak_test.go` | 1 | 1200-cycle correctness soak test |

---

### Other backend packages (102 tests)

| File | Tests | What they cover |
|------|-------|----------------|
| `app/run_test.go` | 13 | Execution tick lifecycle, retry events, rate limits, hooks |
| `config/load_test.go` | 9 | Env vars, workflow overrides, defaults, validation |
| `db/crypto_test.go` | 6 | AES-256-GCM encrypt/decrypt roundtrip, edge cases |
| `workspace/service_test.go` | 6 | Worktree create/reuse/remove, hook behavior |
| `workflow/frontmatter_test.go` | 5 | YAML frontmatter parsing |
| `specs/pr_body_test.go` | 5 | PR body linting |
| `prompt/builder_test.go` | 6 | Prompt template rendering |
| `workspace/path_guard_test.go` | 4 | Path sanitization, traversal rejection |
| `observability/pubsub_test.go` | 4 | Pub/sub publish, subscribe, timestamps |
| `logfile/logfile_test.go` | 3 | Session log creation, symlinks |
| `telemetry/watcher_test.go` | 3 | Token extraction, idempotent rescan |
| `workspace/migration_test.go` | 3 | Migration planning and execution |
| `specs/check_test.go` | 3 | Workflow validation |
| `workspace/hooks_test.go` | 2 | Hook execution, timeout |
| `workflow/store_test.go` | 2 | Workflow loading, path switching |
| `tracker/memory/client_test.go` | 9 | Candidate filtering, state fetching, ordering |
| `utils/git/worktree_test.go` | 10 | Worktree CRUD, pruning, diffs |
| `runtime/identity_test.go` | 1 | Token requirements by host |
| `tools/linear_executor_test.go` | 1 | Tracker query execution |

---

## TUI (Go) — 25 tests across 2 files

### main_test.go (14 tests)

| Test | What it validates |
|------|-------------------|
| `TestInitialModel` | Model initialization with services |
| `TestInitialModelNoStart` | NoStart flag skips auto-start |
| `TestGetCurrentService` | Returns correct service for active tab |
| `TestTabSwitching` | Tab key cycles through tabs |
| `TestNumberKeySwitching` | Number keys select specific tabs |
| `TestQuitKey` | `q` sends quit command |
| `TestCtrlCQuit` | Ctrl+C sends quit command |
| `TestFollowToggle` | `f` toggles log follow mode |
| `TestUpKeyDisablesFollow` | Up arrow disables follow |
| `TestWindowSizeMsg` | Viewport updates on window resize |
| `TestWindowSizeMsgMinimumDimensions` | Clamps to minimum dimensions |
| `TestGetStatusDisplay` | Status display formatting |
| `TestViewBeforeReady` | Shows initializing message |
| `TestTabResetsFollowLogs` | Tab reset follow to true |

**File:** `apps/tui/main_test.go`

### manager_test.go (11 tests)

| Test | What it validates |
|------|-------------------|
| `TestServiceInitialState` | Service starts in stopped state |
| `TestServiceStatusConstants` | Status enum values |
| `TestStartChangesStatus` | Start changes to running |
| `TestStartSetsStartingStatus` | Start sets starting synchronously |
| `TestStopChangesStatus` | Stop changes to stopped |
| `TestStopAppendsLog` | Stop appends log message |
| `TestStartGuardAgainstDuplicate` | Prevents duplicate starts |
| `TestStartGuardWhileStarting` | Prevents start while starting |
| `TestLogBufferCapped` | Log buffer caps at 200 lines |
| `TestLogBufferCappedWithRealCommand` | Log cap with real output |
| `TestServiceStruct` | Service struct fields |

**File:** `apps/tui/manager_test.go`

---

## Desktop (TypeScript) — 105 tests across 14 files

### lib/orchestra-client.test.ts (16 tests)

| Test | What it validates |
|------|-------------------|
| `normalizeSnapshotPayload returns safe defaults` | Malformed payload handling |
| `normalizeSnapshotPayload normalizes mixed values` | Field normalization |
| `normalizeEventEnvelope normalizes valid payload` | Event envelope parsing |
| `normalizeEventEnvelope applies fallback values` | Fallback for malformed envelopes |
| `executes state -> refresh -> migration plan -> apply` | Full operator flow contracts |
| `returns normalized API errors` | UI-safe error display |
| `rejects blank issue identifiers` | Pre-network validation |
| `omits Authorization when token empty` | Header handling |
| `falls back to request_failed for non-json` | Non-JSON error responses |
| `omits migration query params when blank` | Optional param handling |
| `trims from/to values in migration apply` | Input sanitization |
| `isUnauthorizedError detects unauthorized` | Error classification |
| `isUnauthorizedError returns false for others` | Negative case |
| `requestText returns text content` | Text endpoint success path |
| `requestText throws APIError for errors` | Text endpoint error path |

**File:** `apps/desktop/src/lib/orchestra-client.test.ts`

### lib/runtime-sync.test.ts (7 tests)

| Test | What it validates |
|------|-------------------|
| `passes bearer token as query param` | Token in SSE URL |
| `reconnects after error and uses polling` | Reconnection fallback |
| `applies exponential reconnect backoff` | Backoff timing |
| `does not create duplicate polling loops` | Polling deduplication |
| `keeps timers and streams bounded` | Resource cleanup |
| `cancels pending reconnect work on stop` | Stop cleanup |

**File:** `apps/desktop/src/lib/runtime-sync.test.ts`

### lib/validation.test.ts (13 tests)

| Test | What it validates |
|------|-------------------|
| `validateTaskTitle` (4) | Empty, too short, too long, valid |
| `validateTaskDescription` (3) | Too long, valid, empty |
| `validateUrl` (3) | Empty, valid, invalid |
| `validateBaseUrl` (5) | Empty, http, https, invalid protocol, invalid URL |
| `validateProjectPath` (4) | Empty, unix, windows, relative |

**File:** `apps/desktop/src/lib/validation.test.ts`

### lib/runtime-store.test.ts (4 tests)

| Test | What it validates |
|------|-------------------|
| `returns next when previous is null` | Initial snapshot |
| `returns previous reference when idempotent` | No-op update |
| `prepends and bounds timeline items` | Timeline append with cap |
| `skips duplicate head item` | Deduplication |

**File:** `apps/desktop/src/lib/runtime-store.test.ts`

### lib/navigation.test.ts (4 tests)

| Test | What it validates |
|------|-------------------|
| `returns null for unsupported keys` | Non-navigation keys ignored |
| `returns first and last for Home/End` | Home/End navigation |
| `wraps around for ArrowDown/ArrowUp` | Wrap-around cycling |
| `returns null when no items` | Empty list handling |

**File:** `apps/desktop/src/lib/navigation.test.ts`

### lib/view-models.test.ts (3 tests)

| Test | What it validates |
|------|-------------------|
| `sorts running entries by identifier` | Running entry sort |
| `does not mutate input` | Immutability |
| `sorts retry entries by due_at, identifier, attempt` | Retry entry sort |

**File:** `apps/desktop/src/lib/view-models.test.ts`

### widgets/issue-detail/IssueDetailUtils.test.ts (4 tests)

| Test | What it validates |
|------|-------------------|
| `parses markdown checkbox items` | Operational plan extraction |
| `returns empty for numbered lists` | Non-checkbox handling |
| `returns empty when no checkboxes` | Missing checkboxes |
| `ignores items from other issues` | Issue scoping |

**File:** `apps/desktop/src/widgets/issue-detail/IssueDetailUtils.test.ts`

### components/ui/section-error-boundary.test.tsx (4 tests)

| Test | What it validates |
|------|-------------------|
| `renders children when no error` | Normal rendering |
| `shows error message and retry button` | Error state rendering |
| `clicking retry re-renders children` | Recovery behavior |
| `displays section name in error UI` | Section context |

**File:** `apps/desktop/src/components/ui/section-error-boundary.test.tsx`

### components/projects/ProjectGrid.test.tsx (13 tests)

| Test | What it validates |
|------|-------------------|
| `renders project rows with name, path, sessions, tokens` | List rendering |
| `filters projects by name` | Search by name |
| `filters projects by path` | Search by path |
| `sorts by sessions ascending then descending` | Column sort toggle |
| `sorts by name ascending, toggles to descending` | Default sort |
| `shows empty state when no projects` | Empty state |
| `shows empty state when search has no matches` | No-match state |
| `opens delete confirmation dialog` | Delete dialog |
| `calls onDeleteProject when confirming` | Delete callback |
| `delete button click does not trigger row click` | Event propagation |
| `calls onProjectClick with project id` | Row click |
| `renders loading skeleton` | Loading state |
| `does not render skeleton when projects exist` | Loaded state |

**File:** `apps/desktop/src/components/projects/ProjectGrid.test.tsx`

### components/tasks/CreateTaskDialog.test.tsx (4 tests)

| Test | What it validates |
|------|-------------------|
| `renders title input and description textarea` | Input rendering |
| `submit button disabled when title empty` | Validation guard |
| `submit button disabled when no project` | Project required |
| `shows title validation error for too-short titles` | Validation feedback |

**File:** `apps/desktop/src/components/tasks/CreateTaskDialog.test.tsx`

### App.smoke.test.tsx (27 tests, 2 skipped)

| Test | What it validates |
|------|-------------------|
| `renders task board on launch` | Initial render with kanban columns |
| `creates a task` | Task creation flow |
| `deletes a task` | Task deletion flow |
| `shows error on failed task deletion` | Error handling |
| `opens issue inspector` | Issue detail navigation |
| `changes task state` | State transition |
| `requires project for task creation` | Validation |
| `opens issue inspector with detail tabs` | Tab rendering |
| `adds a project` | Project creation flow |
| `opens project detail` | Project navigation |
| `deletes a project` | Project deletion flow |
| `warns on missing project path` | Path validation |
| ~~`saves backend config from settings form`~~ | _Skipped: React 19 + jsdom_ |
| ~~`shows backend config validation error`~~ | _Skipped: React 19 + jsdom_ |
| `creates backend profile from settings` | Profile creation |
| `switches backend profile` | Profile switching |
| `reconnects SSE on profile switch` | SSE reconnection |
| `deletes non-default profile` | Profile deletion |
| `disables profile delete when only one` | Guard |
| ~~`runs workspace migration`~~ | _Skipped: migration UI removed_ |
| ~~`shows migration error`~~ | _Skipped: migration UI removed_ |
| `shows refresh status` | Refresh feedback |
| `shows refresh failure error` | Error display |
| `passes token to SSE` | Token in SSE URL |
| `sidebar navigation` | Section switching |
| `arrow key navigation in sidebar` | Keyboard nav |
| `Home/End navigation in sidebar` | Home/End keys |
| `opens command palette` | Cmd+K palette |
| `toggles theme` | Theme toggle |

**File:** `apps/desktop/src/App.smoke.test.tsx`

---

## Coverage Gaps

### Backend packages with no tests

| Package | Risk | Notes |
|---------|------|-------|
| `internal/logging` | Low | Thin zerolog wrapper |
| `internal/mcp` | Medium | MCP client — should have contract tests |
| `internal/staticassets` | Low | Embedded static files |
| `internal/terminal` | Medium | Terminal PTY manager |
| `internal/tracker/github` | High | GitHub tracker — `SearchIssues` and `CreateIssue` are stubbed |
| `internal/tracker/sqlite` | Medium | SQLite tracker implementation |
| `internal/types` | Low | Type definitions only |
| `internal/unfirehose` | Low | Event logger |
| `internal/unsandbox` | Medium | Unsandbox client (4 files) |
| `internal/utils/github` | Low | GitHub utilities |

### Desktop components with no tests

| Component | Risk | Notes |
|-----------|------|-------|
| `ProjectDetailView` | High | Complex tabbed view with file browser, git, kanban |
| `SettingsCard` | Medium | Backend config, profiles, migration UI |
| `AgentDashboard` | Medium | Agent configuration |
| `SandboxDashboard` | Medium | Remote code execution |
| `KanbanBoard` | High | Drag-and-drop task board |
| `TerminalView` | Medium | xterm integration |
| `Embedded agent (23 files)` | High | Chat, tools, MCP bridge, providers |

---

## Running Tests

```bash
# Backend
cd apps/backend && go test ./...
cd apps/backend && go test -race ./...        # with race detector

# TUI
cd apps/tui && go test -race ./...

# Desktop
cd apps/desktop && npx vitest run
cd apps/desktop && npx vitest run --coverage  # with coverage report

# Single file
cd apps/backend && go test ./internal/api/ -run TestGetProjects -v
cd apps/desktop && npx vitest run src/components/projects/ProjectGrid.test.tsx
```
