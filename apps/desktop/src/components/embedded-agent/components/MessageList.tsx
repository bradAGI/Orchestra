import { useRef, useEffect } from 'react'
import type { ChatMessage } from '../lib/types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onAction: (action: string, params: Record<string, unknown>) => void
}

export function MessageList({ messages, isStreaming, onAction }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isStreaming])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-foreground/70">Orchestra Agent</p>
        <p className="text-xs text-muted-foreground">Ask anything about your project</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onAction={onAction} />
      ))}

      {isStreaming && (
        <div className="flex justify-start">
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
