# Orchestra

Multi-agent orchestration platform that coordinates machine learning coding agents to autonomously resolve issues from project trackers. Orchestra dispatches work to agents (Claude, Codex, OpenCode, Gemini), monitors their execution via real-time event streaming, and manages retries, workspaces, and MCP tool integrations — all through an Electron desktop app or a terminal TUI.

```mermaid
graph TB
    subgraph Desktop["Desktop App (Electron + React)"]
        UI[Dashboard / Issue Inspector]
        SSE[SSE Event Stream]
    end

    subgraph Backend["Backend (Go + Chi)"]
        API[REST API]
        ORC[Orchestrator Service]
        PUB[PubSub Event Bus]
        TRK[Issue Tracker]
        REG[Agent Registry]
    end

    subgraph Agents["Agent Runners"]
        CX[Codex]
        CL[Claude]
        OC[OpenCode]
        GM[Gemini]
    end

    subgraph Infra["Infrastructure"]
        MCP[MCP Servers]
        DB[(SQLite / Memory)]
        GH[GitHub API]
    end

    UI -->|HTTP| API
    SSE -->|SSE| PUB
    API --> ORC
    ORC --> REG
    REG --> CX & CL & OC & GM
    ORC --> TRK
    TRK --> DB
    TRK --> GH
    CX & CL & OC & GM -->|Events| PUB
    ORC --> MCP
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.25, Chi router, zerolog, SQLite |
| Desktop | Electron, React 19, TypeScript, Vite, Tailwind CSS, Radix UI |
| TUI | Go, Bubble Tea |
| Agents | Codex, Claude Code, OpenCode, Gemini CLI |
| Protocol | JSON over HTTP, Server-Sent Events, WebSocket (terminals) |
| CI/CD | GitHub Actions, Docker (GHCR) |

## Project Structure

```
Orchestra/
├── apps/
│   ├── backend/          # Go backend — API server, orchestrator, agent runners
│   │   ├── cmd/          # Entry points: orchestrad (daemon), orchestra (CLI)
│   │   └── internal/     # All business logic (see docs/backend/)
│   ├── desktop/          # Electron + React frontend
│   │   ├── electron/     # Main process, preload, IPC bridge
│   │   └── src/          # React app, components, state management
│   └── tui/              # Terminal UI (Bubble Tea)
├── packages/
│   └── protocol/         # Shared JSON schemas for API contracts
├── ops/
│   └── docker/           # Dockerfile for backend container
├── docs/                 # Documentation wiki (DeepWiki format)
└── .github/
    ├── workflows/        # CI/CD pipelines
    └── actions/          # Reusable composite actions
```

## Quick Start

### Prerequisites

- Go 1.25+
- Node.js 22+ and npm
- At least one agent CLI installed (e.g., `claude`, `codex`)

### Run the Backend

```bash
cd apps/backend
go build -o orchestrad ./cmd/orchestrad/
./orchestrad --workspace-root /path/to/your/project
```

### Run the Desktop App

```bash
cd apps/desktop
npm install
npm run dev
```

### Run the TUI

```bash
cd apps/tui
go run .
```

## Configuration

Orchestra is configured through environment variables. Key settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_WORKSPACE_ROOT` | Root directory for agent workspaces | `.` |
| `ORCHESTRA_AGENT_PROVIDER` | Default agent provider | `CODEX` |
| `ORCHESTRA_TRACKER_TYPE` | Issue tracker backend (`memory`, `sqlite`, `github`) | `memory` |
| `ORCHESTRA_API_TOKEN` | Bearer token for API authentication | _(none)_ |
| `ORCHESTRA_HOST` | Server bind address | `127.0.0.1:3284` |
| `CODEX_COMMAND` | Path to Codex CLI | `codex` |
| `CLAUDE_COMMAND` | Path to Claude CLI | `claude` |
| `OPENCODE_COMMAND` | Path to OpenCode CLI | `opencode` |
| `GEMINI_COMMAND` | Path to Gemini CLI | `gemini` |

See [docs/guides/configuration.md](docs/guides/configuration.md) for the full reference.

## Documentation

Full documentation lives in [`docs/`](docs/index.md), structured as a DeepWiki:

- [Overview](docs/index.md)
- [Architecture](docs/architecture/overview.md)
- [API Reference](docs/api/reference.md)
- [Backend Internals](docs/backend/orchestrator.md)
- [Frontend Architecture](docs/frontend/components.md)
- [Operations](docs/operations/deployment.md)
- [Getting Started](docs/guides/getting-started.md)
- [Enum Reference](docs/enums.md)

## License

See [LICENSE](LICENSE) for details.
