import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'
import { VoiceInput } from './VoiceInput'

interface ChatInputProps {
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleTranscription = useCallback((text: string) => {
    setValue(prev => prev ? `${prev} ${text}` : text)
  }, [])

  return (
    <div className="px-3 py-3">
      <div className="flex items-start gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              const el = e.target
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message Orchestra Agent..."
            disabled={disabled || isStreaming}
            className="w-full resize-none rounded-xl border border-border/15 bg-muted/10 pl-3.5 pr-10 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-border/30 focus:bg-muted/20 disabled:opacity-40"
            style={{ maxHeight: 120 }}
          />
          <div className="absolute right-1.5 top-0 flex h-[40px] items-center">
            <VoiceInput onTranscription={handleTranscription} disabled={disabled || isStreaming} />
          </div>
        </div>

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive transition-all hover:bg-destructive/20 active:scale-95"
            aria-label="Stop"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-md active:scale-95 disabled:opacity-30 disabled:shadow-none"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
