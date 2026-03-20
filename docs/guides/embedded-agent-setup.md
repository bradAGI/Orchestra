# Embedded Agent — Setup Guide

---

## 1. Configure a Provider

1. Open **Settings** (gear icon in the sidebar)
2. Go to the **Integrations** tab
3. Under **Embedded Agent**, select a provider from the dropdown:
   - **OpenRouter** — aggregator with access to many models (recommended for variety)
   - **Claude** — Anthropic's models directly
   - **OpenAI** — GPT models directly
   - **Gemini** — Google's models directly
4. Enter your API key for the selected provider
5. Click **Save**

The key is stored on your local machine at `~/.orchestra/agent-providers.json` with restrictive permissions. It is never sent anywhere except to the selected provider's API.

---

## 2. Select a Model

After saving an API key, the model dropdown populates from the provider's API:

- **OpenRouter:** Shows all models that support tool calling (filtered by `tools` parameter support)
- **OpenAI:** Shows `gpt-*` and `o*` models (excludes audio, embedding, image models)
- **Claude:** Static list of current Claude models (no list-models API available)
- **Gemini:** Shows models that support `generateContent`

Use the **search box** in the model dropdown to filter by name. Your selection is persisted across sessions.

### Recommended Models

| Provider | Model | Notes |
|----------|-------|-------|
| OpenRouter | `anthropic/claude-sonnet-4` | Good balance of speed and capability |
| OpenAI | `gpt-4o` | Strong tool calling |
| Claude | `claude-sonnet-4-6` | Latest Anthropic model |
| Gemini | `gemini-2.5-flash` | Fast responses |

---

## 3. Test the Connection

Click **Test Connection** in the settings form. This sends a minimal request to the provider to verify the API key is valid and the model is accessible. A green check confirms success; an error message indicates what went wrong.

---

## 4. Using the Chat Widget

### Opening the Widget

- Click the **floating orb** in the bottom-right corner of the app
- Or press **Ctrl+.** (Windows/Linux) / **Cmd+.** (macOS) to toggle

The orb hides when the panel is open.

### Sending Messages

- Type in the input field and press **Enter** to send
- **Shift+Enter** for a new line
- The agent streams its response in real time

### Voice Input

- Click and hold the **microphone button** next to the text input
- Speak your message
- Release to transcribe (uses Whisper)
- Edit the transcription if needed, then press Enter to send

### Clearing the Conversation

Click the **clear** button in the panel header. This removes all messages from localStorage.

---

## 5. Available Tools

The agent has access to 40+ tools organized by category. Core tools are available immediately; specialized tools are discovered on demand.

### Always Available

| Tool | Purpose |
|------|---------|
| `list_issues` / `create_issue` / `update_issue` | Issue management |
| `dispatch_agent` | Start an agent on an issue |
| `list_projects` / `find_projects` | Project operations |
| `navigate_to` / `open_settings_tab` | App navigation |
| `search_issues` | Find issues by query |
| `render_ui` | Display rich tables, cards, metrics |
| `get_orchestrator_state` | System status |
| `search_tools` / `get_tool_schema` | Discover other tools |

### Discoverable via search_tools

| Category | Tools |
|----------|-------|
| **git** | git_status, git_history, git_branches, git_commit_flow, git_sync, git_stash |
| **sessions** | summarize_session, get_session_logs, get_raw_logs, list_sessions, get_session_detail |
| **search** | search_sessions, search_docs, get_warehouse_stats |
| **code** | execute_code, check_sandbox_status, list_sandbox_sessions |
| **scheduling** | schedule_reminder, schedule_action, cancel_schedule, list_schedules |
| **mcp** | list_mcp_servers, discover_mcp_tools, mcp_server_status |

### Example Prompts

- "Show me all open issues" — lists issues in a rich table
- "Create an issue: Fix login timeout" — creates a new issue
- "Go to analytics" — navigates to the analytics section
- "What's the git status of my project?" — shows modified/staged files
- "Remind me to check the build in 10 minutes" — sets a reminder
- "What agents are running?" — shows orchestrator state

---

## 6. Troubleshooting

### "Model temporarily unavailable" (503)

The provider is overloaded. Wait a moment and retry, or switch to a different model in Settings.

### "API key invalid or expired"

Your key may have been revoked or expired. Go to Settings > Integrations, remove the old key, and enter a new one.

### "Rate limit exceeded" (429)

You've hit the provider's rate limit. Wait 30-60 seconds before trying again.

### Model does not support tool calling

Some models (especially older or smaller ones) do not support the tool-calling protocol. The agent needs tool support to function properly. On OpenRouter, the model list is pre-filtered to only show models with tool support. For other providers, try switching to a recommended model from the table above.

### "Network error"

Check that you have an internet connection. The agent calls provider APIs directly from the desktop app — no proxy needed for standard providers.

### Chat not responding

- Check that a provider and model are configured (Settings > Integrations)
- Try clearing the chat (header button) — a corrupted conversation can cause issues
- Check the DevTools console (`Ctrl+Shift+I`) for error details

### Backend not reachable

If the settings form cannot save keys, verify the Orchestra backend is running:

```bash
pgrep -af orchestrad
```

If not running, start it from `apps/backend/`:

```bash
ORCHESTRA_API_TOKEN=dev-token ORCHESTRA_WORKSPACE_ROOT=/tmp/orchestra ./orchestrad
```
