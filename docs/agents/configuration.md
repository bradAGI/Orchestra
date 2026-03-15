# Agent Configuration

Symphony provides per-provider configuration management through the **Agents** tab in the desktop UI. Each provider has seven configurable dimensions.

## Configuration Dimensions

| Dimension | What it controls |
|---|---|
| **Instructions** | Markdown file injected into the agent's system context |
| **Permissions** | What the agent is allowed to do (file access, shell, network) |
| **Model** | Which model/version the provider uses |
| **Hooks** | Lifecycle callbacks (pre-run, post-run, on-error) |
| **MCP Servers** | External tool servers available to the agent |
| **Skills** | Capability modules injected at task start |
| **Sub-agents** | Other agents this provider can delegate to |

All configuration is written directly to the filesystem. Changes take effect on the next agent session.

## Claude

| Dimension | File / Location |
|---|---|
| Instructions | `CLAUDE.md` (project root) |
| Permissions | `.claude/settings.json` → `permissions` |
| Model | `.claude/settings.json` → `model` |
| Hooks | `.claude/settings.json` → `hooks` |
| MCP Servers | `.claude/settings.json` → `mcpServers` |
| Skills | `.claude/settings.json` → `skills` |
| Sub-agents | `.claude.json` → `subAgents` |

Example hooks structure:
```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "command": "echo pre-hook" }],
    "PostToolUse": [{ "matcher": "Bash", "command": "echo post-hook" }]
  }
}
```

## Codex

| Dimension | File / Location |
|---|---|
| Instructions | `AGENTS.md` (project root) |
| Permissions | `config.toml` → `approval_policy` (`suggest`, `auto-edit`, `full-auto`) |
| Model | `config.toml` → `model` |
| Hooks | `config.toml` → `hooks` |
| MCP Servers | `config.toml` → `mcpServers` |
| Sandbox | `config.toml` → `sandbox_mode` (`host`, `docker`, `remote`) |
| Skills | `config.toml` → `skills` |
| Sub-agents | `config.toml` → `subAgents` |

## Gemini

| Dimension | File / Location |
|---|---|
| Instructions | `GEMINI.md` (project root) |
| Permissions | `settings.json` → `permissions` |
| Model | `settings.json` → `model` |
| Hooks | `settings.json` → `hooks` |
| MCP Servers | `settings.json` → `mcpServers` |
| Skills | `settings.json` → `skills` |
| Sub-agents | `settings.json` → `subAgents` |

## OpenCode

| Dimension | File / Location |
|---|---|
| Instructions | `AGENTS.md` (project root) |
| Permissions | `opencode.json` → `permission` |
| Model | `opencode.json` → `model` |
| Hooks | `opencode.json` → `hooks` |
| MCP Servers | `opencode.json` → `mcp` |
| Skills | `opencode.json` → `skills` |
| Sub-agents | `opencode.json` → `subAgents` |

## Configuration Hierarchy

Settings are applied in order of precedence:

1. **Project-level** -- Config files in the project/workspace directory
2. **User-level** -- Global dotfiles in your home directory (e.g., `~/.claude.json`)
3. **Platform defaults** -- Templates managed in the Agents tab

## Editing in the UI

The Agents tab provides:
- **JSON validation** -- Syntax errors are highlighted before save
- **Auto-formatting** -- Clean up JSON with one click
- **Path display** -- Shows the absolute filesystem path being edited
- **Live preview** -- See the resolved config that will be used on the next agent session
