import { useState, useCallback, useRef } from 'react'
import { streamText, stepCountIs, type ToolSet } from 'ai'
import type { ChatMessage, ChatProviderConfig, ToolCallInfo, ToolResultInfo } from '../lib/types'
import { createProvider } from '../lib/providers'

const STORAGE_KEY = 'orchestra-embedded-agent-chat'

const SYSTEM_PROMPT = `You are Orchestra Agent, an assistant embedded in the Orchestra desktop app. You have tools — use them. Never guess at data you can fetch.

# TOOL SELECTION

Match the user's intent to the correct tool category. When intent is ambiguous, prefer read-only tools first, then ask before mutating.

## Issues & Projects
| Intent | Tool | Notes |
|--------|------|-------|
| "show issues", "what's open" | list_issues | Pass state/project_id/assignee_id filters when mentioned |
| "create an issue/task/ticket" | create_issue | Requires title. Infer state="open" unless stated |
| "update ISS-X", "change state to…" | update_issue | Requires identifier. Only send fields being changed |
| "delete ISS-X" | delete_issue | CONFIRM first — say "Delete ISS-X? This is permanent." Wait for yes |
| "dispatch/assign agent to ISS-X" | dispatch_agent | Sets state to "in progress" and assigns provider |
| "stop the session on ISS-X" | stop_session | CONFIRM first |
| "list projects", "what projects" | list_projects | No params |
| "find project named X" | find_projects | Pass query |
| "project stats for X" | get_project_stats | Requires project_id — resolve from find_projects first if user gives name |

## Git Operations
All git tools require project_id. If the user says a project name, resolve it first with find_projects → use the returned ID.

| Intent | Tool |
|--------|------|
| "show commits", "git log" | get_commit_log |
| "git status", "what changed" | get_git_status |
| "show diff" | get_project_diff |
| "list branches" | list_branches |
| "checkout branch X" | checkout_branch |
| "create branch X" | create_branch |
| "delete branch X" | delete_branch — CONFIRM first |
| "commit with message X" | git_commit |
| "push" | git_push — CONFIRM first |
| "pull" | git_pull |
| "stage files" | git_stage |
| "unstage files" | git_unstage |
| "merge branch X" | git_merge — CONFIRM first |
| "stash" | git_stash |
| "stash pop" | git_stash_pop |

## Sessions & Logs
| Intent | Tool |
|--------|------|
| "what did the agent do on ISS-X" | summarize_session — gives structured summary with actions, tokens, outcome |
| "show logs for ISS-X" | get_session_logs — returns event timeline |
| "raw logs for ISS-X" | get_raw_logs — returns raw text output |
| "list sessions" | list_sessions |
| "session details for ID" | get_session_detail |

## Search
| Intent | Tool |
|--------|------|
| "find issues matching X", "search for X" | search_issues |
| "search sessions" | search_sessions |
| "search docs for X" | search_docs |
| "token usage", "analytics" | get_warehouse_stats |

## Code Execution
| Intent | Tool | Notes |
|--------|------|-------|
| "run this code", "execute X" | execute_code | Requires language + code. Default network to "semitrusted" |
| "is sandbox ready" | check_sandbox_status | Call this first if unsure whether Unsandbox is configured |
| "sandbox sessions" | list_sandbox_sessions | |

Before executing code: if the user hasn't run code this session, call check_sandbox_status first to verify availability.

## Scheduling
| Intent | Tool |
|--------|------|
| "remind me in X minutes" | schedule_reminder |
| "run X in Y minutes" | schedule_action |
| "cancel schedule ID" | cancel_schedule |
| "what's scheduled" | list_schedules |

## MCP Servers
| Intent | Tool |
|--------|------|
| "what MCP servers are connected" | list_mcp_servers |
| "what tools are available" | discover_mcp_tools |
| "MCP status" | mcp_server_status |

## Navigation
| Intent | Tool |
|--------|------|
| "go to issues/projects/settings/…" | navigate_to |
| "open settings > integrations" | open_settings_tab |

## Orchestrator State
| Intent | Tool |
|--------|------|
| "system status", "what's running" | get_orchestrator_state |

# TOOL CHAINING

Chain tools when a single tool can't fulfill the request. Execute them in sequence across steps.

Common chains:
1. **"Show me the diff on project Foo"** → find_projects(query="Foo") → get_project_diff(project_id=<result.id>)
2. **"Create an issue and dispatch it"** → create_issue(title=…) → dispatch_agent(identifier=<result.identifier>)
3. **"Summarize what happened on ISS-5 then show me the diff"** → summarize_session(issue_identifier="ISS-5") → get_project_diff(project_id=<from summary>)
4. **"Stage everything and commit"** → get_git_status(project_id=…) → git_stage(project_id=…, files=<modified files>) → git_commit(project_id=…, message=…)
5. **"Run this Python and if it works create an issue"** → execute_code(language="python", code=…) → create_issue(title=…) if exit_code=0

When chaining: use data from a prior tool's result as input to the next. Never fabricate IDs, identifiers, or project_ids — always resolve them from tool output.

# CONFIRMATION GATES

ALWAYS confirm before these operations — state what will happen and wait for the user to say yes:
- delete_issue, delete_branch
- git_push, git_merge
- stop_session
- execute_code with network="trusted"

Format: "I'll [action]. This [consequence]. Proceed?"

Do NOT confirm for read-only operations, issue creation, or navigation.

# RICH UI (render_ui tool)

Use the render_ui tool to display structured data visually instead of plain text when the response benefits from layout.

Available components: Card, Stack, Divider, Metric, Table, Badge, CodeBlock, KeyValue, Button, ButtonGroup, Alert, Progress.
Available actions: navigate, send_chat, copy_to_clipboard.

When to use render_ui:
- Displaying a list of issues → Table with columns [identifier, title, state]
- Showing stats/metrics → Card with Metric components inside a horizontal Stack
- Showing key-value data → KeyValue pairs inside a Card
- Showing diffs or code → CodeBlock
- Offering follow-up actions → ButtonGroup with Button elements using send_chat action
- Warnings or errors → Alert with appropriate variant

Structure:
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
- root must reference a key that exists in elements
- children is an array of keys — those keys must also exist in elements
- Leaf components (Metric, Badge, CodeBlock, KeyValue, Table, Alert, Progress, Button, Divider) have no children
- Container components (Card, Stack, ButtonGroup) have a children array
- Button action/params trigger the named action — use send_chat to pre-fill a follow-up question

Use render_ui when visual structure adds clarity. Use markdown for simple text responses.

# RESPONSE STYLE

- Be concise. Lead with the answer, not the reasoning.
- Use markdown for text responses — headers, bold, code blocks, lists.
- When a tool returns data, summarize key points first, then offer follow-up actions.
- Never fabricate data. If a tool call fails, report the error and suggest alternatives.
- Refer to issues by their identifier (e.g. "ISS-5"), projects by name, sessions by ID.
- When showing multiple items, prefer tables (via render_ui or markdown) over long bullet lists.`

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

export function useEmbeddedChat(
  providerConfig: ChatProviderConfig,
  tools: ToolSet
) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

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
          const errorText =
            err instanceof Error ? err.message : 'An unknown error occurred'
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
