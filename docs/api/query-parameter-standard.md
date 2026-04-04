# Query Parameter Standard

This standard covers non-body inputs for REST, SSE, and document endpoints.

## Rules

- Query parameters must be documented per route.
- Parameter names use `snake_case`.
- Boolean flags use `1` or `0` only when the route already behaves that way; otherwise prefer explicit strings such as `true` and `false`.
- Reused parameters should share names and meaning across domains.
- Invalid query parameters should return `invalid_request` or a domain-specific validation code.

## Shared Parameter Vocabulary

- `project_id`: stable project identifier
- `provider`: provider key such as `CODEX`
- `scope`: config scope selector
- `since`: inclusive lower timestamp/date bound
- `until`: inclusive upper timestamp/date bound
- `page`: pagination index
- `path`: filesystem-relative path where applicable

## Route Families

### Issues

- `/api/v1/issues`
  - document all filter params parsed in `GetIssues`
- `/api/v1/search`
  - `q`: search string
- `/api/v1/issues/{issue_identifier}/logs`
  - `provider`
- `/api/v1/issues/{issue_identifier}/history`
  - document any future pagination if added

### Projects And Git

- `/api/v1/projects/{project_id}/file`
  - `path`
- `/api/v1/projects/{project_id}/tree`
  - `path`
- `/api/v1/projects/{project_id}/git`
  - document filter query params if present
- `/api/v1/projects/{project_id}/git/diff`
  - `hash`, `file`, `staged`
- `/api/v1/projects/{project_id}/github/issues`
  - `state`, `page`
- `/api/v1/projects/{project_id}/github/pulls`
  - `page`

### Runtime And Streaming

- `/api/v1/events`
  - `once`
- `/api/v1/terminal/{session_id}`
  - `project_id`
  - `token`

### Workspace And Analytics

- `/api/v1/workspace/migration/plan`
  - `from`, `to`
- analytics routes
  - `since`, `until`, `provider`, `group_by`

## Implementation Plan

1. Produce a route-by-route parameter inventory from handler code.
2. Add request docs for each parameter set.
3. Add validation tests for malformed or unsupported values on critical routes.
4. Reuse shared parameter names instead of inventing near-duplicates.
