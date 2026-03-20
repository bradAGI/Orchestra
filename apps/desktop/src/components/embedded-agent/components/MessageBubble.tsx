import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../lib/types'
import { ToolFeedback } from './ToolFeedback'
import { JsonRenderBlock } from './JsonRenderBlock'

interface MessageBubbleProps {
  message: ChatMessage
  onAction: (action: string, params: Record<string, unknown>) => void
  isStreaming?: boolean
}

export function MessageBubble({ message, onAction, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Don't render an empty assistant bubble while waiting for content
  if (!isUser && !message.content && (!message.toolCalls || message.toolCalls.length === 0) && !message.jsonRenderSpec) {
    return null
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] text-[13px] leading-relaxed ${
          isUser
            ? 'rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm shadow-primary/10'
            : 'rounded-2xl rounded-tl-md border border-border/20 bg-muted/15 px-3.5 py-2.5'
        }`}
      >
        {/* Tool feedback (before text for assistant) */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2">
            <ToolFeedback
              toolCalls={message.toolCalls}
              toolResults={message.toolResults ?? []}
              isStreaming={isStreaming}
            />
          </div>
        )}

        {/* json-render rich UI */}
        {!isUser && message.jsonRenderSpec && (
          <div className="mb-2">
            <JsonRenderBlock
              spec={message.jsonRenderSpec}
              onAction={(action, params) => onAction(action, params ?? {})}
            />
          </div>
        )}

        {/* Text content */}
        {message.content && (
          isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <div className="agent-markdown break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )
        )}
      </div>
    </div>
  )
}
