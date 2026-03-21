interface ConflictBannerProps {
  conflicts: { in_merge: boolean; files: string[] }
  onResolve: (file: string) => void
  onAbort: () => void
}

export function ConflictBanner({ conflicts, onResolve, onAbort }: ConflictBannerProps) {
  if (!conflicts.in_merge || conflicts.files.length === 0) {
    return null
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="text-sm font-medium text-amber-300 mb-2">
        ⚠ Merge in progress — {conflicts.files.length} conflicted files
      </div>
      <div className="space-y-1 mb-2">
        {conflicts.files.map((file) => (
          <div key={file} className="flex items-center justify-between text-xs">
            <span className="text-neutral-300 font-mono">{file}</span>
            <button
              onClick={() => onResolve(file)}
              className="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
            >
              Mark Resolved
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={onAbort}
        className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
      >
        Abort Merge
      </button>
    </div>
  )
}
