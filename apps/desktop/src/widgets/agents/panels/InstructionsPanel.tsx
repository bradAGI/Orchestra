// apps/desktop/src/widgets/agents/panels/InstructionsPanel.tsx
import { useState, useEffect } from 'react'
import { Save, Loader2, RotateCcw, FilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InstructionsPanelProps {
  content: string
  path: string
  exists: boolean
  saving: string | null
  onSave: (content: string) => Promise<void>
}

export function InstructionsPanel({ content: propsContent, path, exists, saving, onSave }: InstructionsPanelProps) {
  const [content, setContent] = useState(propsContent)
  const isDirty = content !== propsContent

  useEffect(() => {
    setContent(propsContent)
  }, [propsContent])

  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p className="text-sm font-medium">No CLAUDE.md found</p>
        <p className="text-[10px] font-mono text-muted-foreground/50">{path}</p>
        <Button
          size="sm"
          onClick={() => onSave('')}
          disabled={!!saving}
          className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
        >
          {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <FilePlus size={12} className="mr-1.5" />}
          Create
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-sm font-bold">CLAUDE.md</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">{path}</p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>
            <Button size="sm" variant="ghost" onClick={() => setContent(propsContent)} className="h-7 text-[10px]">
              <RotateCcw size={10} className="mr-1" /> Discard
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(content)}
              disabled={!!saving}
              className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
            >
              {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
              Save
            </Button>
          </div>
        )}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# CLAUDE.md&#10;&#10;Describe how Claude should work on your codebase..."
        className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
        spellCheck={false}
      />
    </div>
  )
}
