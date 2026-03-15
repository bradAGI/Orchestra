# Core Concepts

The primary entities and workflows in Symphony.

## Tasks

A **task** (also called an issue) is the unit of work. Each task has a title, description, assigned agent, and moves through the Kanban columns. Tasks can be created manually or synced from GitHub issues.

Tasks carry:
- An **operational plan** (checklist the agent updates as it works)
- **Activity log** (real-time events from the agent session)
- **Output** (agent's final result and report)
- **Changes** (file diffs produced during the session)

## Projects

A **project** links a local filesystem directory to Symphony. Each project tracks:
- **Git state** -- branches, status, diffs, commits
- **GitHub connection** -- bidirectional sync of issues and pull requests
- **File tree** -- browsable from the desktop UI

Projects are the scope boundary: tasks belong to projects, and agents execute within the project's workspace.

## Agents

Symphony supports four agent providers:

| Provider | CLI | Config files |
|---|---|---|
| **Claude** | `claude` | CLAUDE.md, settings.json, .claude.json |
| **Codex** | `codex` | AGENTS.md, config.toml |
| **Gemini** | `gemini` | GEMINI.md, settings.json |
| **OpenCode** | `opencode` | AGENTS.md, opencode.json |

Each provider is configured independently through the Agents tab. See [Agent Configuration](../agents/configuration.md) for details.

## The 5 States

Tasks move through a 5-column Kanban board:

```
Backlog → Todo → In Progress → Review → Done
```

| State | Meaning |
|---|---|
| **Backlog** | Discovered or created, not yet prioritized. GitHub issues land here. |
| **Todo** | Prioritized and ready for an agent to pick up. |
| **In Progress** | An agent is actively executing. Live telemetry streams to the UI. |
| **Review** | Agent completed its work. Human inspects diffs, plan, and output. |
| **Done** | Approved and finalized. |

The key handoff: **In Progress → Review** is when the agent finishes and control returns to the human operator for approval.

## Skills

**Skills** are capabilities injected into an agent's context at task start. They define what tools and instructions the agent has access to. Skills are configured per-provider and can include MCP tool schemas, custom instructions, and permission boundaries.

## Sub-agents

**Sub-agents** allow task decomposition. A primary agent can delegate sub-tasks to other agents (same or different provider) via the `request_handoff` tool. This enables parallel execution and specialization.

## MCP Servers

Symphony acts as an **MCP Host** (Model Context Protocol). External MCP servers connect via JSON-RPC over stdio and expose tools that agents can call during execution.

MCP servers are configured at two levels:
- **Global** -- via the MCP tab in the desktop UI (stored in SQLite)
- **Per-provider** -- via each provider's native MCP configuration

## Operational Plan

When an agent works on a task, it maintains an **operational plan** -- a structured checklist of steps. The plan is parsed from agent "thought" events and displayed in real-time in the Issue Inspector's **Plan** tab. This gives operators visibility into what the agent intends to do and how far along it is.
