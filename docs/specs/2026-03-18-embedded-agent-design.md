# Embedded Agent Widget — Design Specification

**Date:** 2026-03-18
**Epic:** [#32](https://github.com/Traves-Theberge/Orchestra/issues/32)
**Status:** Reviewed

---

## 1. Overview

A floating chat widget built into the Orchestra desktop app that acts as an ML-powered co-pilot. It converses with the user via text or voice, navigates the UI, calls Orchestra APIs, renders rich UI components inline via json-render, and connects to MCP servers for extensible tooling.

### Core Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Chat backbone | AI SDK 6 | Multi-provider streaming chat (useChat hook, tool calling) |
| Tool protocol | MCP TypeScript SDK | Connect to MCP servers, discover and call tools |
| Generative UI | json-render | Render rich components inline in chat from LLM-generated JSON |
| Voice input | Whisper (existing) | Hold-to-talk speech-to-text via `@/lib/whisper-client` |
| LLM providers | OpenRouter, Claude, OpenAI, Gemini | Direct API calls from frontend (AI SDK provider adapters) |

### Data Flow

```
User input (text/voice)
    |
    v
AI SDK useChat (streaming)
    |
    v
LLM Provider (OpenRouter / Claude / OpenAI / Gemini)
    |
    +---> Text response --> Markdown render in chat bubble
    |
    +---> Tool calls --> MCP Client --> MCP Servers (Orchestra, external)
    |                        |
    |                        v
    |                   Tool results fed back to LLM
    |
    +---> json-render JSON --> JsonRenderBlock component --> Rich inline UI
```

### Interaction Modes

The agent supports two navigation modes, switchable per-request:

- **Active navigation** — the agent switches sections, opens issues/dialogs. The user watches it happen.
- **Background execution** — the agent calls APIs and reports results in chat. UI stays where the user left it.

The user controls which mode via natural language ("go to analytics" vs "check token usage and tell me").

---

## 2. Widget UI

### Floating Button

- Fixed position: `bottom-6 right-6` (24px inset)
- 56px circle with Orchestra branding icon
- States: idle (subtle), has-response (pulse glow animation), disabled (dimmed)
- Click expands chat panel; click again or press Esc to minimize
- Global keyboard shortcut: `Ctrl+.` to toggle

### Chat Panel (Expanded)

- Dimensions: ~420px wide, ~620px tall, anchored bottom-right
- Layered above all content (`z-50`)
- Rounded corners, border, backdrop blur to match app aesthetic

**Header:**
- Provider selector: dropdown with OpenRouter, Claude, OpenAI, Gemini
- Model selector: provider-specific model list
- Clear chat button
- Close button (minimize to floating button)

**Message Area:**
- Scrollable conversation with user/assistant bubbles
- User messages: right-aligned, primary color background
- Assistant messages: left-aligned, card background
- Assistant messages may contain:
  - Markdown text (rendered)
  - json-render components (rendered inline)
  - Tool call feedback blocks (collapsible)
  - Navigation action chips (clickable)

**Input Area:**
- Text input with send button (Enter to send, Shift+Enter for newline)
- Hold-to-talk mic button (right side of input)
- Typing indicator when LLM is streaming

### Message Types

| Type | Rendering | Source |
|------|-----------|--------|
| Text | Markdown → HTML | LLM text output |
| Rich UI | json-render `<Renderer>` | LLM returns JSON matching catalog |
| Tool feedback | Collapsible block: tool name, params, result | AI SDK tool call metadata |
| Navigation chip | Clickable pill/button | LLM returns navigation intent |

### Conversation Persistence

- v1: localStorage per-session, cleared on app restart
- Clear chat button resets conversation
- No server-side persistence in v1

---

## 3. json-render Integration (Detailed)

### Purpose

json-render enables the LLM to generate structured, interactive UI within chat messages — not just text. When the agent answers "show me running tasks," it can render a styled table with status badges and action buttons, rather than plain text.

### Architecture

```
LLM generates JSON spec
    |
    v
AI SDK parses tool call result containing spec
    |
    v
MessageBubble detects json-render content
    |
    v
JsonRenderBlock renders via:
    StateProvider → VisibilityProvider → ActionProvider → Renderer
```

### Packages

```
@json-render/core     — catalog definition, spec types, streaming compiler
@json-render/react    — React registry, Renderer, StateProvider, hooks
```

### Component Catalog

The catalog defines which components the LLM is allowed to generate. This is the safety boundary — the LLM cannot render arbitrary HTML, only components from this catalog.

Defined in `lib/json-render-catalog.ts` using `defineCatalog()`:

#### Layout Components

| Component | Props | Slots | Description |
|-----------|-------|-------|-------------|
| `Card` | `title: string`, `description?: string`, `padding?: 'sm'\|'md'\|'lg'` | `default` | Container card for grouping content |
| `Stack` | `direction?: 'horizontal'\|'vertical'`, `gap?: 'sm'\|'md'\|'lg'`, `align?: 'start'\|'center'\|'end'` | `default` | Flex container for layout |
| `Grid` | `columns: number`, `gap?: 'sm'\|'md'\|'lg'` | `default` | CSS grid container |
| `Divider` | `label?: string` | — | Horizontal rule with optional label |

#### Data Display Components

| Component | Props | Slots | Description |
|-----------|-------|-------|-------------|
| `Metric` | `label: string`, `value: string\|number`, `format?: 'currency'\|'percent'\|'number'`, `trend?: 'up'\|'down'\|'neutral'`, `trendValue?: string` | — | Single KPI metric with optional trend |
| `Table` | `columns: {key: string, label: string, align?: 'left'\|'center'\|'right'}[]`, `rows: Record<string, string\|number>[]`, `striped?: boolean` | — | Data table |
| `List` | `items: {label: string, description?: string, icon?: string}[]`, `ordered?: boolean` | — | Styled list |
| `Badge` | `label: string`, `variant?: 'default'\|'success'\|'warning'\|'error'\|'info'` | — | Status badge/pill |
| `CodeBlock` | `code: string`, `language?: string`, `title?: string` | — | Syntax-highlighted code |
| `KeyValue` | `pairs: {key: string, value: string}[]` | — | Key-value pair display |

#### Interactive Components

| Component | Props | Slots | Description |
|-----------|-------|-------|-------------|
| `Button` | `label: string`, `variant?: 'primary'\|'secondary'\|'destructive'\|'ghost'`, `action: string`, `params?: Record<string, unknown>` | — | Action button that fires a catalog action |
| `ButtonGroup` | `direction?: 'horizontal'\|'vertical'` | `default` | Group of buttons |
| `Chip` | `label: string`, `action?: string`, `params?: Record<string, unknown>`, `variant?: 'default'\|'primary'` | — | Clickable chip/tag |

#### Feedback Components

| Component | Props | Slots | Description |
|-----------|-------|-------|-------------|
| `Alert` | `message: string`, `variant?: 'info'\|'success'\|'warning'\|'error'`, `title?: string` | — | Alert/notice block |
| `Progress` | `value: number`, `max?: number`, `label?: string` | — | Progress bar |
| `Skeleton` | `lines?: number`, `height?: string` | — | Loading placeholder |

### Action Catalog

Actions are intents the LLM can wire to buttons/chips. The application provides implementations — the LLM never executes arbitrary code.

```typescript
actions: {
  navigate: {
    params: z.object({ section: z.string(), id: z.string().optional() }),
    description: 'Navigate to a section of the app',
  },
  create_issue: {
    params: z.object({ title: z.string(), description: z.string().optional(), state: z.string().optional() }),
    description: 'Create a new task/issue',
  },
  dispatch_agent: {
    params: z.object({ issueId: z.string(), provider: z.string().optional() }),
    description: 'Dispatch an agent to work on an issue',
  },
  stop_session: {
    params: z.object({ issueIdentifier: z.string() }),
    description: 'Stop the active agent session for an issue (by issue identifier)',
  },
  execute_code: {
    params: z.object({ language: z.string(), code: z.string(), confirm: z.boolean().default(false) }),
    description: 'Execute code via Unsandbox — requires user confirmation before dispatch',
  },
  copy_to_clipboard: {
    params: z.object({ text: z.string() }),
    description: 'Copy text to clipboard',
  },
  send_chat: {
    params: z.object({ message: z.string() }),
    description: 'Send a follow-up message in the embedded agent chat',
  },
}
```

### Action Handlers

Implemented in the registry, handlers receive `(params, setState, state)`:

```typescript
navigate: (params) => {
  onNavigate(params.section, params.id)  // calls App.tsx callback
},
create_issue: async (params, setState) => {
  const issue = await createIssue(config, { title: params.title, ... })
  setState(prev => ({ ...prev, lastCreated: issue }))
},
dispatch_agent: async (params) => {
  // Set provider first, then transition state to 'in progress'
  // The orchestrator's execution worker picks up issues in 'in progress' state
  await updateIssue(config, params.issueId, {
    state: 'in progress',
    provider: params.provider ?? 'claude',
  })
},
stop_session: async (params) => {
  // DELETE /api/v1/issues/{identifier}/session stops the active session
  await deleteIssueSession(config, params.issueIdentifier)
},
execute_code: async (params, setState) => {
  // Requires confirm: true — the LLM must first present code to user
  // and ask for confirmation. The json-render Button with action=execute_code
  // sets confirm: true when clicked.
  if (!params.confirm) {
    setState(prev => ({ ...prev, pendingCode: params }))
    return { status: 'awaiting_confirmation', message: 'User must confirm before execution' }
  }
  const result = await executeUnsandbox(config, params.language, params.code, 'semitrusted')
  return result
},
```

> **Safety note on `execute_code`:** The LLM should never auto-execute code. The intended flow is: (1) LLM generates a json-render card showing the code with a "Run" Button whose action is `execute_code` with `confirm: true`, (2) user clicks the button, (3) execution fires. If the LLM calls `execute_code` directly without `confirm: true`, the handler returns `awaiting_confirmation` and the UI renders a confirmation card.

### Data Binding

The LLM can bind component props to state using expressions:

```json
{
  "type": "Metric",
  "props": {
    "label": "Running Sessions",
    "value": { "$state": "/orchestrator/running" },
    "trend": "up"
  }
}
```

State is provided to `<StateProvider>` from the embedded agent's context (orchestrator snapshot, issue lists, etc.).

Supported expressions:
- `{ "$state": "/path/to/value" }` — read from state
- `{ "$template": "Running: ${/orchestrator/running}" }` — string interpolation
- `{ "$cond": condition, "$then": val1, "$else": val2 }` — conditional values

### Streaming

json-render uses SpecStream (JSONL patches, RFC 6902) for progressive rendering:

```json
{"op":"add","path":"/root","value":"card-1"}
{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Running Tasks"}}}
{"op":"add","path":"/elements/table-1","value":{"type":"Table","props":{"columns":[...]}}}
```

Integration with AI SDK streaming:

1. LLM streams a tool call result containing JSONL patches
2. `createSpecStreamCompiler()` incrementally applies patches
3. `<Renderer>` updates as each patch arrives
4. User sees the UI build progressively

### Rendering Pipeline in React

```tsx
// Inside JsonRenderBlock.tsx
import { Renderer, StateProvider, ActionProvider, defineRegistry } from '@json-render/react'
import { catalog } from '../lib/json-render-catalog'

const { registry, handlers } = defineRegistry(catalog, {
  components: {
    Card: ({ props, children }) => <div className="rounded-xl border p-4">{children}</div>,
    Metric: ({ props }) => <div className="text-2xl font-bold">{props.value}</div>,
    Table: ({ props }) => <table>...</table>,
    Button: ({ props }) => <button onClick={() => emit(props.action)}>{props.label}</button>,
    // ... all catalog components mapped to Orchestra's design system
  },
  actions: actionHandlers,
})

export function JsonRenderBlock({ spec, state }: { spec: Spec; state: Record<string, unknown> }) {
  return (
    <StateProvider initialState={state}>
      <ActionProvider handlers={handlers}>
        <Renderer spec={spec} registry={registry} />
      </ActionProvider>
    </StateProvider>
  )
}
```

### Example: Agent Responds to "Show me running tasks"

LLM returns a json-render spec:

```json
{
  "root": "card-1",
  "elements": {
    "card-1": {
      "type": "Card",
      "props": { "title": "Running Tasks", "padding": "md" },
      "children": ["table-1", "actions-1"]
    },
    "table-1": {
      "type": "Table",
      "props": {
        "columns": [
          { "key": "issue", "label": "Issue" },
          { "key": "provider", "label": "Agent" },
          { "key": "turns", "label": "Turns" },
          { "key": "tokens", "label": "Tokens", "align": "right" }
        ],
        "rows": [
          { "issue": "#12 Fix login", "provider": "claude", "turns": 3, "tokens": "12.4k" },
          { "issue": "#15 Add tests", "provider": "codex", "turns": 1, "tokens": "3.2k" }
        ],
        "striped": true
      }
    },
    "actions-1": {
      "type": "ButtonGroup",
      "props": { "direction": "horizontal" },
      "children": ["btn-refresh", "btn-navigate"]
    },
    "btn-refresh": {
      "type": "Button",
      "props": { "label": "Refresh", "variant": "secondary", "action": "send_chat", "params": { "message": "refresh running tasks" } }
    },
    "btn-navigate": {
      "type": "Button",
      "props": { "label": "Open Task Board", "variant": "primary", "action": "navigate", "params": { "section": "ISSUES" } }
    }
  }
}
```

This renders as a styled card with a data table and action buttons — all within the chat message.

---

## 4. MCP Client Integration

### Architecture

The embedded agent acts as an MCP client using the TypeScript SDK (`@modelcontextprotocol/sdk`). It connects to MCP servers configured in Orchestra's agent settings and bridges their tools into AI SDK's tool format.

### MCP Transport in Electron

The Electron renderer process (Chromium) cannot spawn child processes directly, so stdio-based MCP servers are not accessible from the renderer. The embedded agent supports two transport modes:

1. **SSE/HTTP transport (primary)** — MCP servers that expose an HTTP+SSE endpoint can be connected to directly from the renderer via `fetch`. This is the recommended approach for v1.
2. **Backend-proxied stdio transport** — For stdio-based MCP servers, the Go backend acts as a proxy. New endpoints forward tool discovery and tool calls to MCP servers that the backend manages:
   - `GET /api/v1/mcp/{server}/tools` — list tools from a stdio MCP server
   - `POST /api/v1/mcp/{server}/call` — call a tool on a stdio MCP server

The `useMCPClient` hook abstracts this: it checks each server's transport type and routes accordingly.

### Tool Discovery Flow

```
Widget init
    |
    v
useMCPClient hook
    |
    +---> Fetch configured MCP servers from Orchestra backend
    |
    +---> For each server:
    |       SSE server? ---> Connect directly via MCP SDK SSE transport
    |       stdio server? --> Proxy through backend /api/v1/mcp/{server}/*
    |
    +---> Aggregate tool lists from all connected servers
    |
    v
mcp-bridge.ts converts MCP tool schemas to AI SDK tool() definitions
    |
    v
Tools merged with Orchestra built-in tools and passed to streamText()
```

### MCP-to-AI-SDK Bridge

MCP tools use JSON Schema for input validation. AI SDK tools use Zod. The bridge converts:

```typescript
// mcp-bridge.ts
function bridgeMCPTools(mcpTools: MCPTool[]): Record<string, AITool> {
  return Object.fromEntries(
    mcpTools.map(tool => [
      tool.name,
      {
        description: tool.description,
        parameters: jsonSchemaToZod(tool.inputSchema),
        execute: async (params) => {
          return await mcpClient.callTool(tool.name, params)
        },
      },
    ])
  )
}
```

### Built-in Orchestra MCP Server

Orchestra's own API is exposed as an MCP server (or equivalently, as direct tool definitions in `orchestra-tools.ts` that call `@/lib/orchestra-client`). This provides:

- Issue CRUD (create, read, update, delete, list)
- Orchestrator state queries (running, retrying, totals)
- Session management (dispatch, stop, logs)
- Project operations (list, stats, git)
- Unsandbox execution

### External MCP Servers

Any MCP server configured in the agent settings (via the existing MCP management UI in AgentsDashboard) is automatically available to the embedded agent. This makes the widget extensible without code changes.

---

## 5. AI SDK 6 Provider Configuration

### Provider Setup

Each provider is configured in `lib/providers.ts`:

```typescript
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const providers = {
  openrouter: createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: '', // fetched from backend at init
  }),
  claude: createAnthropic({
    apiKey: '',
  }),
  openai: createOpenAI({
    apiKey: '',
  }),
  gemini: createGoogleGenerativeAI({
    apiKey: '',
  }),
}
```

### API Key Storage

Keys are stored in the Go backend (same pattern as Unsandbox credentials):

- `GET /api/v1/config/agent-providers` — fetch provider status AND keys. Since Orchestra runs locally on localhost with token auth, returning keys to the renderer is acceptable. The response includes the actual API key strings needed for direct LLM calls.
- `POST /api/v1/config/agent-providers` — save/update provider keys
- `DELETE /api/v1/config/agent-providers/{provider}` — remove a provider's key

Keys stored at `~/.orchestra/agent-providers.json` with `0600` permissions. Frontend fetches keys at widget initialization and holds them in memory (never persisted client-side).

Response format for GET:
```json
{
  "providers": {
    "openrouter": { "configured": true, "api_key": "sk-or-..." },
    "claude": { "configured": true, "api_key": "sk-ant-..." },
    "openai": { "configured": false },
    "gemini": { "configured": false }
  }
}
```

> **Security note:** This is acceptable for the local Electron app where the backend runs on localhost. For future remote channels (Tier 4), keys will NOT be exposed — those channels will use the backend-proxied inference endpoint (#53) instead.

> **Provider naming:** The embedded agent's provider list (`openrouter`, `claude`, `openai`, `gemini`) is for direct LLM API inference and is intentionally separate from the orchestrator's agent provider enum (`CLAUDE`, `CODEX`, `GEMINI`, `OPENCODE`) which identifies CLI-based agent runners. These are different systems serving different purposes.

### Chat Integration — Client-Side `streamText`

> **Important:** AI SDK's `useChat` hook requires a server-side POST endpoint and cannot be used for direct client-side inference. Since the embedded agent runs entirely in the Electron renderer with no server route, we use `streamText()` from `ai` core wrapped in a custom hook.

The `useEmbeddedChat` hook manages the message list, streaming state, and tool execution manually:

```typescript
// hooks/useEmbeddedChat.ts
import { streamText } from 'ai'

function useEmbeddedChat({ provider, model, tools, systemPrompt }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = async (userMessage: string) => {
    const updated = [...messages, { role: 'user', content: userMessage }]
    setMessages(updated)
    setIsStreaming(true)

    abortRef.current = new AbortController()

    const result = streamText({
      model: provider(model),
      system: systemPrompt,
      messages: updated,
      tools,
      maxSteps: 10,  // allows multi-step tool chains
      abortSignal: abortRef.current.signal,
      onStepFinish: ({ toolCalls, toolResults }) => {
        // Update UI with tool call feedback as each step completes
      },
    })

    let assistantText = ''
    for await (const chunk of result.textStream) {
      assistantText += chunk
      // Update the assistant message progressively
      setMessages([...updated, { role: 'assistant', content: assistantText }])
    }

    setIsStreaming(false)
    // Final message includes full text + any tool call metadata
    const finalResult = await result
    setMessages([...updated, {
      role: 'assistant',
      content: finalResult.text,
      toolCalls: finalResult.toolCalls,
      toolResults: finalResult.toolResults,
    }])
  }

  const stop = () => abortRef.current?.abort()

  return { messages, sendMessage, isStreaming, stop }
}
```

`maxSteps: 10` allows complex multi-step workflows. If the step limit is reached mid-chain, the LLM's final response will indicate it ran out of steps, and the user can say "continue" to resume.

---

## 6. How the LLM Knows the json-render Catalog

The catalog is communicated to the LLM via a dedicated `render_ui` tool, not the system prompt. This is more reliable than prompt injection because the LLM uses its structured tool-calling capability:

```typescript
// In orchestra-tools.ts
render_ui: {
  description: 'Render a rich UI component in the chat. Use this when the user asks to see data, lists, tables, metrics, or any structured information. Return a json-render spec.',
  parameters: z.object({
    spec: z.object({
      root: z.string(),
      elements: z.record(z.object({
        type: z.enum(['Card', 'Stack', 'Grid', 'Divider', 'Metric', 'Table', 'List',
                       'Badge', 'CodeBlock', 'KeyValue', 'Button', 'ButtonGroup',
                       'Chip', 'Alert', 'Progress', 'Skeleton']),
        props: z.record(z.unknown()),
        children: z.array(z.string()).optional(),
      })),
    }),
  }),
  execute: async (params) => {
    // The spec is returned as the tool result; MessageBubble detects it
    // and renders via JsonRenderBlock instead of as text
    return { type: 'json_render', spec: params.spec }
  },
}
```

The system prompt includes a brief note: "When showing structured data (tables, metrics, lists, status), use the `render_ui` tool to generate a rich interface. The user will see interactive components, not raw JSON."

Additionally, `catalog.prompt()` from `@json-render/core` generates a schema description that can be appended to the system prompt for additional context about available components and their props.

---

## 7. Error Handling

### Provider Errors

| Error | User sees | Recovery |
|-------|-----------|----------|
| Invalid/expired API key | Alert: "API key invalid for {provider}. Update in Settings > Integrations." with a navigate button | Navigate to settings |
| Rate limit / quota | Alert: "Rate limited by {provider}. Try again in {retryAfter}s or switch provider." | Auto-retry after delay, or user switches provider |
| Network failure mid-stream | Partial message preserved + error chip: "Connection lost. Retry?" | Retry button resends last message |
| Provider unavailable | Alert: "Cannot reach {provider}. Check your connection." | User switches provider or retries |

### Tool Call Errors

| Error | Behavior |
|-------|----------|
| MCP server disconnected | Error fed back to LLM: "Tool {name} unavailable: MCP server disconnected." LLM can suggest alternatives or report to user. |
| Tool execution throws | Error fed back to LLM as tool result: `{ error: "message" }`. LLM can retry, try alternative, or report to user. |
| Orchestra API error (4xx/5xx) | Error fed back to LLM with status code and message. LLM explains to user. |

Tool errors are fed back into the LLM context (not swallowed) so the LLM can reason about failures and communicate them naturally.

### Malformed json-render Specs

If the LLM returns an invalid json-render spec (unknown component type, missing required props):

1. Catch the render error in `JsonRenderBlock`
2. Fall back to showing the raw JSON in a collapsible `CodeBlock`
3. Log the error for debugging
4. Do NOT crash the chat — the message remains visible with the fallback

### Conversation Persistence Clarification

"Per-session" means per logical chat session — conversations are stored in localStorage and persist across app restarts. They are cleared only when the user clicks "Clear chat." On first mount, the hook loads any existing conversation from localStorage.

---

## 8. Voice Input

Reuses the existing Whisper client from `@/lib/whisper-client` (already used in CreateTaskDialog).

### VoiceInput Component

- Hold-to-talk button with mic icon
- Visual states: idle, recording (pulsing red), processing (spinner)
- On release: audio sent to Whisper, transcription inserted into chat input
- User can edit transcription before sending

---

## 9. Module Structure

```
apps/desktop/src/components/embedded-agent/
├── EmbeddedAgentWidget.tsx        # Root: floating button + panel mount
├── EmbeddedAgentPanel.tsx         # Chat panel shell (header, messages, input)
├── EmbeddedAgentProvider.tsx      # React context: state, config, MCP client
├── components/
│   ├── MessageList.tsx            # Scrollable message area
│   ├── MessageBubble.tsx          # Single message (text, rich UI, tool feedback)
│   ├── ChatInput.tsx              # Text input + send + voice
│   ├── VoiceInput.tsx             # Hold-to-talk mic
│   ├── ProviderSelector.tsx       # Provider + model dropdown
│   ├── ToolFeedback.tsx           # Collapsible tool call/result display
│   └── JsonRenderBlock.tsx        # json-render Renderer wrapper
├── hooks/
│   ├── useEmbeddedChat.ts         # Wraps AI SDK streamText + MCP tools
│   ├── useMCPClient.ts            # MCP client lifecycle
│   ├── useProviderConfig.ts       # Provider/model/key management
│   └── useNavigationTools.ts      # App navigation tool bindings
├── tools/
│   ├── orchestra-tools.ts         # Orchestra API tool definitions
│   ├── navigation-tools.ts        # UI navigation tools
│   └── mcp-bridge.ts              # MCP → AI SDK tool bridge
├── lib/
│   ├── providers.ts               # AI SDK provider configs
│   ├── json-render-catalog.ts     # Component + action catalog
│   ├── json-render-registry.tsx   # Registry mapping catalog → React components
│   └── types.ts                   # Shared types
└── index.ts                       # Public exports
```

### Integration Point

Single mount in `App.tsx`:

```tsx
<EmbeddedAgentWidget
  config={config}
  onNavigate={(section, id) => {
    setActiveSection(section as SectionID)
    // optionally open specific issue/project
  }}
/>
```

The widget imports from `@/lib/orchestra-client` for API calls but does NOT import from other feature components. All inter-module communication goes through the `onNavigate` callback and the Orchestra API.

---

## 10. Backend Changes (Minimal for v1)

### New Endpoint: Agent Provider Keys

```
GET  /api/v1/config/agent-providers    — fetch provider API keys (public key only, has_secret flags)
POST /api/v1/config/agent-providers    — save provider API keys
DELETE /api/v1/config/agent-providers  — remove all keys
```

Storage: `~/.orchestra/agent-providers.json`, permissions `0600`.

Response format:
```json
{
  "providers": {
    "openrouter": { "configured": true, "has_key": true },
    "claude": { "configured": false, "has_key": false },
    "openai": { "configured": true, "has_key": true },
    "gemini": { "configured": false, "has_key": false }
  }
}
```

Keys returned in full only on POST confirmation (not exposed via GET for security).

### New Endpoint: MCP Proxy (for stdio servers)

```
GET  /api/v1/mcp/{server}/tools     — list tools from a stdio-based MCP server
POST /api/v1/mcp/{server}/call      — call a tool on a stdio MCP server
```

The backend already manages MCP server lifecycle. These endpoints expose tool discovery and execution to the renderer process for servers that use stdio transport (which the Chromium sandbox cannot access directly). SSE-based MCP servers are connected to directly from the renderer.

### No Other Backend Changes

All other functionality (issue CRUD, orchestrator state, sessions, MCP servers) uses existing endpoints.

---

## 11. Dependencies (New Packages)

```
ai                          — AI SDK 6 core
@ai-sdk/openai              — OpenAI + OpenRouter provider
@ai-sdk/anthropic           — Claude provider
@ai-sdk/google              — Gemini provider
@json-render/core           — Catalog, spec types, streaming
@json-render/react          — React renderer, registry, hooks
@modelcontextprotocol/sdk   — MCP TypeScript SDK
```

---

## 12. Future Considerations (Not in v1)

- **Remote channels** (Tier 4): Discord, Telegram, WhatsApp — share tool definitions via extracted `agent-core` package
- **Backend-proxied inference**: Required for remote channels where API keys can't live client-side
- **Conversation persistence**: Server-side storage for cross-session history
- **Draggable/resizable panel**: v2 UX enhancement
- **Watch mode** (Tier 3): Proactive notifications from orchestrator events
- **Context-aware suggestions** (Tier 3): Suggestions based on current view state
