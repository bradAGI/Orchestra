import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@ui/dialog'
import type { FileResourceItem } from './FileResourcePanel'

interface GeminiCommandsPanelProps {
  items: FileResourceItem[]
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
}

export function GeminiCommandsPanel({ items, saving, onSave, onDelete, onCreate }: GeminiCommandsPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPending, setCreatePending] = useState(false)

  const effectiveSelectedKey = selectedKey && items.some(item => item.key === selectedKey)
    ? selectedKey
    : (items[0]?.key ?? null)
  const selected = items.find(item => item.key === effectiveSelectedKey) ?? null

  const parsed = useMemo(() => parseGeminiCommand(selected?.content ?? ''), [selected?.content])
  const [description, setDescription] = useState(parsed.description)
  const [prompt, setPrompt] = useState(parsed.prompt)
  const [raw, setRaw] = useState(selected?.content ?? '')

  useEffect(() => {
    setDescription(parsed.description)
    setPrompt(parsed.prompt)
    setRaw(selected?.content ?? '')
  }, [parsed.description, parsed.prompt, selected?.content])

  const isDirty = selected ? (
    isTomlGeminiCommand(selected.path)
      ? buildTomlCommand(description, prompt) !== selected.content
      : raw !== selected.content
  ) : false

  const handleCreate = async () => {
    const next = createName.trim()
    if (!next) return
    setCreatePending(true)
    try {
      await onCreate(next)
      setCreateOpen(false)
      setCreateName('')
    } finally {
      setCreatePending(false)
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-[220px] flex flex-col border-r border-border/30 shrink-0">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Commands</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">Gemini custom commands</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedKey(item.key)}
              className={`w-full text-left px-2.5 py-2 rounded-md transition-colors border ${
                item.key === effectiveSelectedKey
                  ? 'bg-primary/8 text-primary border-primary/20'
                  : 'text-muted-foreground hover:bg-muted/10 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold truncate flex-1">{item.name}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider rounded-full border border-border/40 px-1.5 py-0.5 text-muted-foreground/60">
                  {item.path.endsWith('.toml') ? 'TOML' : 'Legacy'}
                </span>
              </div>
              <p className="text-[9px] mt-1 font-mono text-muted-foreground/40 truncate">{item.path}</p>
            </button>
          ))}
        </div>
        <div className="p-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)} className="w-full h-7 text-[10px] text-muted-foreground/50 hover:text-foreground">
            <Plus size={10} className="mr-1" /> Add Command
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        {selected ? (
          <>
            <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 shrink-0">
              <p className="text-[11px] font-semibold">Gemini Commands</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">New Gemini commands are TOML files with fields like <code className="font-mono">description</code> and <code className="font-mono">prompt</code>. Legacy Markdown files are still editable in raw mode.</p>
            </div>

            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">{selected.name}</h3>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono truncate">{selected.path}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isDirty ? <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span> : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(selected.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? selected.path)}
                  className="h-7 text-[10px] text-muted-foreground/50 hover:text-red-400"
                >
                  <Trash2 size={10} />
                </Button>
                {isDirty ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDescription(parsed.description)
                        setPrompt(parsed.prompt)
                        setRaw(selected.content)
                      }}
                      className="h-7 text-[10px]"
                    >
                      <RotateCcw size={10} className="mr-1" /> Discard
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onSave(selected.path, isTomlGeminiCommand(selected.path) ? buildTomlCommand(description, prompt) : raw)}
                      disabled={saving === selected.path}
                      className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
                    >
                      {saving === selected.path ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                      Save
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {isTomlGeminiCommand(selected.path) ? (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
                <section className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Description</h4>
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Summarize the current branch"
                    className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </section>

                <section className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Prompt</h4>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    className="min-h-[260px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    spellCheck={false}
                  />
                </section>
              </div>
            ) : (
              <textarea
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
                spellCheck={false}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest">No commands found</p>
              <p className="text-[10px]">Create a Gemini command for the selected scope.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Command</DialogTitle>
            <DialogDescription>Create a new Gemini command TOML file in the selected scope.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name</label>
            <input
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value.replace(/[^a-zA-Z0-9._/-]/g, '-'))}
              onKeyDown={(event) => event.key === 'Enter' && createName.trim() && handleCreate()}
              placeholder="e.g. daily-summary"
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName('') }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || createPending}>
              <Plus className="h-4 w-4 mr-2" />
              {createPending ? 'Creating...' : 'Add Command'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function isTomlGeminiCommand(path: string): boolean {
  return path.toLowerCase().endsWith('.toml')
}

function parseGeminiCommand(content: string): { description: string, prompt: string } {
  return {
    description: readTomlScalar(content, 'description'),
    prompt: readTomlPrompt(content),
  }
}

function readTomlScalar(content: string, field: string): string {
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*=\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm')
  return content.match(pattern)?.[1]?.trim() ?? ''
}

function readTomlPrompt(content: string): string {
  const triple = content.match(/^prompt\s*=\s*"""\n([\s\S]*?)\n"""\s*$/m)
  if (triple) return triple[1]
  const single = content.match(/^prompt\s*=\s*["']([^"']*)["']\s*$/m)
  return single?.[1] ?? ''
}

function buildTomlCommand(description: string, prompt: string): string {
  const lines = []
  if (description.trim()) lines.push(`description = ${JSON.stringify(description.trim())}`)
  lines.push('prompt = """')
  lines.push(prompt.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
  lines.push('"""')
  return `${lines.join('\n')}\n`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
