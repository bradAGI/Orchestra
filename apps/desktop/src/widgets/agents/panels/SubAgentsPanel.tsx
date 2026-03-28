// apps/desktop/src/widgets/agents/panels/SubAgentsPanel.tsx
import { useState, useEffect } from 'react'
import { Save, Loader2, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PanelProps } from '../types'

export function SubAgentsPanel({ items, selectedItem, onSave, onDelete, loading, saving }: PanelProps) {
  const selected = items.find(i => i.path === selectedItem) ?? null
  const [content, setContent] = useState(selected?.content ?? '')
  const isDirty = selected ? content !== selected.content : false

  useEffect(() => { setContent(selected?.content ?? '') }, [selected])

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[200px] w-full" /></div>
  }

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/20">
        <div className="text-center space-y-2">
          <p className="text-sm font-bold uppercase tracking-widest">No sub-agent selected</p>
          <p className="text-[10px]">Sub-agents run in isolated contexts with their own tools and model</p>
        </div>
      </div>
    )
  }

  const name = selected.name.split('/').pop() ?? selected.name

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold truncate">{name}</h3>
        <div className="flex items-center gap-2">
          {isDirty && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>}
          <Button size="sm" variant="ghost" onClick={() => onDelete(selected.path)} className="h-7 text-[10px] text-muted-foreground/40 hover:text-red-400">
            <Trash2 size={10} />
          </Button>
          {isDirty && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setContent(selected.content)} className="h-7 text-[10px]">
                <RotateCcw size={10} className="mr-1" /> Discard
              </Button>
              <Button size="sm" onClick={() => onSave(selected.path, content)} disabled={!!saving} className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg">
                {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />} Save
              </Button>
            </>
          )}
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Sub-agent definition..."
        className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
        spellCheck={false}
      />
    </div>
  )
}
