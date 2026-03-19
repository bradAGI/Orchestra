import { createContext, useContext, useMemo, useState, useCallback, useRef, type ReactNode } from 'react'
import type { BackendConfig } from '@/lib/orchestra-client'
import type { EmbeddedAgentContextValue } from './lib/types'
import { useProviderConfig } from './hooks/useProviderConfig'
import { useEmbeddedChat } from './hooks/useEmbeddedChat'
import { useWatchMode } from './hooks/useWatchMode'
import { useScheduler } from './hooks/useScheduler'
import { useContextSuggestions } from './hooks/useContextSuggestions'
import { createOrchestraTools } from './tools/orchestra-tools'
import { createNavigationTools } from './tools/navigation-tools'
import { createGitTools } from './tools/git-tools'
import { createSessionTools } from './tools/session-tools'
import { createSearchTools } from './tools/search-tools'
import { createCodeExecutionTools } from './tools/code-execution-tools'
import { createSchedulerTools } from './tools/scheduler-tools'
import { createMCPBridgeTools } from './tools/mcp-bridge-tools'

const EmbeddedAgentContext = createContext<EmbeddedAgentContextValue | null>(null)

interface EmbeddedAgentProviderProps {
  config: BackendConfig | null
  onNavigate: (section: string, id?: string) => void
  activeSection?: string
  selectedProjectId?: string
  children: ReactNode
}

// eslint-disable-next-line react-refresh/only-export-components
export function EmbeddedAgentProvider({ config, onNavigate, activeSection, selectedProjectId, children }: EmbeddedAgentProviderProps) {
  const { providerConfig, setProviderConfig, updateProvider, availableKeys } = useProviderConfig(config)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const sendMessageRef = useRef<((text: string) => Promise<void>) | null>(null)

  // Tier 3: Watch mode
  const watchMode = useWatchMode(config)

  // Tier 3: Scheduler
  const scheduler = useScheduler(
    // onReminder: inject as a system message into chat
    useCallback((message: string) => {
      void sendMessageRef.current?.(`[Reminder] ${message}`)
    }, []),
    // onAction: trigger tool execution via chat
    useCallback((toolName: string, args: Record<string, unknown>) => {
      void sendMessageRef.current?.(`Run the ${toolName} tool with these parameters: ${JSON.stringify(args)}`)
    }, []),
  )

  // Tier 3: Context-aware suggestions
  const contextSuggestions = useContextSuggestions(config, activeSection || '', undefined, selectedProjectId)

  const tools = useMemo(() => {
    const orchestraTools = config ? createOrchestraTools(config) : {}
    const navigationTools = createNavigationTools(onNavigate)
    const gitTools = config ? createGitTools(config) : {}
    const sessionTools = config ? createSessionTools(config) : {}
    const searchTools = config ? createSearchTools(config) : {}
    const codeExecutionTools = config ? createCodeExecutionTools(config) : {}
    const schedulerTools = createSchedulerTools(scheduler)
    const mcpBridgeTools = config ? createMCPBridgeTools(config) : {}
    return {
      ...orchestraTools,
      ...navigationTools,
      ...gitTools,
      ...sessionTools,
      ...searchTools,
      ...codeExecutionTools,
      ...schedulerTools,
      ...mcpBridgeTools,
    }
  }, [config, onNavigate, scheduler])

  const { messages, sendMessage, isStreaming, stop, clearChat } = useEmbeddedChat(providerConfig, tools)

  // Keep ref updated so scheduler callbacks can access latest sendMessage
  sendMessageRef.current = sendMessage

  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev)
  }, [])

  const value = useMemo<EmbeddedAgentContextValue>(
    () => ({
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
      watchMode: {
        enabled: watchMode.enabled,
        toggle: watchMode.toggle,
        notifications: watchMode.notifications,
        unreadCount: watchMode.unreadCount,
        dismiss: watchMode.dismiss,
        dismissAll: watchMode.dismissAll,
      },
      scheduler: {
        activeItems: scheduler.activeItems,
        cancel: scheduler.cancel,
      },
      contextSuggestions: {
        suggestions: contextSuggestions.suggestions,
        enabled: contextSuggestions.enabled,
        toggle: contextSuggestions.toggle,
        dismiss: contextSuggestions.dismiss,
      },
    }),
    [messages, isStreaming, sendMessage, stop, clearChat, providerConfig, setProviderConfig, availableKeys, updateProvider, isPanelOpen, togglePanel, watchMode, scheduler, contextSuggestions],
  )

  return (
    <EmbeddedAgentContext.Provider value={value}>
      {children}
    </EmbeddedAgentContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEmbeddedAgent(): EmbeddedAgentContextValue {
  const ctx = useContext(EmbeddedAgentContext)
  if (!ctx) {
    throw new Error('useEmbeddedAgent must be used within EmbeddedAgentProvider')
  }
  return ctx
}
