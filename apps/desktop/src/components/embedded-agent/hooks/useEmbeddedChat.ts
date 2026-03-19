import { useState, useCallback, useRef } from 'react'
import { streamText, stepCountIs, type ToolSet } from 'ai'
import type { ChatMessage, ChatProviderConfig, ToolCallInfo, ToolResultInfo } from '../lib/types'
import { createProvider } from '../lib/providers'

const STORAGE_KEY = 'orchestra-embedded-agent-chat'

const SYSTEM_PROMPT = `You are Orchestra Agent, an intelligent assistant embedded in the Orchestra desktop application.
You help users manage projects, sessions, and workflows within the Orchestra platform.

Capabilities:
- Issue & project management: create, update, search, and delete issues and projects
- Git operations: view diffs, branches, commit history, stage/commit/push/pull, merge, stash
- Session analysis: fetch event logs, raw logs, summarize what agents did on issues
- Code execution: run code snippets in the Unsandbox environment (Python, JS, bash, etc.)
- Cross-entity search: search issues, sessions, docs, and get analytics
- Navigation: switch between app sections and settings tabs
- Rich UI: render interactive components via json-render specs

When tools are available, use them to fulfill user requests. Chain multiple tool calls when needed to complete complex tasks.
For destructive operations (delete, force push), confirm with the user first.
Be concise and helpful. Format responses with markdown when appropriate.`

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
          if (res && res.type === 'json_render') {
            jsonRenderSpec = res as unknown as ChatMessage['jsonRenderSpec']
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
