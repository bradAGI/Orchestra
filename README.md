# Orchestra

Orchestra is an orchestration platform for managing AI coding agents. It coordinates multiple agent providers (Claude, Codex, Gemini, OpenCode) through a 5-column Kanban workflow with bidirectional GitHub sync, giving you a single control surface for autonomous engineering work.

## Task Lifecycle

```
BACKLOG ──────► TODO ──────► IN PROGRESS ──────► REVIEW ──────► DONE
   │              │               │                  │              │
   │              │               │                  │              ├─ Close GitHub issue
   │              │               │                  │              └─ Clean up branch
   │              │               │                  │
   │              │               │                  ├─ Commit changes (git add + commit)
   │              │               │                  ├─ Draft PR (task branch → main)
   │              │               │                  ├─ Review: Plan, Output, Changes
   │              │               │                  ├─ Sound + browser notification
   │              │               │                  └─ GitHub comment with summary
   │              │               │
   │              │               ├─ Agent runs on dedicated git branch
   │              │               ├─ Writes code in actual project directory
   │              │               ├─ Plan checkboxes update live
   │              │               ├─ Output streams in real-time
   │              │               ├─ Changes scoped to task branch
   │              │               └─ Ralph loop: runs until done (max 25 turns)
   │              │
   │              └─ Assign agent (Claude, Codex, Gemini, OpenCode)
   │
   └─ Import from GitHub issue or create manually
```

### How It Works

1. **Create a task** — import from GitHub Issues or create manually on the Kanban board
2. **Assign an agent** — pick Claude, Codex, Gemini, or OpenCode
3. **Move to In Progress** — the agent launches in the project directory on a dedicated git branch
4. **Agent works autonomously** — creates an operational plan, writes code, runs tests, checks off plan items
5. **Auto-moves to Review** — when the agent finishes, the task moves to Review and you get a notification
6. **Human reviews** — check the Plan, Output, and Changes tabs. Commit, draft a PR, or send back
7. **Close** — moves to Done, closes the linked GitHub issue, posts a summary comment

### Issue Inspector Tabs

| Tab | What It Shows |
|-----|--------------|
| **Details** | Task title, markdown description, sidebar with agent/project/status |
| **Plan** | Agent's operational plan with checkbox progress (live updates) |
| **Activity** | Timeline of state changes and agent messages |
| **Output** | Streaming agent output — messages, tool calls, thinking, results |
| **Changes** | Git diff scoped to the task's branch (not all project changes) |

### Git Integration

Each task gets its own git branch (`fetch-1`, `fetch-2`, etc.) so multiple agents can work on the same project simultaneously without conflicts. The Git tab provides:

- **Branch management** — create, switch, delete branches
- **Staging** — stage/unstage individual files
- **Commit & Push** — with inline commit message
- **Stash** — save work in progress
- **GitHub Issues** — list, create, close, import to board
- **Pull Requests** — create, review, approve, merge
- **Diff viewer** — split/unified toggle with syntax highlighting

## Key Features

- **5-Column Kanban Board** — Backlog, Todo, In Progress, Review, Done
- **GitHub Bidirectional Sync** — Issues auto-populate your backlog; edits sync both ways
- **Multi-Agent Management** — Configure and dispatch Claude, Codex, Gemini, and OpenCode
- **Branch-Per-Task Isolation** — each agent works on its own git branch
- **Project Management** — Git-integrated project views with full branch/commit/PR workflow
- **Issue Inspector** — Details, Plan, Activity, Output, and Changes tabs
- **Notifications** — Sound + browser notification when agents complete tasks
- **16 Concurrent Agents** — run agents on multiple tasks/projects simultaneously
- **Ralph Loop** — agents run continuously until done (up to 25 turns)
- **Session Continuity** — prior turn context injected so agents don't restart from scratch
- **TUI Dashboard** — Terminal-based control surface for starting/stopping services
- **Telemetry & Analytics** — token usage analytics and cost tracking per provider

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Go, chi, SQLite (modernc.org/sqlite), zerolog |
| Desktop | Electron, React 18, TypeScript, Vite, Tailwind CSS, Radix UI |
| TUI | Go, Bubble Tea, Lipgloss |
| API Contract | OpenAPI 3.1 (`docs/openapi.yaml`) |

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
│   └── roadmap/
└── licenses/
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

# Desktop
cd apps/desktop && npx vitest run
```

## License

Apache License 2.0 — Copyright 2025-2026 Traves Theberge. See [LICENSE](LICENSE).

Third-party licenses: [licenses/](licenses/)
