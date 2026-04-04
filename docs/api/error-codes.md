# API Error Code Standard

This document defines the standard for machine-readable API errors.

## Error Envelope

All JSON errors use:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "human readable message"
  }
}
```

## Rules

- `code` is stable and intended for programmatic handling.
- `message` may be adjusted for clarity without changing the semantic meaning.
- Error codes are lowercase snake_case.
- Domain codes should describe the failure category, not the implementation detail.

## Shared Error Families

- `invalid_request`
- `unauthorized`
- `forbidden`
- `not_found`
- `conflict`
- `validation_failed`
- `internal_error`
- `not_supported`
- `timeout`

## Domain Standards

### Issues

- `issue_not_found`
- `issue_invalid_state`
- `issue_already_running`
- `issue_not_running`
- `issue_pr_creation_failed`

### Projects

- `project_not_found`
- `project_path_invalid`
- `project_path_not_found`
- `project_not_git_repo`

### Git

- `git_checkout_failed`
- `git_merge_conflict`
- `git_merge_abort_failed`
- `git_push_failed`
- `git_branch_not_found`
- `git_invalid_pathspec`

### GitHub

- `github_not_connected`
- `github_oauth_failed`
- `github_repo_creation_failed`
- `github_issue_sync_failed`
- `github_pr_merge_failed`

### Agents And Config

- `provider_invalid`
- `provider_not_configured`
- `agent_config_invalid`
- `agent_config_not_found`
- `agent_permission_invalid`

### MCP

- `mcp_server_not_found`
- `mcp_server_duplicate`
- `mcp_server_invalid`
- `mcp_tool_lookup_failed`

### Workspace And Unsandbox

- `workspace_migration_invalid`
- `workspace_migration_blocked`
- `unsandbox_unavailable`
- `unsandbox_job_not_found`
- `unsandbox_execution_failed`

## Implementation Plan

1. Audit current `writeJSONError` callsites by domain.
2. Normalize reused generic codes where they are sufficient.
3. Replace vague or inconsistent codes with the domain standard.
4. Add contract tests for critical failure paths in high-risk domains.
