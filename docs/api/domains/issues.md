# Issues Domain

## Scope

- `/api/v1/issues`
- `/api/v1/issues/{issue_identifier}`
- `/api/v1/issues/{issue_identifier}/logs`
- `/api/v1/issues/{issue_identifier}/history`
- `/api/v1/issues/{issue_identifier}/diff`
- `/api/v1/issues/{issue_identifier}/artifacts`
- `/api/v1/issues/{issue_identifier}/pr`
- `/api/v1/issues/{issue_identifier}/stop`
- `/api/v1/search`

## Canonical Resources

- `IssueRef`
- `IssueSummary`
- `IssueDetail`
- `IssueAttempts`
- `IssueWorkspace`
- `IssueLogEntry`
- `IssueEvent`
- `IssueCreateRequest`
- `IssueUpdateRequest`

## Current Weak Spots

- Mixed `id` and `issue_id` naming.
- Mixed `identifier` and `issue_identifier` naming.
- Provider-specific log grouping leaks into public schema.
- `history`, `running`, `retry`, and `recent_events` are not strongly typed.
- Search results should reuse issue summary shape instead of inventing a near-copy.

## Shared Refs

- `common/id`
- `common/provider`
- `common/timestamp`
- `common/log-entry`
- `common/event-summary`

## Test Targets

- `/api/v1/issues`
- `/api/v1/issues/{issue_identifier}`
- `/api/v1/search`
