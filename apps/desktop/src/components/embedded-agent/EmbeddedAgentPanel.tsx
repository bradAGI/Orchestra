import { useCallback } from 'react'
import { X, RefreshCcw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { useEmbeddedAgent } from './EmbeddedAgentProvider'
import { MessageList } from './components/MessageList'
import { ChatInput } from './components/ChatInput'

export function EmbeddedAgentPanel({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const {
    messages,
    isStreaming,
    sendMessage,
    stop,
    clearChat,
    providerConfig,
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
    <div className="agent-panel-enter fixed bottom-20 right-6 z-50 flex h-[620px] w-[420px] flex-col overflow-hidden rounded-2xl border border-border/20 bg-card/95 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {/* Subtle top gradient accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {providerConfig.apiKey ? providerConfig.modelId : 'Not configured'}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {onOpenSettings && (
            <AppTooltip content="Agent settings">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { togglePanel(); onOpenSettings() }}
                className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </AppTooltip>
          )}
          <AppTooltip content="New chat">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </AppTooltip>
          <AppTooltip content="Close (Ctrl+.)">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePanel}
              className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground"
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
