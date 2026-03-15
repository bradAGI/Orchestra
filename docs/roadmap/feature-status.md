# Feature Status

Current state of Symphony's planned features.

## Completed

### Kanban & Task Lifecycle
- [x] 5-column Kanban board (Backlog, Todo, In Progress, Review, Done)
- [x] Drag-and-drop task management
- [x] Agent dispatch on state transition (Todo → In Progress)
- [x] Human review gate (In Progress → Review → Done)
- [x] Issue Inspector with Details, Plan, Activity, Output, Changes tabs
- [x] Operational plan checklists (real-time progress from agent thoughts)
- [x] Issue history timeline with event icons and token metrics

### GitHub Integration
- [x] Bidirectional issue sync (GitHub issues auto-populate Backlog)
- [x] GitHub issue CRUD from desktop UI
- [x] Pull request listing, creation, and diff viewing
- [x] Branch listing
- [x] GitHub OAuth flow
- [x] Per-project GitHub connect/disconnect

### Agent Management
- [x] 4 providers: Claude, Codex, Gemini, OpenCode
- [x] Per-provider config: Instructions, Permissions, Model, Hooks, MCP, Skills, Sub-agents
- [x] Agent config UI with JSON validation and auto-formatting
- [x] Provider-specific permissions and model configuration endpoints

### Project Management
- [x] Project CRUD with filesystem linking
- [x] Git integration (status, diff, commit, push, pull, branches)
- [x] File tree browsing and content viewing
- [x] Project detail view with Commits, Issues, PRs sub-tabs

### Telemetry & Warehouse
- [x] Unified session telemetry from all 4 providers
- [x] Claude JSON, Codex logs, Gemini JSON stream, OpenCode SQLite ingestion
- [x] Token analytics and cost tracking
- [x] Telemetry health endpoint
- [x] Warehouse statistics

### Terminal & Observability
- [x] Terminal multiplexer (up to 16 tiled PTY sessions)
- [x] Live log streaming and search
- [x] Diff highlighting
- [x] SSE event stream
- [x] Real-time state snapshots

### MCP (Model Context Protocol)
- [x] MCP host with stdio JSON-RPC
- [x] Global MCP server management (UI + SQLite)
- [x] Per-provider MCP server configuration
- [x] Tool discovery and schema display
- [x] MCP resource support

### Platform
- [x] TUI dashboard (`make dash`)
- [x] Docker deployment
- [x] systemd service template
- [x] GitHub Actions CI (backend checks, desktop smoke tests, release artifacts)
- [x] Theme sync (system light/dark mode)
- [x] OpenAPI 3.1 spec

## Remaining / In Progress

- [ ] Multi-agent parallel execution for same issue (compare outputs)
- [ ] Agent handoff protocol refinement
- [ ] Cost management dashboards with budget alerts
- [ ] Stability scoring (project health index)
- [ ] Animated architecture relation graphs (D3)
- [ ] Shortcut mapper UI
- [ ] PR planning bridge (collaborative HITL review before push)
