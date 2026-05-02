import { Copy, MessageSquare, X } from 'lucide-react'
import type { GrabPayload } from './use-grab-mode'

interface GrabConfirmationProps {
  payload: GrabPayload
  onCopy: () => void
  onSendToAgent: () => void
  onDismiss: () => void
}

export function GrabConfirmation({ payload, onCopy, onSendToAgent, onDismiss }: GrabConfirmationProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border border-border rounded-lg shadow-xl p-3 max-w-md">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-medium text-foreground">
            Captured: <code className="text-primary">&lt;{payload.target.tag}&gt;</code> {payload.target.selector}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">
            {payload.target.text || '(no text content)'}
          </p>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-0.5">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 text-foreground"
        >
          <Copy size={12} /> Copy
        </button>
        <button
          onClick={onSendToAgent}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <MessageSquare size={12} /> Send to Agent
        </button>
      </div>
    </div>
  )
}
