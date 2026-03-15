# OpenAPI Documentation

The backend API is documented in an OpenAPI 3.1 specification:

- File: `docs/openapi.yaml`
- Runtime: `GET /api/v1/openapi.yaml`

## Endpoint Summary

### Runtime & Health

| Method | Path | Description |
|---|---|---|
| GET | `/healthz` | Health check |
| GET | `/api/v1/state` | Full runtime state snapshot |
| GET | `/api/v1/events` | SSE event stream |
| POST | `/api/v1/refresh` | Trigger tracker refresh |
| GET | `/api/v1/telemetry/health` | Telemetry watcher health |
| GET | `/api/v1/warehouse/stats` | Warehouse statistics |

### Issues

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/issues` | List all issues |
| POST | `/api/v1/issues` | Create an issue |
| GET | `/api/v1/issues/{id}` | Get issue details |
| PATCH | `/api/v1/issues/{id}` | Update an issue |
| DELETE | `/api/v1/issues/{id}` | Delete an issue |
| GET | `/api/v1/issues/{id}/history` | Issue event history |
| GET | `/api/v1/issues/{id}/logs` | Agent session logs |
| GET | `/api/v1/issues/{id}/diff` | Workspace diff |
| GET | `/api/v1/issues/{id}/artifacts` | List artifacts |
| POST | `/api/v1/issues/{id}/pr` | Create GitHub PR from issue |
| DELETE | `/api/v1/issues/{id}/session` | Stop active session |

### Projects

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/projects` | List projects |
| POST | `/api/v1/projects` | Create a project |
| GET | `/api/v1/projects/{id}` | Get project details |
| DELETE | `/api/v1/projects/{id}` | Delete a project |
| POST | `/api/v1/projects/{id}/refresh` | Refresh project state |
| GET | `/api/v1/projects/{id}/tree` | File tree |
| GET | `/api/v1/projects/{id}/file` | File content |

### Project Git Operations

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/projects/{id}/git` | Git stats |
| GET | `/api/v1/projects/{id}/git/status` | Git status |
| GET | `/api/v1/projects/{id}/git/diff` | Git diff |
| GET | `/api/v1/projects/{id}/git/branches` | List branches |
| POST | `/api/v1/projects/{id}/git/commit` | Create commit |
| POST | `/api/v1/projects/{id}/git/push` | Push to remote |
| POST | `/api/v1/projects/{id}/git/pull` | Pull from remote |

### Project GitHub Integration

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/projects/{id}/github/issues` | List GitHub issues |
| POST | `/api/v1/projects/{id}/github/issues` | Create GitHub issue |
| PATCH | `/api/v1/projects/{id}/github/issues/{number}` | Update GitHub issue |
| GET | `/api/v1/projects/{id}/github/pulls` | List pull requests |
| POST | `/api/v1/projects/{id}/github/pulls` | Create pull request |
| GET | `/api/v1/projects/{id}/github/pulls/{number}/diff` | Get PR diff |
| POST | `/api/v1/projects/{id}/github/disconnect` | Disconnect GitHub |

### Agents

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/agents` | List agent providers |
| GET | `/api/v1/agents/{provider}/permissions` | Get provider permissions |
| POST | `/api/v1/agents/{provider}/permissions` | Update provider permissions |
| GET | `/api/v1/agents/{provider}/model` | Get provider model config |
| POST | `/api/v1/agents/{provider}/model` | Update provider model config |
| GET | `/api/v1/agents/{provider}/hooks` | Get provider hooks |
| POST | `/api/v1/agents/{provider}/hooks` | Update provider hooks |
| GET | `/api/v1/agents/{provider}/mcp` | List provider MCP servers |
| POST | `/api/v1/agents/{provider}/mcp` | Add provider MCP server |
| DELETE | `/api/v1/agents/{provider}/mcp/{name}` | Remove provider MCP server |

### Agent Config (Legacy)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/config/agents` | Get agent config file |
| POST | `/api/v1/config/agents` | Save agent config file |
| GET | `/api/v1/config/agents/items` | List config items |
| POST | `/api/v1/config/agents/items` | Update config item |
| POST | `/api/v1/config/agents/new` | Create config item |

### MCP, Sessions, GitHub Auth, Terminal

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/mcp/tools` | List MCP tools |
| GET | `/api/v1/mcp/servers` | List MCP servers |
| POST | `/api/v1/mcp/servers` | Add MCP server |
| DELETE | `/api/v1/mcp/servers/{id}` | Remove MCP server |
| GET | `/api/v1/sessions` | List sessions |
| GET | `/api/v1/sessions/{id}` | Session details |
| GET | `/api/v1/github/login` | GitHub OAuth login |
| GET | `/api/v1/github/callback` | GitHub OAuth callback |
| GET | `/api/v1/terminal/{session_id}` | WebSocket terminal |

## Viewing the Spec

**Swagger Editor:**
1. Open https://editor.swagger.io/
2. Paste the contents of `docs/openapi.yaml`

**Docker local preview:**
```bash
docker run --rm -p 8080:8080 -e SWAGGER_JSON=/spec/openapi.yaml -v "$PWD/docs:/spec" swaggerapi/swagger-ui
```

**Redoc:**
```bash
npx redoc-cli serve docs/openapi.yaml
```

## Validation

```bash
npx @redocly/cli lint docs/openapi.yaml
```

## Notes

- Most `/api/v1/*` routes require bearer auth when `ORCHESTRA_API_TOKEN` is set.
- The terminal WebSocket supports bearer auth header or `token` query parameter.
- SSE endpoint (`/api/v1/events`) streams real-time state changes.
