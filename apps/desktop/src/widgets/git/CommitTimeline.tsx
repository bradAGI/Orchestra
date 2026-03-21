import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import type { GitCommit } from '@/lib/orchestra-client'

function relativeTime(dateStr: string): string {
  const now = Date.now()
  // Handle Unix timestamp (seconds) or ISO date string
  const parsed = /^\d+$/.test(dateStr) ? Number(dateStr) * 1000 : new Date(dateStr).getTime()
  if (Number.isNaN(parsed)) return dateStr
  const diff = now - parsed
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function CommitTimeline({
  commits,
  selectedHash,
  onSelectCommit,
}: {
  commits: GitCommit[]
  selectedHash: string | null
  onSelectCommit: (hash: string) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return commits
    const q = search.toLowerCase()
    return commits.filter((c) => c.message.toLowerCase().includes(q))
  }, [commits, search])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 bg-muted/10 rounded-lg px-2 py-1">
          <Search size={12} className="text-muted-foreground/50 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commits..."
            className="bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none flex-1"
          />
        </div>
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((commit) => {
          const hash = commit.hash ?? ''
          const selected = hash === selectedHash
          return (
            <button
              key={hash}
              onClick={() => onSelectCommit(hash)}
              data-selected={selected}
              className={`w-full text-left flex items-stretch gap-0 px-3 py-2 hover:bg-muted/10 transition-colors ${
                selected ? 'bg-primary/5' : ''
              }`}
            >
              {/* Timeline column */}
              <div className="relative flex flex-col items-center w-5 shrink-0 mr-2.5">
                {/* Vertical line */}
                <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-[2px] bg-primary/20" />
                {/* Dot */}
                <div
                  data-testid="timeline-dot"
                  className={`relative mt-1.5 w-2 h-2 rounded-full border-2 ${
                    selected
                      ? 'bg-primary border-primary'
                      : 'bg-background border-primary/50'
                  }`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground truncate">{commit.message}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[9px] bg-muted/20 rounded px-1 py-px text-muted-foreground/60">
                    {hash.slice(0, 7)}
                  </span>
                  {commit.author && (
                    <span className="text-[10px] text-muted-foreground/70">{commit.author}</span>
                  )}
                  <span className="text-[9px] text-muted-foreground/40">
                    {relativeTime(commit.date)}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-[10px] text-muted-foreground/50 text-center">
            {search ? 'No matching commits' : 'No commits'}
          </div>
        )}
      </div>
    </div>
  )
}
