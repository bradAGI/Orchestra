# Sessions Domain

## Scope

- `/api/v1/sessions`
- `/api/v1/sessions/{session_id}`
- terminal coupling via `/api/v1/terminal/{session_id}`

## Canonical Resources

- `SessionSummary`
- `SessionDetail`
- `SessionEvent`
- `SessionTimelineEntry`

## Current Weak Spots

- Sessions are closely related to issues, providers, and terminal streams, but should still have their own stable contract.
- Timeline and event payloads should be typed rather than passed through as unstructured arrays.
- Summary and detail responses should reuse shared token and timestamp objects.

## Shared Refs

- `common/id`
- `common/provider`
- `common/timestamp`
- `common/token-usage`
- `common/event-summary`

## Test Targets

- `/api/v1/sessions`
- `/api/v1/sessions/{session_id}`
