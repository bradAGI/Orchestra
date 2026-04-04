# Schema Refactor Draft

This draft defines the first-pass target structure for API schemas and the canonical `Issue` model. The goal is to remove field drift, reduce duplication, and make backend and desktop clients depend on one stable contract.

## Goals

- Use one canonical identity model per resource.
- Extract shared objects and enums into reusable `$ref` targets.
- Separate summary and detail payloads cleanly.
- Eliminate untyped `{}` and loosely typed arrays from public contracts.

## Proposed Directory Layout

```text
packages/protocol/schemas/v1/
  common/
    id.schema.json
    timestamp.schema.json
    provider.schema.json
    token-usage.schema.json
    log-entry.schema.json
    error.response.schema.json
  issues/
    issue-ref.schema.json
    issue-summary.schema.json
    issue-detail.schema.json
    issue-status.schema.json
    issue-attempts.schema.json
    issue-create.request.schema.json
    issue-update.request.schema.json
    issues.list.response.schema.json
  projects/
  sessions/
  agents/
  mcp/
  workspace/
  analytics/
```

## Canonical Naming Decisions

- Use `id` for the stable internal resource ID.
- Use `identifier` for the human-facing issue key or tracker identifier.
- Do not expose both `issue_id` and `id` in the same payload.
- Do not expose both `issue_identifier` and `identifier` in the same payload.
- Use `status` for orchestration/runtime state and reserve `state` for tracker workflow state.

## Canonical Issue Shapes

### `IssueRef`

Minimal cross-reference used in nested structures such as dependencies:

```json
{
  "type": "object",
  "required": ["id", "identifier", "state"],
  "properties": {
    "id": { "$ref": "../common/id.schema.json" },
    "identifier": { "type": "string" },
    "state": { "type": "string" }
  },
  "additionalProperties": false
}
```

### `IssueSummary`

Used by list endpoints and lightweight state views:

```json
{
  "type": "object",
  "required": ["id", "identifier", "title", "state", "provider"],
  "properties": {
    "id": { "$ref": "../common/id.schema.json" },
    "identifier": { "type": "string" },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "state": { "type": "string" },
    "priority": { "type": "number" },
    "project_id": { "$ref": "../common/id.schema.json" },
    "assignee_id": { "$ref": "../common/id.schema.json" },
    "branch_name": { "type": "string" },
    "url": { "type": "string" },
    "labels": { "type": "array", "items": { "type": "string" } },
    "blocked_by": {
      "type": "array",
      "items": { "$ref": "./issue-ref.schema.json" }
    },
    "provider": { "$ref": "../common/provider.schema.json" },
    "disabled_tools": { "type": "array", "items": { "type": "string" } },
    "created_at": { "$ref": "../common/timestamp.schema.json" },
    "updated_at": { "$ref": "../common/timestamp.schema.json" },
    "base_sha": { "type": "string" }
  },
  "additionalProperties": false
}
```

### `IssueDetail`

Build on `IssueSummary` and add orchestration-specific detail:

- `status`: enum such as `RUNNING`, `RETRYING`, `TRACKED`, `IDLE`
- `attempts`: typed object with retry counters
- `workspace`: typed object with `path`
- `logs`: array of typed log entries, not provider-specific field names
- `recent_events`: typed event summaries
- `last_error`: nullable string
- `history`: typed event list or separate paged resource

## Immediate Cleanup Targets

1. Replace `issue.response.schema.json` with `issues/issue-detail.schema.json`.
2. Replace `issues.list.response.schema.json` with a list of `IssueSummary`.
3. Update `state.response.schema.json` to reuse `IssueSummary` plus runtime-only overlays.
4. Move provider enum to `common/provider.schema.json`.
5. Add `additionalProperties: false` to new public schemas unless there is a clear extension need.

## Migration Notes

- Keep current response aliases temporarily at the handler layer, not in canonical schemas.
- Update desktop adapters to consume canonical fields before removing aliases.
- Add contract tests for `/issues`, `/issues/{id}`, and `/state` before deleting legacy fields.
