# Workspace And Unsandbox Domain

## Scope

- `/api/v1/workspace/migration/plan`
- `/api/v1/workspace/migrate`
- `/api/v1/unsandbox/status`
- `/api/v1/unsandbox/execute`
- `/api/v1/unsandbox/jobs/*`
- `/api/v1/unsandbox/sessions`
- `/api/v1/unsandbox/services`

## Canonical Resources

- `WorkspaceMigrationPlan`
- `WorkspaceMigrationResult`
- `UnsandboxStatus`
- `UnsandboxExecutionRequest`
- `UnsandboxJob`
- `UnsandboxSession`
- `UnsandboxService`

## Current Weak Spots

- Workspace migration is a filesystem domain and should stay separate from remote execution concerns.
- Unsandbox endpoints likely have request and response payloads with operational fields that need tighter typing.
- Job and session resources need stable identity and lifecycle fields for polling clients.

## Shared Refs

- `common/id`
- `common/timestamp`
- `common/error-response`

## Test Targets

- `/api/v1/workspace/migration/plan`
- `/api/v1/workspace/migrate`
- `/api/v1/unsandbox/status`
