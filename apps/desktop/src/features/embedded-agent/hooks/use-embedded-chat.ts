import { useState, useCallback, useEffect, useRef } from 'react'
import { streamText, stepCountIs, type ToolSet } from 'ai'
import type { ChatMessage, ChatProviderConfig, ToolCallInfo, ToolResultInfo } from '../lib/types'
import { createProvider } from '../lib/providers'

const STORAGE_KEY = 'orchestra-embedded-agent-chat'

const SYSTEM_PROMPT = `You are Orchestra Agent, an assistant embedded in the Orchestra desktop app. You have tools — use them. Never guess at data you can fetch.

# TOOL DISCOVERY

You have a core set of tools available directly. For specialized operations (git, sessions, code execution, scheduling, MCP), call search_tools to discover available tools by category or keyword.

Categories: issues, projects, git, sessions, search, code, scheduling, mcp, navigation, system

Workflow:
1. Try your core tools first — they cover issues, projects, search, navigation, and UI rendering.
2. If the request needs a specialized tool, call search_tools(category="git") or search_tools(query="stash").
3. If needed, call get_tool_schema(tool_name="git_stash") to confirm exact parameters.
4. Then call the discovered tool.

Tool descriptions include prerequisites and confirmation gates — follow them.

# CONFIRMATION GATES

ALWAYS confirm before destructive or irreversible operations. Tool descriptions marked "CONFIRM BEFORE CALLING" require you to state what will happen and wait for the user to say "yes".

Format: "I'll [action]. This [consequence]. Proceed?"

Do NOT confirm for read-only operations, issue creation, or navigation.

# TOOL CHAINING

Chain tools when one tool's output feeds another's input. Common pattern: resolve a name to an ID (find_projects), then use the ID in subsequent calls. Never fabricate IDs, identifiers, or project_ids — always resolve them from tool output.

# RICH UI (render_ui)

Use render_ui to display structured data visually when layout adds clarity.

Components:
- Layout: Card (title, description, children), Stack (direction, gap, children), Divider (label)
- Data: Metric (label, value, trend), Table (columns, rows), Badge (label, variant), CodeBlock (code, language), KeyValue (pairs)
- Interactive: Button (label, action, params, variant), ButtonGroup (children)
- Feedback: Alert (message, variant, title), Progress (value, max, label)

Actions: navigate (section, id), send_chat (message), copy_to_clipboard (text)

Spec structure:
\`\`\`json
{
  "root": "rootKey",
  "elements": {
    "rootKey": { "type": "Card", "props": { "title": "…" }, "children": ["child1"] },
    "child1": { "type": "Metric", "props": { "label": "…", "value": 42 } }
  }
}
\`\`\`

Rules:
- Every element needs a unique key in the elements map
- root must reference an existing key
- children is an array of keys that must also exist in elements
- Leaf components (Metric, Badge, CodeBlock, KeyValue, Table, Alert, Progress, Button, Divider) have no children
- Container components (Card, Stack, ButtonGroup) have a children array
- Use send_chat action on Buttons to pre-fill follow-up questions
- IMPORTANT: When you use render_ui, put ALL the data in the spec. Do NOT repeat the same data as markdown text — the rendered UI IS the response. Only add a brief sentence summary after render_ui, never duplicate the table/list as text.
- IMPORTANT: Always populate the Table rows with actual data from tool results. Never render an empty table.

When to use: issue lists → Table, project lists → Table, stats → Card + Metric, diffs/code → CodeBlock, key-value data → KeyValue, follow-ups → ButtonGroup, warnings → Alert.

ALWAYS use render_ui for: listing issues, listing projects, showing orchestrator state, any tabular data. NEVER output markdown tables — always use render_ui Table instead.

# RESPONSE STYLE

- Be concise. Lead with the answer, not the reasoning.
- Use markdown for text. Summarize tool results, then offer follow-ups.
- Never fabricate data. If a tool fails, report the error and suggest alternatives.
- Refer to issues by identifier (ISS-5), projects by name, sessions by ID.
- Prefer tables over bullet lists for multiple items.`

/** Core tools sent to the model context. Other tools are discoverable via search_tools. */
const ACTIVE_TOOLS = [
  'search_tools', 'get_tool_schema',
  'list_issues', 'create_issue', 'update_issue', 'dispatch_agent',
  'find_projects', 'list_projects',
  'navigate_to', 'open_settings_tab',
  'search_issues',
  'render_ui',
  'get_orchestrator_state',
] as const

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function loadMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as ChatMessage[]
    return parsed.map((m) => ({
      ...m,
      createdAt: new Date(m.createdAt),
    }))
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // localStorage may be full or unavailable
  }
}

/** Map raw provider/network errors to user-friendly messages. */
function formatProviderError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()

  // HTTP status codes
  if (lower.includes('503') || lower.includes('service unavailable') || lower.includes('overloaded')) {
    return 'Model temporarily unavailable. Try again or switch to a different model.'
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('invalid.*key') || lower.includes('api key')) {
    return 'API key invalid or expired. Update in Settings.'
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Rate limit exceeded. Wait a moment and try again.'
  }
  if (lower.includes('500') || lower.includes('internal server error')) {
    return 'The model provider returned an internal error. Try again shortly.'
  }
  if (lower.includes('502') || lower.includes('bad gateway')) {
    return 'The model provider is temporarily unreachable. Try again shortly.'
  }

  // Network-level failures
  if (lower.includes('fetch failed') || lower.includes('networkerror') || lower.includes('failed to fetch') || lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('network')) {
    return 'Network error. Check your connection.'
  }

  // Fallback: return the raw message but cap length to avoid dumping stack traces
  return raw.length > 300 ? raw.slice(0, 300) + '...' : raw
}

export function useEmbeddedChat(
  providerConfig: ChatProviderConfig,
  tools: ToolSet
) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Abort any in-flight stream on unmount so closing the widget mid-response
  // stops token consumption against the provider.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        createdAt: new Date(),
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        toolCalls: [],
        toolResults: [],
      }

      const updatedMessages = [...messages, userMessage, assistantMessage]
      setMessages(updatedMessages)
      setIsStreaming(true)

      const abortController = new AbortController()
      abortRef.current = abortController

      // Collect tool info across steps
      const collectedToolCalls: ToolCallInfo[] = []
      const collectedToolResults: ToolResultInfo[] = []
      let currentStep = 0

      try {
        const provider = createProvider(providerConfig.providerId, providerConfig.apiKey)
        const model = provider(providerConfig.modelId)

        const sdkMessages = [...messages, userMessage].map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }))

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: sdkMessages,
          tools,
          experimental_activeTools: ACTIVE_TOOLS as unknown as string[],
          stopWhen: stepCountIs(10),
          abortSignal: abortController.signal,
          onStepFinish(event) {
            const stepIndex = currentStep++
            for (const tc of event.toolCalls) {
              collectedToolCalls.push({
                toolName: tc.toolName,
                args: tc.input as Record<string, unknown>,
                stepIndex,
              })
            }
            for (const tr of event.toolResults) {
              collectedToolResults.push({
                toolName: tr.toolName,
                result: tr.output,
                isError: false,
                stepIndex,
              })
            }
            // Update message with per-step progress so UI shows live updates
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last && last.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  toolCalls: [...collectedToolCalls],
                  toolResults: [...collectedToolResults],
                }
              }
              return updated
            })
          },
        })

        let fullText = ''
        for await (const delta of result.textStream) {
          fullText += delta
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: fullText }
            }
            return updated
          })
        }

        // Check tool results for render_ui responses
        let jsonRenderSpec: ChatMessage['jsonRenderSpec'] = null
        for (const tr of collectedToolResults) {
          const res = tr.result as Record<string, unknown> | undefined
          if (res && res.type === 'json_render' && res.spec) {
            jsonRenderSpec = res.spec as ChatMessage['jsonRenderSpec']
            break
          }
        }

        // Final update with all collected data
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: fullText,
              toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
              toolResults: collectedToolResults.length > 0 ? collectedToolResults : undefined,
              jsonRenderSpec: jsonRenderSpec ?? undefined,
            }
          }
          saveMessages(updated)
          return updated
        })
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User cancelled — save what we have
          setMessages((prev) => {
            saveMessages(prev)
            return prev
          })
        } else {
          const errorText = formatProviderError(err)
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content
                  ? `${last.content}\n\n**Error:** ${errorText}`
                  : `**Error:** ${errorText}`,
              }
            }
            saveMessages(updated)
            return updated
          })
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [messages, providerConfig, tools]
  )

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { messages, sendMessage, isStreaming, stop, clearChat }
}
