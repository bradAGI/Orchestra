import { useMemo, useState } from 'react'
import { Code, Loader2, Plus, RotateCcw, Save, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { Provider } from '../types'
import type { FileResourceItem } from './FileResourcePanel'

interface ProviderConfigPanelProps {
  provider: Provider
  title: string
  subtitle: string
  items: FileResourceItem[]
  saving: string | null
  emptyTitle: string
  emptyDescription: string
  onSave: (path: string, content: string) => Promise<void>
  onCreate?: (name: string) => Promise<void>
  createLabel?: string
  createDescription?: string
}

type EditorMode = 'structured' | 'raw'

export function ProviderConfigPanel({
  provider,
  title,
  subtitle,
  items,
  saving,
  emptyTitle,
  emptyDescription,
  onSave,
  onCreate,
  createLabel = 'Create Config',
  createDescription = 'Create the primary configuration file.',
}: ProviderConfigPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<Record<string, EditorMode>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPending, setCreatePending] = useState(false)

  const effectiveSelectedKey = selectedKey && items.some(item => item.key === selectedKey)
    ? selectedKey
    : (items[0]?.key ?? null)
  const selected = items.find(item => item.key === effectiveSelectedKey) ?? null
  const content = selected ? (drafts[selected.key] ?? selected.content) : ''
  const editorMode = selected ? (mode[selected.key] ?? 'structured') : 'structured'
  const isDirty = selected ? content !== selected.content : false

  const parsedJson = useMemo(() => {
    if (!selected || provider === 'codex') return null
    try {
      return JSON.parse(content) as Record<string, unknown>
    } catch {
      return null
    }
  }, [content, provider, selected])

  const tomlFields = useMemo(() => {
    if (!selected || provider !== 'codex') return null
    return {
      model: readTomlScalar(content, 'model'),
      approvalPolicy: readTomlScalar(content, 'approval_policy'),
      sandboxMode: readTomlScalar(content, 'sandbox_mode'),
      reasoningEffort: readTomlScalar(content, 'model_reasoning_effort'),
    }
  }, [content, provider, selected])

  const handleCreate = async () => {
    if (!onCreate || !createName.trim()) return
    setCreatePending(true)
    try {
      await onCreate(createName.trim())
      setCreateOpen(false)
      setCreateName('')
    } finally {
      setCreatePending(false)
    }
  }

  const setContentForSelected = (next: string) => {
    if (!selected) return
    setDrafts(prev => ({ ...prev, [selected.key]: next }))
  }

  const setJsonField = (field: string, value: unknown) => {
    if (!parsedJson) return
    const next = { ...parsedJson, [field]: value }
    setContentForSelected(JSON.stringify(next, null, 2))
  }

  const setNestedJsonField = (path: string[], value: unknown) => {
    if (!parsedJson) return
    const next = structuredClone(parsedJson)
    let cursor: Record<string, unknown> = next
    for (let index = 0; index < path.length - 1; index += 1) {
      const key = path[index]
      const current = cursor[key]
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        cursor[key] = {}
      }
      cursor = cursor[key] as Record<string, unknown>
    }
    cursor[path[path.length - 1]] = value
    setContentForSelected(JSON.stringify(next, null, 2))
  }

  const setTomlField = (field: string, value: string) => {
    setContentForSelected(writeTomlScalar(content, field, value))
  }

  return (
    <div className="flex h-full">
      <div className="w-[220px] flex flex-col border-r border-border/30 shrink-0">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{title}</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">{subtitle}</p>
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
                {item.badge ? <span className="text-[8px] font-bold uppercase tracking-wider rounded-full border border-border/40 px-1.5 py-0.5 text-muted-foreground/60">{item.badge}</span> : null}
              </div>
              <p className="text-[9px] mt-1 font-mono text-muted-foreground/40 truncate">{item.path}</p>
            </button>
          ))}
        </div>
        {onCreate ? (
          <div className="p-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)} className="w-full h-7 text-[10px] text-muted-foreground/50 hover:text-foreground">
              <Plus size={10} className="mr-1" /> {createLabel}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">{selected.name}</h3>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono truncate">{selected.path}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode(prev => ({ ...prev, [selected.key]: (prev[selected.key] ?? 'structured') === 'structured' ? 'raw' : 'structured' }))}
                  className="h-7 text-[10px] gap-1.5"
                >
                  {editorMode === 'structured' ? <Code size={10} /> : <Settings2 size={10} />}
                  {editorMode === 'structured' ? 'Raw' : 'Structured'}
                </Button>
                {isDirty ? <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span> : null}
                {isDirty ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setDrafts(prev => ({ ...prev, [selected.key]: selected.content }))} className="h-7 text-[10px]">
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

            {editorMode === 'structured' ? (
              provider === 'codex' ? (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
                  <StructuredField label="Model" value={tomlFields?.model ?? ''} onChange={(value) => setTomlField('model', value)} />
                  <StructuredField label="Approval Policy" value={tomlFields?.approvalPolicy ?? ''} onChange={(value) => setTomlField('approval_policy', value)} />
                  <StructuredField label="Sandbox Mode" value={tomlFields?.sandboxMode ?? ''} onChange={(value) => setTomlField('sandbox_mode', value)} />
                  <StructuredField label="Reasoning Effort" value={tomlFields?.reasoningEffort ?? ''} onChange={(value) => setTomlField('model_reasoning_effort', value)} />
                  <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
                    <p className="text-[11px] font-semibold">TOML Config</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">This structured view only manages common top-level Codex keys. Switch to raw mode for nested or advanced settings.</p>
                  </div>
                </div>
              ) : parsedJson ? (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
                  <StructuredField
                    label="Model"
                    value={typeof parsedJson.model === 'string' ? parsedJson.model : ''}
                    onChange={(value) => setJsonField('model', value || undefined)}
                  />
                  {provider === 'gemini' ? (
                    <StructuredField
                      label="Context File Name"
                      value={readNestedString(parsedJson, ['context', 'fileName'])}
                      onChange={(value) => setNestedJsonField(['context', 'fileName'], value || 'GEMINI.md')}
                    />
                  ) : null}
                  {provider === 'opencode' ? (
                    <>
                      <StringListField
                        label="Instructions"
                        items={Array.isArray(parsedJson.instructions) ? parsedJson.instructions.filter((item): item is string => typeof item === 'string') : []}
                        onChange={(itemsValue) => setJsonField('instructions', itemsValue)}
                      />
                      <StructuredField
                        label="Default Agent"
                        value={typeof parsedJson.defaultAgent === 'string' ? parsedJson.defaultAgent : ''}
                        onChange={(value) => setJsonField('defaultAgent', value || undefined)}
                      />
                    </>
                  ) : null}
                  <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-1">
                    <p className="text-[11px] font-semibold">Configuration Summary</p>
                    <p className="text-[10px] text-muted-foreground/50">MCP entries: {countConfigEntries(parsedJson, provider === 'gemini' ? 'mcpServers' : 'mcp')}</p>
                    {provider === 'opencode' ? <p className="text-[10px] text-muted-foreground/50">Agent definitions: {countConfigEntries(parsedJson, 'agent')}</p> : null}
                    {provider === 'opencode' ? <p className="text-[10px] text-muted-foreground/50">Permission blocks: {countConfigEntries(parsedJson, 'permission')}</p> : null}
                  </div>
                  {provider === 'opencode' ? (
                    <JsonObjectPreview label="Permissions" value={asObject(parsedJson.permission)} />
                  ) : null}
                  {provider === 'gemini' ? (
                    <JsonObjectPreview label="MCP Servers" value={asObject(parsedJson.mcpServers)} />
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground/30">
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold uppercase tracking-widest">Structured mode unavailable</p>
                    <p className="text-[10px]">This file could not be parsed cleanly. Use raw mode to edit it directly.</p>
                  </div>
                </div>
              )
            ) : (
              <textarea
                value={content}
                onChange={(event) => setContentForSelected(event.target.value)}
                className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
                spellCheck={false}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest">{emptyTitle}</p>
              <p className="text-[10px]">{emptyDescription}</p>
            </div>
          </div>
        )}
      </div>

      {onCreate ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{createLabel}</DialogTitle>
              <DialogDescription>{createDescription}</DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name</label>
              <input
                autoFocus
                value={createName}
                onChange={(event) => setCreateName(event.target.value.replace(/[^a-zA-Z0-9._/-]/g, '-'))}
                onKeyDown={(event) => event.key === 'Enter' && createName.trim() && handleCreate()}
                placeholder="e.g. default"
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName('') }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!createName.trim() || createPending}>
                <Plus className="h-4 w-4 mr-2" />
                {createPending ? 'Creating...' : createLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

function StructuredField({ label, value, onChange }: { label: string, value: string, onChange: (value: string) => void }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</h4>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </section>
  )
}

function StringListField({ label, items, onChange }: { label: string, items: string[], onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState('')
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</h4>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item} className="flex items-center gap-2">
            <input value={item} readOnly className="flex-1 h-8 rounded-lg border border-border/30 bg-muted/10 px-3 text-xs font-mono" />
            <Button size="sm" variant="ghost" className="h-8 text-[10px]" onClick={() => onChange(items.filter(candidate => candidate !== item))}>Remove</Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} className="flex-1 h-8 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Add path or glob" />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px]"
            disabled={!draft.trim()}
            onClick={() => {
              if (!draft.trim()) return
              onChange([...items, draft.trim()])
              setDraft('')
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </section>
  )
}

function readNestedString(value: Record<string, unknown>, path: string[]): string {
  let cursor: unknown = value
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return ''
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return typeof cursor === 'string' ? cursor : ''
}

function countConfigEntries(value: Record<string, unknown>, key: string): number {
  const target = value[key]
  if (!target || typeof target !== 'object' || Array.isArray(target)) return 0
  return Object.keys(target as Record<string, unknown>).length
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function JsonObjectPreview({ label, value }: { label: string, value: Record<string, unknown> }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</h4>
      <pre className="rounded-lg border border-border/30 bg-muted/10 px-3 py-3 text-[11px] leading-5 font-mono text-foreground/80 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  )
}

function readTomlScalar(content: string, field: string): string {
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*=\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm')
  const match = content.match(pattern)
  return match?.[1]?.trim() ?? ''
}

function writeTomlScalar(content: string, field: string, value: string): string {
  const normalized = value.trim()
  const line = normalized ? `${field} = "${normalized}"` : ''
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*=.*$`, 'm')
  if (pattern.test(content)) {
    if (!line) return content.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
    return content.replace(pattern, line)
  }
  if (!line) return content
  return `${content.trimEnd()}\n${line}\n`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
