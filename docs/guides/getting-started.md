# 7. Getting Started

This guide walks you through installing, building, and running Orchestra for the first time.

## Prerequisites

| Requirement | Minimum Version | Purpose |
|-------------|----------------|---------|
| **Go** | 1.25+ | Backend daemon (`orchestrad`) and TUI |
| **Node.js** | 22+ | Desktop app (Electron + React) |
| **npm** | (bundled with Node.js) | Frontend dependency management |
| **Git** | 2.x | Workspace management, project operations |

You also need at least one agent CLI installed and available on your `$PATH`:

| Agent | Install |
|-------|---------|
| Codex | `npm install -g @openai/codex` |
| Claude Code | `npm install -g @anthropic-ai/claude-code` |
| OpenCode | See [opencode.ai](https://opencode.ai) |
| Gemini CLI | `npm install -g @google/gemini-cli` |

Verify your toolchain:

```bash
go version          # go1.25.0 or later
node --version      # v22.x or later
codex --version     # or whichever agent you plan to use
```

## Installing and Building the Backend

Clone the repository and build the `orchestrad` daemon:

```bash
git clone https://github.com/Traves-Theberge/Orchestra.git
cd Orchestra/apps/backend
go build -o orchestrad ./cmd/orchestrad/
```

This produces the `orchestrad` binary in the current directory. You can also install it system-wide:

```bash
go install ./cmd/orchestrad/
```

### Starting the Backend

```bash
./orchestrad --workspace-root /path/to/your/project
```

By default the server binds to `127.0.0.1:4010`. Override this with environment variables:

```bash
ORCHESTRA_SERVER_HOST=0.0.0.0 ORCHESTRA_SERVER_PORT=8080 ./orchestrad
```

Verify it is running:

```bash
curl http://127.0.0.1:4010/healthz
# {"status":"ok"}
```

## Running the Desktop App

The desktop app is an Electron + React application in `apps/desktop/`:

```bash
cd apps/desktop
npm install
npm run dev
```

This starts two processes concurrently:
1. Vite dev server on `http://localhost:5173`
2. Electron window loading from the Vite dev server

The desktop app connects to the backend at `http://127.0.0.1:4010` by default. Make sure `orchestrad` is running before launching the desktop app.

### Building for Distribution

To create a distributable package:

```bash
npm run dist:desktop
```

This builds the React frontend, stages the backend binary into the Electron resources, and packages with `electron-builder`. Output appears in `apps/desktop/release/`.

## Running the TUI

Orchestra includes a terminal dashboard built with Bubble Tea:

```bash
# Run directly
cd apps/tui
go run .

# Or build and install
make build       # produces ./orchestra-dash in repo root
make install     # installs to /usr/local/bin/orchestra-dash
```

The TUI connects to the same backend API as the desktop app.

## First-Run Walkthrough

1. **Start the backend** with a workspace root pointing to a directory where agent workspaces will be created:

   ```bash
   cd apps/backend
   ./orchestrad --workspace-root ~/orchestra-workspaces
   ```

   On first run, Orchestra creates the `.orchestra/` directory structure inside your workspace root, including `warehouse.db` (SQLite database) and default agent configuration files.

2. **Open the desktop app** (or TUI) -- the dashboard shows an empty issue list and a healthy connection status.

3. **Create an issue** through the UI or via the API:

   ```bash
   curl -X POST http://127.0.0.1:4010/api/v1/issues \
     -H "Content-Type: application/json" \
     -d '{"title": "Hello World", "body": "Create a hello world script"}'
   ```

4. **Watch the agent work** -- Orchestra dispatches the issue to the configured agent (default: Codex), streams events in real time via SSE, and manages the workspace lifecycle automatically.

5. **Review results** -- inspect agent output, diffs, and artifacts through the issue detail view.

## Troubleshooting Common Issues

### Backend fails to start: "invalid port"

The `ORCHESTRA_SERVER_PORT` value must be a valid integer between 1 and 65535. Check for stray whitespace or non-numeric characters.

### "agent provider X is not configured"

The configured `ORCHESTRA_AGENT_PROVIDER` (default: `CODEX`) must have a matching command template. Ensure the agent CLI is installed and the corresponding `ORCHESTRA_AGENT_COMMAND_*` environment variable is set if using a non-default path.

### "non-loopback host requires ORCHESTRA_API_TOKEN"

When binding to a non-loopback address (anything other than `127.0.0.1`, `localhost`, or `::1`), Orchestra requires an API token for security. Set `ORCHESTRA_API_TOKEN` to any secret string:

```bash
ORCHESTRA_API_TOKEN=my-secret ORCHESTRA_SERVER_HOST=0.0.0.0 ./orchestrad
```

### Desktop app shows "connection refused"

Make sure `orchestrad` is running and listening on the expected host/port. The desktop app defaults to `http://127.0.0.1:4010`.

### Agent CLI not found

Orchestra shells out to agent CLIs using the command templates in configuration. Verify the CLI is on your `$PATH`:

```bash
which codex    # or claude, opencode, gemini
```

Override the command path with environment variables if needed:

```bash
ORCHESTRA_AGENT_COMMAND_CODEX="/usr/local/bin/codex exec --json {{prompt}}" ./orchestrad
```

### SQLite database errors

The warehouse database is stored at `<workspace-root>/.orchestra/warehouse.db`. If it becomes corrupted, stop the backend, delete the file, and restart. Orchestra will recreate it with empty state.

### Port already in use

If port 4010 is occupied, choose a different port:

```bash
ORCHESTRA_SERVER_PORT=4011 ./orchestrad
```
