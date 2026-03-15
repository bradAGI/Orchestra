import { useState, useRef, useEffect } from 'react'
import { GitBranch, Plus, Archive } from 'lucide-react'
import type { BackendConfig } from '@/lib/orchestra-client'
import { gitCheckout, gitCreateBranch, gitStash, gitStashPop } from '@/lib/orchestra-client'

export function BranchBar({
  projectId,
  config,
  currentBranch,
  branches,
  onBranchChange,
}: {
  projectId: string
  config: BackendConfig
  currentBranch: string
  branches: string[]
  onBranchChange: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [stashOpen, setStashOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const stashRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stashRef.current && !stashRef.current.contains(e.target as Node)) {
        setStashOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleCheckout(branch: string) {
    if (branch === currentBranch || loading) return
    setLoading(true)
    setError('')
    try {
      await gitCheckout(config, projectId, branch)
      onBranchChange()
    } catch (err: any) {
      setError(err?.message || 'Checkout failed')
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
      onBranchChange()
    } catch (err: any) {
      setError(err?.message || 'Create branch failed')
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

  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border/40 shrink-0 bg-card/30 relative">
      {error && (
        <div className="absolute top-full left-0 right-0 z-10 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-[10px] text-red-400">{error}</div>
      )}
      <div className="flex items-center gap-1 mr-1 shrink-0">
        <GitBranch size={14} className="text-primary/60" />
      </div>

      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
        {branches.map((branch) => (
          <button
            key={branch}
            onClick={() => handleCheckout(branch)}
            disabled={loading}
            className={`rounded-md px-2.5 py-1 text-[10px] font-bold whitespace-nowrap transition-all ${
              branch === currentBranch
                ? 'bg-primary/15 text-primary border border-primary/20 shadow-sm shadow-primary/10'
                : 'bg-muted/10 text-muted-foreground/60 border border-transparent hover:bg-muted/30 hover:text-foreground'
            }`}
          >
            {branch === currentBranch && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle animate-pulse" />
            )}
            {branch}
          </button>
        ))}

        {creating ? (
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            onBlur={() => { if (!newName.trim()) { setCreating(false); setNewName('') } }}
            placeholder="branch name..."
            className="rounded-md px-2.5 py-1 text-[10px] bg-muted/10 text-foreground border border-primary/30 outline-none focus:border-primary/60 w-28"
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="rounded-md px-2.5 py-1 text-[10px] text-muted-foreground/40 border border-dashed border-border/30 hover:border-primary/30 hover:text-primary/60 flex items-center gap-1 transition-all"
          >
            <Plus size={10} />
            New
          </button>
        )}
      </div>

      <div className="ml-2 relative shrink-0" ref={stashRef}>
        <button
          onClick={() => setStashOpen((v) => !v)}
          disabled={loading}
          className="rounded-md px-2.5 py-1 text-[10px] font-bold text-muted-foreground/50 bg-muted/10 border border-border/20 hover:bg-muted/30 hover:text-foreground flex items-center gap-1 transition-all"
        >
          <Archive size={10} />
          Stash
        </button>
        {stashOpen && (
          <div className="absolute right-0 top-full mt-1 bg-card border border-border/40 rounded-xl shadow-lg z-20 py-1 min-w-[120px]">
            <button
              onClick={handleStash}
              className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/20"
            >
              Stash Changes
            </button>
            <button
              onClick={handleStashPop}
              className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/20"
            >
              Pop Stash
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
