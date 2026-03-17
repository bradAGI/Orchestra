# 7.1 Configuration Guide

Orchestra is configured through environment variables, with optional overrides from a `WORKFLOW.md` file. Environment variables take highest precedence, followed by workflow file values, followed by built-in defaults.

## Environment Variables

### Server

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_SERVER_HOST` | IP address / hostname to bind the HTTP server | `127.0.0.1` |
| `ORCHESTRA_SERVER_PORT` | Port number for the HTTP server | `4010` |
| `ORCHESTRA_API_TOKEN` | Bearer token for API authentication. Required when binding to a non-loopback address. | _(none)_ |
| `ORCHESTRA_WORKFLOW_FILE` | Path to `WORKFLOW.md` for declarative config overrides | `WORKFLOW.md` |

### Workspace

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_WORKSPACE_ROOT` | Root directory where agent workspaces are created and managed | `~/.orchestra/workspaces` |
| `ORCHESTRA_WORKSPACE_AFTER_CREATE` | Shell command to run after a workspace directory is created | _(none)_ |
| `ORCHESTRA_WORKSPACE_BEFORE_REMOVE` | Shell command to run before a workspace directory is removed | _(none)_ |
| `ORCHESTRA_WORKSPACE_BEFORE_RUN` | Shell command to run before each agent turn | _(none)_ |
| `ORCHESTRA_WORKSPACE_AFTER_RUN` | Shell command to run after each agent turn | _(none)_ |
| `ORCHESTRA_PROJECT_ROOTS` | Comma-separated list of directories to scan for projects | _(none)_ |

### Agent

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_AGENT_PROVIDER` | Default agent provider (`CODEX`, `CLAUDE`, `OPENCODE`, `GEMINI`, `UNSANDBOX`) | `CODEX` |
| `ORCHESTRA_AGENT_MAX_TURNS` | Maximum number of turns per agent session | `10` |
| `ORCHESTRA_MAX_CONCURRENT` | Maximum number of concurrent agent sessions | `16` |
| `ORCHESTRA_MAX_CONCURRENT_BY_STATE` | Per-state concurrency limits, comma-separated `state:limit` pairs (e.g. `Todo:4,In Progress:2`) | _(none)_ |
| `ORCHESTRA_AGENT_COMMAND_CODEX` | Command template for Codex agent | `codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox --json {{prompt}}` |
| `ORCHESTRA_AGENT_COMMAND_CLAUDE` | Command template for Claude agent | `claude -p {{prompt}} --output-format stream-json --verbose --dangerously-skip-permissions` |
| `ORCHESTRA_AGENT_COMMAND_OPENCODE` | Command template for OpenCode agent | `opencode run {{prompt}} --format json` |
| `ORCHESTRA_AGENT_COMMAND_GEMINI` | Command template for Gemini agent | `gemini -p {{prompt}} --output-format stream-json --approval-mode yolo` |
| `ORCHESTRA_AGENT_COMMAND_UNSANDBOX` | Command template for Unsandbox remote agent | _(none)_ |

### Issue Tracker

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_TRACKER_TYPE` | Issue tracker backend: `memory`, `sqlite`, or `github` | `memory` |
| `ORCHESTRA_TRACKER_ENDPOINT` | Endpoint URL for the tracker (GitHub API base, etc.) | _(none)_ |
| `ORCHESTRA_TRACKER_TOKEN` | Authentication token for the tracker API | _(none)_ |
| `ORCHESTRA_TRACKER_WORKER_ASSIGNEE_IDS` | Comma-separated GitHub user IDs to filter assigned issues | _(none)_ |
| `ORCHESTRA_ACTIVE_STATES` | Comma-separated issue states that trigger agent work | `Todo,In Progress` |
| `ORCHESTRA_TERMINAL_STATES` | Comma-separated issue states considered finished | `Done,Cancelled,Canceled,Closed,Duplicate` |

### GitHub OAuth

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_GITHUB_CLIENT_ID` | GitHub OAuth app client ID (for login flow) | _(none)_ |
| `ORCHESTRA_GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret | _(none)_ |

### MCP (Model Context Protocol)

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_MCP_SERVERS` | Comma-separated `name=command` pairs defining MCP servers (e.g. `filesystem=/usr/bin/mcp-fs,git=/usr/bin/mcp-git`) | _(none)_ |

### Telemetry

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_TELEMETRY_PROVIDERS` | Comma-separated list of providers to collect telemetry from | `CLAUDE,CODEX,GEMINI,OPENCODE` |
| `ORCHESTRA_TELEMETRY_RETENTION_DAYS` | Number of days to retain telemetry data | `7` |
| `ORCHESTRA_TELEMETRY_STORE_RAW_PAYLOAD` | Store full raw payloads (`true`/`false`) | `false` |

### Speech-to-Text (Whisper)

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRA_STT_WHISPER_BIN` | Path to the whisper.cpp binary | _(none)_ |
| `ORCHESTRA_STT_WHISPER_MODEL` | Path to the Whisper model file | _(none)_ |
| `ORCHESTRA_STT_WHISPER_THREADS` | Number of CPU threads for Whisper inference | `0` (auto) |
| `ORCHESTRA_STT_WHISPER_LANGUAGE` | Language code for speech recognition | `en` |

## WORKFLOW.md Overrides

Instead of (or in addition to) environment variables, you can place a `WORKFLOW.md` file in your project root. Orchestra parses structured YAML/config blocks from this file to populate the same settings. Environment variables always take precedence over workflow file values.

The workflow file supports nested keys that map to environment variables:

```yaml
server:
  host: "127.0.0.1"
  port: "4010"
  api_token: "my-token"

workspace:
  root: "/home/user/workspaces"
  after_create: "git init"
  before_run: "git checkout main && git pull"
  project_roots: "/home/user/projects,/opt/repos"

agent:
  provider: "CLAUDE"
  max_turns: "20"
  max_concurrent: "8"
  commands:
    codex: "codex exec --json {{prompt}}"
    claude: "claude -p {{prompt}} --output-format stream-json"

tracker:
  type: "github"
  endpoint: "https://api.github.com"
  token: "ghp_..."
  active_states: ["Todo", "In Progress"]
  terminal_states: ["Done", "Closed"]

github:
  client_id: "Iv1.abc123"
  client_secret: "secret"
```

## Agent Configuration Files and Discovery

Orchestra discovers agent configuration files from three sources, in order:

### 1. Internal Orchestra configs

Located at `<workspace-root>/.orchestra/agents/`. Orchestra auto-creates these on first run:

| File | Purpose |
|------|---------|
| `.claude` | Runtime configuration for Claude Code |
| `.codex` | Runtime configuration for Codex (TOML format) |
| `.gemini` | Runtime configuration for Gemini |
| `.opencode` | Runtime configuration for OpenCode |
| `workspace.json` | Shared workspace settings and pointer overrides |

### 2. Real agent configs (global and project-scoped)

Orchestra scans standard agent config paths for each provider:

| Agent | Global paths (relative to `$HOME`) | Project paths (relative to project root) | Format |
|-------|-----------------------------------|------------------------------------------|--------|
| Claude | `.claude/settings.json`, `.claude.json` | `.claude/settings.json`, `.claude/settings.local.json` | JSON |
| Codex | `.codex/config.toml` | `.codex/config.toml`, `AGENTS.md` | TOML |
| Gemini | `.gemini/settings.json` | `.gemini/settings.json` | JSON |
| OpenCode | `.config/opencode/opencode.json` | `opencode.json` | JSON |

### 3. Skill and sub-agent discovery

Orchestra recursively walks skill directories for `.json`, `.toml`, `.md`, and `.yaml` files:

| Agent | Skill directories |
|-------|-------------------|
| Claude | `.claude/agents` |
| Codex | `.codex/skills` |
| Gemini | `.gemini/agents`, `.gemini/skills` |
| OpenCode | `.config/opencode/agents`, `.config/opencode/skills`, `.config/opencode/tools` |

Both global (`$HOME/<path>`) and project-local variants are scanned.

## workspace.json Structure

The `workspace.json` file at `<workspace-root>/.orchestra/agents/workspace.json` serves as the central settings hub:

```json
{
  "pointers": {
    "claude": {
      "global": "~/custom-path/.claude/settings.json"
    },
    "codex": {
      "global": "~/.codex/config.toml"
    }
  },
  "settings": {
    "theme": "dark"
  }
}
```

### Fields

- **`pointers`** -- Override the default global config path for any agent. Each key is an agent name, with a nested `"global"` key pointing to an absolute or `~/`-prefixed path.
- **`settings`** -- Shared UI and workspace settings (e.g., theme preference).

When a pointer is defined for an agent, Orchestra reads the config from that path instead of scanning the default global paths.

## Global vs. Project Scope

Orchestra distinguishes two configuration scopes:

| Scope | Location | Purpose |
|-------|----------|---------|
| **GLOBAL** | `$HOME/<agent-paths>` or `<workspace-root>/.orchestra/agents/` | User-wide settings that apply across all projects |
| **PROJECT** | `<project-root>/<agent-paths>` | Project-specific overrides that only apply when working in that project |

Project-scoped configs are only loaded when a `projectRoot` is provided to the agent config discovery system.

## Example Configurations

### Minimal: In-memory tracker with Codex

```bash
./orchestrad --workspace-root ~/workspaces
```

Uses all defaults: memory tracker, Codex agent, localhost:4010.

### GitHub tracker with Claude

```bash
export ORCHESTRA_TRACKER_TYPE=github
export ORCHESTRA_TRACKER_ENDPOINT=https://api.github.com
export ORCHESTRA_TRACKER_TOKEN=ghp_your_token_here
export ORCHESTRA_AGENT_PROVIDER=CLAUDE
export ORCHESTRA_WORKSPACE_ROOT=~/orchestra-workspaces
./orchestrad
```

### Production with authentication

```bash
export ORCHESTRA_SERVER_HOST=0.0.0.0
export ORCHESTRA_SERVER_PORT=8080
export ORCHESTRA_API_TOKEN=strong-random-token
export ORCHESTRA_TRACKER_TYPE=sqlite
export ORCHESTRA_AGENT_PROVIDER=CLAUDE
export ORCHESTRA_MAX_CONCURRENT=4
export ORCHESTRA_WORKSPACE_ROOT=/var/lib/orchestra/workspaces
./orchestrad
```

### Multiple MCP servers

```bash
export ORCHESTRA_MCP_SERVERS="filesystem=/usr/bin/mcp-filesystem,git=/usr/bin/mcp-git,search=/usr/bin/mcp-search"
./orchestrad
```
