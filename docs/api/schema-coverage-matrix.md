# Schema Coverage Matrix

This matrix is the working inventory for the schema refactor. Status values:

- `covered`: existing schema exists and appears intentionally mapped
- `partial`: existing schema exists but is weak, inconsistent, or incomplete
- `missing`: no clear request/response schema is published yet

## Core Runtime

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/healthz` | none | health response | missing |
| `GET` | `/api/v1/healthz` | none | health response | missing |
| `GET` | `/api/v1/openapi.yaml` | none | OpenAPI document | special |
| `GET` | `/api/v1/state` | none | `state.response.schema.json` | partial |
| `GET` | `/api/v1/events` | query only | SSE event stream | special |
| `POST` | `/api/v1/refresh` | none | `refresh.response.schema.json` | covered |
| `GET` | `/api/v1/stt/health` | none | `stt.health.response.schema.json` | covered |
| `POST` | `/api/v1/stt/transcribe` | multipart/form-data | `stt.transcribe.response.schema.json` | partial |
| `GET` | `/api/v1/docs` | none | docs HTML/index payload | missing |
| `GET` | `/api/v1/docs/*` | none | docs content payload | missing |
| `GET` | `/api/v1/terminal/{session_id}` | websocket frames | terminal protocol | special |

## Issues

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/issues` | query/filter params | `issues.list.response.schema.json` | partial |
| `POST` | `/api/v1/issues` | `issue.create.request.schema.json` | issue detail or summary | partial |
| `GET` | `/api/v1/issues/{issue_identifier}` | none | `issue.response.schema.json` | partial |
| `PATCH` | `/api/v1/issues/{issue_identifier}` | `issue.update.request.schema.json` | issue detail or updated issue | partial |
| `DELETE` | `/api/v1/issues/{issue_identifier}` | none | delete acknowledgement | missing |
| `DELETE` | `/api/v1/issues/{issue_identifier}/session` | none | delete acknowledgement | missing |
| `GET` | `/api/v1/issues/{issue_identifier}/logs` | none | issue logs payload | missing |
| `GET` | `/api/v1/issues/{issue_identifier}/history` | none | issue history payload | missing |
| `GET` | `/api/v1/issues/{issue_identifier}/diff` | none | diff payload | missing |
| `GET` | `/api/v1/issues/{issue_identifier}/artifacts` | none | artifact list payload | missing |
| `GET` | `/api/v1/issues/{issue_identifier}/artifacts/*` | none | artifact content payload | missing |
| `POST` | `/api/v1/issues/{issue_identifier}/pr` | PR create payload | PR creation response | missing |
| `POST` | `/api/v1/issues/{issue_identifier}/stop` | none | stop acknowledgement | missing |
| `GET` | `/api/v1/search` | query/filter params | issue search results | missing |

## Projects

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/projects` | none | `projects.list.response.schema.json` | partial |
| `POST` | `/api/v1/projects` | `project.create.request.schema.json` | `project.response.schema.json` | partial |
| `GET` | `/api/v1/projects/{project_id}` | none | `project.response.schema.json` | partial |
| `DELETE` | `/api/v1/projects/{project_id}` | none | delete acknowledgement | missing |
| `POST` | `/api/v1/projects/{project_id}/refresh` | none | refresh acknowledgement | missing |
| `GET` | `/api/v1/projects/{project_id}/file` | query param `path` | file content payload | missing |
| `GET` | `/api/v1/projects/{project_id}/tree` | none | tree payload | missing |

## Git

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/projects/{project_id}/git` | none | git stats payload | missing |
| `GET` | `/api/v1/projects/{project_id}/git/status` | none | git status payload | missing |
| `GET` | `/api/v1/projects/{project_id}/git/diff` | none | diff payload | missing |
| `GET` | `/api/v1/projects/{project_id}/git/branches` | none | branch list payload | missing |
| `GET` | `/api/v1/projects/{project_id}/git/branches/detail` | none | branch detail payload | missing |
| `POST` | `/api/v1/projects/{project_id}/git/branches` | create branch payload | branch creation response | missing |
| `DELETE` | `/api/v1/projects/{project_id}/git/branches/{branch}` | none | delete acknowledgement | missing |
| `POST` | `/api/v1/projects/{project_id}/git/checkout` | checkout payload | checkout response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/stage` | stage payload | stage response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/unstage` | unstage payload | unstage response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/commit` | commit payload | commit response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/push` | push payload | push response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/pull` | pull payload | pull response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/fetch` | fetch payload | fetch response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/stash` | stash payload | stash response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/stash/pop` | none or stash payload | stash pop response | missing |
| `GET` | `/api/v1/projects/{project_id}/git/stash/list` | none | stash list payload | missing |
| `POST` | `/api/v1/projects/{project_id}/git/stash/apply` | stash apply payload | apply response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/stash/drop` | stash drop payload | drop response | missing |
| `GET` | `/api/v1/projects/{project_id}/git/conflicts` | none | conflict list payload | missing |
| `POST` | `/api/v1/projects/{project_id}/git/merge` | merge payload | merge response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/merge/abort` | none | merge abort response | missing |
| `POST` | `/api/v1/projects/{project_id}/git/resolve` | conflict resolution payload | resolution response | missing |
| `GET` | `/api/v1/projects/{project_id}/git/default-branch` | none | default branch payload | missing |

## GitHub

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/github/login` | query only | redirect | special |
| `GET` | `/api/v1/github/callback` | query only | redirect or HTML | special |
| `POST` | `/api/v1/projects/{project_id}/github/disconnect` | none | disconnect response | missing |
| `POST` | `/api/v1/projects/{project_id}/github/create-repo` | create repo payload | repo response | missing |
| `GET` | `/api/v1/projects/{project_id}/github/issues` | none | GitHub issue list | missing |
| `POST` | `/api/v1/projects/{project_id}/github/issues` | GitHub issue create payload | GitHub issue response | missing |
| `PATCH` | `/api/v1/projects/{project_id}/github/issues/{number}` | GitHub issue update payload | GitHub issue response | missing |
| `GET` | `/api/v1/projects/{project_id}/github/pulls` | none | GitHub PR list | missing |
| `POST` | `/api/v1/projects/{project_id}/github/pulls` | GitHub PR create payload | GitHub PR response | missing |
| `GET` | `/api/v1/projects/{project_id}/github/pulls/{number}/diff` | none | PR diff payload | missing |
| `GET` | `/api/v1/projects/{project_id}/github/pulls/{number}/reviews` | none | review list payload | missing |
| `POST` | `/api/v1/projects/{project_id}/github/pulls/{number}/reviews` | review payload | review response | missing |
| `PUT` | `/api/v1/projects/{project_id}/github/pulls/{number}/merge` | merge payload | merge response | missing |
| `GET` | `/api/v1/projects/{project_id}/github/pulls/{number}/comments` | none | comment list payload | missing |

## Agents And Config

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/agents` | none | `agents.list.response.schema.json` | partial |
| `GET` | `/api/v1/config/agents` | none | `agent.config.response.schema.json` | partial |
| `PATCH` | `/api/v1/config/agents` | config patch payload | `agent.config.response.schema.json` | partial |
| `POST` | `/api/v1/config/agents` | config replace payload | `agent.config.response.schema.json` | partial |
| `GET` | `/api/v1/config/agents/items` | query only | config item list payload | deprecated |
| `POST` | `/api/v1/config/agents/new` | create config payload | config creation response | deprecated |
| `POST` | `/api/v1/config/agents/items` | update config items payload | config update response | deprecated |
| `GET` | `/api/v1/agents/{provider}/permissions` | none | provider permissions payload | missing |
| `POST` | `/api/v1/agents/{provider}/permissions` | permissions payload | provider permissions payload | missing |
| `GET` | `/api/v1/agents/{provider}/model` | none | provider model payload | missing |
| `POST` | `/api/v1/agents/{provider}/model` | model payload | provider model payload | missing |
| `GET` | `/api/v1/agents/{provider}/hooks` | none | provider hooks payload | missing |
| `POST` | `/api/v1/agents/{provider}/hooks` | hooks payload | provider hooks payload | missing |
| `GET` | `/api/v1/agents/claude/settings` | none | Claude settings payload | missing |
| `POST` | `/api/v1/agents/claude/settings` | Claude settings payload | Claude settings payload | missing |
| `GET` | `/api/v1/agents/claude/instructions` | none | Claude instructions payload | missing |
| `POST` | `/api/v1/agents/claude/instructions` | Claude instructions payload | Claude instructions payload | missing |
| `DELETE` | `/api/v1/agents/claude/instructions` | none | delete acknowledgement | missing |
| `GET` | `/api/v1/agents/claude/rules` | none | Claude rule list payload | missing |
| `POST` | `/api/v1/agents/claude/rules` | Claude rule payload | Claude rule response | missing |
| `DELETE` | `/api/v1/agents/claude/rules/{name}` | none | delete acknowledgement | missing |
| `GET` | `/api/v1/agents/claude/skills` | none | Claude skill list payload | missing |
| `POST` | `/api/v1/agents/claude/skills` | Claude skill payload | Claude skill response | missing |
| `DELETE` | `/api/v1/agents/claude/skills/{name}` | none | delete acknowledgement | missing |
| `GET` | `/api/v1/agents/claude/subagents` | none | Claude sub-agent list payload | missing |
| `POST` | `/api/v1/agents/claude/subagents` | Claude sub-agent payload | Claude sub-agent response | missing |
| `DELETE` | `/api/v1/agents/claude/subagents/{name}` | none | delete acknowledgement | missing |
| `GET` | `/api/v1/config/agent-providers` | none | provider secret status payload | missing |
| `POST` | `/api/v1/config/agent-providers` | provider secret payload | provider secret status payload | missing |
| `GET` | `/api/v1/config/unsandbox` | none | unsandbox config status payload | missing |
| `POST` | `/api/v1/config/unsandbox` | unsandbox config payload | unsandbox config status payload | missing |
| `DELETE` | `/api/v1/config/unsandbox` | none | delete acknowledgement | missing |

## MCP

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/mcp/tools` | none | `mcp.tools.response.schema.json` | partial |
| `GET` | `/api/v1/mcp/servers` | none | `mcp.servers.response.schema.json` | partial |
| `POST` | `/api/v1/mcp/servers` | MCP server payload | MCP server response | partial |
| `DELETE` | `/api/v1/mcp/servers/{id}` | none | delete acknowledgement | missing |
| `GET` | `/api/v1/agents/{provider}/mcp` | none | provider MCP server list | missing |
| `POST` | `/api/v1/agents/{provider}/mcp` | provider MCP server payload | provider MCP server response | missing |
| `PUT` | `/api/v1/agents/{provider}/mcp/{name}` | provider MCP server payload | provider MCP server response | missing |
| `PATCH` | `/api/v1/agents/{provider}/mcp/{name}` | enable/disable payload | provider MCP server response | missing |
| `DELETE` | `/api/v1/agents/{provider}/mcp/{name}` | none | delete acknowledgement | missing |

## Sessions

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/sessions` | none | `sessions.list.response.schema.json` | partial |
| `GET` | `/api/v1/sessions/{session_id}` | none | `session.detail.response.schema.json` | partial |

## Analytics

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/warehouse/stats` | none | `warehouse.stats.response.schema.json` | partial |
| `GET` | `/api/v1/telemetry/health` | none | telemetry health payload | missing |
| `GET` | `/api/v1/analytics/daily` | query only | analytics daily payload | missing |
| `GET` | `/api/v1/analytics/cost` | query only | analytics cost payload | missing |
| `GET` | `/api/v1/analytics/cost/optimization` | query only | optimization payload | missing |
| `GET` | `/api/v1/analytics/performance` | query only | analytics performance payload | missing |
| `GET` | `/api/v1/analytics/rate-limits` | query only | rate limits payload | missing |
| `GET` | `/api/v1/analytics/productivity` | query only | analytics productivity payload | missing |
| `GET` | `/api/v1/analytics/productivity/sessions` | query only | productivity sessions payload | missing |
| `GET` | `/api/v1/analytics/budgets` | none | budgets payload | missing |
| `POST` | `/api/v1/analytics/budgets` | budget payload | budget response | missing |
| `DELETE` | `/api/v1/analytics/budgets/{id}` | none | delete acknowledgement | missing |
| `POST` | `/api/v1/analytics/external/sync` | sync payload | sync response | missing |
| `GET` | `/api/v1/analytics/external/status` | none | external status payload | missing |
| `GET` | `/api/v1/analytics/external/reconcile` | none | reconcile payload | missing |
| `GET` | `/api/v1/external/status` | none | external status payload | missing |
| `GET` | `/api/v1/external/reconcile` | none | reconcile payload | missing |

## Workspace And Unsandbox

| Method | Route | Request | Response | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/workspace/migration/plan` | none | `workspace.migration.plan.response.schema.json` | covered |
| `POST` | `/api/v1/workspace/migrate` | migration request payload | `workspace.migrate.response.schema.json` | partial |
| `GET` | `/api/v1/unsandbox/status` | none | unsandbox status payload | missing |
| `POST` | `/api/v1/unsandbox/execute` | execution request payload | execution response payload | missing |
| `GET` | `/api/v1/unsandbox/jobs/*` | none | job payload | missing |
| `GET` | `/api/v1/unsandbox/sessions` | none | session list payload | missing |
| `GET` | `/api/v1/unsandbox/services` | none | services payload | missing |
