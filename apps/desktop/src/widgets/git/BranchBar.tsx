import { useState, useRef, useEffect } from 'react'
import { GitBranch, ChevronDown, Archive } from 'lucide-react'
import type { BackendConfig, StashEntry } from '@/lib/orchestra-client'
import { gitCheckout, gitCreateBranch, gitStash, gitStashPop } from '@/lib/orchestra-client'
import { StashPanel } from './StashPanel'

interface BranchBarProps {
  projectId: string
  config: BackendConfig
  currentBranch: string
  branches: string[]
  remoteBranches?: string[]
  aheadBehind?: { ahead: number; behind: number }
  onBranchChange: () => void
  onPush?: () => void
  onPull?: () => void
  onFetch?: () => void
  onMerge?: (branch: string) => void
  onDeleteBranch?: (branch: string) => void
  stashes?: StashEntry[]
  onStashApply?: (ref: string) => void
  onStashDrop?: (ref: string) => void
}

export function BranchBar({
  projectId,
  config,
  currentBranch,
  branches,
  remoteBranches,
  aheadBehind,
  onBranchChange,
  onPush,
  onPull,
  onFetch,
  onMerge,
  onDeleteBranch,
  stashes,
  onStashApply,
  onStashDrop,
}: BranchBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [stashOpen, setStashOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'merge'; branch: string } | null>(null)
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const stashRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setCreating(false)
        setNewName('')
        setConfirmAction(null)
      }
      if (stashRef.current && !stashRef.current.contains(e.target as Node)) {
        setStashOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        setStashOpen(false)
        setCreating(false)
        setNewName('')
        setConfirmAction(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function handleCheckout(branch: string) {
    if (branch === currentBranch || loading) return
    setLoading(true)
    setError('')
    try {
      await gitCheckout(config, projectId, branch)
      setDropdownOpen(false)
      onBranchChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setTimeout(() => setError(''), 4000)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name || loading) return
    setLoading(true)
    setError('')
    try {
      await gitCreateBranch(config, projectId, name)
      setCreating(false)
      setNewName('')
      setDropdownOpen(false)
      onBranchChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create branch failed')
      setTimeout(() => setError(''), 4000)
    } finally {
      setLoading(false)
    }
  }

  async function handleStash() {
    setStashOpen(false)
    setLoading(true)
    try {
      await gitStash(config, projectId)
      onBranchChange()
    } catch (err) {
      console.error('stash failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleStashPop() {
    setStashOpen(false)
    setLoading(true)
    try {
      await gitStashPop(config, projectId)
      onBranchChange()
    } catch (err) {
      console.error('stash pop failed', err)
    } finally {
      setLoading(false)
    }
  }

  function handleDeleteConfirm(branch: string) {
    setConfirmAction(null)
    onDeleteBranch?.(branch)
  }

  function handleMergeConfirm(branch: string) {
    setConfirmAction(null)
    onMerge?.(branch)
  }

  const actionBtnClass =
    'rounded-md px-2.5 py-1 text-[10px] font-bold text-muted-foreground/50 bg-muted/10 border border-border/20 hover:bg-muted/30 hover:text-foreground transition-all'

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 shrink-0 relative h-10">
      {error && (
        <div className="absolute top-full left-0 right-0 z-10 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-[10px] text-red-400">
          {error}
        </div>
      )}

      {/* Branch dropdown trigger */}
      <div className="relative" ref={dropdownRef}>
        <button
          data-testid="branch-trigger"
          onClick={() => setDropdownOpen((v) => !v)}
          disabled={loading}
          className="rounded-md px-2.5 py-1 text-[10px] font-bold bg-primary/15 text-primary border border-primary/20 shadow-sm shadow-primary/10 flex items-center gap-1.5 transition-all"
        >
          <GitBranch size={12} className="shrink-0" />
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {currentBranch}
          <ChevronDown size={10} className="opacity-60" />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1 bg-card border border-border/40 rounded-xl shadow-lg z-20 py-1 min-w-[240px] max-h-[300px] overflow-y-auto">
            {/* Local branches section */}
            <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Local Branches
            </div>
            {branches.map((branch) =>
              confirmAction?.branch === branch ? (
                <div key={branch} data-testid={`branch-row-${branch}`} className="px-3 py-1.5 text-[11px] flex items-center gap-2">
                  <span className="text-foreground">
                    {confirmAction.type === 'delete'
                      ? `Delete ${branch}?`
                      : `Merge ${branch} into ${currentBranch}?`}
                  </span>
                  <button
                    onClick={() =>
                      confirmAction.type === 'delete'
                        ? handleDeleteConfirm(branch)
                        : handleMergeConfirm(branch)
                    }
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  >
                    {confirmAction.type === 'delete' ? 'Delete' : 'Merge'}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:bg-muted/20"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div
                  key={branch}
                  data-testid={`branch-row-${branch}`}
                  className="px-3 py-1.5 text-[11px] hover:bg-muted/20 cursor-pointer flex items-center justify-between"
                  onClick={() => handleCheckout(branch)}
                  onMouseEnter={() => setHoveredBranch(branch)}
                  onMouseLeave={() => setHoveredBranch(null)}
                >
                  <span className="flex items-center gap-1.5">
                    {branch === currentBranch && (
                      <span
                        data-testid="green-dot"
                        className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"
                      />
                    )}
                    <span className={branch === currentBranch ? 'text-primary font-bold' : 'text-foreground'}>
                      {branch}
                    </span>
                  </span>
                  {branch !== currentBranch && hoveredBranch === branch && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmAction({ type: 'merge', branch })
                        }}
                        className="px-1 py-0.5 rounded text-[9px] text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        title="Merge into current"
                      >
                        Merge
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmAction({ type: 'delete', branch })
                        }}
                        className="px-1 py-0.5 rounded text-[9px] text-red-400/60 hover:bg-red-500/10 hover:text-red-400"
                        title="Delete branch"
                      >
                        Del
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Remote branches section */}
            {remoteBranches && remoteBranches.length > 0 && (
              <>
                <div className="my-1 border-t border-border/20" />
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  Remote Branches
                </div>
                {remoteBranches.map((branch) => (
                  <div
                    key={branch}
                    data-testid={`remote-branch-row-${branch}`}
                    className="px-3 py-1.5 text-[11px] text-muted-foreground/60 hover:bg-muted/20 cursor-pointer flex items-center"
                    onClick={() => handleCheckout(branch.replace(/^origin\//, ''))}
                  >
                    {branch}
                  </div>
                ))}
              </>
            )}

            {/* Divider + New branch */}
            <div className="my-1 border-t border-border/20" />
            {creating ? (
              <div className="px-3 py-1.5">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') {
                      setCreating(false)
                      setNewName('')
                    }
                  }}
                  placeholder="branch name..."
                  className="w-full rounded-md px-2 py-1 text-[10px] bg-muted/10 text-foreground border border-primary/30 outline-none focus:border-primary/60"
                />
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-1.5 text-[11px] text-primary/60 hover:bg-muted/20 hover:text-primary"
              >
                + New branch
              </button>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      {onFetch && (
        <button onClick={onFetch} disabled={loading} className={actionBtnClass}>
          Fetch
        </button>
      )}
      {onPull && (
        <button onClick={onPull} disabled={loading} className={actionBtnClass}>
          Pull{aheadBehind && aheadBehind.behind > 0 ? ` ↓${aheadBehind.behind}` : ''}
        </button>
      )}
      {onPush && (
        <button onClick={onPush} disabled={loading} className={actionBtnClass}>
          Push{aheadBehind && aheadBehind.ahead > 0 ? ` ↑${aheadBehind.ahead}` : ''}
        </button>
      )}

      {/* Stash dropdown */}
      <div className="relative shrink-0" ref={stashRef}>
        <button
          onClick={() => setStashOpen((v) => !v)}
          disabled={loading}
          className={`${actionBtnClass} flex items-center gap-1`}
        >
          <Archive size={10} />
          Stash
        </button>
        {stashOpen && (
          <StashPanel
            stashes={stashes ?? []}
            onStash={handleStash}
            onApply={(ref) => { setStashOpen(false); onStashApply?.(ref) }}
            onDrop={(ref) => { setStashOpen(false); onStashDrop?.(ref) }}
            onClose={() => setStashOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
