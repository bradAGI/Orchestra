interface StashPanelProps {
  stashes: Array<{ ref: string; message: string }>
  onStash: () => void
  onApply: (ref: string) => void
  onDrop: (ref: string) => void
  onClose: () => void
}

export function StashPanel({ stashes, onStash, onApply, onDrop }: StashPanelProps) {
  return (
    <div className="absolute right-0 top-full mt-1 bg-popover border border-border/60 rounded-lg shadow-xl z-50 py-1.5 min-w-[280px] max-h-[320px] overflow-y-auto">
      <div className="px-3 pt-1.5 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
          Stashes <span className="font-normal tabular-nums">{stashes.length}</span>
        </span>
        <button
          onClick={onStash}
          className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Stash changes
        </button>
      </div>

      <div className="h-px bg-border/40 mx-2" />

      {stashes.length === 0 ? (
        <div className="px-3 py-4 text-[11px] text-muted-foreground/50 text-center">
          No stashes
        </div>
      ) : (
        <div className="pt-1">
          {stashes.map((stash) => (
            <div
              key={stash.ref}
              className="group flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-foreground/[0.03] transition-colors"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  {stash.ref}
                </span>
                <span className="text-[11.5px] text-foreground/90 truncate">
                  {stash.message}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onApply(stash.ref)}
                  className="px-2 py-0.5 rounded text-[10.5px] font-medium text-emerald-500 hover:bg-emerald-500/10"
                >
                  Apply
                </button>
                <button
                  onClick={() => onDrop(stash.ref)}
                  className="px-2 py-0.5 rounded text-[10.5px] font-medium text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                >
                  Drop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
