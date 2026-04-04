# MCP Domain

## Scope

- `/api/v1/mcp/tools`
- `/api/v1/mcp/servers`
- provider-scoped MCP routes under `/api/v1/agents/{provider}/mcp`

## Canonical Resources

- `MCPServer`
- `MCPTool`
- `ProviderMCPServer`

## Current Weak Spots

- Global and provider-scoped MCP definitions should share core structure while staying distinct where behavior differs.
- Capability and enablement fields need clear typing.
- Server identity should be modeled consistently across create, list, toggle, and delete flows.

## Shared Refs

- `common/id`
- `common/provider`
- `common/timestamp`

## Test Targets

- `/api/v1/mcp/servers`
- `/api/v1/mcp/tools`
- `/api/v1/agents/{provider}/mcp`
