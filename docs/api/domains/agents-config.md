# Agents And Config Domain

## Scope

- `/api/v1/agents`
- `/api/v1/config/agents`
- `/api/v1/config/agents/items`
- `/api/v1/config/agents/new`
- `/api/v1/agents/{provider}/mcp`
- `/api/v1/agents/{provider}/permissions`
- `/api/v1/agents/{provider}/model`
- `/api/v1/agents/{provider}/hooks`
- `/api/v1/agents/claude/*`
- `/api/v1/config/agent-providers`
- `/api/v1/config/unsandbox`

## Canonical Resources

- `AgentRuntime`
- `AgentConfigDocument`
- `AgentConfigItem`
- `ProviderPermissions`
- `ProviderModelConfig`
- `ProviderHooks`
- `ClaudeRule`
- `ClaudeSkill`
- `ClaudeSubAgent`
- `AgentProviderSecretStatus`

## Current Weak Spots

- Runtime agent status and persisted config are distinct concerns but are easy to blur.
- Shared normalized endpoints and provider-native document routes need explicit schema boundaries.
- Some legacy generic config item APIs still exist and likely need more precise payload definitions than generic objects.

## Current Split

- `/api/v1/config/agents` remains the runtime/app-level agent settings surface.
- `/api/v1/config/agents/items` and `/api/v1/config/agents/new` remain legacy generic config-item helpers.
- `/api/v1/agents/{provider}/...` is the preferred provider-native configuration surface for the `Agents` workspace.

## Deprecation Signals

Legacy generic config-item routes emit explicit deprecation headers:
- `Deprecation: true`
- `Sunset: Wed, 31 Dec 2026 23:59:59 GMT`
- `Link: </api/v1/agents>; rel="successor-version"`

## Shared Refs

- `common/provider`
- `common/id`
- `mcp/mcp-server`

## Test Targets

- `/api/v1/agents`
- `/api/v1/config/agents`
- `/api/v1/agents/{provider}/permissions`
