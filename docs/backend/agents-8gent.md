# 3.2.1 8gent Integration

> **Source files:** `apps/backend/internal/agents/eightgent_runner.go`, `apps/backend/internal/agents/registry.go`, `apps/backend/internal/agents/types.go`, `apps/backend/internal/agents/config.go`, `apps/backend/internal/config/load.go`

8gent Code is an open-source autonomous coding agent (Apache 2.0) maintained by the [8GI Foundation](https://github.com/8gi-foundation/8gent-code). It runs locally with a Bun runtime, emits a stream-json NDJSON protocol, and uses NemoClaw for permission decisions. Orchestra dispatches turns to 8gent through `EightgentRunner`, a thin wrapper over the generic `CommandRunner`.

This document explains the wiring so future maintainers can debug or extend the integration without reverse-engineering 8gent's output.

---

## Provider wiring

| Field | Value | Source |
|-------|-------|--------|
| Provider constant | `Provider8gent = "8GENT"` | `agents/types.go` |
| Runner | `EightgentRunner` (wraps `CommandRunner`) | `agents/eightgent_runner.go` |
| Default command template | `8gent run --yes --output-format stream-json {{prompt}}` | `config/load.go` |
| Env override | `ORCHESTRA_AGENT_COMMAND_8GENT` | `config/load.go` |
| Config discovery | `~/.8gent/config.json`, `.8gent/config.json` | `agents/config.go` |
| Registry hook | `case Provider8gent: r.runners[provider] = NewEightgentRunner(command)` | `agents/registry.go` |

The default command relies on the `run` subcommand introduced in [`8gi-foundation/8gent-code#1712`](https://github.com/8gi-foundation/8gent-code/pull/1712). Older 8gent installs that only expose the TUI will not work; users need `8gent-code` v0.x with the `run` subcommand on PATH.

---

## Stream-json event shape

8gent emits one JSON object per line on stdout. Each line is a complete event. There is no SSE framing, no array envelopes, no multi-line payloads. Diagnostic logging is redirected to stderr while `--output-format stream-json` is active so stdout stays clean.

| `type` | `subtype` | When | Notable fields |
|--------|-----------|------|----------------|
| `session_start` | _none_ | First event of every run | `session_id`, `started_at`, `provider`, `model`, `cwd` |
| `assistant` | `text` \| `tool_calls` | Each model step | `step`, `finish_reason`, `text` (when text), `tool_calls` (when tool_calls), `usage` |
| `tool_use` | `start` | Before a tool runs | `tool_call_id`, `tool_name`, `step`, `input` |
| `tool_result` | `ok` \| `error` | After a tool runs | `tool_call_id`, `tool_name`, `step`, `success`, `duration_ms`, `result_preview` |
| `result` | `ok` \| `error` | Last event of every run | `session_id`, `ended_at`, `final_text` (on ok), `error` (on error) |
| `error` | `usage` \| `agent` | Setup or fatal failures | `message` |

### Why this shape parses cleanly through Orchestra's generic path

Orchestra's `parseLineToEvent` reads `event`, `type`, `kind`, or `method` to derive `Event.Kind`. 8gent's `type` field maps directly:

- `session_start` is treated as a regular event with `Kind="session_start"`.
- `assistant` events with `text` populate `Event.Message` via the existing extraction (top-level `text` key, then nested fallbacks).
- `tool_use` and `tool_result` are surfaced as `Kind="tool_use"` and `Kind="tool_result"` respectively, with `Raw` carrying the full payload.
- `result` events terminate the run because Orchestra's completion detection treats `result`, `result/*`, and any payload carrying `session_id` as a finish signal. 8gent emits both.

### Token usage extraction

8gent emits usage in the `usage` field of `assistant` events, shaped as:

```json
{ "usage": { "input_tokens": 12, "output_tokens": 4, "total_tokens": 16 } }
```

Orchestra's `extractUsage` picks this up via the `usage.*` nesting pattern and accumulates across events. No 8gent-specific extractor is required.

### Completion detection

Orchestra signals turn completion when any of the following fire:

- `Kind` is `turn.completed`, `result`, or starts with `result/`.
- The payload contains a top-level `session_id` field.
- The payload contains a top-level `cost_usd` field (8gent does not currently emit this; reserved for future cloud provider routing).

8gent emits both `Kind="result"` and `session_id` in its terminal event, so completion detection fires reliably even under PTY mode.

---

## Sample NDJSON output

A real (trimmed) `8gent run --yes --output-format stream-json --max-turns 2 --model qwen3:32b "say hello"` produces:

```jsonl
{"type":"session_start","session_id":"run-1735083240123-a1b2c3","started_at":"2026-04-23T10:54:00.123Z","provider":"8gent","model":"qwen3:32b","cwd":"/Users/you/orchestra"}
{"type":"assistant","subtype":"text","step":1,"finish_reason":"stop","text":"Hello.","usage":{"input_tokens":42,"output_tokens":3,"total_tokens":45}}
{"type":"result","subtype":"ok","session_id":"run-1735083240123-a1b2c3","ended_at":"2026-04-23T10:54:01.456Z","final_text":"Hello."}
```

Tool-using runs emit `tool_use` and `tool_result` events between the `assistant` events, with the assistant's `subtype` set to `tool_calls` for the step that requested the tool.

---

## Auto-approval and permissions

The `--yes` flag in the default command sets NemoClaw's auto-approve mode. 8gent will not prompt for tool or file approvals while this flag is active, so Orchestra never receives `approval_required` events from 8gent under the default configuration. If you remove `--yes`, 8gent emits prompts on stderr (not as structured events), which Orchestra's blocking-event detector will not see, so the run will appear to hang. Keep `--yes` in the command template unless you are running 8gent through a PTY with manual stdin attached.

---

## Sample config file

8gent looks for `~/.8gent/config.json` (global) and `<workspace>/.8gent/config.json` (project). Orchestra surfaces both in `ListAgentConfigs`. A minimal valid config:

```json
{
  "version": 1,
  "provider": "8gent",
  "model": "eight-1.0-q3:14b",
  "fallback": ["qwen3:14b", "openrouter:auto:free"],
  "permissions": {
    "auto_approve": false,
    "deny_globs": ["**/.env", "**/.env.*", "**/credentials*"]
  },
  "memory": {
    "enabled": true,
    "scope": "workspace"
  }
}
```

The `provider` value names the active inference backend (one of `8gent`, `ollama`, `openrouter`, `groq`, `grok`, `openai`, `anthropic`, `mistral`, `together`, `fireworks`, `replicate`). The `--model` flag in the Orchestra command template overrides whatever is set here at run time, which is the recommended path because it keeps Orchestra's per-task model selection authoritative.

---

## Troubleshooting

**The run starts and never emits events.**
8gent is probably falling back to the TUI because the `run` subcommand is missing. Check `8gent --help` and look for a `run` line. Upgrade with `npm i -g @8gi-foundation/8gent-code` or build from source.

**Events stream but the turn never completes.**
The local 8gent build is older than [`8gi-foundation/8gent-code#1712`](https://github.com/8gi-foundation/8gent-code/pull/1712) and does not yet emit `type:"result"` or a `session_id` field. Upgrade 8gent. Orchestra's 5 MB / 2000 event limits will eventually terminate the run, but not gracefully.

**Token usage stays at zero.**
Either the local model provider does not report token counts (some Ollama models on certain runtimes), or the user is on a stream-json build that predates the `usage` field on `assistant` events. Both are 8gent-side issues, not Orchestra-side.

**Approval-required errors when `--yes` is in the command.**
This should not happen under the default command. If it does, `parseLineToEvent` is matching a substring inside an unrelated payload. Capture the offending line and file an issue against Orchestra so the matcher can be tightened.

---

## See also

- [3.2 Agents](agents.md) for the generic runner and event-parsing system.
- [8gent-code repo](https://github.com/8gi-foundation/8gent-code) for the agent itself.
- [`config/load.go`](../../apps/backend/internal/config/load.go) for the default command template.
