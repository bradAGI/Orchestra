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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <svg viewBox="0 0 64 64" className="h-10 w-10 text-primary/60" aria-hidden="true">
            <circle
              cx="32" cy="32" r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="110 40"
              strokeLinecap="round"
              transform="rotate(-10 32 32)"
              opacity="0.5"
            />
            <rect
              x="24" y="24" width="16" height="16" rx="3"
              fill="currentColor"
              transform="rotate(45 32 32)"
              opacity="0.4"
            />
            <circle cx="32" cy="32" r="3" fill="currentColor" opacity="0.6" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-foreground/80">Orchestra Agent</p>
          <p className="text-xs leading-relaxed text-muted-foreground/60 max-w-[240px]">
            Ask me to create tasks, check running agents, navigate the app, or anything else.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
          {['What tasks are running?', 'Create a new task', 'Go to analytics'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onAction('send_chat', { message: suggestion })}
              className="rounded-full border border-border/30 bg-muted/20 px-3 py-1 text-[10px] text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
      {messages.map((msg) => (
        <div key={msg.id} className="agent-message-enter">
          <MessageBubble message={msg} onAction={onAction} />
        </div>
      ))}

      {isStreaming && (
        <div className="agent-message-enter flex justify-start">
          <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border/20 bg-muted/20 px-4 py-2.5">
            <span className="agent-typing-dot h-1.5 w-1.5 rounded-full bg-primary/60" style={{ animationDelay: '0ms' }} />
            <span className="agent-typing-dot h-1.5 w-1.5 rounded-full bg-primary/60" style={{ animationDelay: '200ms' }} />
            <span className="agent-typing-dot h-1.5 w-1.5 rounded-full bg-primary/60" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
