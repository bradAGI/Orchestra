# Projects Domain

## Scope

- `/api/v1/projects`
- `/api/v1/projects/{project_id}`
- `/api/v1/projects/{project_id}/refresh`
- `/api/v1/projects/{project_id}/file`
- `/api/v1/projects/{project_id}/tree`

## Canonical Resources

- `ProjectSummary`
- `ProjectDetail`
- `ProjectCreateRequest`
- `ProjectTreeNode`
- `ProjectFileContent`

## Current Weak Spots

- Project metadata, filesystem views, and usage stats are mixed together.
- `project.response` includes operational stats that do not belong in every context.
- File and tree endpoints likely need their own explicit response schemas rather than ad hoc payloads.

## Shared Refs

- `common/id`
- `common/timestamp`
- `common/error-response`

## Test Targets

- `/api/v1/projects`
- `/api/v1/projects/{project_id}`
- `/api/v1/projects/{project_id}/tree`
