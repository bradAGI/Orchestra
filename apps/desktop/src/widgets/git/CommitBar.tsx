import { useState, useCallback, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

export interface CommitBarProps {
  stagedCount: number
  aheadCount?: number
  onCommit: (message: string) => void
  onPush: () => void
}

export function CommitBar({
  stagedCount,
  aheadCount = 0,
  onCommit,
  onPush,
}: CommitBarProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showBody, setShowBody] = useState(false)

  const canCommit = stagedCount > 0 && subject.trim().length > 0

  const handleCommit = useCallback(() => {
    if (!canCommit) return
    const message = showBody && body.trim()
      ? `${subject}\n\n${body.trim()}`
      : subject
    onCommit(message)
    setSubject('')
    setBody('')
    setShowBody(false)
  }, [canCommit, subject, body, showBody, onCommit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleCommit()
      }
    },
    [handleCommit],
  )

  const charCount = subject.length
  const charWarn = charCount > 72

  return (
    <div className="border-t border-border/40 p-3 bg-card/30 shrink-0">
      {/* Subject line */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Commit message..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-muted/10 border border-border/40 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] tabular-nums ${charWarn ? 'text-yellow-400' : 'text-muted-foreground/60'}`}
          >
            {charCount}/72
          </span>
          <button
            type="button"
            onClick={() => setShowBody(!showBody)}
            className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            + body
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canCommit}
            onClick={handleCommit}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-primary/10 text-primary disabled:opacity-30 transition-opacity"
          >
            Commit
          </button>

          {aheadCount > 0 && (
            <button
              type="button"
              onClick={onPush}
              aria-label="Push"
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center gap-1.5"
            >
              <Send size={10} />
              Push ↑{aheadCount}
            </button>
          )}
        </div>
      </div>

      {/* Extended body */}
      {showBody && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Extended description..."
          rows={3}
          className="mt-2 w-full bg-muted/10 border border-border/40 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary/50 transition-colors resize-none"
        />
      )}
    </div>
  )
}
