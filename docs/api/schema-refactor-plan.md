# Schema Refactor Plan

This plan turns the protocol layer into a real contract boundary between `apps/backend`, `apps/desktop`, and `packages/protocol/schemas`.

## Why

Current weaknesses:

- The same resource uses multiple field names (`id` and `issue_id`, `identifier` and `issue_identifier`).
- Important payloads contain untyped objects and arrays.
- Shared enums and sub-objects are duplicated instead of referenced.
- Route coverage is broader than schema coverage, so the schema set is only partially authoritative.

## Principles

- One canonical shape per resource.
- Shared building blocks live in `v1/common/`.
- Domain schemas live under domain folders, not a flat directory.
- New schemas default to `additionalProperties: false`.
- Backward compatibility is handled in handlers and client adapters during migration, not in canonical schema definitions.

## Target Layout

```text
packages/protocol/schemas/v1/
  common/
  core/
  issues/
  projects/
  git/
  github/
  agents/
  mcp/
  sessions/
  analytics/
  workspace/
  unsandbox/
```

## Domain Order

1. `common`
2. `issues`
3. `core`
4. `projects`
5. `git`
6. `github`
7. `agents`
8. `mcp`
9. `sessions`
10. `analytics`
11. `workspace`
12. `unsandbox`

This order starts with the most reused objects and the highest visible client drift.

## Phase 1: Common Foundations

Create shared definitions for:

- identifiers
- timestamps
- provider enum
- token usage
- error envelope
- log entry
- event summary

Exit criteria:

- New issue and core schemas can reuse these definitions through `$ref`.

## Phase 2: Issues

Define canonical:

- `IssueRef`
- `IssueSummary`
- `IssueDetail`
- `IssueCreateRequest`
- `IssueUpdateRequest`
- `IssuesListResponse`

Migration:

- Keep alias fields in handlers temporarily.
- Update desktop issue types and adapters.
- Add contract tests for `/issues` and `/issues/{issue_identifier}`.

Exit criteria:

- List and detail responses are backed by canonical issue schemas.

## Phase 3: Core Runtime

Cover:

- `/state`
- `/events`
- `/refresh`
- health endpoints
- STT health and transcription
- docs and openapi metadata where appropriate

Key goal:

- Reuse `IssueSummary`, runtime overlays, event summaries, and token usage instead of defining new inline shapes.

## Phase 4: Projects, Git, and GitHub

Separate local project metadata from source-control operations and remote GitHub resources.

Key goal:

- Avoid mixing filesystem project models with git status models and GitHub issue/PR models.

## Phase 5: Agents, MCP, Sessions

Normalize configuration and runtime concepts:

- installed providers
- provider config
- permissions
- hooks
- MCP server definitions
- session detail and timeline payloads

Key goal:

- Distinguish persisted config from runtime inspection responses.

## Phase 6: Analytics, Workspace, Unsandbox

These domains have broader payload variation and lower reuse pressure, so they come after the core models stabilize.

Key goal:

- Introduce schema coverage for currently under-specified operational endpoints without blocking the higher-value contract cleanup.

## Testing Strategy

- Add schema validation tests around representative HTTP responses.
- Start with `/issues`, `/issues/{issue_identifier}`, `/state`, and `/projects`.
- Keep fixture payloads in `packages/test-fixtures/api/v1/`.
- Fail tests on field drift, missing required fields, or unmodeled additions.

## Documentation Strategy

- Keep one domain note per API domain under `docs/api/domains/`.
- Each note should record route scope, canonical resources, shared refs, migration concerns, and test targets.
- Update `docs/api/schemas.md` only after a domain has landed.
- Keep cross-cutting standards in dedicated docs:
  - `schema-coverage-matrix.md`
  - `deprecation-policy.md`
  - `contract-ownership.md`
  - `versioning-policy.md`
  - `error-codes.md`
  - `query-parameter-standard.md`
  - `type-generation-standard.md`
  - `go-contract-validation-standard.md`
  - `rollout-standard.md`
  - `streaming-contracts.md`
  - `streaming-protocol-plan.md`

## Review Gates

Each domain migration is complete only when:

1. canonical schema files exist
2. at least one handler/test path validates against them
3. desktop consumers are updated if needed
4. legacy aliases are either removed or explicitly tracked for later removal
