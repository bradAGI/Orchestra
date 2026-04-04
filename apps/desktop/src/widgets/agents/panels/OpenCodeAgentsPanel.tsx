import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { FileResourceItem } from './FileResourcePanel'
import { buildOpenCodeMarkdown, parseOpenCodeMarkdown } from './open-code-frontmatter'

interface OpenCodeAgentsPanelProps {
  items: FileResourceItem[]
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
}

export function OpenCodeAgentsPanel({ items, saving, onSave, onDelete, onCreate }: OpenCodeAgentsPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPending, setCreatePending] = useState(false)

  const effectiveSelectedKey = selectedKey && items.some(item => item.key === selectedKey)
    ? selectedKey
    : (items[0]?.key ?? null)
  const selected = items.find(item => item.key === effectiveSelectedKey) ?? null

  const parsed = useMemo(() => parseOpenCodeMarkdown(selected?.content ?? ''), [selected?.content])
  const [description, setDescription] = useState(parsed.frontmatter.description ?? '')
  const [mode, setMode] = useState(parsed.frontmatter.mode ?? '')
  const [model, setModel] = useState(parsed.frontmatter.model ?? '')
  const [body, setBody] = useState(parsed.body)

  useEffect(() => {
    setDescription(parsed.frontmatter.description ?? '')
    setMode(parsed.frontmatter.mode ?? '')
    setModel(parsed.frontmatter.model ?? '')
    setBody(parsed.body)
  }, [parsed.body, parsed.frontmatter.description, parsed.frontmatter.mode, parsed.frontmatter.model])

  const isDirty = selected
    ? buildOpenCodeMarkdown({ description, mode, model }, body) !== selected.content
    : false

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
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Agents</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">OpenCode agent definitions</p>
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
              </div>
              <p className="text-[9px] mt-1 font-mono text-muted-foreground/40 truncate">{item.path}</p>
            </button>
          ))}
        </div>
        <div className="p-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)} className="w-full h-7 text-[10px] text-muted-foreground/50 hover:text-foreground">
            <Plus size={10} className="mr-1" /> Add Agent
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        {selected ? (
          <>
            <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 shrink-0">
              <p className="text-[11px] font-semibold">OpenCode Agents</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">OpenCode agents are Markdown files with frontmatter. Use <code className="font-mono">description</code>, <code className="font-mono">mode</code>, and optional <code className="font-mono">model</code> to define routing and behavior.</p>
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
                        setDescription(parsed.frontmatter.description ?? '')
                        setMode(parsed.frontmatter.mode ?? '')
                        setModel(parsed.frontmatter.model ?? '')
                        setBody(parsed.body)
                      }}
                      className="h-7 text-[10px]"
                    >
                      <RotateCcw size={10} className="mr-1" /> Discard
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onSave(selected.path, buildOpenCodeMarkdown({ description, mode, model }, body))}
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

            <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
              <Field label="Description">
                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Planner agent for repo-wide work" className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </Field>

              <Field label="Mode">
                <select value={mode} onChange={(event) => setMode(event.target.value)} className="w-full max-w-sm h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">Default</option>
                  <option value="subagent">subagent</option>
                  <option value="agent">agent</option>
                </select>
              </Field>

              <Field label="Model">
                <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="anthropic/claude-sonnet-4-5" className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </Field>

              <Field label="Instructions">
                <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-[260px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" spellCheck={false} />
              </Field>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest">No agents found</p>
              <p className="text-[10px]">Create an OpenCode agent for the selected scope.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Agent</DialogTitle>
            <DialogDescription>Create a new OpenCode agent Markdown file with frontmatter.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name</label>
            <input
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value.replace(/[^a-zA-Z0-9._/-]/g, '-'))}
              onKeyDown={(event) => event.key === 'Enter' && createName.trim() && handleCreate()}
              placeholder="e.g. planner"
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName('') }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || createPending}>
              <Plus className="h-4 w-4 mr-2" />
              {createPending ? 'Creating...' : 'Add Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string, children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</h4>
      {children}
    </section>
  )
}
