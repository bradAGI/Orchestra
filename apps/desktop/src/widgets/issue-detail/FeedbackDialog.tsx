import { useState } from 'react'

interface FeedbackDialogProps {
  onSubmit: (feedback: string, targetState: 'Todo' | 'In Progress') => void
  onCancel: () => void
}

export function FeedbackDialog({ onSubmit, onCancel }: FeedbackDialogProps) {
  const [feedback, setFeedback] = useState('')
  const [targetState, setTargetState] = useState<'Todo' | 'In Progress'>('In Progress')

  const handleSubmit = () => {
    if (!feedback.trim()) return
    onSubmit(feedback.trim(), targetState)
    setFeedback('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border/40 rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-sm font-bold text-foreground mb-3">Reject &amp; Send Back</h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Describe what needs to change. The agent will act on your feedback.
        </p>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What needs to change?"
          rows={4}
          autoFocus
          className="w-full bg-muted/10 border border-border/40 rounded-lg px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/40 resize-none outline-none focus:border-primary/60"
        />
        <div className="space-y-2 mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Action</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTargetState('In Progress')}
              className={`p-3 rounded-lg border text-left transition-all ${
                targetState === 'In Progress'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 text-muted-foreground hover:bg-muted/20'
              }`}
            >
              <p className="text-[11px] font-bold">Re-execute</p>
              <p className="text-[9px] text-muted-foreground">Agent re-runs with feedback</p>
            </button>
            <button
              onClick={() => setTargetState('Todo')}
              className={`p-3 rounded-lg border text-left transition-all ${
                targetState === 'Todo'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 text-muted-foreground hover:bg-muted/20'
              }`}
            >
              <p className="text-[11px] font-bold">Re-plan</p>
              <p className="text-[9px] text-muted-foreground">Agent re-plans from scratch</p>
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg text-muted-foreground hover:text-foreground transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!feedback.trim()}
            className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {targetState === 'In Progress' ? 'Send to Re-execute' : 'Send to Re-plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
