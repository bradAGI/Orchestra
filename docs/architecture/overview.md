# 1.1 Architecture Overview

> **Source files:** `apps/backend/cmd/orchestrad/`, `apps/backend/internal/`, `apps/desktop/`, `apps/tui/`

Orchestra follows a client-server architecture with a single Go backend serving multiple frontends. The backend owns orchestration logic, issue state, execution dispatch, telemetry, and event broadcasting, while frontends render state and issue commands through the API.

---

### High-Level System Diagram

```mermaid
graph TB
    subgraph Frontends
        DESKTOP["Desktop App<br/><small>Electron + React</small>"]
        TUI["TUI Dashboard<br/><small>Bubble Tea</small>"]
    end

    subgraph Backend ["orchestrad (Go)"]
        API["API Layer<br/><small>Chi Router</small>"]
        ORCH["Orchestrator<br/><small>State Machine</small>"]
        PUBSUB["PubSub<br/><small>Event Bus</small>"]
        AGENTS["Agent Registry<br/><small>Runner Pool</small>"]
        TRACKER["Tracker<br/><small>Issue Store</small>"]
        DB["Analytics DB<br/><small>SQLite</small>"]
        WORKSPACE["Workspace<br/><small>File + Git</small>"]
        MCP_PKG["MCP Client<br/><small>Tool Server</small>"]
    end

    subgraph External
        CLAUDE["Claude"]
        GEMINI["Gemini"]
        CODEX["Codex"]
        OPENCODE["OpenCode"]
        UNSANDBOX["Unsandbox"]
        GITHUB["GitHub API"]
        MCP_SRV["MCP Servers"]
    end

    DESKTOP -- "HTTP REST / SSE" --> API
    TUI -- "Process Manager" --> API

    API --> ORCH
    API --> PUBSUB
    ORCH --> AGENTS
    ORCH --> TRACKER
    ORCH --> DB
    ORCH --> WORKSPACE
    AGENTS --> MCP_PKG

    AGENTS --> CLAUDE
    AGENTS --> GEMINI
    AGENTS --> CODEX
    AGENTS --> OPENCODE
    AGENTS --> UNSANDBOX
    TRACKER --> GITHUB
    MCP_PKG --> MCP_SRV
```

---

### Component Responsibilities

| Component | Package | Responsibility |
|-----------|---------|----------------|
| **API Server** | `internal/api` | HTTP routing, SSE streaming, auth, rate limiting, WebSocket terminals |
| **Orchestrator** | `internal/orchestrator` | Central state machine -- tracks running/retrying issues, dispatches agents, reconciles states |
| **Agent Registry** | `internal/agents` | Provider abstraction -- registers runners for Claude, Gemini, Codex, OpenCode, Unsandbox |
| **Tracker** | `internal/tracker` | Pluggable issue storage (memory, SQLite, GitHub Issues) |
| **PubSub** | `internal/observability` | In-process event bus -- fan-out lifecycle events to SSE subscribers |
| **Analytics DB** | `internal/db` | SQLite database for sessions, projects, token usage, MCP server configs |
| **Workspace** | `internal/workspace` | Manages working directories, git operations, workspace migration, path guards |
| **MCP Client** | `internal/mcp` | Model Context Protocol client for connecting to external tool servers |
| **Config** | `internal/config` | Loads configuration from environment variables and config files |
| **Telemetry** | `internal/telemetry` | Watches agent log files for token usage and session events |
| **Terminal** | `internal/terminal` | WebSocket-based terminal sessions for the desktop app |
| **Prompt** | `internal/prompt` | Builds system prompts for agent runners |
| **Workflow** | `internal/workflow` | Frontmatter parsing and workflow definition store |
| **Presenter** | `internal/presenter` | Formats orchestrator state for API responses |
| **Unsandbox** | `internal/unsandbox` | Client for remote execution on the Unsandbox platform |

---

### Communication Patterns

Orchestra uses three communication channels between backend and frontends:

```mermaid
graph LR
    FE["Frontend"]
    BE["Backend"]

    FE -- "1. HTTP REST<br/><small>CRUD, commands</small>" --> BE
    BE -- "2. SSE<br/><small>events + snapshots</small>" --> FE
    FE -- "3. WebSocket<br/><small>terminal I/O</small>" --> BE

    style FE fill:#0f3460,stroke:#533483,color:#fff
    style BE fill:#1a1a2e,stroke:#e94560,color:#fff
```

| Channel | Protocol | Direction | Use Case |
|---------|----------|-----------|----------|
| **REST API** | HTTP/JSON | Client -> Server | Issue CRUD, project management, git operations, config, agent control |
| **SSE** | `text/event-stream` | Server -> Client | Real-time snapshot broadcasts, lifecycle events (run started/failed/succeeded) |
| **WebSocket** | WS | Bidirectional | Interactive terminal sessions (`/api/v1/terminal/{session_id}`) |

---

### Data Flow: Issue Creation to Resolution

```mermaid
sequenceDiagram
    participant User
    participant Desktop
    participant API
    participant Orchestrator
    participant AgentRegistry
    participant Agent
    participant Tracker
    participant PubSub

    User->>Desktop: Create issue
    Desktop->>API: POST /api/v1/issues
    API->>Orchestrator: Create issue in BACKLOG
    Orchestrator->>Tracker: Store issue
    API-->>Desktop: Issue created
    User->>Desktop: Move BACKLOG issue to TODO
    Desktop->>API: PATCH /api/v1/issues/{issue_identifier} {state:"Todo"}
    API->>Orchestrator: Update issue state
    Orchestrator->>AgentRegistry: Claim issue and start run
    AgentRegistry->>Agent: Execute (Claude/Gemini/...)
    Agent-->>AgentRegistry: Stream progress
    AgentRegistry-->>Orchestrator: Update state
    Orchestrator->>PubSub: Publish(RUN_STARTED)
    PubSub-->>API: Fan-out event
    API-->>Desktop: SSE: RUN_STARTED + snapshot (issue in In Progress)
    Agent-->>AgentRegistry: Completion
    AgentRegistry-->>Orchestrator: Mark run successful
    Orchestrator->>PubSub: Publish(RUN_SUCCEEDED)
    Orchestrator->>Tracker: Advance issue to REVIEW
    PubSub-->>API: Fan-out event
    API-->>Desktop: SSE: RUN_SUCCEEDED + snapshot (issue in REVIEW)
    Desktop-->>User: Show result
```

---

### Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend language | **Go 1.25+** | Fast compilation, strong concurrency primitives, single binary deployment |
| HTTP router | **Chi** (`go-chi/chi/v5`) | Lightweight, idiomatic middleware chain, URL parameters |
| Logging | **zerolog** (`rs/zerolog`) | Zero-allocation structured JSON logging |
| CORS | **go-chi/cors** | Chi-native CORS middleware |
| Desktop framework | **Electron** | Cross-platform desktop with web technologies |
| UI library | **React 19** | Component model, hooks, concurrent rendering |
| Build tool | **Vite** | Fast HMR, ESM-native bundling |
| Styling | **Tailwind CSS** | Utility-first, no CSS files to manage |
| Component primitives | **Radix UI** | Accessible, unstyled component primitives |
| Charts | **Recharts** | React-native charting built on D3 |
| TUI framework | **Bubble Tea** | Elm-architecture TUI framework for Go |
| Database | **SQLite** | Zero-config embedded database, single file |
| ID generation | **UUID v4** (`google/uuid`) | Globally unique, no coordination needed |

---

### Cross-References

- [1.2 Backend Architecture](backend.md) -- Package-level internals of `orchestrad`
- [1.3 Desktop Frontend](desktop.md) -- Electron + React component structure
- [1.4 TUI Architecture](tui.md) -- Terminal dashboard details
- [1.5 Data Flow & Events](data-flow.md) -- SSE event types, PubSub, retry logic
