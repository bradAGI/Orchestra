import { useCallback } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useEmbeddedAgent } from './EmbeddedAgentProvider'
import { MessageList } from './components/MessageList'
import { ChatInput } from './components/ChatInput'
import { ProviderSelector } from './components/ProviderSelector'

export function EmbeddedAgentPanel() {
  const {
    messages,
    isStreaming,
    sendMessage,
    stop,
    clearChat,
    providerConfig,
    availableKeys,
    updateProvider,
    togglePanel,
  } = useEmbeddedAgent()

  const handleAction = useCallback(
    (action: string, params: Record<string, unknown>) => {
      if (action === 'send_chat' && typeof params.text === 'string') {
        void sendMessage(params.text)
      }
      // navigate actions are handled by navigation tools
    },
    [sendMessage],
  )

  return (
    <div className="fixed bottom-20 right-6 z-50 flex h-[620px] w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <span className="text-sm font-semibold">Agent</span>
        <div className="flex-1">
          <ProviderSelector
            config={providerConfig}
            availableKeys={availableKeys}
            onUpdate={updateProvider}
          />
        </div>
        <button
          type="button"
          onClick={clearChat}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear chat"
        >
          <Trash2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={togglePanel}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close panel"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Body */}
      <MessageList messages={messages} isStreaming={isStreaming} onAction={handleAction} />

      {/* Footer */}
      <ChatInput
        onSend={(text) => void sendMessage(text)}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!providerConfig.apiKey}
      />
    </div>
  )
}
