# Embedded Agent Widget (Tier 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a floating chat widget with multi-provider LLM support, MCP tool integration, json-render generative UI, voice input, and Orchestra API tools — all self-contained in `apps/desktop/src/components/embedded-agent/`.

**Architecture:** Client-side AI SDK `streamText()` calls LLM providers directly from the Electron renderer. MCP TypeScript SDK connects to MCP servers for extensible tools. json-render renders rich inline UI from LLM-generated JSON specs. A React context provider manages chat state, provider config, and MCP connections. Single integration point in App.tsx via `<EmbeddedAgentWidget />`.

**Tech Stack:** AI SDK 6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`), MCP TypeScript SDK (`@modelcontextprotocol/sdk`), json-render (`@json-render/core`, `@json-render/react`), Whisper (existing), React 19, TypeScript, Tailwind v4.

**Spec:** `docs/specs/2026-03-18-embedded-agent-design.md`

---

## File Structure

### New Files (all under `apps/desktop/src/components/embedded-agent/`)

| File | Responsibility |
|------|---------------|
| `index.ts` | Public exports: `EmbeddedAgentWidget` |
| `EmbeddedAgentWidget.tsx` | Root component: floating button + panel toggle |
| `EmbeddedAgentPanel.tsx` | Chat panel shell: header, message area, input area |
| `EmbeddedAgentProvider.tsx` | React context: chat state, provider config, MCP client, tools |
| `components/MessageList.tsx` | Scrollable message area with auto-scroll |
| `components/MessageBubble.tsx` | Single message: markdown, json-render, tool feedback |
| `components/ChatInput.tsx` | Text input + send button + voice toggle |
| `components/VoiceInput.tsx` | Hold-to-talk mic (reuses Whisper client) |
| `components/ProviderSelector.tsx` | Provider + model dropdown |
| `components/ToolFeedback.tsx` | Collapsible tool call/result display |
| `components/JsonRenderBlock.tsx` | json-render Renderer wrapper |
| `hooks/useEmbeddedChat.ts` | Wraps AI SDK `streamText` + message list management |
| `hooks/useMCPClient.ts` | MCP client lifecycle: connect, list tools, call |
| `hooks/useProviderConfig.ts` | Provider/model selection, API key fetching |
| `hooks/useNavigationTools.ts` | App navigation tool definitions + bindings |
| `tools/orchestra-tools.ts` | Tool definitions mapping to Orchestra API |
| `tools/navigation-tools.ts` | UI navigation tools (setActiveSection, open dialogs) |
| `tools/mcp-bridge.ts` | Converts MCP tools to AI SDK tool format |
| `lib/providers.ts` | AI SDK provider factory configs |
| `lib/json-render-catalog.ts` | Component + action catalog (defineCatalog) |
| `lib/json-render-registry.tsx` | Registry mapping catalog to React components |
| `lib/types.ts` | Shared types (Message, ProviderConfig, etc.) |

### Modified Files

| File | Change |
|------|--------|
| `apps/desktop/src/App.tsx` | Mount `<EmbeddedAgentWidget />`, pass `onNavigate` callback |
| `apps/desktop/src/lib/orchestra-client.ts` | Add `fetchAgentProviderKeys()`, `saveAgentProviderKeys()` |
| `apps/desktop/package.json` | Add new dependencies |
| `apps/backend/internal/api/router.go` | Add agent-provider config routes + MCP proxy routes |
| `apps/backend/internal/api/agent_providers.go` | New: handler for provider key CRUD |
| `apps/backend/internal/api/mcp_proxy.go` | New: handler for MCP stdio proxy |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Install AI SDK packages**

```bash
cd apps/desktop
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google --legacy-peer-deps
```

- [ ] **Step 2: Install json-render packages**

```bash
npm install @json-render/core @json-render/react --legacy-peer-deps
```

- [ ] **Step 3: Install MCP SDK**

```bash
npm install @modelcontextprotocol/sdk --legacy-peer-deps
```

- [ ] **Step 4: Verify install and typecheck**

```bash
npx tsc --noEmit
```

Expected: no new type errors

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install AI SDK, json-render, and MCP SDK dependencies"
```

---

## Task 2: Shared Types

**Files:**
- Create: `apps/desktop/src/components/embedded-agent/lib/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// lib/types.ts

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
  toolCalls?: ToolCallInfo[]
  toolResults?: ToolResultInfo[]
  jsonRenderSpec?: JsonRenderSpec | null
}

export type ToolCallInfo = {
  toolName: string
  args: Record<string, unknown>
}

export type ToolResultInfo = {
  toolName: string
  result: unknown
  isError?: boolean
}

export type JsonRenderSpec = {
  root: string
  elements: Record<string, {
    type: string
    props: Record<string, unknown>
    children?: string[]
  }>
}

export type ChatProviderConfig = {
  providerId: 'openrouter' | 'claude' | 'openai' | 'gemini'
  modelId: string
  apiKey: string
}

export type AgentProviderKeys = {
  providers: Record<string, {
    configured: boolean
    api_key?: string
  }>
}

export type EmbeddedAgentContextValue = {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (text: string) => Promise<void>
  stop: () => void
  clearChat: () => void
  providerConfig: ChatProviderConfig
  setProviderConfig: (config: ChatProviderConfig) => void
  availableKeys: Record<string, string>
  updateProvider: (providerId: ChatProviderConfig['providerId'], modelId?: string) => void
  isPanelOpen: boolean
  togglePanel: () => void
}

export const CHAT_PROVIDERS = [
  { id: 'openrouter' as const, label: 'OpenRouter', models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-pro'] },
  { id: 'claude' as const, label: 'Claude', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'] },
  { id: 'openai' as const, label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'] },
  { id: 'gemini' as const, label: 'Gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
] as const
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/embedded-agent/lib/types.ts
git commit -m "feat(embedded-agent): add shared type definitions"
```

---

## Task 3: Provider Configuration Hook

**Files:**
- Create: `apps/desktop/src/components/embedded-agent/lib/providers.ts`
- Create: `apps/desktop/src/components/embedded-agent/hooks/useProviderConfig.ts`
- Modify: `apps/desktop/src/lib/orchestra-client.ts` (add API key fetch functions)

- [ ] **Step 1: Add API key fetch functions to orchestra-client**

Add to the end of `apps/desktop/src/lib/orchestra-client.ts`:

```typescript
/** Fetches configured LLM provider API keys for the embedded agent. */
export async function fetchAgentProviderKeys(config: BackendConfig): Promise<{
  providers: Record<string, { configured: boolean; api_key?: string }>
}> {
  return requestJSON(config, '/api/v1/config/agent-providers')
}

/** Saves an LLM provider API key for the embedded agent. */
export async function saveAgentProviderKey(
  config: BackendConfig,
  providerId: string,
  apiKey: string,
): Promise<void> {
  await requestJSON(config, '/api/v1/config/agent-providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerId, api_key: apiKey }),
  })
}
```

- [ ] **Step 2: Create provider factory**

Create `apps/desktop/src/components/embedded-agent/lib/providers.ts`:

```typescript
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export function createProvider(providerId: string, apiKey: string) {
  switch (providerId) {
    case 'openrouter':
      return createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })
    case 'openai':
      return createOpenAI({ apiKey })
    case 'claude':
      return createAnthropic({ apiKey })
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })
    default:
      throw new Error(`Unknown provider: ${providerId}`)
  }
}
```

- [ ] **Step 3: Create useProviderConfig hook**

Create `apps/desktop/src/components/embedded-agent/hooks/useProviderConfig.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react'
import { fetchAgentProviderKeys } from '@/lib/orchestra-client'
import type { BackendConfig } from '@/lib/orchestra-client'
import { type ChatProviderConfig, CHAT_PROVIDERS } from '../lib/types'

export function useProviderConfig(config: BackendConfig | null) {
  const [providerConfig, setProviderConfig] = useState<ChatProviderConfig>({
    providerId: 'openrouter',
    modelId: CHAT_PROVIDERS[0].models[0],
    apiKey: '',
  })
  const [availableKeys, setAvailableKeys] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!config) return
    setLoading(true)
    fetchAgentProviderKeys(config)
      .then((result) => {
        const keys: Record<string, string> = {}
        for (const [id, info] of Object.entries(result.providers)) {
          if (info.configured && info.api_key) {
            keys[id] = info.api_key
          }
        }
        setAvailableKeys(keys)

        // Auto-select first configured provider
        const firstConfigured = CHAT_PROVIDERS.find(p => keys[p.id])
        if (firstConfigured) {
          setProviderConfig({
            providerId: firstConfigured.id,
            modelId: firstConfigured.models[0],
            apiKey: keys[firstConfigured.id],
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [config])

  const updateProvider = useCallback((providerId: ChatProviderConfig['providerId'], modelId?: string) => {
    const provider = CHAT_PROVIDERS.find(p => p.id === providerId)
    if (!provider) return
    setProviderConfig({
      providerId,
      modelId: modelId ?? provider.models[0],
      apiKey: availableKeys[providerId] ?? '',
    })
  }, [availableKeys])

  return { providerConfig, setProviderConfig, updateProvider, availableKeys, loading }
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/embedded-agent/lib/providers.ts \
        src/components/embedded-agent/hooks/useProviderConfig.ts \
        src/lib/orchestra-client.ts
git commit -m "feat(embedded-agent): provider config hook and API key integration"
```

---

## Task 4: Orchestra API Tools

**Files:**
- Create: `apps/desktop/src/components/embedded-agent/tools/orchestra-tools.ts`
- Create: `apps/desktop/src/components/embedded-agent/tools/navigation-tools.ts`

- [ ] **Step 1: Create Orchestra API tools**

Create `apps/desktop/src/components/embedded-agent/tools/orchestra-tools.ts`:

```typescript
import { tool } from 'ai'
import { z } from 'zod'
import type { BackendConfig } from '@/lib/orchestra-client'
import {
  fetchIssues,
  createIssue,
  updateIssue,
  deleteIssue,
  fetchState,
  fetchProjects,
  stopIssueSession,
} from '@/lib/orchestra-client'

export function createOrchestraTools(config: BackendConfig) {
  return {
    list_issues: tool({
      description: 'List tasks/issues. Optionally filter by state, project, or assignee.',
      parameters: z.object({
        state: z.string().optional().describe('Filter by state: backlog, in progress, done, cancelled'),
        project_id: z.string().optional().describe('Filter by project ID'),
        assignee: z.string().optional().describe('Filter by assignee'),
      }),
      execute: async (params) => {
        const issues = await fetchIssues(config, params.state ? [params.state] : undefined, params.project_id, params.assignee)
        return { issues: issues.slice(0, 50) } // limit for context
      },
    }),

    create_issue: tool({
      description: 'Create a new task/issue.',
      parameters: z.object({
        title: z.string().describe('Issue title'),
        description: z.string().optional().describe('Issue description'),
        state: z.string().optional().describe('Initial state (default: backlog)'),
        provider: z.string().optional().describe('Agent provider to assign (claude, codex, gemini, opencode)'),
      }),
      execute: async (params) => {
        const issue = await createIssue(config, {
          title: params.title,
          description: params.description ?? '',
          state: params.state ?? 'backlog',
          assignee_id: params.provider ? `agent-${params.provider}` : '',
          project_id: '',
        })
        return { created: issue }
      },
    }),

    update_issue: tool({
      description: 'Update an existing issue (change state, title, assignee, provider).',
      parameters: z.object({
        identifier: z.string().describe('Issue identifier (e.g. "12" or issue ID)'),
        state: z.string().optional(),
        title: z.string().optional(),
        provider: z.string().optional(),
        assignee_id: z.string().optional(),
      }),
      execute: async (params) => {
        const { identifier, ...updates } = params
        const result = await updateIssue(config, identifier, updates)
        return { updated: result }
      },
    }),

    delete_issue: tool({
      description: 'Delete an issue permanently.',
      parameters: z.object({
        identifier: z.string().describe('Issue identifier'),
      }),
      execute: async (params) => {
        await deleteIssue(config, params.identifier)
        return { deleted: true, identifier: params.identifier }
      },
    }),

    get_orchestrator_state: tool({
      description: 'Get current orchestrator state: running sessions, retrying issues, token totals.',
      parameters: z.object({}),
      execute: async () => {
        const state = await fetchState(config)
        return {
          running: state.running?.length ?? 0,
          retrying: state.retrying?.length ?? 0,
          running_details: state.running?.slice(0, 10),
          retrying_details: state.retrying?.slice(0, 10),
          totals: state.totals,
        }
      },
    }),

    dispatch_agent: tool({
      description: 'Dispatch an agent to work on an issue by setting it to "in progress".',
      parameters: z.object({
        identifier: z.string().describe('Issue identifier'),
        provider: z.string().optional().describe('Agent provider (claude, codex, gemini, opencode). Defaults to claude.'),
      }),
      execute: async (params) => {
        const result = await updateIssue(config, params.identifier, {
          state: 'in progress',
          provider: params.provider ?? 'claude',
        })
        return { dispatched: result }
      },
    }),

    stop_session: tool({
      description: 'Stop the active agent session for an issue.',
      parameters: z.object({
        identifier: z.string().describe('Issue identifier'),
      }),
      execute: async (params) => {
        await stopIssueSession(config, params.identifier)
        return { stopped: true, identifier: params.identifier }
      },
    }),

    list_projects: tool({
      description: 'List all projects in the workspace.',
      parameters: z.object({}),
      execute: async () => {
        const projects = await fetchProjects(config)
        return { projects }
      },
    }),

    render_ui: tool({
      description: 'Render a rich UI component in the chat. Use this when the user asks to see data, lists, tables, metrics, or any structured information. Return a json-render spec with a root key and elements map.',
      parameters: z.object({
        spec: z.object({
          root: z.string(),
          elements: z.record(z.object({
            type: z.string(),
            props: z.record(z.unknown()),
            children: z.array(z.string()).optional(),
          })),
        }),
      }),
      execute: async (params) => {
        return { type: 'json_render', spec: params.spec }
      },
    }),
  }
}
```

- [ ] **Step 2: Create navigation tools**

Create `apps/desktop/src/components/embedded-agent/tools/navigation-tools.ts`:

```typescript
import { tool } from 'ai'
import { z } from 'zod'

const SECTIONS = ['ISSUES', 'PROJECTS', 'CONSOLE', 'AGENTS', 'WAREHOUSE', 'SANDBOX', 'SETTINGS', 'DOCS'] as const

export function createNavigationTools(onNavigate: (section: string, id?: string) => void) {
  return {
    navigate_to: tool({
      description: 'Navigate the Orchestra UI to a specific section. Use this when the user says "go to", "show me", "open" a section.',
      parameters: z.object({
        section: z.enum(SECTIONS).describe('Section to navigate to'),
      }),
      execute: async (params) => {
        onNavigate(params.section)
        return { navigated: true, section: params.section }
      },
    }),

    open_settings_tab: tool({
      description: 'Open a specific settings tab (backend, agents, integrations, shortcuts, notifications).',
      parameters: z.object({
        tab: z.enum(['backend', 'agents', 'integrations', 'shortcuts', 'notifications']),
      }),
      execute: async (params) => {
        onNavigate('SETTINGS', params.tab)
        return { navigated: true, section: 'SETTINGS', tab: params.tab }
      },
    }),
  }
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/embedded-agent/tools/
git commit -m "feat(embedded-agent): Orchestra API and navigation tool definitions"
```

---

## Task 5: json-render Catalog & Registry

**Files:**
- Create: `apps/desktop/src/components/embedded-agent/lib/json-render-catalog.ts`
- Create: `apps/desktop/src/components/embedded-agent/lib/json-render-registry.tsx`
- Create: `apps/desktop/src/components/embedded-agent/components/JsonRenderBlock.tsx`

- [ ] **Step 1: Create the component catalog**

Create `apps/desktop/src/components/embedded-agent/lib/json-render-catalog.ts`:

```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const catalog = defineCatalog({
  components: {
    Card: {
      props: z.object({
        title: z.string(),
        description: z.string().nullable().optional(),
        padding: z.enum(['sm', 'md', 'lg']).nullable().optional(),
      }),
      slots: ['default'],
      description: 'Container card for grouping content',
    },
    Stack: {
      props: z.object({
        direction: z.enum(['horizontal', 'vertical']).optional().default('vertical'),
        gap: z.enum(['sm', 'md', 'lg']).optional().default('md'),
        align: z.enum(['start', 'center', 'end']).optional(),
      }),
      slots: ['default'],
      description: 'Flex container for layout',
    },
    Divider: {
      props: z.object({
        label: z.string().optional(),
      }),
      description: 'Horizontal rule with optional label',
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        format: z.enum(['currency', 'percent', 'number']).optional(),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
        trendValue: z.string().optional(),
      }),
      description: 'Display a single metric value',
    },
    Table: {
      props: z.object({
        columns: z.array(z.object({
          key: z.string(),
          label: z.string(),
          align: z.enum(['left', 'center', 'right']).optional(),
        })),
        rows: z.array(z.record(z.union([z.string(), z.number()]))),
        striped: z.boolean().optional(),
      }),
      description: 'Data table with columns and rows',
    },
    Badge: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['default', 'success', 'warning', 'error', 'info']).optional(),
      }),
      description: 'Status badge/pill',
    },
    CodeBlock: {
      props: z.object({
        code: z.string(),
        language: z.string().optional(),
        title: z.string().optional(),
      }),
      description: 'Code block with optional syntax label',
    },
    KeyValue: {
      props: z.object({
        pairs: z.array(z.object({ key: z.string(), value: z.string() })),
      }),
      description: 'Key-value pair display',
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['primary', 'secondary', 'destructive', 'ghost']).optional(),
        action: z.string(),
        params: z.record(z.unknown()).optional(),
      }),
      description: 'Action button that fires a catalog action',
    },
    ButtonGroup: {
      props: z.object({
        direction: z.enum(['horizontal', 'vertical']).optional().default('horizontal'),
      }),
      slots: ['default'],
      description: 'Group of buttons',
    },
    Alert: {
      props: z.object({
        message: z.string(),
        variant: z.enum(['info', 'success', 'warning', 'error']).optional(),
        title: z.string().optional(),
      }),
      description: 'Alert/notice block',
    },
    Progress: {
      props: z.object({
        value: z.number(),
        max: z.number().optional().default(100),
        label: z.string().optional(),
      }),
      description: 'Progress bar',
    },
  },
  actions: {
    navigate: {
      params: z.object({ section: z.string(), id: z.string().optional() }),
      description: 'Navigate to a section of the app',
    },
    send_chat: {
      params: z.object({ message: z.string() }),
      description: 'Send a follow-up message in the chat',
    },
    copy_to_clipboard: {
      params: z.object({ text: z.string() }),
      description: 'Copy text to clipboard',
    },
  },
})
```

- [ ] **Step 2: Create the registry (maps catalog to React components)**

Create `apps/desktop/src/components/embedded-agent/lib/json-render-registry.tsx`:

```tsx
import { defineRegistry } from '@json-render/react'
import { catalog } from './json-render-catalog'

const GAP = { sm: 'gap-1', md: 'gap-3', lg: 'gap-5' } as const
const PAD = { sm: 'p-2', md: 'p-4', lg: 'p-6' } as const
const BADGE_VARIANT = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-500',
  error: 'bg-red-500/10 text-red-500',
  info: 'bg-blue-500/10 text-blue-500',
} as const
const ALERT_VARIANT = {
  info: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
  success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  warning: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  error: 'border-red-500/30 bg-red-500/5 text-red-400',
} as const
const BTN_VARIANT = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-muted/50 text-foreground hover:bg-muted',
  destructive: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
} as const

export function createAgentRegistry(
  onAction: (action: string, params: Record<string, unknown>) => void,
) {
  return defineRegistry(catalog, {
    components: {
      Card: ({ props, children }) => (
        <div className={`rounded-xl border border-border/30 bg-card ${PAD[props.padding ?? 'md']}`}>
          {props.title && <p className="text-sm font-bold mb-2">{props.title}</p>}
          {props.description && <p className="text-xs text-muted-foreground mb-3">{props.description}</p>}
          {children}
        </div>
      ),
      Stack: ({ props, children }) => (
        <div className={`flex ${props.direction === 'horizontal' ? 'flex-row items-center' : 'flex-col'} ${GAP[props.gap ?? 'md']} ${props.align ? `items-${props.align}` : ''}`}>
          {children}
        </div>
      ),
      Divider: ({ props }) => (
        <div className="flex items-center gap-2 my-2">
          <div className="flex-1 h-px bg-border/40" />
          {props.label && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{props.label}</span>}
          <div className="flex-1 h-px bg-border/40" />
        </div>
      ),
      Metric: ({ props }) => (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{props.label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black">{props.value}</span>
            {props.trend && (
              <span className={`text-xs font-bold ${props.trend === 'up' ? 'text-emerald-500' : props.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
                {props.trend === 'up' ? '+' : props.trend === 'down' ? '-' : ''}{props.trendValue ?? ''}
              </span>
            )}
          </div>
        </div>
      ),
      Table: ({ props }) => (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                {props.columns.map((col) => (
                  <th key={col.key} className={`py-1.5 px-2 font-bold uppercase tracking-wider text-muted-foreground text-[10px] text-${col.align ?? 'left'}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row, i) => (
                <tr key={i} className={`border-b border-border/10 ${props.striped && i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                  {props.columns.map((col) => (
                    <td key={col.key} className={`py-1.5 px-2 text-${col.align ?? 'left'}`}>
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
      Badge: ({ props }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${BADGE_VARIANT[props.variant ?? 'default']}`}>
          {props.label}
        </span>
      ),
      CodeBlock: ({ props }) => (
        <div className="rounded-lg border border-border/30 overflow-hidden">
          {props.title && (
            <div className="bg-muted/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/20">
              {props.title}{props.language ? ` (${props.language})` : ''}
            </div>
          )}
          <pre className="p-3 text-xs font-mono overflow-x-auto bg-background/50">
            <code>{props.code}</code>
          </pre>
        </div>
      ),
      KeyValue: ({ props }) => (
        <div className="space-y-1">
          {props.pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium min-w-[80px]">{pair.key}</span>
              <span className="font-mono">{pair.value}</span>
            </div>
          ))}
        </div>
      ),
      Button: ({ props }) => (
        <button
          onClick={() => onAction(props.action, props.params ?? {})}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${BTN_VARIANT[props.variant ?? 'primary']}`}
        >
          {props.label}
        </button>
      ),
      ButtonGroup: ({ props, children }) => (
        <div className={`flex ${props.direction === 'vertical' ? 'flex-col' : 'flex-row'} gap-2`}>
          {children}
        </div>
      ),
      Alert: ({ props }) => (
        <div className={`rounded-lg border px-3 py-2.5 text-xs ${ALERT_VARIANT[props.variant ?? 'info']}`}>
          {props.title && <p className="font-bold mb-1">{props.title}</p>}
          <p>{props.message}</p>
        </div>
      ),
      Progress: ({ props }) => (
        <div className="space-y-1">
          {props.label && <p className="text-[10px] font-bold text-muted-foreground">{props.label}</p>}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (props.value / (props.max ?? 100)) * 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    actions: {
      navigate: (params) => onAction('navigate', params),
      send_chat: (params) => onAction('send_chat', params),
      copy_to_clipboard: async (params) => {
        await navigator.clipboard.writeText(String(params.text))
      },
    },
  })
}
```

- [ ] **Step 3: Create JsonRenderBlock component**

Create `apps/desktop/src/components/embedded-agent/components/JsonRenderBlock.tsx`:

```tsx
import { useMemo } from 'react'
import { Renderer, StateProvider, ActionProvider } from '@json-render/react'
import { createAgentRegistry } from '../lib/json-render-registry'
import type { JsonRenderSpec } from '../lib/types'

export function JsonRenderBlock({
  spec,
  state,
  onAction,
}: {
  spec: JsonRenderSpec
  state?: Record<string, unknown>
  onAction: (action: string, params: Record<string, unknown>) => void
}) {
  const registryResult = useMemo(() => {
    try {
      return { ok: true as const, ...createAgentRegistry(onAction) }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  }, [onAction])

  if (!registryResult.ok) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="text-[10px] font-bold text-amber-500 mb-1">Render error</p>
        <pre className="text-[10px] font-mono text-muted-foreground overflow-auto max-h-[100px]">
          {registryResult.error}
        </pre>
        <details className="mt-2">
          <summary className="text-[10px] text-muted-foreground cursor-pointer">Raw spec</summary>
          <pre className="text-[10px] font-mono mt-1 overflow-auto max-h-[200px]">
            {JSON.stringify(spec, null, 2)}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <StateProvider initialState={state ?? {}}>
      <ActionProvider handlers={registryResult.handlers}>
        <Renderer spec={spec} registry={registryResult.registry} />
      </ActionProvider>
    </StateProvider>
  )
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/embedded-agent/lib/json-render-catalog.ts \
        src/components/embedded-agent/lib/json-render-registry.tsx \
        src/components/embedded-agent/components/JsonRenderBlock.tsx
git commit -m "feat(embedded-agent): json-render catalog, registry, and render component"
```

---

## Task 6: Chat Hook (useEmbeddedChat)

**Files:**
- Create: `apps/desktop/src/components/embedded-agent/hooks/useEmbeddedChat.ts`

- [ ] **Step 1: Create the chat hook**

Create `apps/desktop/src/components/embedded-agent/hooks/useEmbeddedChat.ts`:

```typescript
import { useCallback, useRef, useState } from 'react'
import { streamText, type CoreTool } from 'ai'
import { createProvider } from '../lib/providers'
import type { ChatMessage, ChatProviderConfig } from '../lib/types'

const STORAGE_KEY = 'orchestra-embedded-agent-chat'

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw).map((m: ChatMessage) => ({
      ...m,
      createdAt: new Date(m.createdAt),
    }))
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch { /* quota exceeded — silent fail */ }
}

const SYSTEM_PROMPT = `You are Orchestra Agent, an ML-powered assistant embedded in the Orchestra desktop application. You help users manage tasks, navigate the UI, inspect agent sessions, and work with projects.

When showing structured data (tables, metrics, lists, status), use the render_ui tool to generate a rich interface. The user will see interactive components, not raw JSON.

When the user asks you to "go to" or "show" a section, use the navigate_to tool.

Be concise. Use the tools available to you. Prefer action over explanation.`

export function useEmbeddedChat(
  providerConfig: ChatProviderConfig,
  tools: Record<string, CoreTool>,
) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !providerConfig.apiKey) return

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      createdAt: new Date(),
    }

    const updated = [...messages, userMsg]
    setMessages(updated)
    saveMessages(updated)
    setIsStreaming(true)

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: new Date(),
      toolCalls: [],
      toolResults: [],
    }

    abortRef.current = new AbortController()

    try {
      const provider = createProvider(providerConfig.providerId, providerConfig.apiKey)
      const result = streamText({
        model: provider(providerConfig.modelId),
        system: SYSTEM_PROMPT,
        messages: updated.map(m => ({ role: m.role, content: m.content })),
        tools,
        maxSteps: 10,
        abortSignal: abortRef.current.signal,
        onStepFinish: ({ toolCalls, toolResults }) => {
          if (toolCalls && toolCalls.length > 0) {
            assistantMsg.toolCalls = [
              ...(assistantMsg.toolCalls ?? []),
              ...toolCalls.map(tc => ({ toolName: tc.toolName, args: tc.args as Record<string, unknown> })),
            ]
          }
          if (toolResults && toolResults.length > 0) {
            assistantMsg.toolResults = [
              ...(assistantMsg.toolResults ?? []),
              ...toolResults.map(tr => ({ toolName: tr.toolName, result: tr.result })),
            ]
          }
        },
      })

      for await (const chunk of result.textStream) {
        assistantMsg.content += chunk
        setMessages([...updated, { ...assistantMsg }])
      }

      // Check for json-render spec in tool results
      const renderResult = assistantMsg.toolResults?.find(
        tr => tr.toolName === 'render_ui' && tr.result && typeof tr.result === 'object' && 'type' in (tr.result as Record<string, unknown>) && (tr.result as Record<string, unknown>).type === 'json_render'
      )
      if (renderResult) {
        assistantMsg.jsonRenderSpec = (renderResult.result as { spec: ChatMessage['jsonRenderSpec'] }).spec
      }

      const finalMessages = [...updated, assistantMsg]
      setMessages(finalMessages)
      saveMessages(finalMessages)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      assistantMsg.content += `\n\n> Error: ${err instanceof Error ? err.message : String(err)}`
      const finalMessages = [...updated, assistantMsg]
      setMessages(finalMessages)
      saveMessages(finalMessages)
    } finally {
      setIsStreaming(false)
    }
  }, [messages, providerConfig, tools])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { messages, sendMessage, isStreaming, stop, clearChat }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/embedded-agent/hooks/useEmbeddedChat.ts
git commit -m "feat(embedded-agent): useEmbeddedChat hook with streamText and tool support"
```

---

## Task 7: UI Components

**Files:**
- Create: `apps/desktop/src/components/embedded-agent/components/MessageBubble.tsx`
- Create: `apps/desktop/src/components/embedded-agent/components/MessageList.tsx`
- Create: `apps/desktop/src/components/embedded-agent/components/ChatInput.tsx`
- Create: `apps/desktop/src/components/embedded-agent/components/ToolFeedback.tsx`
- Create: `apps/desktop/src/components/embedded-agent/components/ProviderSelector.tsx`
- Create: `apps/desktop/src/components/embedded-agent/components/VoiceInput.tsx`

- [ ] **Step 1: Create ToolFeedback component**

Create `apps/desktop/src/components/embedded-agent/components/ToolFeedback.tsx`:

```tsx
import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import type { ToolCallInfo, ToolResultInfo } from '../lib/types'

export function ToolFeedback({
  toolCalls,
  toolResults,
}: {
  toolCalls: ToolCallInfo[]
  toolResults: ToolResultInfo[]
}) {
  const [expanded, setExpanded] = useState(false)

  if (toolCalls.length === 0) return null

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Wrench className="h-3 w-3" />
        <span className="font-bold uppercase tracking-wider">
          {toolCalls.length} tool{toolCalls.length > 1 ? 's' : ''} called
        </span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5 pl-5">
          {toolCalls.map((tc, i) => (
            <div key={i} className="rounded-lg border border-border/20 bg-muted/10 p-2 text-[10px]">
              <p className="font-bold font-mono text-foreground/80">{tc.toolName}</p>
              <pre className="mt-1 text-muted-foreground overflow-auto max-h-[60px] font-mono">
                {JSON.stringify(tc.args, null, 2)}
              </pre>
              {toolResults[i] && (
                <div className={`mt-1.5 pt-1.5 border-t border-border/20 ${toolResults[i].isError ? 'text-red-500' : 'text-emerald-500'}`}>
                  <pre className="overflow-auto max-h-[60px] font-mono">
                    {JSON.stringify(toolResults[i].result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create MessageBubble component**

Create `apps/desktop/src/components/embedded-agent/components/MessageBubble.tsx`:

```tsx
import type { ChatMessage } from '../lib/types'
import { ToolFeedback } from './ToolFeedback'
import { JsonRenderBlock } from './JsonRenderBlock'

export function MessageBubble({
  message,
  onAction,
}: {
  message: ChatMessage
  onAction: (action: string, params: Record<string, unknown>) => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted/30 border border-border/20 text-foreground'
      }`}>
        {/* Tool feedback (assistant only) */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolFeedback
            toolCalls={message.toolCalls}
            toolResults={message.toolResults ?? []}
          />
        )}

        {/* json-render spec (assistant only) */}
        {!isUser && message.jsonRenderSpec && (
          <div className="my-2">
            <JsonRenderBlock spec={message.jsonRenderSpec} onAction={onAction} />
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create MessageList component**

Create `apps/desktop/src/components/embedded-agent/components/MessageList.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../lib/types'
import { MessageBubble } from './MessageBubble'

export function MessageList({
  messages,
  isStreaming,
  onAction,
}: {
  messages: ChatMessage[]
  isStreaming: boolean
  onAction: (action: string, params: Record<string, unknown>) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Orchestra Agent</p>
          <p className="text-xs text-muted-foreground/60 max-w-[240px]">
            Ask me to create tasks, check running agents, navigate the app, or anything else.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onAction={onAction} />
      ))}
      {isStreaming && (
        <div className="flex justify-start">
          <div className="flex gap-1 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 4: Create ChatInput component**

Create `apps/desktop/src/components/embedded-agent/components/ChatInput.tsx`:

```tsx
import { useState, type KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
}: {
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}) {
  const [input, setInput] = useState('')

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border/30 p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Orchestra Agent..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none rounded-lg border border-border/40 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none disabled:opacity-50"
          style={{ minHeight: '36px', maxHeight: '120px' }}
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create ProviderSelector component**

Create `apps/desktop/src/components/embedded-agent/components/ProviderSelector.tsx`:

```tsx
import { CHAT_PROVIDERS, type ChatProviderConfig } from '../lib/types'

export function ProviderSelector({
  config,
  availableKeys,
  onUpdate,
}: {
  config: ChatProviderConfig
  availableKeys: Record<string, string>
  onUpdate: (providerId: ChatProviderConfig['providerId'], modelId?: string) => void
}) {
  const currentProvider = CHAT_PROVIDERS.find(p => p.id === config.providerId)

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={config.providerId}
        onChange={(e) => onUpdate(e.target.value as ChatProviderConfig['providerId'])}
        className="h-7 rounded-md border border-border/40 bg-background px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground focus:outline-none focus:border-primary"
      >
        {CHAT_PROVIDERS.map((p) => (
          <option key={p.id} value={p.id} disabled={!availableKeys[p.id]}>
            {p.label}{!availableKeys[p.id] ? ' (no key)' : ''}
          </option>
        ))}
      </select>
      {currentProvider && (
        <select
          value={config.modelId}
          onChange={(e) => onUpdate(config.providerId, e.target.value)}
          className="h-7 rounded-md border border-border/40 bg-background px-2 text-[10px] font-mono text-muted-foreground focus:outline-none focus:border-primary"
        >
          {currentProvider.models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create VoiceInput component**

Create `apps/desktop/src/components/embedded-agent/components/VoiceInput.tsx`:

```tsx
import { useCallback, useRef, useState } from 'react'
import { Mic, Loader2 } from 'lucide-react'
import { getWhisperClient, type WhisperStatus } from '@/lib/whisper-client'

export function VoiceInput({
  onTranscription,
  disabled,
}: {
  onTranscription: (text: string) => void
  disabled?: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<WhisperStatus>('idle')
  const clientRef = useRef(getWhisperClient((s: WhisperStatus) => setStatus(s)))

  const handlePointerDown = useCallback(async () => {
    if (disabled || processing) return
    try {
      await clientRef.current.startRecording()
      setRecording(true)
    } catch {
      /* mic permission denied — silent */
    }
  }, [disabled, processing])

  const handlePointerUp = useCallback(async () => {
    if (!recording) return
    setRecording(false)
    setProcessing(true)
    try {
      const audio = await clientRef.current.stopRecording()
      const text = await clientRef.current.transcribe(audio)
      if (text.trim()) onTranscription(text.trim())
    } catch {
      /* transcription error — silent */
    } finally {
      setProcessing(false)
    }
  }, [recording, onTranscription])

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
        recording
          ? 'bg-red-500 text-white animate-pulse'
          : processing
            ? 'bg-muted text-muted-foreground'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={recording ? 'Release to transcribe' : 'Hold to talk'}
    >
      {processing ? <Loader2 className="h-4 w-4 animate-spin-smooth" /> : <Mic className="h-4 w-4" />}
    </button>
  )
}
```

- [ ] **Step 7: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/components/embedded-agent/components/
git commit -m "feat(embedded-agent): chat UI components — messages, input, voice, provider selector"
```

---

## Task 8: Panel, Widget, Provider & App Integration

**Files:**
- Create: `apps/desktop/src/components/embedded-agent/EmbeddedAgentProvider.tsx`
- Create: `apps/desktop/src/components/embedded-agent/EmbeddedAgentPanel.tsx`
- Create: `apps/desktop/src/components/embedded-agent/EmbeddedAgentWidget.tsx`
- Create: `apps/desktop/src/components/embedded-agent/index.ts`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create EmbeddedAgentProvider**

Create `apps/desktop/src/components/embedded-agent/EmbeddedAgentProvider.tsx`:

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { BackendConfig } from '@/lib/orchestra-client'
import { useEmbeddedChat } from './hooks/useEmbeddedChat'
import { useProviderConfig } from './hooks/useProviderConfig'
import { createOrchestraTools } from './tools/orchestra-tools'
import { createNavigationTools } from './tools/navigation-tools'
import type { EmbeddedAgentContextValue } from './lib/types'

const EmbeddedAgentContext = createContext<EmbeddedAgentContextValue | null>(null)

export function useEmbeddedAgent() {
  const ctx = useContext(EmbeddedAgentContext)
  if (!ctx) throw new Error('useEmbeddedAgent must be inside EmbeddedAgentProvider')
  return ctx
}

export function EmbeddedAgentProvider({
  config,
  onNavigate,
  children,
}: {
  config: BackendConfig | null
  onNavigate: (section: string, id?: string) => void
  children: ReactNode
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const { providerConfig, setProviderConfig, updateProvider, availableKeys, loading } = useProviderConfig(config)

  const tools = useMemo(() => {
    if (!config) return {}
    return {
      ...createOrchestraTools(config),
      ...createNavigationTools(onNavigate),
    }
  }, [config, onNavigate])

  const { messages, sendMessage, isStreaming, stop, clearChat } = useEmbeddedChat(providerConfig, tools)

  const togglePanel = () => setIsPanelOpen(prev => !prev)

  const value: EmbeddedAgentContextValue = {
    messages,
    isStreaming,
    sendMessage,
    stop,
    clearChat,
    providerConfig,
    setProviderConfig,
    availableKeys,
    updateProvider,
    isPanelOpen,
    togglePanel,
  }

  return (
    <EmbeddedAgentContext.Provider value={value}>
      {children}
    </EmbeddedAgentContext.Provider>
  )
}
```

- [ ] **Step 2: Create EmbeddedAgentPanel**

Create `apps/desktop/src/components/embedded-agent/EmbeddedAgentPanel.tsx`:

```tsx
import { X, Trash2 } from 'lucide-react'
import { useEmbeddedAgent } from './EmbeddedAgentProvider'
import { MessageList } from './components/MessageList'
import { ChatInput } from './components/ChatInput'
import { ProviderSelector } from './components/ProviderSelector'
import type { ChatProviderConfig } from './lib/types'

export function EmbeddedAgentPanel({
  availableKeys,
  onUpdateProvider,
}: {
  availableKeys: Record<string, string>
  onUpdateProvider: (providerId: ChatProviderConfig['providerId'], modelId?: string) => void
}) {
  const {
    messages,
    isStreaming,
    sendMessage,
    stop,
    clearChat,
    providerConfig,
    togglePanel,
  } = useEmbeddedAgent()

  const handleAction = (action: string, params: Record<string, unknown>) => {
    if (action === 'send_chat' && typeof params.message === 'string') {
      sendMessage(params.message)
    }
    if (action === 'navigate') {
      // Navigation is handled by the tools directly
    }
  }

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col w-[420px] h-[620px] rounded-2xl border border-border/30 bg-card shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">Agent</span>
          <ProviderSelector
            config={providerConfig}
            availableKeys={availableKeys}
            onUpdate={onUpdateProvider}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={togglePanel}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onAction={handleAction}
      />

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!providerConfig.apiKey}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create EmbeddedAgentWidget**

Create `apps/desktop/src/components/embedded-agent/EmbeddedAgentWidget.tsx`:

```tsx
import { useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import type { BackendConfig } from '@/lib/orchestra-client'
import { EmbeddedAgentProvider, useEmbeddedAgent } from './EmbeddedAgentProvider'
import { EmbeddedAgentPanel } from './EmbeddedAgentPanel'

function WidgetInner() {
  const { isPanelOpen, togglePanel, isStreaming, availableKeys, updateProvider } = useEmbeddedAgent()

  // Keyboard shortcut: Ctrl+.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault()
        togglePanel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePanel])

  return (
    <>
      {/* Floating button */}
      <button
        onClick={togglePanel}
        className={`fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all ${
          isStreaming ? 'animate-pulse' : ''
        }`}
        title="Orchestra Agent (Ctrl+.)"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat panel */}
      {isPanelOpen && (
        <EmbeddedAgentPanel
          availableKeys={availableKeys}
          onUpdateProvider={updateProvider}
        />
      )}
    </>
  )
}

export function EmbeddedAgentWidget({
  config,
  onNavigate,
}: {
  config: BackendConfig | null
  onNavigate: (section: string, id?: string) => void
}) {
  return (
    <EmbeddedAgentProvider config={config} onNavigate={onNavigate}>
      <WidgetInner />
    </EmbeddedAgentProvider>
  )
}
```

- [ ] **Step 4: Create index.ts**

Create `apps/desktop/src/components/embedded-agent/index.ts`:

```typescript
export { EmbeddedAgentWidget } from './EmbeddedAgentWidget'
```

- [ ] **Step 5: Mount in App.tsx**

Add import at top of `apps/desktop/src/App.tsx`:

```typescript
import { EmbeddedAgentWidget } from '@/components/embedded-agent'
```

Add just before the closing `</AppShell>` tag (around the end of the JSX):

```tsx
<EmbeddedAgentWidget
  config={config}
  onNavigate={(section, id) => {
    setActiveSection(section as SectionID)
    if (section === 'SETTINGS' && id) {
      setSettingsInitialTab(id as any)
    }
  }}
/>
```

- [ ] **Step 6: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Run lint**

```bash
npx eslint src/components/embedded-agent/ src/App.tsx
```

- [ ] **Step 8: Verify dev server renders the widget**

```bash
npm run dev
```

Expected: floating circle button visible bottom-right. Clicking it opens the chat panel.

- [ ] **Step 9: Commit**

```bash
git add src/components/embedded-agent/ src/App.tsx
git commit -m "feat(embedded-agent): complete Tier 1 widget — panel, provider, chat, tools, json-render"
```

---

## Task 9: Backend — Agent Provider Key Endpoints

**Files:**
- Create: `apps/backend/internal/api/agent_providers.go`
- Modify: `apps/backend/internal/api/router.go`

- [ ] **Step 1: Create agent_providers.go**

Create `apps/backend/internal/api/agent_providers.go`:

```go
package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)

type agentProviderEntry struct {
	Configured bool   `json:"configured"`
	APIKey     string `json:"api_key,omitempty"`
}

type agentProvidersResponse struct {
	Providers map[string]agentProviderEntry `json:"providers"`
}

type saveProviderRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"api_key"`
}

func agentProvidersPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".orchestra", "agent-providers.json")
}

func loadAgentProviders() map[string]string {
	data, err := os.ReadFile(agentProvidersPath())
	if err != nil {
		return map[string]string{}
	}
	var m map[string]string
	if err := json.Unmarshal(data, &m); err != nil {
		return map[string]string{}
	}
	return m
}

func saveAgentProviders(m map[string]string) error {
	dir := filepath.Dir(agentProvidersPath())
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(agentProvidersPath(), data, 0600)
}

func (s *Server) HandleGetAgentProviders(w http.ResponseWriter, r *http.Request) {
	providers := loadAgentProviders()
	resp := agentProvidersResponse{
		Providers: make(map[string]agentProviderEntry),
	}
	for _, id := range []string{"openrouter", "claude", "openai", "gemini"} {
		key, ok := providers[id]
		if ok && key != "" {
			resp.Providers[id] = agentProviderEntry{Configured: true, APIKey: key}
		} else {
			resp.Providers[id] = agentProviderEntry{Configured: false}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) HandleSaveAgentProvider(w http.ResponseWriter, r *http.Request) {
	var req saveProviderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Provider == "" || req.APIKey == "" {
		http.Error(w, `{"error":"provider and api_key required"}`, http.StatusBadRequest)
		return
	}
	providers := loadAgentProviders()
	providers[req.Provider] = req.APIKey
	if err := saveAgentProviders(providers); err != nil {
		http.Error(w, `{"error":"save failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"ok":true}`))
}
```

- [ ] **Step 2: Add routes to router.go**

Add to the router setup in `apps/backend/internal/api/router.go`, in the config route group:

```go
r.Get("/api/v1/config/agent-providers", server.HandleGetAgentProviders)
r.Post("/api/v1/config/agent-providers", server.HandleSaveAgentProvider)
```

- [ ] **Step 3: Build and verify**

```bash
cd apps/backend
PATH="/home/traves/.local/go/bin:$PATH" go build -o orchestrad ./cmd/orchestrad/
```

Expected: builds without errors

- [ ] **Step 4: Commit**

```bash
git add internal/api/agent_providers.go internal/api/router.go
git commit -m "feat(backend): add agent provider API key storage endpoints"
```

---

## Task 10: Lint, Test, Final Verification

- [ ] **Step 1: Run full typecheck**

```bash
cd apps/desktop && npx tsc --noEmit
```

- [ ] **Step 2: Run full lint**

```bash
npx eslint src/
```

Fix any issues.

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run
```

Expected: all 57 existing tests still pass

- [ ] **Step 4: Manual smoke test**

1. Start backend: `cd apps/backend && ./orchestrad`
2. Start frontend: `cd apps/desktop && npm run dev`
3. Verify floating button appears bottom-right
4. Click button — panel opens
5. Panel shows provider selector, empty state message
6. Configure an API key via Settings > Integrations (or directly via API)
7. Type a message — verify streaming response
8. Ask "what tasks are there?" — verify tool call + response
9. Ask "go to analytics" — verify navigation
10. Press Ctrl+. — verify keyboard shortcut toggles panel
11. Click clear chat — verify messages cleared

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(embedded-agent): Tier 1 complete — lint clean, tests pass"
```
