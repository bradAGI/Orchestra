import { useEffect, useState } from 'react'
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/dialog'
import type { ProviderFileEntry } from '@core/api/client'

interface CodexRulesPanelProps {
  items: ProviderFileEntry[]
  saving: string | null
  onSave: (name: string, content: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
}

const RULE_TEMPLATE = `prefix_rule("git", "status")
Always check the repository state before modifying files.
`

export function CodexRulesPanel({ items, saving, onSave, onDelete }: CodexRulesPanelProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPending, setCreatePending] = useState(false)

  useEffect(() => {
    if (!selectedName && items.length > 0) setSelectedName(items[0].name)
  }, [selectedName, items])

  useEffect(() => {
    if (selectedName && !items.find(item => item.name === selectedName)) {
      setSelectedName(items.length > 0 ? items[0].name : null)
    }
  }, [selectedName, items])

  const selected = items.find(item => item.name === selectedName) ?? null

  useEffect(() => {
    setContent(selected?.content ?? '')
  }, [selected])

  const isDirty = selected ? content !== selected.content : false

  const handleCreate = async () => {
    const name = createName.trim()
    if (!name) return
    setCreatePending(true)
    try {
      await onSave(name, RULE_TEMPLATE)
      setSelectedName(name.endsWith('.rules') ? name : `${name}.rules`)
      setCreateOpen(false)
      setCreateName('')
    } finally {
      setCreatePending(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeletePending(true)
    try {
      await onDelete(deleteTarget)
      setDeleteTarget(null)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-[220px] flex flex-col border-r border-border/30 shrink-0">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Rules</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">.codex/rules/*.rules</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {items.map(item => (
            <button
              key={item.path}
              onClick={() => setSelectedName(item.name)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] truncate transition-colors ${
                item.name === selectedName
                  ? 'bg-primary/8 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted/10 border border-transparent'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="p-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)} className="w-full h-7 text-[10px] text-muted-foreground/50 hover:text-foreground">
            <Plus size={10} className="mr-1" /> Add Rule
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        {selected ? (
          <>
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold truncate">{selected.name}</h3>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Codex rule files shape tool and command permissions without editing the main config.</p>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>}
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(selected.name)} className="h-7 text-[10px] text-muted-foreground/50 hover:text-red-400">
                  <Trash2 size={10} />
                </Button>
                {isDirty && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setContent(selected.content)} className="h-7 text-[10px]">
                      <RotateCcw size={10} className="mr-1" /> Discard
                    </Button>
                    <Button size="sm" onClick={() => onSave(selected.name, content)} disabled={!!saving} className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg">
                      {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />} Save
                    </Button>
                  </>
                )}
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={RULE_TEMPLATE}
              className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest">No rule selected</p>
              <p className="text-[10px]">Codex rules live in .rules files and are loaded by the Codex client.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Codex Rule</DialogTitle>
            <DialogDescription>
              Creates a new <code className="font-mono">.rules</code> file in <code className="font-mono">.codex/rules</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Rule Name</label>
            <input
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && createName.trim() && handleCreate()}
              placeholder="e.g. git-safety"
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName('') }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || createPending}>
              <Plus className="h-4 w-4 mr-2" />
              {createPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="h-5 w-5" />
              Delete Rule
            </DialogTitle>
            <DialogDescription>
              This removes the selected rule from disk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletePending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletePending}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deletePending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
