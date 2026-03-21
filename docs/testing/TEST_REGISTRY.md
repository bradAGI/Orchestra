# Test Registry

> **Last updated:** 2026-03-21
> **Total:** 49 files, 397 tests (267 backend, 25 TUI, 105 desktop)
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

#### terminal_auth_test.go (4 tests)

| Test | What it validates |
|------|-------------------|
| `TestIsTerminalAuthorizedAllowsWhenTokenUnset` | Allows access when no token configured |
| `TestIsTerminalAuthorizedAcceptsBearerHeader` | Accepts valid bearer token in header |
| `TestIsTerminalAuthorizedAcceptsTokenQuery` | Accepts token via query parameter |
| `TestIsTerminalAuthorizedRejectsMissingOrWrongToken` | Rejects missing or incorrect tokens |

**File:** `apps/backend/internal/api/terminal_auth_test.go`

#### static_test.go (2 tests)

| Test | What it validates |
|------|-------------------|
| `TestGetDashboardServesHTML` | Dashboard endpoint serves HTML content |
| `TestDashboardIncludesCoreLiveStatusSections` | Dashboard contains live status sections |

**File:** `apps/backend/internal/api/static_test.go`

#### workspace_migration_test.go (2 tests)

| Test | What it validates |
|------|-------------------|
| `TestPostWorkspaceMigrateDryRun` | Migration dry-run returns plan without mutation |
| `TestPostWorkspaceMigrateApply` | Migration apply executes the plan |

**File:** `apps/backend/internal/api/workspace_migration_test.go`

---

### internal/orchestrator — State machine (59 tests)

#### dispatch_test.go (42 tests)

| Test | What it validates |
|------|-------------------|
| `TestPerformRefreshEnqueuesCandidatesUpToConcurrency` | Enqueues candidates respecting concurrency limit |
| `TestShouldRetryAttemptHonorsMaxRetryPolicy` | Retry stops after max attempts |
| `TestPerformRefreshHonorsPerStateConcurrencyLimit` | Per-state concurrency limit enforced |
| `TestPerformRefreshSkipsIssuesNotAssignedToWorker` | Skips issues assigned to other workers |
| `TestPerformRefreshSkipsCandidatesOutsideActiveStates` | Skips candidates not in active states |
| `TestPerformRefreshSkipsTodoBlockedByNonTerminalIssue` | Skips todo blocked by non-terminal issue |
| `TestPerformRefreshAllowsTodoBlockedOnlyByTerminalIssues` | Allows todo when blockers are terminal |
| `TestReleaseDueRetriesMovesToRunning` | Releases due retries into running state |
| `TestReleaseDueRetriesRespectsPerStateConcurrencyLimits` | Retry release respects concurrency |
| `TestReleaseDueRetriesUsesRetryStateAsRunningState` | Retry uses original state when running |
| `TestRecordRunFailureCreatesRetryAndRemovesRunning` | Failure creates retry entry, removes running |
| `TestRecordRunFailureDerivesTotalTokensWhenMissing` | Derives total tokens from input+output |
| `TestRecordRunSuccessRemovesRunningEntry` | Success removes running entry |
| `TestClaimNextRunnableClaimsOnlyOnceUntilRelease` | Claim is exclusive until release |
| `TestRecordRunResultAccumulatesTotals` | Run result accumulates token totals |
| `TestRecordRunFailureStopsRetryAfterMaxAttempts` | Stops retrying after max attempts |
| `TestNextRetryDueHonorsBackoffBounds` | Retry backoff stays within bounds |
| `TestComputeRetryDueUsesAttemptFloorOfOne` | Retry due uses minimum attempt of 1 |
| `TestComputeRetryDueSquaresAttemptBeforeApplyingJitter` | Backoff squares attempt before jitter |
| `TestRetryJitterStableWithinSameMinuteForSameIssue` | Jitter is stable within same minute |
| `TestRetryJitterDiffersAcrossIssueIDs` | Jitter differs per issue ID |
| `TestRecordRunEventUpdatesRunningStatus` | Run event updates running entry status |
| `TestShouldContinueTurnHonorsMaxTurns` | Stops after max turns reached |
| `TestShouldContinueTurnChecksTrackerState` | Checks tracker state before continuing |
| `TestShouldContinueTurnStopsWhenIssueUnassigned` | Stops when issue is unassigned |
| `TestShouldContinueTurnStopsWhenTodoBlockedByNonTerminal` | Stops when todo blocked by non-terminal |
| `TestPrepareNextTurnIncrementsTurnAndReleasesClaim` | Next turn increments turn, releases claim |
| `TestRecordRunSuccessAccumulatesSecondsRun` | Success accumulates seconds_run |
| `TestRecordRunEventUpdatesRateLimits` | Run event updates rate limits |
| `TestRecordRunEventUpdatesNestedRateLimits` | Run event updates nested rate limits |
| `TestRecordRunEventPreservesExistingLastEventAndMessageWhenEmpty` | Preserves last_event and message when empty |
| `TestRecordRunEventDerivesTotalTokensWhenMissing` | Derives total tokens from event usage |
| `TestRecordRunEventUpdatesRateLimitsFromParamsEnvelope` | Rate limits from params envelope |
| `TestRecordRunEventUpdatesRateLimitsFromJSONStringEnvelope` | Rate limits from JSON string envelope |
| `TestRecordRunEventUpdatesRateLimitsFromArrayEnvelope` | Rate limits from array envelope |
| `TestRevalidateClaimedIssueRemovesMissingIssue` | Removes claimed issue not found in tracker |
| `TestRevalidateClaimedIssueRemovesTerminalIssue` | Removes claimed issue in terminal state |
| `TestRevalidateClaimedIssueRemovesUnassignedIssue` | Removes claimed issue no longer assigned |
| `TestRevalidateClaimedIssueRemovesTodoBlockedByNonTerminal` | Removes todo blocked by non-terminal |
| `TestRevalidateClaimedIssueUpdatesStateForActiveIssue` | Updates state for active claimed issue |
| `TestRevalidateClaimedIssueReturnsErrorOnTrackerFailure` | Returns error on tracker failure |
| `TestPerformRefreshCarriesDescriptionIntoRunningEntry` | Carries description into running entry |

**File:** `apps/backend/internal/orchestrator/dispatch_test.go`

#### refresh_test.go (11 tests)

| Test | What it validates |
|------|-------------------|
| `TestPerformRefreshReconcilesRunningEntries` | Reconciles running entries during refresh |
| `TestPerformRefreshClearsClaimsForReconciledOutIssues` | Clears claims for reconciled-out issues |
| `TestPerformRefreshMovesStalledClaimedRunToRetry` | Moves stalled claimed run to retry |
| `TestPerformRefreshDropsStalledRunAfterMaxAttempts` | Drops stalled run after max attempts |
| `TestPerformRefreshDoesNotRetryUnclaimedOldRun` | Does not retry unclaimed old runs |
| `TestPerformRefreshDropsRunningIssueNoLongerAssignedToWorker` | Drops running issue no longer assigned |
| `TestPerformRefreshDropsRunningTodoBlockedByNonTerminal` | Drops running todo blocked by non-terminal |
| `TestPerformRefreshClearsPendingFlagOnError` | Clears pending flag on error |
| `TestPerformRefreshDropsRetryEntriesForTerminalIssuesButKeepsMissing` | Drops terminal retries, keeps missing |
| `TestPerformRefreshBackfillsRetryStateFromTracker` | Backfills retry state from tracker |
| `TestPerformRefreshDropsRetryEntriesNotDispatchableByAssignmentOrBlockers` | Drops non-dispatchable retry entries |

**File:** `apps/backend/internal/orchestrator/refresh_test.go`

#### reconcile_test.go (3 tests)

| Test | What it validates |
|------|-------------------|
| `TestReconcileRunningStatesRemovesTerminalAndInactive` | Removes terminal and inactive entries |
| `TestReconcileRunningStatesUpdatesStateFromRefresh` | Updates state from refresh data |
| `TestReconcileRunningStatesAccumulatesTotalsForRemovedEntries` | Accumulates totals for removed entries |

**File:** `apps/backend/internal/orchestrator/reconcile_test.go`

#### state_test.go (2 tests)

| Test | What it validates |
|------|-------------------|
| `TestQueueRefreshCoalesces` | Refresh requests coalesce |
| `TestSnapshotIncludesCounts` | Snapshot includes correct counts |

**File:** `apps/backend/internal/orchestrator/state_test.go`

#### soak_test.go (1 test)

| Test | What it validates |
|------|-------------------|
| `TestOrchestratorSoakRefreshDispatchRetryLoop` | 1200-cycle correctness soak test |

**File:** `apps/backend/internal/orchestrator/soak_test.go`

---

### internal/app — Execution tick lifecycle (13 tests)

| Test | What it validates |
|------|-------------------|
| `TestNewTrackerClientUsesMemoryWhenEndpointUnset` | Falls back to memory tracker when endpoint unset |
| `TestPublishRunEventIncludesIssueAndProvider` | Run event includes issue and provider fields |
| `TestPublishLifecycleEventPublishesTypedEnvelope` | Lifecycle event publishes typed envelope |
| `TestProcessExecutionTickPublishesSuccessLifecycleEvents` | Tick publishes success lifecycle events |
| `TestProcessExecutionTickPublishesFailureAndRetryLifecycleEvents` | Tick publishes failure and retry events |
| `TestProcessExecutionTickDoesNotPublishRetryWhenAttemptExceedsMax` | No retry event when max attempts exceeded |
| `TestPublishRefreshRetryLifecycleEventsPublishesOnlyNewEntries` | Retry events only for new entries |
| `TestClassifyRefreshRetryCause` | Classifies refresh retry cause |
| `TestProcessExecutionTickPreservesRateLimitsFromMixedNestedEnvelope` | Preserves rate limits from mixed envelope |
| `TestProcessExecutionTickSkipsBeforeRunHookAfterFirstTurn` | Skips before-run hook after first turn |
| `TestProcessExecutionTickPublishesBeforeRunHookFailureCause` | Publishes before-run hook failure cause |
| `TestPublishRefreshRetryLifecycleEventsSuppressesDueAtOnlyChanges` | Suppresses due_at-only changes |
| `TestPublishRefreshRetryLifecycleEventsCarriesCompleteFields` | Retry events carry complete fields |

**File:** `apps/backend/internal/app/run_test.go`

---

### internal/config — Configuration loading (9 tests)

| Test | What it validates |
|------|-------------------|
| `TestLoad_UsesOrchestraEnv` | Loads config from ORCHESTRA_ env vars |
| `TestLoad_AgentProviderAndCommandsFromEnv` | Agent provider and commands from env |
| `TestLoad_ParsesTrackerAndConcurrencyOverridesFromEnv` | Tracker and concurrency overrides |
| `TestLoad_UsesWorkflowOverridesWhenEnvUnset` | Falls back to workflow overrides |
| `TestLoad_UsesDefaultsWhenWorkflowFileIsMissing` | Defaults when workflow file missing |
| `TestLoad_ParsesWorkflowListValuesForTrackerFields` | Parses list values for tracker fields |
| `TestLoad_InvalidPortReturnsError` | Invalid port returns error |
| `TestLoad_InvalidAgentMaxTurnsFallsBackToDefault` | Invalid max turns falls back to default |
| `TestLoad_InvalidMaxConcurrentFallsBackToDefault` | Invalid max concurrent falls back to default |

**File:** `apps/backend/internal/config/load_test.go`

---

### internal/db — Database crypto (6 tests)

| Test | What it validates |
|------|-------------------|
| `TestEncryptDecryptRoundTrip` | AES-256-GCM encrypt/decrypt round trip |
| `TestEncryptDecryptEmptyString` | Encrypt/decrypt empty string |
| `TestDecryptPlaintextPassthrough` | Plaintext passthrough on decrypt |
| `TestDecryptWithWrongKey` | Decrypt with wrong key fails |
| `TestEncryptWithoutKeyReturnsPlaintext` | Encrypt without key returns plaintext |
| `TestDecryptEncryptedTokenWithoutKeyErrors` | Decrypt encrypted token without key errors |

**File:** `apps/backend/internal/db/crypto_test.go`

---

### internal/logfile — Session logging (3 tests)

| Test | What it validates |
|------|-------------------|
| `TestWriteSessionLogCreatesSessionAndLatest` | Creates session log and latest symlink |
| `TestResetLatestLogCreatesWorkingSymlink` | Resets latest log symlink |
| `TestWriteSessionLogSanitizesPaths` | Sanitizes paths in session log names |

**File:** `apps/backend/internal/logfile/logfile_test.go`

---

### internal/observability — Pub/sub (4 tests)

| Test | What it validates |
|------|-------------------|
| `TestPubSubPublishSubscribe` | Publish and subscribe deliver events |
| `TestPubSubUnsubscribeStopsDelivery` | Unsubscribe stops event delivery |
| `TestPubSubPublishSetsTimestampWhenMissing` | Sets timestamp when missing |
| `TestPubSubPublishPreservesProvidedTimestamp` | Preserves provided timestamp |

**File:** `apps/backend/internal/observability/pubsub_test.go`

---

### internal/presenter — State presentation (7 tests)

| Test | What it validates |
|------|-------------------|
| `TestStatePayloadIncludesRunningAndRetrying` | State payload includes running and retrying |
| `TestStatePayloadIncludesTotalsAndRateLimits` | State payload includes totals and rate limits |
| `TestStatePayloadHumanizesLongMessages` | State payload humanizes long messages |
| `TestIssuePayloadFindsRunningIssue` | Issue payload finds running issue |
| `TestIssuePayloadFindsRetryIssueIncludesState` | Issue payload finds retry issue with state |
| `TestIssuePayloadMissingIssue` | Issue payload returns not found for missing |
| `TestHumanizeMessageTruncatesLongInput` | Humanize truncates long input |

**File:** `apps/backend/internal/presenter/presenter_test.go`

---

### internal/prompt — Prompt template rendering (6 tests)

| Test | What it validates |
|------|-------------------|
| `TestBuildRendersWorkflowPromptTemplate` | Renders workflow prompt template |
| `TestBuildFailsWhenTemplateMissingField` | Fails when template references missing field |
| `TestBuildSupportsLowercaseLiquidStyleKeysAndIssueParityFields` | Supports lowercase keys and parity fields |
| `TestBuildRendersDescriptionInTemplate` | Renders description in template |
| `TestBuildFailsWhenWorkflowPromptIsEmpty` | Fails when workflow prompt is empty |
| `TestBuildFailsWhenWorkflowFileMissing` | Fails when workflow file is missing |

**File:** `apps/backend/internal/prompt/builder_test.go`

---

### internal/runtime — Identity (1 test)

| Test | What it validates |
|------|-------------------|
| `TestHostRequiresToken` | Token requirements by host |

**File:** `apps/backend/internal/runtime/identity_test.go`

---

### internal/specs — Workflow and PR validation (8 tests)

#### check_test.go (3 tests)

| Test | What it validates |
|------|-------------------|
| `TestCheckPassesForValidWorkflow` | Check passes for valid workflow |
| `TestCheckFailsForEmptyPrompt` | Check fails for empty prompt |
| `TestCheckFailsWhenProviderCommandMissing` | Check fails when provider command missing |

**File:** `apps/backend/internal/specs/check_test.go`

#### pr_body_test.go (5 tests)

| Test | What it validates |
|------|-------------------|
| `TestLintPRBodyValid` | Valid PR body passes lint |
| `TestLintPRBodyDetectsMissingHeadingAndPlaceholder` | Detects missing heading and placeholder |
| `TestCaptureSection` | Captures markdown section content |
| `TestCheckPRBodyEndToEndValid` | End-to-end valid PR body |
| `TestCheckPRBodyEndToEndReportsTemplateViolations` | End-to-end template violation reporting |

**File:** `apps/backend/internal/specs/pr_body_test.go`

---

### internal/telemetry — Token watcher (3 tests)

| Test | What it validates |
|------|-------------------|
| `TestExtractTokens` | Extracts token usage from output |
| `TestScanGeminiJSON_IdempotentRescan` | Gemini JSON scan is idempotent |
| `TestScanOpenCodeSQLite_IdempotentRescan` | OpenCode SQLite scan is idempotent |

**File:** `apps/backend/internal/telemetry/watcher_test.go`

---

### internal/tools — Tool execution (1 test)

| Test | What it validates |
|------|-------------------|
| `TestExecuteTrackerQueryCandidates` | Tracker query execution returns candidates |

**File:** `apps/backend/internal/tools/linear_executor_test.go`

---

### internal/tracker/memory — In-memory tracker (9 tests)

| Test | What it validates |
|------|-------------------|
| `TestFetchCandidateIssuesFiltersByActiveState` | Filters candidates by active state |
| `TestFetchIssueStatesByIDs` | Fetches issue states by IDs |
| `TestFetchIssuesByIDs` | Fetches issues by IDs |
| `TestFetchIssuesByStates` | Fetches issues by states |
| `TestFetchIssueStatesByIDsSupportsLargeInput` | Supports large input for state fetch |
| `TestFetchCandidateIssuesReturnsDeterministicOrder` | Candidate fetch returns deterministic order |
| `TestNewClientWithWorkerAssigneesMarksAssignment` | Worker assignees mark assignment |
| `TestMemoryClientPreservesRichIssueFields` | Preserves rich issue fields |
| `TestDeleteIssue` | Deletes issue from memory store |

**File:** `apps/backend/internal/tracker/memory/client_test.go`

---

### internal/utils/git — Git worktree operations (10 tests)

| Test | What it validates |
|------|-------------------|
| `TestWorktreeAdd_NewBranch` | Adds worktree with new branch |
| `TestWorktreeAdd_ExistingBranch` | Adds worktree with existing branch |
| `TestWorktreeRemove` | Removes worktree |
| `TestWorktreeRemove_NonExistent` | Handles removal of non-existent worktree |
| `TestWorktreePrune` | Prunes stale worktree entries |
| `TestWorktreeList` | Lists worktrees |
| `TestHeadSHA` | Returns HEAD SHA |
| `TestBranchDiff_OnlyShowsBranchChanges` | Branch diff shows only branch changes |
| `TestWorktreeDiff_UncommittedChanges` | Worktree diff shows uncommitted changes |
| `TestIsGitRepo` | Detects git repository |

**File:** `apps/backend/internal/utils/git/worktree_test.go`

---

### internal/workflow — Workflow loading (7 tests)

#### frontmatter_test.go (5 tests)

| Test | What it validates |
|------|-------------------|
| `TestParse_WithFrontMatterAndPrompt` | Parses frontmatter with prompt |
| `TestParse_WithoutFrontMatter` | Parses file without frontmatter |
| `TestParse_InvalidFrontMatterYAMLReturnsError` | Invalid YAML returns error |
| `TestParse_FrontMatterMustBeMap` | Frontmatter must be a map |
| `TestParse_EmptyFrontMatterAllowed` | Empty frontmatter allowed |

**File:** `apps/backend/internal/workflow/frontmatter_test.go`

#### store_test.go (2 tests)

| Test | What it validates |
|------|-------------------|
| `TestStoreCurrentAndForceReload` | Store current and force reload |
| `TestStoreSetPath` | Store set path switches workflow |

**File:** `apps/backend/internal/workflow/store_test.go`

---

### internal/workspace — Workspace management (15 tests)

#### service_test.go (6 tests)

| Test | What it validates |
|------|-------------------|
| `TestEnsureWorktree_CreatesNewWorktree` | Creates new worktree |
| `TestEnsureWorktree_ReusesExisting` | Reuses existing worktree |
| `TestRemoveWorktree` | Removes worktree |
| `TestWorktreePath` | Returns correct worktree path |
| `TestRunBeforeRunHookReturnsErrorOnFailure` | Before-run hook failure returns error |
| `TestRunAfterRunHookIgnoresFailureButRunsHook` | After-run hook ignores failure |

**File:** `apps/backend/internal/workspace/service_test.go`

#### path_guard_test.go (4 tests)

| Test | What it validates |
|------|-------------------|
| `TestWorkspacePath_SanitizesIdentifier` | Sanitizes workspace identifier |
| `TestValidateWorkspacePath_RejectsRoot` | Rejects root path |
| `TestValidateWorkspacePath_RejectsOutsideRoot` | Rejects path outside root |
| `TestValidateWorkspacePath_RejectsSymlinkEscape` | Rejects symlink escape |

**File:** `apps/backend/internal/workspace/path_guard_test.go`

#### migration_test.go (3 tests)

| Test | What it validates |
|------|-------------------|
| `TestPlanWorkspaceMigrationRenameRoot` | Plans migration with root rename |
| `TestExecuteWorkspaceMigrationDryRunNoMutation` | Dry run does not mutate |
| `TestExecuteWorkspaceMigrationMovesEntriesOnConflictAwarePlan` | Moves entries with conflict-aware plan |

**File:** `apps/backend/internal/workspace/migration_test.go`

#### hooks_test.go (2 tests)

| Test | What it validates |
|------|-------------------|
| `TestRunHook_Success` | Hook execution succeeds |
| `TestRunHook_Timeout` | Hook times out correctly |

**File:** `apps/backend/internal/workspace/hooks_test.go`

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

## Desktop (TypeScript) — 105 tests across 11 files

### lib/orchestra-client.test.ts (15 tests)

| Test | What it validates |
|------|-------------------|
| `returns safe defaults for malformed payloads` | Malformed payload handling |
| `normalizes snapshot fields from mixed payload values` | Field normalization |
| `normalizes valid event payload` | Event envelope parsing |
| `applies fallback values for malformed envelopes` | Fallback for malformed envelopes |
| `executes state -> refresh -> migration plan -> migration apply with expected contracts` | Full operator flow contracts |
| `returns normalized API errors for UI-safe display` | UI-safe error display |
| `rejects blank issue identifiers before network request` | Pre-network validation |
| `omits Authorization header when api token is empty` | Header handling |
| `falls back to request_failed error for non-json error responses` | Non-JSON error responses |
| `omits workspace migration query params when from/to are blank` | Optional param handling |
| `trims from/to values in migration apply body` | Input sanitization |
| `detects unauthorized display strings and error instances` | Error classification |
| `returns false for non-unauthorized errors` | Negative case |
| `requestText returns text content for successful responses` | Text endpoint success path |
| `requestText throws APIError for error responses` | Text endpoint error path |

**File:** `apps/desktop/src/lib/orchestra-client.test.ts`

### lib/runtime-sync.test.ts (6 tests)

| Test | What it validates |
|------|-------------------|
| `passes bearer token as query param when SSE is used` | Token in SSE URL |
| `reconnects stream after error and uses polling fallback` | Reconnection fallback |
| `applies exponential reconnect backoff and resets after open` | Backoff timing |
| `does not create duplicate polling loops across repeated stream errors` | Polling deduplication |
| `keeps timer and stream counts bounded during reconnect churn` | Resource cleanup |
| `cancels pending reconnect work on stop` | Stop cleanup |

**File:** `apps/desktop/src/lib/runtime-sync.test.ts`

### lib/validation.test.ts (19 tests)

#### validateTaskTitle (4 tests)

| Test | What it validates |
|------|-------------------|
| `returns error for empty title` | Empty title rejected |
| `returns error for too short title` | Too-short title rejected |
| `returns error for too long title` | Too-long title rejected |
| `returns empty string for valid title` | Valid title accepted |

#### validateTaskDescription (3 tests)

| Test | What it validates |
|------|-------------------|
| `returns error for too long description` | Too-long description rejected |
| `returns empty string for valid description` | Valid description accepted |
| `returns empty string for empty description` | Empty description accepted |

#### validateUrl (3 tests)

| Test | What it validates |
|------|-------------------|
| `returns empty string when URL is empty` | Empty URL accepted |
| `returns empty string for valid URL` | Valid URL accepted |
| `returns error for invalid URL` | Invalid URL rejected |

#### validateBaseUrl (5 tests)

| Test | What it validates |
|------|-------------------|
| `returns error for empty URL` | Empty base URL rejected |
| `returns empty string for valid http URL` | HTTP URL accepted |
| `returns empty string for valid https URL` | HTTPS URL accepted |
| `returns error for invalid protocol` | Invalid protocol rejected |
| `returns error for invalid URL` | Invalid URL rejected |

#### validateProjectPath (4 tests)

| Test | What it validates |
|------|-------------------|
| `returns error for empty path` | Empty path rejected |
| `returns empty string for absolute unix path` | Unix path accepted |
| `returns empty string for absolute windows path` | Windows path accepted |
| `returns error for relative path` | Relative path rejected |

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
| `submit button is disabled when title is empty` | Validation guard |
| `submit button is disabled when no project is selected` | Project required |
| `shows title validation error for too-short titles` | Validation feedback |

**File:** `apps/desktop/src/components/tasks/CreateTaskDialog.test.tsx`

### App.smoke.test.tsx (29 tests, 2 skipped)

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
| `saves backend config from settings form` | Settings persistence |
| `shows backend config validation error for invalid URL` | Settings validation |
| `creates backend profile from settings` | Profile creation |
| `switches backend profile` | Profile switching |
| `reconnects SSE on profile switch` | SSE reconnection |
| `deletes non-default profile from settings` | Profile deletion |
| `disables profile delete when only one profile exists` | Guard |
| ~~`runs workspace migration`~~ | _Skipped: migration UI removed_ |
| ~~`shows migration error`~~ | _Skipped: migration UI removed_ |
| `shows refresh status` | Refresh feedback |
| `shows refresh failure error in runtime strip` | Error display |
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
