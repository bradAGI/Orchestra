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

interface CodexSubAgentsPanelProps {
  items: ProviderFileEntry[]
  configContent: string
  configPath: string
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
  onSaveConfig: (path: string, content: string) => Promise<void>
}

type AgentConfigBlock = {
  name: string
  description: string
  configFile: string
  nicknameCandidates: string[]
}

export function CodexSubAgentsPanel({
  items,
  configContent,
  configPath,
  saving,
  onSave,
  onDelete,
  onCreate,
  onSaveConfig,
}: CodexSubAgentsPanelProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(items[0]?.path ?? null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const configBlocks = useMemo(() => parseAgentConfigBlocks(configContent), [configContent])

  useEffect(() => {
    if (!selectedPath && items.length > 0) setSelectedPath(items[0].path)
    if (selectedPath && !items.some(item => item.path === selectedPath)) {
      setSelectedPath(items[0]?.path ?? null)
    }
  }, [items, selectedPath])

  const selected = items.find(item => item.path === selectedPath) ?? null
  const content = selected ? (drafts[selected.path] ?? selected.content) : ''
  const isDirty = selected ? content !== selected.content : false
  const agentName = selected ? selected.path.split('/').pop()?.replace(/\.toml$/i, '') ?? '' : ''
  const agentConfig: AgentConfigBlock = configBlocks.find(block => block.name === agentName) ?? { name: agentName, description: '', configFile: '', nicknameCandidates: [] }
  const [description, setDescription] = useState(agentConfig.description)
  const [configFile, setConfigFile] = useState(agentConfig.configFile)
  const [nicknameCandidates, setNicknameCandidates] = useState(agentConfig.nicknameCandidates.join(' '))
  const globalSettings = useMemo(() => parseAgentGlobalSettings(configContent), [configContent])
  const [maxThreads, setMaxThreads] = useState(globalSettings.maxThreads)
  const [maxDepth, setMaxDepth] = useState(globalSettings.maxDepth)
  const [jobRuntime, setJobRuntime] = useState(globalSettings.jobRuntime)

  useEffect(() => {
    setDescription(agentConfig.description)
    setConfigFile(agentConfig.configFile)
    setNicknameCandidates(agentConfig.nicknameCandidates.join(' '))
  }, [agentConfig.description, agentConfig.configFile, agentConfig.nicknameCandidates, agentName])

  useEffect(() => {
    setMaxThreads(globalSettings.maxThreads)
    setMaxDepth(globalSettings.maxDepth)
    setJobRuntime(globalSettings.jobRuntime)
  }, [globalSettings.jobRuntime, globalSettings.maxDepth, globalSettings.maxThreads])

  const isConfigDirty =
    description !== agentConfig.description ||
    configFile !== agentConfig.configFile ||
    nicknameCandidates !== agentConfig.nicknameCandidates.join(' ')
  const isGlobalDirty =
    maxThreads !== globalSettings.maxThreads ||
    maxDepth !== globalSettings.maxDepth ||
    jobRuntime !== globalSettings.jobRuntime

  const handleCreate = async () => {
    if (!createName.trim()) return
    await onCreate(createName.trim())
    setCreateOpen(false)
    setCreateName('')
  }

  const handleSaveConfigBlock = async () => {
    if (!configPath || !agentName) return
    await onSaveConfig(configPath, upsertAgentConfigBlock(configContent, {
      name: agentName,
      description,
      configFile,
      nicknameCandidates: nicknameCandidates.split(/\s+/).map((item: string) => item.trim()).filter(Boolean),
    }))
  }

  const handleSaveGlobalSettings = async () => {
    if (!configPath) return
    await onSaveConfig(configPath, upsertAgentGlobalSettings(configContent, {
      maxThreads,
      maxDepth,
      jobRuntime,
    }))
  }

  return (
    <div className="flex h-full">
      <div className="w-[220px] flex flex-col border-r border-border/30 shrink-0">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Sub-agents</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">.codex/agents/*.toml</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {items.map(item => {
            const name = item.path.split('/').pop()?.replace(/\.toml$/i, '') ?? item.name
            const block = configBlocks.find(candidate => candidate.name === name)
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
                <div className="text-[11px] font-semibold truncate">{item.name}</div>
                {block?.description ? <p className="text-[9px] mt-1 text-muted-foreground/40 truncate">{block.description}</p> : null}
                <p className="text-[9px] mt-1 font-mono text-muted-foreground/40 truncate">{item.path}</p>
              </button>
            )
          })}
        </div>
        <div className="p-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)} className="w-full h-7 text-[10px] text-muted-foreground/50 hover:text-foreground">
            <Plus size={10} className="mr-1" /> Add Sub-agent
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        {selected ? (
          <>
            <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 shrink-0">
              <p className="text-[11px] font-semibold">Codex Sub-agents</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">The TOML file defines the subagent itself. Optional <code className="font-mono">[agents.{agentName}]</code> config in <code className="font-mono">config.toml</code> adds routing metadata such as description and config layers.</p>
            </div>

            <div className="rounded-lg border border-border/30 bg-background px-3 py-3 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate">{selected.name}</h3>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono truncate">{selected.path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isDirty ? <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span> : null}
                  <Button size="sm" variant="ghost" onClick={() => onDelete(agentName)} className="h-7 text-[10px] text-muted-foreground/50 hover:text-red-400">
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Agent Routing Config</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Writes the <code className="font-mono">[agents.{agentName}]</code> block inside the active Codex config.</p>
                </div>
                {isConfigDirty ? (
                  <Button
                    size="sm"
                    onClick={handleSaveConfigBlock}
                    disabled={saving === configPath}
                    className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
                  >
                    {saving === configPath ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                    Save
                  </Button>
                ) : null}
              </div>
              <AgentField label="Description" value={description} onChange={setDescription} />
              <AgentField label="Config File" value={configFile} onChange={setConfigFile} placeholder=".codex/agents/reviewer.toml" />
              <AgentField label="Nickname Candidates" value={nicknameCandidates} onChange={setNicknameCandidates} placeholder="reviewer critic analyst" />
            </div>

            <div className="rounded-lg border border-border/30 bg-background px-3 py-3 shrink-0 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Global Agent Limits</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Writes top-level <code className="font-mono">agents.max_threads</code>, <code className="font-mono">agents.max_depth</code>, and <code className="font-mono">agents.job_max_runtime_seconds</code>.</p>
                </div>
                {isGlobalDirty ? (
                  <Button
                    size="sm"
                    onClick={handleSaveGlobalSettings}
                    disabled={saving === configPath}
                    className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
                  >
                    {saving === configPath ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                    Save
                  </Button>
                ) : null}
              </div>
              <AgentField label="Max Threads" value={maxThreads} onChange={setMaxThreads} placeholder="6" />
              <AgentField label="Max Depth" value={maxDepth} onChange={setMaxDepth} placeholder="1" />
              <AgentField label="Job Runtime Seconds" value={jobRuntime} onChange={setJobRuntime} placeholder="1800" />
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
              <p className="text-sm font-bold uppercase tracking-widest">No sub-agents found</p>
              <p className="text-[10px]">Create a Codex subagent to manage both the agent file and its config routing block.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sub-agent</DialogTitle>
            <DialogDescription>Create a new Codex subagent TOML file for the selected scope.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Sub-agent Name</label>
            <input
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value.replace(/[^a-zA-Z0-9._/-]/g, '-'))}
              onKeyDown={(event) => event.key === 'Enter' && createName.trim() && handleCreate()}
              placeholder="e.g. reviewer"
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName('') }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Sub-agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AgentField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (value: string) => void, placeholder?: string }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</h4>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </section>
  )
}

function parseAgentConfigBlocks(content: string): AgentConfigBlock[] {
  const lines = content.split('\n')
  const blocks: AgentConfigBlock[] = []
  let current: AgentConfigBlock | null = null

  for (const line of lines) {
    const header = line.match(/^\[agents\.([^\]]+)\]\s*$/)
    if (header) {
      if (current) blocks.push(current)
      current = { name: header[1], description: '', configFile: '', nicknameCandidates: [] }
      continue
    }
    if (!current) continue
    if (/^\[.*\]\s*$/.test(line)) {
      blocks.push(current)
      current = null
      continue
    }

    const scalar = line.match(/^([a-zA-Z0-9_.-]+)\s*=\s*["']?([^"'\n]+)["']?\s*$/)
    const array = line.match(/^nickname_candidates\s*=\s*\[(.*?)\]\s*$/)
    if (array) {
      current.nicknameCandidates = array[1].split(',').map(item => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      continue
    }
    if (!scalar) continue
    if (scalar[1] === 'description') current.description = scalar[2].trim()
    if (scalar[1] === 'config_file') current.configFile = scalar[2].trim()
  }

  if (current) blocks.push(current)
  return blocks
}

function upsertAgentConfigBlock(content: string, block: AgentConfigBlock): string {
  const section = buildAgentSection(block)
  const pattern = new RegExp(`\\[agents\\.${escapeRegExp(block.name)}\\][\\s\\S]*?(?=\\n\\[[^\\n]+\\]|$)`, 'm')
  if (pattern.test(content)) {
    return content.replace(pattern, section).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
  }
  return `${content.trimEnd()}\n\n${section}\n`
}

function buildAgentSection(block: AgentConfigBlock): string {
  const lines = [`[agents.${block.name}]`]
  if (block.description.trim()) lines.push(`description = "${block.description.trim()}"`)
  if (block.configFile.trim()) lines.push(`config_file = "${block.configFile.trim()}"`)
  if (block.nicknameCandidates.length > 0) {
    lines.push(`nickname_candidates = [${block.nicknameCandidates.map(item => `"${item}"`).join(', ')}]`)
  }
  return lines.join('\n')
}

function parseAgentGlobalSettings(content: string): { maxThreads: string, maxDepth: string, jobRuntime: string } {
  return {
    maxThreads: readGlobalScalar(content, 'agents.max_threads'),
    maxDepth: readGlobalScalar(content, 'agents.max_depth'),
    jobRuntime: readGlobalScalar(content, 'agents.job_max_runtime_seconds'),
  }
}

function upsertAgentGlobalSettings(content: string, settings: { maxThreads: string, maxDepth: string, jobRuntime: string }): string {
  let next = content
  next = writeGlobalNumber(next, 'agents.max_threads', settings.maxThreads)
  next = writeGlobalNumber(next, 'agents.max_depth', settings.maxDepth)
  next = writeGlobalNumber(next, 'agents.job_max_runtime_seconds', settings.jobRuntime)
  return next
}

function readGlobalScalar(content: string, field: string): string {
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*=\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm')
  return content.match(pattern)?.[1]?.trim() ?? ''
}

function writeGlobalScalar(content: string, field: string, value: string): string {
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

function writeGlobalNumber(content: string, field: string, value: string): string {
  const normalized = value.trim()
  const line = normalized ? `${field} = ${normalized}` : ''
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
