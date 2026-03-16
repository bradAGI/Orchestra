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

function initials(author: string): string {
  const parts = author.split(/[\s@]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (author.slice(0, 2) || '??').toUpperCase()
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

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((commit) => {
          const hash = commit.hash ?? ''
          const selected = hash === selectedHash
          return (
            <button
              key={hash}
              onClick={() => onSelectCommit(hash)}
              className={`w-full text-left flex items-start gap-2.5 px-3 py-2 hover:bg-muted/10 transition-colors ${
                selected ? 'border-l-2 border-primary bg-primary/5' : 'border-l-2 border-transparent'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0 mt-0.5">
                {initials(commit.author ?? '')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground truncate">{commit.message}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[9px] text-muted-foreground/60">{hash.slice(0, 7)}</span>
                  <span className="text-[9px] text-muted-foreground/40">{relativeTime(commit.date)}</span>
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
