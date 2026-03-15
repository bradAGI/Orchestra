# Getting Started

Get from zero to your first agent-managed task in under 5 minutes.

## Prerequisites

- **Go** 1.25+ (backend and TUI)
- **Node.js** 20+ and npm (desktop app)
- **Git**
- At least one agent CLI installed: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex](https://github.com/openai/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), or [OpenCode](https://github.com/opencode-ai/opencode)

## 1. Start the TUI Dashboard

The fastest way to launch all services:

```bash
make dash
```

This starts the Bubble Tea dashboard, which manages the backend and provides a terminal control surface. Alternatively, start services manually:

```bash
# Terminal 1: backend
cd apps/backend && go run ./cmd/orchestrad

# Terminal 2: desktop
cd apps/desktop && npm ci && npm run dev
```

## 2. Add a Project

1. Open the desktop app and navigate to **Projects** in the sidebar.
2. Click **Add Project** and select a local Git repository directory.
3. Symphony registers the project and scans its Git state (branches, remotes).

## 3. Connect GitHub (Optional)

To enable bidirectional issue sync:

1. Go to **Settings** and configure your GitHub OAuth credentials (`ORCHESTRA_GITHUB_CLIENT_ID` / `ORCHESTRA_GITHUB_CLIENT_SECRET`).
2. Open your project and click **Connect GitHub**.
3. Authenticate via the OAuth flow.
4. GitHub issues automatically populate the **Backlog** column. Edits sync both ways.

## 4. Create a Task

1. Open the **Tasks** (Kanban) board.
2. Click **+ New Task** or let GitHub issues flow into Backlog automatically.
3. Fill in the title, description, and optionally assign a project.

## 5. Assign an Agent

1. Drag the task from **Backlog** to **Todo**.
2. Select an agent provider (Claude, Codex, Gemini, or OpenCode) if not using the default.
3. Configure provider-specific settings in the **Agents** tab if needed (see [Agent Configuration](../agents/configuration.md)).

## 6. Move Through the Lifecycle

| Column | What happens |
|---|---|
| **Backlog** | Task exists but is not yet ready for work |
| **Todo** | Task is queued and ready for an agent |
| **In Progress** | Agent is actively working -- watch live in the Inspector or Terminal |
| **Review** | Agent finished; human reviews output, diffs, and plan |
| **Done** | Approved and complete |

Drag a task from **Todo** to **In Progress** to dispatch the agent. Monitor progress in the **Issue Inspector** (Details, Plan, Activity, Output, Changes tabs).

When the agent finishes, the task moves to **Review**. Inspect the changes, then drag to **Done** to approve -- or back to **Todo** to retry.

## Next Steps

- [Core Concepts](core-concepts.md) -- Understand the data model and workflow
- [Agent Configuration](../agents/configuration.md) -- Tune per-provider settings
- [Architecture Overview](../architecture/overview.md) -- How the system fits together
