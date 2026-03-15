# Architecture Overview

Symphony is a three-layer system: a Go backend control plane, an Electron desktop app, and a Bubble Tea TUI.

## System Layers

```
┌─────────────────────────────────┐
│  Desktop App (Electron/React)   │  Operator UI: Kanban, Inspector, Agents, Projects
├─────────────────────────────────┤
│  TUI Dashboard (Bubble Tea)     │  Terminal control surface: start/stop services
├─────────────────────────────────┤
│  Backend (Go + chi + SQLite)    │  API server, orchestration, telemetry, GitHub sync
└─────────────────────────────────┘
```

## Backend: Go + chi + SQLite

Entry point: `apps/backend/cmd/orchestrad/main.go`

The backend is a single Go binary (`orchestrad`) that:
- Serves the HTTP/SSE/WebSocket API on port 4010
- Manages agent lifecycle (provision workspace, dispatch agent, collect telemetry)
- Stores all state in SQLite (`~/.orchestra/workspaces/.orchestra/warehouse.db`)
- Syncs bidirectionally with GitHub (issues, PRs)
- Watches for telemetry output from all 4 agent providers

Key packages:
- `internal/api/` -- chi router, all HTTP handlers
- `internal/orchestrator/` -- core orchestration logic
- `internal/db/` -- SQLite schema, migrations, queries
- `internal/config/` -- environment-based configuration
- `internal/terminal/` -- WebSocket PTY sessions

## Frontend: React + TypeScript + Electron + Vite

Entry point: `apps/desktop/src/main.tsx`

The desktop app provides:
- **Kanban board** -- 5-column task management (Backlog, Todo, In Progress, Review, Done)
- **Issue Inspector** -- Details, Plan, Activity, Output, Changes tabs
- **Project views** -- Git integration with Commits, Issues, PRs sub-tabs
- **Agent management** -- Per-provider config editing (instructions, permissions, model, hooks, MCP, skills, sub-agents)
- **Terminal multiplexer** -- Up to 16 tiled PTY sessions
- **Settings** -- Backend profiles, GitHub OAuth, theme

## TUI: Bubble Tea

Entry point: `apps/tui/main.go`

A terminal dashboard for starting/stopping the backend and desktop services. Launched via `make dash`.

## Key API Endpoints

| Group | Endpoints |
|---|---|
| **Runtime** | `GET /api/v1/state`, `GET /api/v1/events` (SSE), `POST /api/v1/refresh` |
| **Issues** | CRUD on `/api/v1/issues`, plus `/history`, `/logs`, `/diff`, `/artifacts` |
| **Projects** | CRUD on `/api/v1/projects`, plus `/tree`, `/file`, `/git/*` |
| **Agents** | `GET /api/v1/agents`, per-provider: `/permissions`, `/model`, `/hooks`, `/mcp` |
| **GitHub** | `/github/login`, `/github/callback`, per-project: `/github/issues`, `/github/pulls`, `/git/branches` |
| **Sessions** | `GET /api/v1/sessions`, `GET /api/v1/sessions/{id}` |
| **MCP** | `/mcp/tools`, `/mcp/servers` (CRUD) |
| **Telemetry** | `GET /api/v1/telemetry/health`, `GET /api/v1/warehouse/stats` |
| **Terminal** | `GET /api/v1/terminal/{session_id}` (WebSocket) |

Full spec: `docs/openapi.yaml` (also served at `GET /api/v1/openapi.yaml`)

## Bidirectional GitHub Sync

When a project is connected to GitHub:
1. **Inbound** -- GitHub issues are fetched and added to the Backlog column
2. **Outbound** -- Status changes, comments, and PR creation sync back to GitHub
3. **Issue CRUD** -- Create, read, update GitHub issues directly from the desktop UI
4. **Pull Requests** -- List, create, and view diffs for PRs

## Telemetry Watcher

The backend watches for telemetry output from all 4 agent providers:
- **Claude** -- Session JSON files
- **Codex** -- Session logs
- **Gemini** -- JSON stream output
- **OpenCode** -- SQLite session database

Telemetry is ingested into the warehouse for unified analytics, token tracking, and cost estimation. Health status is available at `GET /api/v1/telemetry/health`.
