import { useCallback } from 'react'
import { X, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
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
      if (action === 'send_chat' && typeof params.message === 'string') {
        void sendMessage(params.message)
      }
    },
    [sendMessage],
  )

  return (
    <div className="fixed bottom-20 right-6 z-50 flex h-[620px] w-[420px] flex-col overflow-hidden rounded-2xl border border-border/30 bg-card shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <ProviderSelector
            config={providerConfig}
            availableKeys={availableKeys}
            onUpdate={updateProvider}
          />
        </div>
        <div className="flex items-center gap-1">
          <AppTooltip content="New chat">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="h-7 w-7 p-0"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </AppTooltip>
          <AppTooltip content="Close (Ctrl+.)">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePanel}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </AppTooltip>
        </div>
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
