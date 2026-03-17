# 7.2 Development Guide

This guide covers setting up a development environment, building and testing each component, and contributing new functionality to Orchestra.

## Repository Structure Overview

```
Orchestra/
├── apps/
│   ├── backend/              # Go backend: API server, orchestrator, agent runners
│   │   ├── cmd/
│   │   │   └── orchestrad/   # Daemon entry point (main.go)
│   │   └── internal/         # All business logic
│   │       ├── agents/       # Agent registry, runners, config discovery
│   │       ├── api/          # HTTP handlers and Chi router
│   │       ├── app/          # Application bootstrap (Run function)
│   │       ├── config/       # Environment variable loading and config types
│   │       ├── db/           # SQLite database layer
│   │       ├── mcp/          # Model Context Protocol server registry
│   │       ├── observability/# PubSub event bus for SSE streaming
│   │       ├── orchestrator/ # Core orchestration service
│   │       ├── prompt/       # Prompt construction for agents
│   │       ├── telemetry/    # Agent telemetry collection
│   │       ├── terminal/     # PTY/WebSocket terminal manager
│   │       ├── tools/        # Built-in tool implementations
│   │       ├── tracker/      # Issue tracker backends (memory, sqlite, github)
│   │       ├── unfirehose/   # Session logging
│   │       ├── unsandbox/    # Remote execution support
│   │       ├── utils/        # Git and GitHub utilities
│   │       ├── workflow/     # WORKFLOW.md parser
│   │       └── workspace/    # Workspace lifecycle management
│   ├── desktop/              # Electron + React frontend
│   │   ├── electron/         # Main process, preload script, IPC bridge
│   │   ├── src/              # React app, components, state management
│   │   ├── scripts/          # Build and smoke test scripts
│   │   └── resources/        # Bundled assets (backend binary for dist)
│   └── tui/                  # Terminal UI (Go + Bubble Tea)
├── packages/
│   └── protocol/             # Shared JSON schemas for API contracts
├── ops/
│   └── docker/               # Dockerfile for backend container
├── docs/                     # Documentation (DeepWiki format)
└── .github/
    ├── workflows/            # CI/CD pipelines
    └── actions/              # Reusable composite actions (setup-go-cached)
```

## Setting Up the Development Environment

### 1. Clone the repository

```bash
git clone https://github.com/Traves-Theberge/Orchestra.git
cd Orchestra
```

### 2. Install Go dependencies

```bash
cd apps/backend
go mod download
```

### 3. Install Node.js dependencies

```bash
cd apps/desktop
npm install
```

### 4. Install agent CLIs (at least one)

```bash
npm install -g @openai/codex          # Codex
npm install -g @anthropic-ai/claude-code  # Claude Code
```

### 5. Verify your setup

```bash
# Backend compiles
cd apps/backend && go build ./...

# Frontend type-checks
cd apps/desktop && npx tsc --noEmit

# TUI compiles
cd apps/tui && go build .
```

## Building and Testing the Backend (Go)

### Build

```bash
cd apps/backend
go build -o orchestrad ./cmd/orchestrad/
```

### Run tests

```bash
# Unit and integration tests
go test ./...

# With coverage
go test -coverprofile=coverage.out ./...

# Race detector
go test -race ./...
```

### Formatting and linting

CI enforces `gofmt` on the `cmd/` and `internal/` directories:

```bash
# Check formatting (should produce no output)
gofmt -l ./cmd ./internal

# Fix formatting
gofmt -w ./cmd ./internal

# Vet for suspicious constructs
go vet ./...
```

### Key dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `go-chi/chi/v5` | v5.2.5 | HTTP router |
| `rs/zerolog` | v1.34.0 | Structured logging |
| `modernc.org/sqlite` | v1.46.2 | Pure-Go SQLite driver |
| `gorilla/websocket` | v1.5.3 | WebSocket for terminals |
| `google/go-github/v69` | v69.2.0 | GitHub API client |
| `creack/pty` | v1.1.24 | PTY allocation for agent processes |
| `pelletier/go-toml/v2` | v2.2.4 | TOML parsing (Codex configs) |

## Building and Testing the Frontend (React/Electron)

### Development mode

```bash
cd apps/desktop
npm run dev
```

This runs Vite on port 5173 and opens an Electron window connected to it. Hot module replacement is active.

### Type checking

```bash
npm run typecheck
```

### Running tests

```bash
# Full test suite
npm test

# Smoke test (renderer)
npm run test:smoke-renderer

# Integration smoke test (spawns backend)
npm run smoke:ops:go
```

### Production build

```bash
npm run build         # Vite production build only
npm run dist:desktop  # Full distributable (builds + packages with electron-builder)
```

### Key frontend dependencies

| Package | Purpose |
|---------|---------|
| React 19 | UI framework |
| Vite 8 | Build tool and dev server |
| Electron 41 | Desktop shell |
| Tailwind CSS 3 | Utility-first styling |
| Radix UI | Accessible UI primitives (Dialog, Tooltip, etc.) |
| xterm | Terminal emulator component |
| Recharts | Data visualization charts |
| react-mosaic-component | Tiling window manager for panels |
| cmdk | Command palette (Cmd+K) |

## Code Style and Conventions

### Go

- **Formatting**: `gofmt` is enforced in CI. No exceptions.
- **Naming**: Standard Go conventions. Exported types have doc comments.
- **Error handling**: Wrap errors with `fmt.Errorf("context: %w", err)`.
- **Logging**: Use `zerolog.Logger` injected from the application root. Do not use `log.Println`.
- **Testing**: Table-driven tests preferred. Tests live alongside the code they test (`*_test.go`).
- **Module path**: `github.com/orchestra/orchestra/apps/backend`.

### TypeScript/React

- **Type checking**: Strict TypeScript with `tsc --noEmit` in CI.
- **Testing**: Vitest with React Testing Library.
- **Styling**: Tailwind CSS utility classes; `clsx` and `tailwind-merge` for conditional classes.
- **Components**: Functional components with hooks. Radix UI for accessible primitives.

## Adding a New Agent Runner

Agent runners live in `apps/backend/internal/agents/`. Each runner implements the `Runner` interface:

### 1. Define the provider constant

In `apps/backend/internal/agents/types.go` (or wherever `Provider` is defined), add your provider:

```go
const ProviderMyAgent Provider = "MYAGENT"
```

### 2. Implement the Runner interface

Create `apps/backend/internal/agents/runner_myagent.go`:

```go
package agents

import "context"

type MyAgentRunner struct {
    command string
}

func (r *MyAgentRunner) RunTurn(ctx context.Context, req TurnRequest, onEvent EventHandler) (TurnResult, error) {
    // 1. Build the CLI command from r.command and req
    // 2. Execute the process, streaming output
    // 3. Call onEvent() with events as they arrive
    // 4. Return the final TurnResult
}
```

### 3. Register in the registry

In `apps/backend/internal/agents/registry.go`, update the `SetCommand` method (or equivalent) to recognize your provider and instantiate `MyAgentRunner`.

### 4. Add the default command template

In `apps/backend/internal/config/load.go`, add the default command to `agentCommandsDefault`:

```go
"MYAGENT": "myagent run {{prompt}} --json",
```

And add the environment variable:

```go
agentCommandMyAgent := getenvOrEmpty("ORCHESTRA_AGENT_COMMAND_MYAGENT")
```

### 5. Add agent metadata for config discovery

In `apps/backend/internal/agents/config.go`, add an entry to `AgentMeta`:

```go
"myagent": {
    GlobalPaths: []string{".myagent/config.json"},
    LocalPaths:  []string{".myagent/config.json"},
    Format:      "json",
    SkillPaths:  []string{".myagent/skills"},
},
```

## Adding a New API Endpoint

The API uses the Chi router, defined in `apps/backend/internal/api/router.go`.

### 1. Add the handler method

Create or edit a handler file in `apps/backend/internal/api/`:

```go
// apps/backend/internal/api/handle_myfeature.go
package api

import "net/http"

func (s *Server) GetMyFeature(w http.ResponseWriter, r *http.Request) {
    // Access shared deps via s.orchestrator, s.db, s.logger, etc.
    result := map[string]string{"status": "ok"}
    writeJSON(w, http.StatusOK, result)
}
```

### 2. Register the route

In `router.go`, add the route to the appropriate group:

```go
// Public (no auth required)
r.Get("/api/v1/myfeature", server.GetMyFeature)

// Protected (requires bearer token when ORCHESTRA_API_TOKEN is set)
protected.Post("/api/v1/myfeature", server.PostMyFeature)
```

Routes follow the pattern `/api/v1/<resource>`. Use Chi URL parameters for resource identifiers: `/api/v1/issues/{issue_identifier}`.

### 3. Write tests

```go
// apps/backend/internal/api/handle_myfeature_test.go
package api_test

func TestGetMyFeature(t *testing.T) {
    // Set up test server with NewRouter()
    // Make HTTP request
    // Assert response status and body
}
```

### 4. Utility functions

Use the existing helpers in `router.go`:

- `writeJSON(w, status, v)` -- encode a response as JSON
- `writeJSONError(w, status, code, message)` -- structured error response
- `chi.URLParam(r, "param")` -- extract URL parameters

## CI/CD Pipelines

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `orchestra-backend.yml` | Changes to `apps/backend/` | Runs `gofmt` check, `go vet`, unit tests, race tests, naming guard |
| `make-all.yml` | Changes to `apps/tui/` | TUI tests, `make build` verification |
| `orchestra-desktop-smoke.yml` | Changes to `apps/desktop/` | Desktop smoke tests |
| `orchestra-container-publish.yml` | Releases | Docker image build and push to GHCR |
| `orchestra-release-artifacts.yml` | Releases | Build release artifacts |
| `orchestra-desktop-release.yml` | Releases | Desktop app distribution packages |

All workflows use a reusable `.github/actions/setup-go-cached` composite action for consistent Go toolchain setup with module caching.
