# API Schema Deprecation Policy

This policy controls how contract cleanup happens without breaking the desktop app or external consumers.

## Rules

1. Canonical schemas do not include deprecated alias fields.
2. Deprecated fields may remain in handler responses temporarily for compatibility.
3. Every deprecated field must be tracked in docs with:
   - field name
   - replacement field
   - affected routes
   - removal phase
4. Alias removal must follow a passing contract test and a confirmed client migration.

The same policy applies to deprecated routes. Deprecated routes must be tracked with:
- route
- preferred replacement
- deprecation signal
- removal phase

## Initial Deprecations

| Deprecated Field | Replacement | Affected Routes | Removal Phase |
| --- | --- | --- | --- |
| `issue_id` | `id` | issue detail, state overlays | issues phase completion |
| `issue_identifier` | `identifier` | issue detail, state overlays | issues phase completion |
| provider-specific `logs.codex_session_logs` | `logs[]` typed entries | issue detail and related log responses | issues/core completion |
| `workspace_path` | `workspace.path` | issue detail | issues phase completion |

## Initial Route Deprecations

| Deprecated Route | Replacement | Deprecation Signal | Removal Phase |
| --- | --- | --- | --- |
| `/api/v1/config/agents/items` | `/api/v1/agents/{provider}/...` | `Deprecation`, `Sunset`, `Link` headers | agents provider-native completion |
| `/api/v1/config/agents/new` | `/api/v1/agents/{provider}/...` | `Deprecation`, `Sunset`, `Link` headers | agents provider-native completion |

## Removal Process

1. Introduce canonical schema and handler support for canonical field.
2. Update desktop and any documented consumers.
3. Add or update contract tests for canonical fields.
4. Mark legacy fields as deprecated in docs.
5. Remove legacy fields in a later PR once downstream consumers are clean.

## Review Requirement

No deprecated field should be removed in the same change that introduces the canonical replacement unless all known consumers are updated and validated in the same change.
