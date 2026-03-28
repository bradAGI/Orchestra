// apps/desktop/src/widgets/agents/panels/InstructionsPanel.tsx
import { useState, useEffect } from 'react'
import { Save, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PanelProps } from '../types'

export function InstructionsPanel({ items, onSave, loading, saving, provider }: PanelProps) {
  const config = items[0] ?? null
  const [content, setContent] = useState(config?.content ?? '')
  const isDirty = config ? content !== config.content : content.trim().length > 0

  useEffect(() => {
    setContent(config?.content ?? '')
  }, [config])

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[300px] w-full" /></div>
  }

  const instructionFile = provider === 'codex' ? 'AGENTS.md' : provider === 'gemini' ? 'GEMINI.md' : 'CLAUDE.md'

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-sm font-bold">{instructionFile}</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Tell {provider} how to work on your code</p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>
            <Button size="sm" variant="ghost" onClick={() => setContent(config?.content ?? '')} className="h-7 text-[10px]">
              <RotateCcw size={10} className="mr-1" /> Discard
            </Button>
            <Button
              size="sm"
              onClick={() => config && onSave(config.path, content)}
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
        placeholder={`# ${provider} Instructions\n\nDescribe how ${provider} should work on your codebase...\n\n- Coding style preferences\n- Testing requirements\n- Architecture guidelines`}
        className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
        spellCheck={false}
      />
    </div>
  )
}
