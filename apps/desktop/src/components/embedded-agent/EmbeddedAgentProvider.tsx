import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import type { BackendConfig } from '@/lib/orchestra-client'
import type { EmbeddedAgentContextValue } from './lib/types'
import { useProviderConfig } from './hooks/useProviderConfig'
import { useEmbeddedChat } from './hooks/useEmbeddedChat'
import { createOrchestraTools } from './tools/orchestra-tools'
import { createNavigationTools } from './tools/navigation-tools'
import { createGitTools } from './tools/git-tools'
import { createSessionTools } from './tools/session-tools'
import { createSearchTools } from './tools/search-tools'
import { createCodeExecutionTools } from './tools/code-execution-tools'

const EmbeddedAgentContext = createContext<EmbeddedAgentContextValue | null>(null)

interface EmbeddedAgentProviderProps {
  config: BackendConfig | null
  onNavigate: (section: string, id?: string) => void
  children: ReactNode
}

export function EmbeddedAgentProvider({ config, onNavigate, children }: EmbeddedAgentProviderProps) {
  const { providerConfig, setProviderConfig, updateProvider, availableKeys } = useProviderConfig(config)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const tools = useMemo(() => {
    const orchestraTools = config ? createOrchestraTools(config) : {}
    const navigationTools = createNavigationTools(onNavigate)
    const gitTools = config ? createGitTools(config) : {}
    const sessionTools = config ? createSessionTools(config) : {}
    const searchTools = config ? createSearchTools(config) : {}
    const codeExecutionTools = config ? createCodeExecutionTools(config) : {}
    return { ...orchestraTools, ...navigationTools, ...gitTools, ...sessionTools, ...searchTools, ...codeExecutionTools }
  }, [config, onNavigate])

  const { messages, sendMessage, isStreaming, stop, clearChat } = useEmbeddedChat(providerConfig, tools)

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
    }),
    [messages, isStreaming, sendMessage, stop, clearChat, providerConfig, setProviderConfig, availableKeys, updateProvider, isPanelOpen, togglePanel],
  )

  return (
    <EmbeddedAgentContext.Provider value={value}>
      {children}
    </EmbeddedAgentContext.Provider>
  )
}

export function useEmbeddedAgent(): EmbeddedAgentContextValue {
  const ctx = useContext(EmbeddedAgentContext)
  if (!ctx) {
    throw new Error('useEmbeddedAgent must be used within EmbeddedAgentProvider')
  }
  return ctx
}
