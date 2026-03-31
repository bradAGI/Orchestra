// apps/desktop/src/widgets/agents/panels/SkillsPanel.tsx
import { useState, useEffect } from 'react'
import { Save, Loader2, RotateCcw, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClaudeFileEntry } from '@/lib/orchestra-client'

interface FileListPanelProps {
  items: ClaudeFileEntry[]
  saving: string | null
  onSave: (name: string, content: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
}

const PLACEHOLDER = `---
name: my-skill
description: What this skill does
---

# Skill instructions here`

export function SkillsPanel({ items, saving, onSave, onDelete }: FileListPanelProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [content, setContent] = useState('')

  // Auto-select first item if nothing selected
  useEffect(() => {
    if (!selectedName && items.length > 0) {
      setSelectedName(items[0].name)
    }
  }, [selectedName, items])

  // Clear selection if selected item was removed
  useEffect(() => {
    if (selectedName && !items.find(i => i.name === selectedName)) {
      setSelectedName(items.length > 0 ? items[0].name : null)
    }
  }, [selectedName, items])

  const selected = items.find(i => i.name === selectedName) ?? null

  // Sync content when selection changes
  useEffect(() => {
    setContent(selected?.content ?? '')
  }, [selected])

  const isDirty = selected ? content !== selected.content : false

  const handleAdd = () => {
    const name = window.prompt('Skill filename (e.g. refactor.md):')
    if (!name) return
    onSave(name, '')
  }

  const handleDelete = () => {
    if (!selected) return
    if (!window.confirm(`Delete "${selected.name}"? This will remove the file from disk.`)) return
    onDelete(selected.name)
  }

  return (
    <div className="flex h-full">
      {/* Left side: file list */}
      <div className="w-[200px] flex flex-col border-r border-border/30 shrink-0">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Skills</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">Reusable prompt templates in .claude/skills/</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {items.map(item => (
            <button
              key={item.name}
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
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAdd}
            className="w-full h-7 text-[10px] text-muted-foreground/50 hover:text-foreground"
          >
            <Plus size={10} className="mr-1" /> Add Skill
          </Button>
        </div>
      </div>

      {/* Right side: editor */}
      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        {selected ? (
          <>
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold truncate">{selected.name}</h3>
              <div className="flex items-center gap-2">
                {isDirty && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>}
                <Button size="sm" variant="ghost" onClick={handleDelete} className="h-7 text-[10px] text-muted-foreground/50 hover:text-red-400">
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
              placeholder={PLACEHOLDER}
              className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest">No skill selected</p>
              <p className="text-[10px]">Select a skill from the list or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
