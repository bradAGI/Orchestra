import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'

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

  return (
    <div className="flex items-end gap-1.5 border-t border-border/50 px-3 py-2">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          // Auto-resize
          const el = e.target
          el.style.height = 'auto'
          el.style.height = `${Math.min(el.scrollHeight, 120)}px`
        }}
        onKeyDown={handleKeyDown}
        placeholder="Message..."
        disabled={disabled || isStreaming}
        className="flex-1 resize-none rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50 disabled:opacity-50"
        style={{ maxHeight: 120 }}
      />

      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
          aria-label="Stop"
        >
          <Square className="size-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="size-3.5" />
        </button>
      )}
    </div>
  )
}
