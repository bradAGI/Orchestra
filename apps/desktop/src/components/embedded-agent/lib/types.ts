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
  stepIndex?: number
}

export type ToolResultInfo = {
  toolName: string
  result: unknown
  isError?: boolean
  stepIndex?: number
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

export type WatchModeState = {
  enabled: boolean
  toggle: () => void
  notifications: { id: string; type: string; title: string; message: string; dismissed: boolean; actions?: { label: string; action: string; params?: Record<string, unknown> }[] }[]
  unreadCount: number
  dismiss: (id: string) => void
  dismissAll: () => void
}

export type SchedulerState = {
  activeItems: { id: string; type: string; message?: string; toolName?: string; firesAt: Date }[]
  cancel: (id: string) => void
}

export type SuggestionsState = {
  suggestions: { id: string; text: string; action: string; params?: Record<string, unknown>; dismissed: boolean }[]
  enabled: boolean
  toggle: () => void
  dismiss: (id: string) => void
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
  watchMode: WatchModeState
  scheduler: SchedulerState
  contextSuggestions: SuggestionsState
}

export const CHAT_PROVIDERS = [
  { id: 'openrouter' as const, label: 'OpenRouter', models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-pro'] },
  { id: 'claude' as const, label: 'Claude', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'] },
  { id: 'openai' as const, label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'] },
  { id: 'gemini' as const, label: 'Gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
] as const
