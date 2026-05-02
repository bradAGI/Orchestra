import { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { Button } from '@ui/button'
import type { FileResourceItem } from './FileResourcePanel'

interface OpenCodeInstructionsPanelProps {
  items: FileResourceItem[]
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
  onCreate: () => Promise<void>
}

export function OpenCodeInstructionsPanel({ items, saving, onSave, onCreate }: OpenCodeInstructionsPanelProps) {
  const selected = items[0] ?? null
  const parsed = useMemo(() => safeParse(selected?.content ?? ''), [selected?.content])
  const [instructions, setInstructions] = useState(readInstructions(parsed))

  useEffect(() => {
    setInstructions(readInstructions(parsed))
  }, [parsed])

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/20">
        <div className="text-center space-y-2 max-w-md">
          <p className="text-sm font-bold uppercase tracking-widest">No config found</p>
          <p className="text-[10px]">OpenCode instructions are configured through the <code className="font-mono">instructions</code> array in <code className="font-mono">opencode.json</code>. Create a config file first.</p>
          <Button size="sm" onClick={() => onCreate()} className="h-8 px-4 text-[11px]">Create Config</Button>
        </div>
      </div>
    )
  }

  if (!parsed) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/20">
        <div className="text-center space-y-2 max-w-md">
          <p className="text-sm font-bold uppercase tracking-widest">Structured editing unavailable</p>
          <p className="text-[10px]">This OpenCode config could not be parsed cleanly. Use the Config panel raw editor first.</p>
        </div>
      </div>
    )
  }

  const isDirty = JSON.stringify(instructions) !== JSON.stringify(readInstructions(parsed))

  return (
    <div className="flex flex-col h-full p-4 gap-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Instructions</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">OpenCode instructions are a list of file paths or glob patterns stored in <code className="font-mono">instructions</code>.</p>
          <p className="text-[10px] text-muted-foreground/35 mt-1 font-mono truncate">{selected.path}</p>
        </div>
        {isDirty ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>
            <Button size="sm" variant="ghost" onClick={() => setInstructions(readInstructions(parsed))} className="h-7 text-[10px]">
              <RotateCcw size={10} className="mr-1" /> Discard
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(selected.path, buildConfig(parsed, instructions))}
              disabled={saving === selected.path}
              className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
            >
              {saving === selected.path ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
              Save
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-1">
        <p className="text-[11px] font-semibold">Instruction Paths</p>
        <p className="text-[10px] text-muted-foreground/50">Use file paths or glob patterns like <code className="font-mono">CONTRIBUTING.md</code>, <code className="font-mono">docs/guidelines.md</code>, or <code className="font-mono">.cursor/rules/*.md</code>.</p>
      </div>

      <ListField items={instructions} onChange={setInstructions} placeholder=".cursor/rules/*.md" />
    </div>
  )
}

function buildConfig(base: Record<string, unknown>, instructions: string[]) {
  const next = structuredClone(base)
  if (instructions.length > 0) next.instructions = instructions
  else delete next.instructions
  return `${JSON.stringify(next, null, 2)}\n`
}

function readInstructions(parsed: Record<string, unknown> | null): string[] {
  const value = parsed?.instructions
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function safeParse(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return null
  }
}

function ListField({ items, onChange, placeholder }: { items: string[], onChange: (items: string[]) => void, placeholder: string }) {
  const [draft, setDraft] = useState('')
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.length > 0 ? items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(items.filter((entry) => entry !== item))}
            className="inline-flex items-center gap-1 rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-[11px] font-mono"
          >
            {item}
          </button>
        )) : <span className="text-[10px] italic text-muted-foreground/35">No instruction paths configured</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              const next = draft.trim()
              if (next && !items.includes(next)) {
                onChange([...items, next])
                setDraft('')
              }
            }
          }}
          placeholder={placeholder}
          className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const next = draft.trim()
            if (next && !items.includes(next)) {
              onChange([...items, next])
              setDraft('')
            }
          }}
          className="h-9"
        >
          Add
        </Button>
      </div>
    </section>
  )
}
