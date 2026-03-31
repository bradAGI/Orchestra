import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  GitBranch,
  Trash2,
  GitMerge,
  Plus,
  Search,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { BackendConfig, BranchDetail } from '@/lib/orchestra-client'
import {
  fetchProjectGitBranchesDetail,
  gitCreateBranch,
  gitDeleteBranch,
  gitCheckout,
  gitMerge,
  gitFetch,
} from '@/lib/orchestra-client'

interface BranchManagerViewProps {
  config: BackendConfig
  projectId: string
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function BranchManagerView({ config, projectId }: BranchManagerViewProps) {
  const [branches, setBranches] = useState<BranchDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [mergeConfirm, setMergeConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [remotesExpanded, setRemotesExpanded] = useState(true)
  const [currentBranch, setCurrentBranch] = useState('')

  const loadBranches = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchProjectGitBranchesDetail(config, projectId)
      setBranches(data.branches || [])
      setCurrentBranch(data.current || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }, [config, projectId])

  useEffect(() => {
    loadBranches()
  }, [loadBranches])

  const handleFetch = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await gitFetch(config, projectId)
      await loadBranches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }, [config, projectId, loadBranches])

  const handleCheckout = useCallback(async (branch: string) => {
    setLoading(true)
    setError('')
    try {
      await gitCheckout(config, projectId, branch)
      await loadBranches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }, [config, projectId, loadBranches])

  const handleDelete = useCallback(async (branch: string) => {
    setDeleteConfirm(null)
    setLoading(true)
    setError('')
    try {
      await gitDeleteBranch(config, projectId, branch)
      await loadBranches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }, [config, projectId, loadBranches])

  const handleMerge = useCallback(async (branch: string) => {
    setMergeConfirm(null)
    setLoading(true)
    setError('')
    try {
      await gitMerge(config, projectId, branch)
      await loadBranches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }, [config, projectId, loadBranches])

  const handleCreate = useCallback(async () => {
    const name = newBranchName.trim()
    if (!name) return
    setLoading(true)
    setError('')
    try {
      // checkout base branch first if specified and different from current
      if (baseBranch && baseBranch !== currentBranch) {
        await gitCheckout(config, projectId, baseBranch)
      }
      await gitCreateBranch(config, projectId, name)
      setCreateOpen(false)
      setNewBranchName('')
      setBaseBranch('')
      await loadBranches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create branch failed')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }, [config, projectId, newBranchName, baseBranch, currentBranch, loadBranches])

  const localBranches = useMemo(() => {
    const filtered = branches.filter((b) => !b.is_remote)
    if (!search) return filtered
    const q = search.toLowerCase()
    return filtered.filter((b) => b.name.toLowerCase().includes(q))
  }, [branches, search])

  const remoteBranches = useMemo(() => {
    const filtered = branches.filter((b) => b.is_remote)
    if (!search) return filtered
    const q = search.toLowerCase()
    return filtered.filter((b) => b.name.toLowerCase().includes(q))
  }, [branches, search])

  const localBranchNames = useMemo(
    () => branches.filter((b) => !b.is_remote).map((b) => b.name),
    [branches],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Error banner */}
      {error && (
        <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-[10px] text-red-400 shrink-0 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400">
            <X size={10} />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 shrink-0">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter branches..."
            className="w-full rounded-md pl-7 pr-2 py-1.5 text-[11px] bg-muted/10 text-foreground border border-border/30 outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
          />
        </div>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="rounded-md px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground/50 bg-muted/10 border border-border/20 hover:bg-muted/30 hover:text-foreground transition-all flex items-center gap-1"
          title="Fetch from remote"
        >
          <RefreshCcw size={10} className={loading ? 'animate-spin' : ''} />
          Fetch
        </button>
        <button
          onClick={() => {
            setCreateOpen((v) => !v)
            if (!createOpen && !baseBranch) setBaseBranch(currentBranch)
          }}
          disabled={loading}
          className="rounded-md px-2.5 py-1.5 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-1"
        >
          <Plus size={10} />
          New Branch
        </button>
      </div>

      {/* Create branch form */}
      {createOpen && (
        <div className="px-3 py-2.5 border-b border-border/40 bg-card/40 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setCreateOpen(false); setNewBranchName('') }
              }}
              placeholder="Branch name..."
              autoFocus
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] bg-muted/10 text-foreground border border-primary/30 outline-none focus:border-primary/60 font-mono placeholder:text-muted-foreground/30"
            />
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <span>from</span>
              <select
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                className="rounded-md px-2 py-1.5 text-[11px] bg-muted/10 text-foreground border border-border/30 outline-none focus:border-primary/40"
              >
                {localBranchNames.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={loading || !newBranchName.trim()}
              className="rounded-md px-3 py-1.5 text-[10px] font-bold text-primary bg-primary/15 border border-primary/20 hover:bg-primary/25 transition-all disabled:opacity-40"
            >
              Create
            </button>
            <button
              onClick={() => { setCreateOpen(false); setNewBranchName(''); setBaseBranch('') }}
              className="rounded-md px-2 py-1.5 text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Branch list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Local branches */}
        {localBranches.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 bg-card/20 border-b border-border/20 sticky top-0 z-10">
              Local Branches
              <span className="ml-1.5 text-muted-foreground/30">{localBranches.length}</span>
            </div>
            {localBranches.map((branch) => (
              <BranchRow
                key={branch.name}
                branch={branch}
                currentBranch={currentBranch}
                deleteConfirm={deleteConfirm}
                mergeConfirm={mergeConfirm}
                loading={loading}
                onCheckout={handleCheckout}
                onDelete={handleDelete}
                onMerge={handleMerge}
                onDeleteConfirm={setDeleteConfirm}
                onMergeConfirm={setMergeConfirm}
              />
            ))}
          </div>
        )}

        {/* Remote branches */}
        {remoteBranches.length > 0 && (
          <div>
            <button
              onClick={() => setRemotesExpanded((v) => !v)}
              className="w-full flex items-center gap-1 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 bg-card/20 border-b border-border/20 border-t border-t-border/20 sticky top-0 z-10 hover:bg-card/30 transition-colors"
            >
              {remotesExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Remote Branches
              <span className="ml-1 text-muted-foreground/30">{remoteBranches.length}</span>
            </button>
            {remotesExpanded && remoteBranches.map((branch) => (
              <BranchRow
                key={branch.name}
                branch={branch}
                currentBranch={currentBranch}
                deleteConfirm={deleteConfirm}
                mergeConfirm={mergeConfirm}
                loading={loading}
                onCheckout={handleCheckout}
                onDelete={handleDelete}
                onMerge={handleMerge}
                onDeleteConfirm={setDeleteConfirm}
                onMergeConfirm={setMergeConfirm}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {localBranches.length === 0 && remoteBranches.length === 0 && !loading && (
          <div className="flex items-center justify-center h-32 text-muted-foreground/40 text-[11px]">
            {search ? 'No branches match your filter' : 'No branches found'}
          </div>
        )}

        {/* Loading state */}
        {loading && branches.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground/40 text-[11px]">
            Loading branches...
          </div>
        )}
      </div>
    </div>
  )
}

function BranchRow({
  branch,
  currentBranch,
  deleteConfirm,
  mergeConfirm,
  loading,
  onCheckout,
  onDelete,
  onMerge,
  onDeleteConfirm,
  onMergeConfirm,
}: {
  branch: BranchDetail
  currentBranch: string
  deleteConfirm: string | null
  mergeConfirm: string | null
  loading: boolean
  onCheckout: (name: string) => void
  onDelete: (name: string) => void
  onMerge: (name: string) => void
  onDeleteConfirm: (name: string | null) => void
  onMergeConfirm: (name: string | null) => void
}) {
  const isCurrent = branch.is_current
  const isDefault = branch.is_default
  const canDelete = !isCurrent && !isDefault
  const canMerge = !isCurrent

  // Delete confirmation
  if (deleteConfirm === branch.name) {
    return (
      <div className="px-3 py-2 border-b border-border/20 bg-red-500/5 flex items-center gap-2">
        <span className="text-[11px] text-foreground flex-1">
          Delete <span className="font-mono font-bold">{branch.name}</span>?
        </span>
        <button
          onClick={() => onDelete(branch.name)}
          disabled={loading}
          className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Delete
        </button>
        <button
          onClick={() => onDeleteConfirm(null)}
          className="px-2 py-1 rounded text-[10px] text-muted-foreground hover:bg-muted/20 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  // Merge confirmation
  if (mergeConfirm === branch.name) {
    return (
      <div className="px-3 py-2 border-b border-border/20 bg-primary/5 flex items-center gap-2">
        <span className="text-[11px] text-foreground flex-1">
          Merge <span className="font-mono font-bold">{branch.name}</span> into <span className="font-mono font-bold">{currentBranch}</span>?
        </span>
        <button
          onClick={() => onMerge(branch.name)}
          disabled={loading}
          className="px-2 py-1 rounded text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
        >
          Merge
        </button>
        <button
          onClick={() => onMergeConfirm(null)}
          className="px-2 py-1 rounded text-[10px] text-muted-foreground hover:bg-muted/20 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div
      className={`group px-3 py-2 border-b border-border/20 flex items-center gap-2 hover:bg-muted/10 transition-colors ${
        isCurrent ? 'bg-primary/5' : ''
      }`}
    >
      {/* Current indicator */}
      <div className="w-2 shrink-0 flex justify-center">
        {isCurrent ? (
          <span className="inline-block w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/30" />
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/10" />
        )}
      </div>

      {/* Branch info */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <GitBranch size={12} className={isCurrent ? 'text-primary shrink-0' : 'text-muted-foreground/40 shrink-0'} />
        <span
          className={`font-mono text-[11px] truncate ${
            isCurrent ? 'text-primary font-bold' : 'text-foreground'
          }`}
        >
          {branch.name}
        </span>

        {/* Badges */}
        {isDefault && (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary/70 border border-primary/15">
            default
          </span>
        )}
        {branch.is_remote && (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted/20 text-muted-foreground/50 border border-border/20">
            remote
          </span>
        )}

        {/* Ahead/behind - local branches only */}
        {!branch.is_remote && (branch.ahead > 0 || branch.behind > 0) && (
          <div className="shrink-0 flex items-center gap-1.5 text-[10px]">
            {branch.ahead > 0 && (
              <span className="flex items-center gap-0.5 text-primary">
                <ArrowUpRight size={10} />
                {branch.ahead}
              </span>
            )}
            {branch.behind > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400">
                <ArrowDownRight size={10} />
                {branch.behind}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Commit info */}
      <div className="hidden sm:flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground/40">
        {branch.last_commit_message && (
          <span className="max-w-[200px] truncate" title={branch.last_commit_message}>
            {branch.last_commit_message}
          </span>
        )}
        {branch.last_commit_author && (
          <span className="shrink-0">{branch.last_commit_author}</span>
        )}
        {branch.last_commit_date && (
          <span className="shrink-0 tabular-nums">{relativeTime(branch.last_commit_date)}</span>
        )}
      </div>

      {/* Action buttons - visible on hover */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isCurrent && (
          <button
            onClick={() => onCheckout(branch.name)}
            disabled={loading}
            className="rounded px-1.5 py-1 text-[9px] font-bold text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-0.5"
            title="Checkout"
          >
            <Check size={10} />
            Checkout
          </button>
        )}
        {canMerge && (
          <button
            onClick={() => onMergeConfirm(branch.name)}
            disabled={loading}
            className="rounded px-1.5 py-1 text-[9px] font-bold text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-0.5"
            title={`Merge into ${currentBranch}`}
          >
            <GitMerge size={10} />
            Merge
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDeleteConfirm(branch.name)}
            disabled={loading}
            className="rounded px-1.5 py-1 text-[9px] font-bold text-muted-foreground/60 hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center gap-0.5"
            title="Delete branch"
          >
            <Trash2 size={10} />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
