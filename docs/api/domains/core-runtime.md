# Core Runtime Domain

## Scope

Routes centered on system status and live orchestration behavior:

- `/healthz`
- `/api/v1/healthz`
- `/api/v1/state`
- `/api/v1/events`
- `/api/v1/refresh`
- `/api/v1/openapi.yaml`
- `/api/v1/docs`
- `/api/v1/stt/health`
- `/api/v1/stt/transcribe`
- `/api/v1/terminal/{session_id}`

## Canonical Resources

- `StateSnapshot`
- `RunningIssue`
- `RetryingIssue`
- `EventSummary`
- `RefreshResponse`
- `STTHealth`
- `STTTranscription`

## Current Weak Spots

- `state.response` duplicates issue identity and provider shapes.
- Runtime overlays are mixed with issue detail fields.
- `rate_limits` and some event-like objects are under-specified.
- Terminal and SSE behavior are documented, but not consistently modeled as contracts.

## Shared Refs

- `common/id`
- `common/provider`
- `common/timestamp`
- `common/token-usage`
- `common/event-summary`
- `issues/issue-summary`

## Test Targets

- `/api/v1/state`
- `/api/v1/events?once=1`
- `/api/v1/refresh`
- `/api/v1/stt/health`
