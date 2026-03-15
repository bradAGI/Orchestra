import { useState } from 'react'
import { Plus, Minus, Send } from 'lucide-react'
import type { BackendConfig, GitStatusEntry } from '@/lib/orchestra-client'
import { gitStage, gitUnstage, gitCommit, gitPush } from '@/lib/orchestra-client'

function statusColor(code: string): string {
  const c = code.trim().replace('?', '')
  if (c === 'M') return 'bg-blue-500/20 text-blue-400'
  if (c === 'A' || code.includes('?')) return 'bg-green-500/20 text-green-400'
  if (c === 'D') return 'bg-red-500/20 text-red-400'
  if (c === 'R') return 'bg-amber-500/20 text-amber-400'
  return 'bg-muted/20 text-muted-foreground'
}

function statusLabel(code: string): string {
  if (code.includes('?')) return '?'
  const c = code.trim()
  return c.charAt(0) || c
}

type ClassifiedFiles = {
  staged: GitStatusEntry[]
  unstaged: GitStatusEntry[]
}

function classifyFiles(status: GitStatusEntry[]): ClassifiedFiles {
  const staged: GitStatusEntry[] = []
  const unstaged: GitStatusEntry[] = []

  for (const entry of status) {
    const s = entry.status
    // First char = staging area, second char = working tree
    // '??' means untracked (unstaged)
    if (s === '??') {
      unstaged.push(entry)
      continue
    }
    const indexCode = s.charAt(0)
    const wtCode = s.charAt(1)
    if (indexCode !== ' ' && indexCode !== '?') {
      staged.push({ ...entry, status: indexCode })
    }
    if (wtCode !== ' ' && wtCode !== '?') {
      unstaged.push({ ...entry, status: wtCode })
    }
  }

  return { staged, unstaged }
}

export function ChangesList({
  projectId,
  config,
  status,
  onFileSelect,
  onRefresh,
}: {
  projectId: string
  config: BackendConfig
  status: GitStatusEntry[]
  onFileSelect: (path: string) => void
  onRefresh: () => void
}) {
  const [commitMsg, setCommitMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const { staged, unstaged } = classifyFiles(status)

  async function handleStage(files: string[]) {
    setLoading(true)
    try {
      await gitStage(config, projectId, files)
      onRefresh()
    } catch (err) {
      console.error('stage failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUnstage(files: string[]) {
    setLoading(true)
    try {
      await gitUnstage(config, projectId, files)
      onRefresh()
    } catch (err) {
      console.error('unstage failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit(andPush: boolean) {
    if (!commitMsg.trim() || loading) return
    setLoading(true)
    try {
      await gitCommit(config, projectId, commitMsg.trim())
      if (andPush) {
        await gitPush(config, projectId)
      }
      setCommitMsg('')
      onRefresh()
    } catch (err) {
      console.error('commit failed', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Commit section — always visible at top */}
      <div className="border-b border-border/40 p-3 shrink-0 bg-card/50">
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message..."
          rows={2}
          className="w-full bg-muted/10 border border-border/40 rounded-lg px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/40 resize-none outline-none focus:border-primary/60"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => handleCommit(false)}
            disabled={!commitMsg.trim() || staged.length === 0 || loading}
            className="flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Commit
          </button>
          <button
            onClick={() => handleCommit(true)}
            disabled={!commitMsg.trim() || staged.length === 0 || loading}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Send size={10} />
            Push
          </button>
        </div>
      </div>

      {/* Staged section */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-3 py-1.5 bg-green-500/5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">
            Staged ({staged.length})
          </span>
          {staged.length > 0 && (
            <button
              onClick={() => handleUnstage(staged.map((f) => f.path))}
              disabled={loading}
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Unstage All
            </button>
          )}
        </div>
        <div className="max-h-[30vh] overflow-y-auto">
          {staged.map((entry) => (
            <div
              key={`s-${entry.path}`}
              className="flex items-center gap-2 px-3 py-1 hover:bg-muted/10 group"
            >
              <span className={`text-[9px] font-bold uppercase w-5 text-center rounded px-1 ${statusColor(entry.status)}`}>
                {statusLabel(entry.status)}
              </span>
              <button
                onClick={() => onFileSelect(entry.path)}
                className="flex-1 text-left text-[11px] text-foreground truncate hover:text-primary"
                title={entry.path}
              >
                {entry.path}
              </button>
              <button
                onClick={() => handleUnstage([entry.path])}
                disabled={loading}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
                title="Unstage"
              >
                <Minus size={12} />
              </button>
            </div>
          ))}
          {staged.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-muted-foreground/50">No staged files</div>
          )}
        </div>
      </div>

      {/* Unstaged section */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">
            Unstaged ({unstaged.length})
          </span>
          {unstaged.length > 0 && (
            <button
              onClick={() => handleStage(unstaged.map((f) => f.path))}
              disabled={loading}
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Stage All
            </button>
          )}
        </div>
        <div className="max-h-[30vh] overflow-y-auto">
          {unstaged.map((entry) => (
            <div
              key={`u-${entry.path}`}
              className="flex items-center gap-2 px-3 py-1 hover:bg-muted/10 group"
            >
              <span className={`text-[9px] font-bold uppercase w-5 text-center rounded px-1 ${statusColor(entry.status)}`}>
                {statusLabel(entry.status)}
              </span>
              <button
                onClick={() => onFileSelect(entry.path)}
                className="flex-1 text-left text-[11px] text-foreground truncate hover:text-primary"
                title={entry.path}
              >
                {entry.path}
              </button>
              <button
                onClick={() => handleStage([entry.path])}
                disabled={loading}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-green-400"
                title="Stage"
              >
                <Plus size={12} />
              </button>
            </div>
          ))}
          {unstaged.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-muted-foreground/50">No unstaged files</div>
          )}
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="flex-1" />
    </div>
  )
}
