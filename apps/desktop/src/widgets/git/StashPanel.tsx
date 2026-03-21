interface StashPanelProps {
  stashes: Array<{ ref: string; message: string }>
  onStash: () => void
  onApply: (ref: string) => void
  onDrop: (ref: string) => void
  onClose: () => void
}

export function StashPanel({ stashes, onStash, onApply, onDrop }: StashPanelProps) {
  return (
    <div className="absolute right-0 top-full mt-1 bg-card border border-border/40 rounded-xl shadow-lg z-20 py-1 min-w-[260px] max-h-[300px] overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-border/20">
        <span className="text-[10px] font-bold text-muted-foreground/70">
          Stashes ({stashes.length})
        </span>
        <button
          onClick={onStash}
          className="text-[10px] font-bold text-primary/70 hover:text-primary transition-colors"
        >
          Stash Changes
        </button>
      </div>

      {/* Stash entries */}
      {stashes.length === 0 ? (
        <div className="px-3 py-3 text-[11px] text-muted-foreground/50 text-center">
          No stashes
        </div>
      ) : (
        stashes.map((stash) => (
          <div
            key={stash.ref}
            className="group px-3 py-1.5 hover:bg-muted/20 flex items-center justify-between gap-2"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-mono text-muted-foreground/50">
                {stash.ref}
              </span>
              <span className="text-[11px] text-foreground truncate">
                {stash.message}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onApply(stash.ref)}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold text-green-400 hover:bg-green-500/10"
              >
                Apply
              </button>
              <button
                onClick={() => onDrop(stash.ref)}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold text-red-400 hover:bg-red-500/10"
              >
                Drop
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
