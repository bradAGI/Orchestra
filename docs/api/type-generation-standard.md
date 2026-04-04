# Type Generation Standard

This standard governs how schema contracts map into desktop TypeScript types.

## Current State

The desktop app maintains API-facing types manually in [orchestra-types.ts](/home/traves/Development/symphony-main/apps/desktop/src/lib/orchestra-types.ts). Those types already show schema drift, especially around issue and state payloads.

## Standard

- Canonical JSON schemas are the source of truth for shared API types.
- Desktop API types should be generated from canonical schemas where feasible.
- Hand-written frontend view-model types are still allowed, but they must be derived from generated API types rather than replacing them.

## Model Layers

1. `API types`
   - direct schema-derived payload types
2. `Adapters`
   - convert compatibility payloads to canonical shapes during migration
3. `View models`
   - UI-specific shapes for components and state management

## Rules

- Do not hand-author new API payload types if a schema exists.
- Keep generated types in a dedicated file or directory separate from UI models.
- Alias handling belongs in adapters, not in generated types.
- Once a domain is migrated, `orchestra-types.ts` should stop defining that domain manually.

## Migration Plan

1. Start with `issues` and `core runtime`.
2. Generate or scaffold canonical TypeScript types from the new schemas.
3. Introduce adapters for legacy issue detail and state payloads.
4. Update desktop consumers to import canonical API types.
5. Remove redundant manual definitions from `orchestra-types.ts`.

## Decision Point

Before implementation, choose one:

- generated files committed to the repo
- generated files produced in CI/dev scripts

The simpler first step is committed generated output with a verification check later.
