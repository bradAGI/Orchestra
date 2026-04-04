import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { FileResourceItem } from './FileResourcePanel'
import { buildOpenCodeSkill, parseOpenCodeSkill } from './open-code-skill-frontmatter'

interface OpenCodeSkillsPanelProps {
  items: FileResourceItem[]
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
}

export function OpenCodeSkillsPanel({ items, saving, onSave, onDelete, onCreate }: OpenCodeSkillsPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPending, setCreatePending] = useState(false)

  const effectiveSelectedKey = selectedKey && items.some(item => item.key === selectedKey)
    ? selectedKey
    : (items[0]?.key ?? null)
  const selected = items.find(item => item.key === effectiveSelectedKey) ?? null

  const parsed = useMemo(() => parseOpenCodeSkill(selected?.content ?? ''), [selected?.content])
  const [name, setName] = useState(parsed.frontmatter.name)
  const [description, setDescription] = useState(parsed.frontmatter.description)
  const [license, setLicense] = useState(parsed.frontmatter.license ?? '')
  const [compatibility, setCompatibility] = useState(parsed.frontmatter.compatibility ?? '')
  const [body, setBody] = useState(parsed.body)

  useEffect(() => {
    setName(parsed.frontmatter.name)
    setDescription(parsed.frontmatter.description)
    setLicense(parsed.frontmatter.license ?? '')
    setCompatibility(parsed.frontmatter.compatibility ?? '')
    setBody(parsed.body)
  }, [parsed.body, parsed.frontmatter.compatibility, parsed.frontmatter.description, parsed.frontmatter.license, parsed.frontmatter.name])

  const isDirty = selected
    ? buildOpenCodeSkill({ name, description, license, compatibility }, body) !== selected.content
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
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Skills</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">OpenCode skill definitions</p>
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
            <Plus size={10} className="mr-1" /> Add Skill
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        {selected ? (
          <>
            <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 shrink-0">
              <p className="text-[11px] font-semibold">OpenCode Skills</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">OpenCode skills use YAML frontmatter in <code className="font-mono">SKILL.md</code>. The recognized fields are <code className="font-mono">name</code>, <code className="font-mono">description</code>, <code className="font-mono">license</code>, and <code className="font-mono">compatibility</code>.</p>
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
                  onClick={() => onDelete(selected.path.split('/').slice(-2)[0] ?? selected.path)}
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
                        setName(parsed.frontmatter.name)
                        setDescription(parsed.frontmatter.description)
                        setLicense(parsed.frontmatter.license ?? '')
                        setCompatibility(parsed.frontmatter.compatibility ?? '')
                        setBody(parsed.body)
                      }}
                      className="h-7 text-[10px]"
                    >
                      <RotateCcw size={10} className="mr-1" /> Discard
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onSave(selected.path, buildOpenCodeSkill({ name, description, license, compatibility }, body))}
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
              <Field label="Name">
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="git-release" className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </Field>

              <Field label="Description">
                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Create consistent releases and changelogs" className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </Field>

              <Field label="License">
                <input value={license} onChange={(event) => setLicense(event.target.value)} placeholder="MIT" className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </Field>

              <Field label="Compatibility">
                <input value={compatibility} onChange={(event) => setCompatibility(event.target.value)} placeholder="opencode" className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </Field>

              <Field label="Body">
                <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-[260px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" spellCheck={false} />
              </Field>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest">No skills found</p>
              <p className="text-[10px]">Create an OpenCode skill for the selected scope.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
            <DialogDescription>Create a new OpenCode skill directory with <code className="font-mono">SKILL.md</code>.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name</label>
            <input
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value.replace(/[^a-z0-9-]/g, '-'))}
              onKeyDown={(event) => event.key === 'Enter' && createName.trim() && handleCreate()}
              placeholder="e.g. git-release"
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName('') }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || createPending}>
              <Plus className="h-4 w-4 mr-2" />
              {createPending ? 'Creating...' : 'Add Skill'}
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
