# Telemetry Source Research (Root User)

This document captures what telemetry-like artifacts currently exist under `/home/traves` for the supported agent tool homes, and how to map them into Orchestra's normalized telemetry model.

## Current Watcher Coverage

`watcher.go` currently scans `*.jsonl` and `*.log` in these locations:

- Claude: `~/.claude/projects`, `~/.claude/logs`
- Codex: `~/.codex/sessions`, `~/.codex/log`
- OpenCode: `~/.opencode/logs`, `~/.opencode/sessions`
- Gemini: `~/.gemini/logs`, `~/.gemini/sessions`

## What Exists On Disk

## Claude (`~/.claude`)

### Found
- `history.jsonl`
- `projects/**/*.jsonl`
- `transcripts/*.jsonl`

### Observed record shape
- Top-level keys commonly include:
  - `type`, `timestamp`, `sessionId`, `cwd`, `uuid`, `message`, `data`
- Common `type` values:
  - `assistant`, `user`, `progress`, `file-history-snapshot`
- Token fields often appear at:
  - `message.usage.input_tokens`
  - `message.usage.output_tokens`

### Extraction readiness
- Already compatible with current JSONL ingestion pattern.

## Codex (`~/.codex`)

### Found
- `history.jsonl`
- `session_index.jsonl`
- `sessions/YYYY/MM/DD/*.jsonl`

### Observed record shape
- Top-level keys:
  - `timestamp`, `type`, `payload`
- Frequent top-level `type` values:
  - `session_meta`, `turn_context`, `response_item`, `event_msg`
- Token usage appears in nested payload events, commonly:
  - `payload.info.last_token_usage`
  - `payload.info.total_token_usage`

### Extraction readiness
- Already compatible with current JSONL ingestion pattern.

## Gemini (`~/.gemini`)

### Found
- No `*.jsonl` observed.
- Telemetry-equivalent data exists in JSON files:
  - `~/.gemini/tmp/<project>/logs.json`
  - `~/.gemini/tmp/<project>/chats/session-*.json`
  - Project mapping: `~/.gemini/projects.json`

### Observed record shape
- `logs.json` entries look like lightweight message log rows:
  - `sessionId`, `messageId`, `type`, `message`, `timestamp`
- `chats/session-*.json` includes richer structured telemetry:
  - Session metadata: `sessionId`, `startTime`, `lastUpdated`, `projectHash`
  - Message rows with `type` (`user` / `gemini`)
  - Token counters at message level:
    - `tokens.input`, `tokens.output`, `tokens.cached`, `tokens.thoughts`, `tokens.total`
  - Tool call records:
    - `toolCalls[].name`, `toolCalls[].args`, `toolCalls[].status`, `toolCalls[].timestamp`

### Log-equivalent extraction target
- Treat `~/.gemini/tmp/*/chats/session-*.json` as primary telemetry source.
- Treat `~/.gemini/tmp/*/logs.json` as fallback/summary source.

## OpenCode (`~/.opencode` / `~/.local/share/opencode`)

### Found
- No `~/.opencode/logs` or `~/.opencode/sessions` JSONL files observed.
- Telemetry-equivalent data is stored in SQLite:
  - `~/.local/share/opencode/opencode.db`

### Observed SQLite tables relevant to telemetry
- `session` (session identity, title, directory, project linkage)
- `message` (role-level message records; JSON in `data`)
- `part` (granular steps/tool calls/reasoning; JSON in `data`)
- `project` (project metadata)

### Observed JSON payload shape
- `message.data` commonly includes:
  - `role`, `time`, `modelID`, `providerID`, `path`, `tokens`, `cost`
  - token map often includes `input`, `output`, `reasoning`, `cache.read`, `cache.write`, sometimes `total`
- `part.data` commonly includes step and tool granularity:
  - `type` values like `step-start`, `step-finish`, `tool`, `reasoning`, `patch`

### Log-equivalent extraction target
- Treat `~/.local/share/opencode/opencode.db` as primary telemetry source.
- Derive event stream from `part` rows and usage totals from `message.data.tokens`.

## Normalized Mapping Proposal

For all providers, map into existing DB writer shape:

- Session identity:
  - `session_id`
- Provider:
  - `claude`, `codex`, `gemini`, `opencode`
- Event kind:
  - Source `type` (or nested equivalent)
- Event message:
  - Human-readable text/summary if available
- Tokens:
  - `input_tokens`, `output_tokens` (derive from best source fields)
- Timestamp:
  - Source timestamp field normalized to RFC3339

## Implementation Notes For Watcher

1. Keep current JSONL scanner for Claude/Codex.
2. Add Gemini JSON scanners:
   - `scanGeminiChatJSON(~/.gemini/tmp/*/chats/session-*.json)`
   - `scanGeminiLogsJSON(~/.gemini/tmp/*/logs.json)`
3. Add OpenCode SQLite scanner:
   - Read from `~/.local/share/opencode/opencode.db`
   - Incremental by `time_created` / `time_updated`
4. Track offsets/checkpoints per source type (file path or last sqlite timestamp/id).
