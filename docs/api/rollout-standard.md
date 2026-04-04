# Schema Rollout Standard

This standard defines how the refactor should be executed domain by domain.

## PR Shape

Each domain should land in small, reviewable units:

1. planning/docs
2. shared schema files
3. canonical domain schema files
4. backend contract tests
5. desktop type/adaptation updates
6. legacy field cleanup

Avoid mixing multiple domains in one implementation PR unless the later domain only depends on shared `common/` changes.

## Domain Checklist

For each domain:

1. inventory routes
2. define canonical resources
3. define request and response schemas
4. define error codes
5. define query parameters
6. add contract tests
7. update desktop/API consumers
8. track and later remove deprecated fields

## Recommended Order

1. `common`
2. `issues`
3. `core runtime`
4. `projects`
5. `sessions`
6. `agents`
7. `mcp`
8. `git`
9. `github`
10. `analytics`
11. `workspace`
12. `unsandbox`

## Exit Criteria Per Domain

- canonical schemas committed
- route coverage matrix updated
- query params documented
- error codes documented
- handler contract tests passing
- desktop client updated where applicable
- deprecations tracked

## First Implementation Standard

The first implementation domain should be `issues` because:

- it has clear drift today
- it touches both backend and desktop
- it provides shared building blocks reused by `state`
