# API Versioning Policy

This policy defines how schema and route changes evolve under `/api/v1`.

## Standard

- `v1` remains the active API namespace until a change cannot be delivered compatibly.
- Additive changes are allowed in `v1` only when they do not break canonical schemas or existing consumers.
- Breaking changes require either:
  - a documented deprecation window inside `v1`, or
  - a new namespace such as `/api/v2`.

## Change Classes

### Additive

Allowed in `v1`:

- adding optional fields
- adding new endpoints
- adding new enum values only when clients are already required to handle unknown values safely
- tightening internal implementation without changing wire shape

### Compatibility Transition

Allowed in `v1` with policy controls:

- introducing canonical replacements for legacy alias fields
- adding new nested objects that replace flat fields
- changing documentation or examples to prefer canonical fields

Requirements:

- deprecation entry in `deprecation-policy.md`
- passing contract tests for old and new client paths where needed
- explicit removal phase

### Breaking

Do not ship silently in `v1`:

- removing existing fields without a transition
- renaming fields without alias support
- changing required field semantics
- changing root payload shape
- changing endpoint media type from JSON to non-JSON

## Versioning Plan

### Phase A: Stabilize `v1`

- introduce canonical schemas
- keep compatibility aliases only at handler boundaries
- migrate desktop consumers
- add validation tests

### Phase B: Evaluate `v2` Threshold

Create `v2` only if one or more of these become necessary:

- issue/resource naming must change without alias support
- root shapes need normalization across many domains
- streaming protocols need incompatible envelope changes
- auth or configuration routes need a different top-level model

## Standard For New Work

- New endpoints must be designed against canonical schemas first.
- New fields must be reviewed for whether they belong in an existing canonical resource or a new sub-resource.
- No new legacy aliases may be introduced in `v1`.
