# Orchestra

Orchestra is an orchestration platform for managing AI coding agents. It coordinates multiple agent providers (Claude, Codex, Gemini, OpenCode) through a 5-column Kanban workflow with bidirectional GitHub sync, giving you a single control surface for autonomous engineering work.

## Key Features

- **5-Column Kanban Board** -- Backlog, Todo, In Progress, Review, Done
- **GitHub Bidirectional Sync** -- Issues auto-populate your backlog; edits sync both ways
- **Multi-Agent Management** -- Configure and dispatch Claude, Codex, Gemini, and OpenCode with per-provider settings for instructions, permissions, model, hooks, MCP servers, skills, and sub-agents
- **Project Management** -- Git-integrated project views with Commits, Issues, and PRs sub-tabs
- **Issue Inspector** -- Details, Plan, Activity, Output, and Changes tabs for deep visibility into each task
- **Agent Lifecycle** -- Backlog → Todo → In Progress (agent runs) → Review (human approval) → Done
- **TUI Dashboard** -- Terminal-based control surface for starting/stopping services (`make dash`)
- **Telemetry & Warehouse** -- Ingests session data from all 4 providers; token analytics and cost tracking

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Go, chi, SQLite (modernc.org/sqlite), zerolog |
| Desktop | Electron, React 18, TypeScript, Vite, Tailwind CSS, Radix UI |
| TUI | Go, Bubble Tea, Lipgloss |
| API Contract | OpenAPI 3.1 (`docs/openapi.yaml`) |
| CI | GitHub Actions |

## Project Structure

```text
.
├── apps/
│   ├── backend/      # Go backend daemon (orchestrad)
│   ├── desktop/      # Electron + React desktop app
│   └── tui/          # Bubble Tea terminal dashboard
├── docs/
│   ├── architecture/
│   ├── usage/
│   ├── agents/
│   ├── roadmap/
│   └── openapi.yaml
├── ops/
│   ├── docker/
│   └── systemd/
├── packages/
│   ├── protocol/
│   ├── config-spec/
│   └── test-fixtures/
└── .github/workflows/
```

## Quick Start

```bash
# Start the TUI dashboard (manages all services)
make dash

# Or start services manually:
cd apps/backend && go run ./cmd/orchestrad   # backend on :4010
cd apps/desktop && npm ci && npm run dev     # desktop app
```

Configure the backend connection in **Settings** if needed (default: `http://127.0.0.1:4010`, token: `dev-token`).

## Documentation

| Doc | Description |
|---|---|
| [Getting Started](docs/usage/getting-started.md) | Prerequisites, first project, first task |
| [Core Concepts](docs/usage/core-concepts.md) | Tasks, projects, agents, states, plans |
| [Architecture](docs/architecture/overview.md) | System layers, API surface, data flow |
| [Agent Configuration](docs/agents/configuration.md) | Per-provider config: instructions, permissions, hooks, MCP |
| [API Reference](docs/openapi-README.md) | OpenAPI spec details and endpoint summary |
| [Feature Status](docs/roadmap/feature-status.md) | What's shipped, what's next |

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `ORCHESTRA_SERVER_HOST` | Backend bind host | `127.0.0.1` |
| `ORCHESTRA_SERVER_PORT` | Backend port | `4010` |
| `ORCHESTRA_API_TOKEN` | Bearer token for protected routes | Empty |
| `ORCHESTRA_WORKSPACE_ROOT` | Workspace root directory | `~/.orchestra/workspaces` |
| `ORCHESTRA_GITHUB_CLIENT_ID` | GitHub OAuth client ID | Empty |
| `ORCHESTRA_GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | Empty |

## Testing

```bash
# Backend
cd apps/backend && go test -race ./...

# Desktop (63+ tests)
cd apps/desktop && npx vitest run
```

## License

Apache License 2.0 (`apps/backend/LICENSE`)
