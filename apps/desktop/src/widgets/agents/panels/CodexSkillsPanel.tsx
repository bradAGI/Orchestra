import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ProviderFileEntry } from '@/lib/orchestra-client'

interface CodexSkillsPanelProps {
  items: ProviderFileEntry[]
  configContent: string
  configPath: string
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
  onSaveConfig: (path: string, content: string) => Promise<void>
}

type SkillOverride = {
  path: string
  enabled: boolean
}

export function CodexSkillsPanel({
  items,
  configContent,
  configPath,
  saving,
  onSave,
  onDelete,
  onCreate,
  onSaveConfig,
}: CodexSkillsPanelProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(items[0]?.path ?? null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const overrides = useMemo(() => parseSkillOverrides(configContent), [configContent])

  useEffect(() => {
    if (!selectedPath && items.length > 0) setSelectedPath(items[0].path)
    if (selectedPath && !items.some(item => item.path === selectedPath)) {
      setSelectedPath(items[0]?.path ?? null)
    }
  }, [items, selectedPath])

  const selected = items.find(item => item.path === selectedPath) ?? null
  const content = selected ? (drafts[selected.path] ?? selected.content) : ''
  const isDirty = selected ? content !== selected.content : false
  const skillFolder = selected ? skillFolderPath(selected.path) : ''
  const override = overrides.find(entry => entry.path === skillFolder) ?? null

  const handleCreate = async () => {
    if (!createName.trim()) return
    await onCreate(createName.trim())
    setCreateOpen(false)
    setCreateName('')
  }

  const handleSaveOverride = async (enabled: boolean) => {
    if (!configPath || !skillFolder) return
    await onSaveConfig(configPath, upsertSkillOverride(configContent, { path: skillFolder, enabled }))
  }

  const handleRemoveOverride = async () => {
    if (!configPath || !skillFolder) return
    await onSaveConfig(configPath, removeSkillOverride(configContent, skillFolder))
  }

  return (
    <div className="flex h-full">
      <div className="w-[220px] flex flex-col border-r border-border/30 shrink-0">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Skills</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">SKILL.md + skills.config</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {items.map(item => {
            const folder = skillFolderPath(item.path)
            const itemOverride = overrides.find(entry => entry.path === folder) ?? null
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => setSelectedPath(item.path)}
                className={`w-full text-left px-2.5 py-2 rounded-md transition-colors border ${
                  item.path === selectedPath
                    ? 'bg-primary/8 text-primary border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/10 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold truncate flex-1">{item.name}</span>
                  {itemOverride ? (
                    <span className={`text-[8px] font-bold uppercase tracking-wider rounded-full border px-1.5 py-0.5 ${itemOverride.enabled ? 'border-emerald-500/30 text-emerald-500' : 'border-amber-500/30 text-amber-500'}`}>
                      {itemOverride.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  ) : null}
                </div>
                <p className="text-[9px] mt-1 font-mono text-muted-foreground/40 truncate">{item.path}</p>
              </button>
            )
          })}
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
              <p className="text-[11px] font-semibold">Codex Skills</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">Codex reads the skill content from <code className="font-mono">SKILL.md</code> and optional per-skill overrides from <code className="font-mono">skills.config</code> in <code className="font-mono">config.toml</code>.</p>
            </div>

            <div className="rounded-lg border border-border/30 bg-background px-3 py-3 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate">{selected.name}</h3>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono truncate">{selected.path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isDirty ? <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span> : null}
                  <Button size="sm" variant="ghost" onClick={() => onDelete(selected.path.split('/').slice(-2)[0] ?? selected.path)} className="h-7 text-[10px] text-muted-foreground/50 hover:text-red-400">
                    <Trash2 size={10} />
                  </Button>
                  {isDirty ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setDrafts(prev => ({ ...prev, [selected.path]: selected.content }))} className="h-7 text-[10px]">
                        <RotateCcw size={10} className="mr-1" /> Discard
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onSave(selected.path, content)}
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
            </div>

            <div className="rounded-lg border border-border/30 bg-background px-3 py-3 shrink-0 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Enablement Override</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono break-all">{skillFolder}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={override?.enabled === true ? 'default' : 'outline'} className="h-7 text-[10px]" onClick={() => handleSaveOverride(true)} disabled={!configPath}>
                  Enable
                </Button>
                <Button size="sm" variant={override?.enabled === false ? 'default' : 'outline'} className="h-7 text-[10px]" onClick={() => handleSaveOverride(false)} disabled={!configPath}>
                  Disable
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={handleRemoveOverride} disabled={!override || !configPath}>
                  Clear Override
                </Button>
                {override ? (
                  <span className={`text-[10px] font-semibold ${override.enabled ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {override.enabled ? 'Explicitly enabled' : 'Explicitly disabled'}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/50">Using Codex default behavior</span>
                )}
              </div>
            </div>

            <textarea
              value={content}
              onChange={(event) => setDrafts(prev => ({ ...prev, [selected.path]: event.target.value }))}
              className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest">No skills found</p>
              <p className="text-[10px]">Create a skill to manage its <code className="font-mono">SKILL.md</code> and override state.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
            <DialogDescription>Create a new Codex skill directory with a <code className="font-mono">SKILL.md</code> file.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Skill Name</label>
            <input
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value.replace(/[^a-zA-Z0-9._/-]/g, '-'))}
              onKeyDown={(event) => event.key === 'Enter' && createName.trim() && handleCreate()}
              placeholder="e.g. triage"
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName('') }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function skillFolderPath(skillMarkdownPath: string): string {
  return skillMarkdownPath.replace(/\/SKILL\.md$/i, '')
}

function parseSkillOverrides(content: string): SkillOverride[] {
  const blocks = content.match(/\[\[skills\.config\]\][\s\S]*?(?=\n\[\[skills\.config\]\]|\n\[[^\n]+\]|$)/g) ?? []
  return blocks.map(block => ({
    path: readScalar(block, 'path'),
    enabled: readScalar(block, 'enabled').toLowerCase() === 'true',
  })).filter(entry => entry.path)
}

function upsertSkillOverride(content: string, override: SkillOverride): string {
  const section = buildOverrideSection(override)
  const blocks = content.match(/\[\[skills\.config\]\][\s\S]*?(?=\n\[\[skills\.config\]\]|\n\[[^\n]+\]|$)/g) ?? []
  for (const block of blocks) {
    if (readScalar(block, 'path') === override.path) {
      return content.replace(block, section).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
    }
  }
  return `${content.trimEnd()}\n\n${section}\n`
}

function removeSkillOverride(content: string, skillPath: string): string {
  const blocks = content.match(/\[\[skills\.config\]\][\s\S]*?(?=\n\[\[skills\.config\]\]|\n\[[^\n]+\]|$)/g) ?? []
  let next = content
  for (const block of blocks) {
    if (readScalar(block, 'path') === skillPath) {
      next = next.replace(block, '')
    }
  }
  return next.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

function buildOverrideSection(override: SkillOverride): string {
  return `[[skills.config]]
path = "${override.path}"
enabled = ${override.enabled ? 'true' : 'false'}`
}

function readScalar(content: string, field: string): string {
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*=\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm')
  return content.match(pattern)?.[1]?.trim() ?? ''
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
