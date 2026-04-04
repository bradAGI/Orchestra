# Go Contract Validation Standard

This standard defines how backend handlers are checked against canonical schemas.

## Current State

The backend already has schema validation helpers in [contract_test_helpers.go](/home/traves/Development/symphony-main/apps/backend/internal/api/contract_test_helpers.go) using `gojsonschema`.

## Standard

- High-value JSON endpoints must have contract tests.
- Tests should validate real handler responses, not just hand-crafted fixtures.
- Fixtures remain useful for golden examples and edge-case regression coverage.

## Test Layers

### Handler Contract Tests

Use `httptest` against actual handlers and validate response bodies against schema files.

Required for:

- `/api/v1/issues`
- `/api/v1/issues/{issue_identifier}`
- `/api/v1/state`
- `/api/v1/projects`

### Fixture Validation Tests

Validate representative payload examples stored in `packages/test-fixtures/api/v1/`.

Useful for:

- documenting sample payloads
- preserving known compatibility shapes during migration

### Error Contract Tests

Validate that failures use the standard error envelope and expected error codes.

Required for:

- not found
- invalid request
- unauthorized where applicable

## Rules

- Add a contract test when introducing a canonical schema for a domain.
- Contract tests should fail on unexpected additional fields once canonical schemas set `additionalProperties: false`.
- Handler tests should prefer canonical response paths over compatibility aliases.

## Rollout Plan

1. Add canonical schema files.
2. Add handler contract tests for one representative list route and one detail route.
3. Add error-path tests.
4. Expand to the rest of the domain after the first route pair is stable.
