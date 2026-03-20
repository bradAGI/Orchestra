# Agent Provider API

Backend endpoints for managing LLM provider API keys used by the embedded agent widget.

**Source:** `apps/backend/internal/api/agent_providers.go`
**Router:** `apps/backend/internal/api/router.go` (lines 193-194)

---

## Endpoints

### GET /api/v1/config/agent-providers

Returns the configuration status and API keys for all recognized providers.

**Auth:** Required (behind auth middleware, `ORCHESTRA_API_TOKEN`)

**Response (200):**

```json
{
  "providers": {
    "openrouter": { "configured": true, "api_key": "sk-or-v1-..." },
    "claude": { "configured": true, "api_key": "sk-ant-..." },
    "openai": { "configured": false },
    "gemini": { "configured": false }
  }
}
```

- `configured: true` means a non-empty key is stored
- `api_key` is only present when `configured: true`
- Unconfigured providers have no `api_key` field

**Security note:** API keys are returned in full. This is acceptable because Orchestra runs locally on localhost with token auth. For future remote channels, keys will not be exposed — those will use backend-proxied inference.

---

### POST /api/v1/config/agent-providers

Save or remove an API key for a single provider.

**Auth:** Required

**Request body:**

```json
{
  "provider": "claude",
  "api_key": "sk-ant-..."
}
```

- `provider` (required): one of `openrouter`, `claude`, `openai`, `gemini`
- `api_key`: the key string. Send empty string `""` to remove a provider's key.

**Response (200):**

```json
{
  "provider": "claude",
  "configured": true
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `invalid_body` | Malformed JSON |
| 400 | `missing_fields` | Provider field empty |
| 400 | `invalid_provider` | Provider not in recognized list |
| 500 | `save_failed` | File write error |

---

## Storage

**Path:** `~/.orchestra/agent-providers.json`
**Permissions:** `0600` (owner read/write only)
**Directory:** `~/.orchestra/` with `0700` permissions

The file is a flat JSON map of provider ID to API key string:

```json
{
  "openrouter": "sk-or-v1-...",
  "claude": "sk-ant-..."
}
```

The Go backend sets a restrictive umask (`0077`) before writing and explicitly `chmod`s both the directory and file after creation.

---

## Valid Providers

Defined in `validAgentProviders`:

```go
var validAgentProviders = []string{"openrouter", "claude", "openai", "gemini"}
```

These are separate from the orchestrator's agent provider enum (`CLAUDE`, `CODEX`, `GEMINI`, `OPENCODE`) which identifies CLI-based agent runners. The embedded agent providers are for direct LLM API inference from the frontend.

---

## Frontend Client

The frontend calls these endpoints via helpers in `apps/desktop/src/lib/orchestra-client.ts`:

- `fetchAgentProviderKeys(config)` — GET, returns provider map
- `saveAgentProviderKey(config, provider, apiKey)` — POST, saves a single key
