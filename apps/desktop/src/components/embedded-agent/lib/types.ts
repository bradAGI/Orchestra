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
