import type { ChatMessage } from '../lib/types'
import { ToolFeedback } from './ToolFeedback'
import { JsonRenderBlock } from './JsonRenderBlock'

interface MessageBubbleProps {
  message: ChatMessage
  onAction: (action: string, params: Record<string, unknown>) => void
}

export function MessageBubble({ message, onAction }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border/50 bg-muted/30'
        }`}
      >
        {message.content && (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolFeedback
            toolCalls={message.toolCalls}
            toolResults={message.toolResults ?? []}
          />
        )}

        {message.jsonRenderSpec && (
          <div className="mt-1.5">
            <JsonRenderBlock
              spec={message.jsonRenderSpec}
              onAction={(action, params) => onAction(action, params ?? {})}
            />
          </div>
        )}
      </div>
    </div>
  )
}
