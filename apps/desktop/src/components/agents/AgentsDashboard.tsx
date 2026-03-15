import React, { useState, useEffect, useMemo } from 'react'
import {
    Save, Plus, Loader2, Trash2,
    Search, Network, File, Folder,
    Eye, Pencil, Terminal, CheckCircle2, AlertCircle, FileText
} from 'lucide-react'
import type { AgentConfig, BackendConfig, Project, SnapshotPayload } from '@/lib/orchestra-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    fetchAgentConfigs,
    updateAgentConfigByPath,
    fetchProjects,
    createAgentResource,
    fetchMCPTools,
    fetchMCPServers,
    createMCPServer,
    deleteMCPServer,
    type MCPServer,
    type MCPTool,
} from '@/lib/orchestra-client'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { CustomDropdown, getAgentIcon } from '@/components/app-shell/shared/controls'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

interface AgentsDashboardProps {
    config: BackendConfig | null
    snapshot: SnapshotPayload | null
}

type SubTab = 'instructions' | 'profiles' | 'mcp' | 'overview'

const PROVIDERS = ['claude', 'codex', 'gemini', 'opencode'] as const
type Provider = (typeof PROVIDERS)[number]

const instructionFiles: Record<Provider, { global: string; project: string; label: string }> = {
    claude:   { global: '~/.claude/CLAUDE.md',           project: 'CLAUDE.md',  label: 'CLAUDE.md' },
    codex:    { global: '~/.codex/AGENTS.md',            project: 'AGENTS.md',  label: 'AGENTS.md' },
    gemini:   { global: '~/.gemini/GEMINI.md',           project: 'GEMINI.md',  label: 'GEMINI.md' },
    opencode: { global: '~/.config/opencode/AGENTS.md',  project: 'AGENTS.md',  label: 'AGENTS.md' },
}

const mcpProviderConfigs = [
    { id: 'claude'   as Provider, path: '~/.claude/settings.json',           field: 'mcpServers' },
    { id: 'codex'    as Provider, path: '~/.codex/config.toml',              field: '[mcp_servers]' },
    { id: 'opencode' as Provider, path: '~/.config/opencode/opencode.json',  field: 'mcp' },
    { id: 'gemini'   as Provider, path: '~/.gemini/settings.json',           field: 'mcpServers' },
]

const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'instructions', label: 'Instructions' },
    { id: 'profiles',     label: 'Profiles' },
    { id: 'mcp',          label: 'MCP' },
    { id: 'overview',     label: 'Overview' },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AgentsDashboard: React.FC<AgentsDashboardProps> = ({ config, snapshot }) => {
    /* ---------- shared state ---------- */
    const [configs, setConfigs] = useState<AgentConfig[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [mcpTools, setMcpTools] = useState<MCPTool[]>([])
    const [mcpServers, setMcpServers] = useState<MCPServer[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [error, setError] = useState('')

    /* ---------- navigation ---------- */
    const [subTab, setSubTab] = useState<SubTab>('instructions')

    /* ---------- instructions state ---------- */
    const [selectedProvider, setSelectedProvider] = useState<Provider>('claude')
    const [scope, setScope] = useState<'global' | 'project'>('global')
    const [selectedProjectID, setSelectedProjectID] = useState<string>('')
    const [activeConfig, setActiveConfig] = useState<AgentConfig | null>(null)
    const [editedContent, setEditedContent] = useState('')
    const [previewMode, setPreviewMode] = useState(false)

    /* ---------- profiles state ---------- */
    const [skillSearch, setSkillSearch] = useState('')
    const [skillAgentFilter, setSkillAgentFilter] = useState('all')
    const [skillDialogOpen, setSkillDialogOpen] = useState(false)
    const [newSkillName, setNewSkillName] = useState('')
    const [newSkillAgent, setNewSkillAgent] = useState<Provider>('claude')
    const [newSkillContent, setNewSkillContent] = useState('')

    /* ---------- mcp state ---------- */
    const [mcpDialogOpen, setMcpDialogOpen] = useState(false)
    const [newMcpName, setNewMcpName] = useState('')
    const [newMcpCommand, setNewMcpCommand] = useState('')
    const [creating, setCreating] = useState(false)

    /* ---------- data loading ---------- */
    const loadData = async () => {
        if (!config) return
        setLoading(true)
        try {
            const [configsData, projectsData, mcpToolsData, mcpServersData] = await Promise.all([
                fetchAgentConfigs(config, scope === 'project' ? selectedProjectID : undefined),
                fetchProjects(config),
                fetchMCPTools(config),
                fetchMCPServers(config),
            ])
            setConfigs(configsData)
            setProjects(projectsData)
            setMcpTools(mcpToolsData)
            setMcpServers(mcpServersData)

            if (subTab === 'instructions') {
                syncActiveConfig(selectedProvider, configsData)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const syncActiveConfig = (provider: Provider, availableConfigs: AgentConfig[]) => {
        const match = availableConfigs.find(c =>
            c.scope === scope &&
            c.category === 'core' &&
            c.name.toLowerCase().includes(provider.toLowerCase()),
        )
        if (match) {
            setActiveConfig(match)
            setEditedContent(match.content)
        } else {
            setActiveConfig(null)
            setEditedContent('')
        }
    }

    useEffect(() => { loadData() }, [config, scope, selectedProjectID, subTab])
    useEffect(() => { syncActiveConfig(selectedProvider, configs) }, [selectedProvider])

    /* ---------- instruction save ---------- */
    const handleSave = async () => {
        if (!config || !activeConfig) return
        setSaving(activeConfig.path)
        try {
            await updateAgentConfigByPath(config, activeConfig.path, editedContent)
            setConfigs(prev => prev.map(c => c.path === activeConfig.path ? { ...c, content: editedContent } : c))
            setError('')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Save failed')
        } finally {
            setSaving(null)
        }
    }

    /* ---------- MCP CRUD ---------- */
    const handleDeleteMCPServer = async (name: string) => {
        if (!config) return
        const server = mcpServers.find(s => s.name === name)
        if (!server?.id) return
        if (!window.confirm(`Delete MCP server "${name}"?`)) return
        try {
            await deleteMCPServer(config, server.id)
            await loadData()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to delete MCP server')
        }
    }

    const handleCreateMCPServer = async () => {
        if (!config || !newMcpName || !newMcpCommand) return
        setCreating(true)
        try {
            await createMCPServer(config, newMcpName, newMcpCommand)
            await loadData()
            setMcpDialogOpen(false)
            setNewMcpName('')
            setNewMcpCommand('')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to create MCP server')
        } finally {
            setCreating(false)
        }
    }

    /* ---------- profile / skill creation ---------- */
    const handleCreateSkill = async () => {
        if (!config || !newSkillName) return
        setCreating(true)
        try {
            await createAgentResource(config, {
                provider: newSkillAgent,
                type: 'skill',
                name: newSkillName,
                scope,
                ...(scope === 'project' && selectedProjectID ? { project_id: selectedProjectID } : {}),
            })
            await loadData()
            setSkillDialogOpen(false)
            setNewSkillName('')
            setNewSkillAgent('claude')
            setNewSkillContent('')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to create skill')
        } finally {
            setCreating(false)
        }
    }

    /* ---------- derived ---------- */
    const isDirty = activeConfig != null && activeConfig.content !== editedContent
    const skills = useMemo(() => configs.filter(c => c.category === 'skill' || c.path.includes('/agents/')), [configs])

    const filteredSkills = useMemo(() => {
        return skills.filter(s => {
            const matchesSearch = !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase()) || s.path.toLowerCase().includes(skillSearch.toLowerCase())
            const agentName = s.name.split('/')[0] || ''
            const matchesAgent = skillAgentFilter === 'all' || agentName.toLowerCase().includes(skillAgentFilter)
            return matchesSearch && matchesAgent
        })
    }, [skills, skillSearch, skillAgentFilter])

    const currentFilePath = activeConfig
        ? activeConfig.path
        : instructionFiles[selectedProvider][scope === 'project' ? 'project' : 'global']

    /* ================================================================ */
    /*  RENDER                                                          */
    /* ================================================================ */

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* ---- Sub-tab bar ---- */}
            <div className="flex items-center justify-between px-6 border-b border-border shrink-0">
                <div className="flex items-center gap-0">
                    {SUB_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
                                subTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground/40 hover:text-muted-foreground'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Save indicator — only for Instructions tab */}
                {subTab === 'instructions' && isDirty && (
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!!saving}
                            className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
                        >
                            {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                            Save
                        </Button>
                    </div>
                )}
            </div>

            {/* ---- Error bar ---- */}
            {error && (
                <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                    <AlertCircle size={12} className="text-red-400 shrink-0" />
                    <span className="text-[10px] text-red-400 font-medium truncate">{error}</span>
                    <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400 text-xs">&times;</button>
                </div>
            )}

            {/* ---- Content ---- */}
            <div className="flex-1 min-h-0">

                {/* ============================================================ */}
                {/* SUB-TAB: Instructions                                         */}
                {/* ============================================================ */}
                {subTab === 'instructions' && (
                    <div className="h-full flex flex-col">
                        {/* Provider + Scope selectors */}
                        <div className="p-4 border-b border-border bg-background flex items-center justify-between gap-4 shrink-0">
                            <div className="flex items-center gap-2">
                                {PROVIDERS.map(id => (
                                    <button
                                        key={id}
                                        onClick={() => setSelectedProvider(id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                                            selectedProvider === id
                                                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                                                : 'bg-muted/20 border-transparent text-muted-foreground hover:border-border'
                                        }`}
                                    >
                                        {getAgentIcon(id, 14)}
                                        {id}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center bg-muted/30 p-1 rounded-xl border border-border">
                                    <button
                                        onClick={() => setScope('global')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                                            scope === 'global' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Global
                                    </button>
                                    <button
                                        onClick={() => setScope('project')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                                            scope === 'project' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Project
                                    </button>
                                </div>
                                {scope === 'project' && (
                                    <CustomDropdown
                                        value={selectedProjectID}
                                        onChange={(value) => setSelectedProjectID(String(value))}
                                        options={projects.map(p => ({ label: p.name, value: p.id, icon: <Folder size={12} /> }))}
                                        placeholder="Select Project..."
                                        className="min-w-[200px]"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Editor area */}
                        <div className="flex-1 min-h-0 bg-background flex flex-col p-4">
                            {!activeConfig ? (
                                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl opacity-30">
                                    <File size={48} strokeWidth={1} />
                                    <p className="mt-4 text-xs font-bold uppercase tracking-widest">No {scope} configuration found for {selectedProvider}</p>
                                </div>
                            ) : (
                                <div className="flex-1 relative border border-border rounded-2xl overflow-hidden shadow-inner bg-card/20 flex flex-col">
                                    {/* Editor Header */}
                                    <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/10 shrink-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={12} className="text-muted-foreground/50 shrink-0" />
                                            <p className="text-[10px] font-mono text-muted-foreground/60 truncate">{currentFilePath}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="secondary" className="text-[8px] font-bold uppercase">{instructionFiles[selectedProvider].label}</Badge>
                                            <div className="flex items-center bg-muted/30 p-0.5 rounded-lg border border-border/40">
                                                <button
                                                    onClick={() => setPreviewMode(false)}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                                                        !previewMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'
                                                    }`}
                                                >
                                                    <Pencil size={10} />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => setPreviewMode(true)}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                                                        previewMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'
                                                    }`}
                                                >
                                                    <Eye size={10} />
                                                    Preview
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Editor / Preview body */}
                                    <div className="flex-1 relative min-h-0 overflow-auto">
                                        {previewMode ? (
                                            <div className="p-6">
                                                <article className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/70 prose-a:text-primary prose-code:text-primary/80 prose-code:bg-muted/40 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border/30 prose-li:text-foreground/70 prose-strong:text-foreground prose-table:text-sm prose-th:text-foreground/70 prose-td:text-foreground/50">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{editedContent}</ReactMarkdown>
                                                </article>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="absolute top-0 left-0 w-10 h-full bg-muted/20 border-r border-border pointer-events-none flex flex-col pt-6 items-center text-[10px] font-mono text-muted-foreground/30">
                                                    {Array.from({ length: 50 }).map((_, i) => <div key={i} className="h-6 flex items-center">{i + 1}</div>)}
                                                </div>
                                                <textarea
                                                    value={editedContent}
                                                    onChange={(e) => setEditedContent(e.target.value)}
                                                    className="w-full h-full bg-transparent pl-14 pr-6 py-6 font-mono text-[13px] leading-6 text-foreground focus:outline-none resize-none"
                                                    spellCheck={false}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* SUB-TAB: Profiles                                             */}
                {/* ============================================================ */}
                {subTab === 'profiles' && (
                    <div className="h-full flex flex-col p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <h2 className="text-sm font-bold text-foreground/70">{skills.length} Profiles</h2>
                                <div className="flex items-center gap-1">
                                    {['all', ...PROVIDERS].map(agent => (
                                        <button key={agent} onClick={() => setSkillAgentFilter(agent)}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest transition-colors ${
                                                skillAgentFilter === agent ? 'bg-primary/10 text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground'
                                            }`}>
                                            {agent === 'all' ? 'All' : agent}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                    <input
                                        className="h-7 w-48 pl-7 pr-3 rounded-lg border border-border/40 bg-muted/20 text-xs outline-none focus:border-primary/40 transition-colors"
                                        placeholder="Search profiles..."
                                        value={skillSearch}
                                        onChange={e => setSkillSearch(e.target.value)}
                                    />
                                </div>
                                <Button onClick={() => setSkillDialogOpen(true)} size="sm" variant="outline" className="h-7 rounded-lg text-[9px] font-bold uppercase">
                                    <Plus size={12} className="mr-1" /> Create
                                </Button>
                            </div>
                        </div>

                        {/* List */}
                        {filteredSkills.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/20">
                                <FileText size={32} className="mb-3" />
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{skillSearch ? 'No profiles match' : 'No profiles configured'}</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <div className="divide-y divide-border/15">
                                    {filteredSkills.map(skill => {
                                        const agentName = skill.name.split('/')[0] || skill.name
                                        const shortName = skill.name.includes('/') ? skill.name.split('/').slice(1).join('/') : skill.name
                                        const preview = skill.content.replace(/^---[\s\S]*?---\s*/, '').trim().slice(0, 80)
                                        return (
                                            <div key={skill.path} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/10 transition-colors group cursor-pointer">
                                                <div className="shrink-0">{getAgentIcon(agentName, 14)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{shortName}</p>
                                                    <p className="text-[9px] text-muted-foreground/40 truncate">{preview || skill.path}</p>
                                                </div>
                                                <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/20 shrink-0">{skill.scope}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* SUB-TAB: MCP                                                  */}
                {/* ============================================================ */}
                {subTab === 'mcp' && (
                    <div className="h-full flex flex-col p-6 overflow-auto">
                        {/* Provider MCP Configs */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Provider MCP Configuration</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {mcpProviderConfigs.map(provider => (
                                    <div key={provider.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/40">
                                        {getAgentIcon(provider.id, 16)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold capitalize">{provider.id}</p>
                                            <p className="text-[9px] text-muted-foreground/40 font-mono truncate">{provider.path}</p>
                                        </div>
                                        <span className="text-[8px] font-bold uppercase text-muted-foreground/30">{provider.field}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Orchestra MCP Servers */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Orchestra MCP Servers</h3>
                            <Button onClick={() => setMcpDialogOpen(true)} size="sm" variant="default" className="h-7 rounded-lg text-[10px] font-bold uppercase bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                                <Plus size={12} className="mr-1.5" /> Add Server
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(snapshot?.mcp_servers || {}).map(([name, cmd]) => {
                                const tools = mcpTools.filter(t => t.name.startsWith(name + '_'))
                                return (
                                    <Card key={name} className="p-5 bg-card/40 border-border/60 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                <span className="text-xs font-bold uppercase tracking-wider">{name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-[8px] font-bold">{tools.length} TOOLS</Badge>
                                                <button
                                                    onClick={() => handleDeleteMCPServer(name)}
                                                    className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                    title="Delete server"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </div>
                                        </div>
                                        <code className="block p-2 bg-muted/30 rounded border border-border/20 text-[9px] font-mono text-muted-foreground truncate">{cmd}</code>
                                        <div className="flex flex-wrap gap-1.5 pt-2">
                                            {tools.map(t => (
                                                <Badge key={t.name} variant="outline" className="text-[7px] font-bold tracking-tighter bg-background/50 border-border/40">
                                                    {t.name.split('_').slice(1).join('_')}
                                                </Badge>
                                            ))}
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* SUB-TAB: Overview                                              */}
                {/* ============================================================ */}
                {subTab === 'overview' && (
                    <div className="h-full p-6 overflow-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {PROVIDERS.map(id => {
                                const instrFile = instructionFiles[id]
                                const coreConfig = configs.find(c => c.category === 'core' && c.name.toLowerCase().includes(id))
                                const hasConfig = !!coreConfig
                                return (
                                    <Card key={id} className="p-5 bg-card/40 border-border/60">
                                        <div className="flex items-center gap-3 mb-4">
                                            {getAgentIcon(id, 24)}
                                            <div>
                                                <h3 className="text-sm font-bold capitalize">{id}</h3>
                                                <p className="text-[9px] text-muted-foreground/50 font-mono">{instrFile.global}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Status */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Status</span>
                                                {hasConfig ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                                                        <CheckCircle2 size={11} /> Configured
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/30">
                                                        <AlertCircle size={11} /> Not configured
                                                    </span>
                                                )}
                                            </div>

                                            {/* Instructions file */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Instructions</span>
                                                <span className="text-[10px] font-mono text-muted-foreground/60">{instrFile.label}</span>
                                            </div>

                                            {/* Command */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Command</span>
                                                <span className="text-[10px] font-mono text-muted-foreground/60 flex items-center gap-1">
                                                    <Terminal size={10} />
                                                    {id}
                                                </span>
                                            </div>

                                            {/* Content preview */}
                                            {coreConfig && coreConfig.content && (
                                                <div className="mt-2 p-2 bg-muted/20 rounded-lg border border-border/20">
                                                    <p className="text-[9px] text-muted-foreground/40 line-clamp-3 font-mono leading-relaxed">{coreConfig.content.slice(0, 200)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ---- MCP Dialog ---- */}
            <Dialog open={mcpDialogOpen} onOpenChange={setMcpDialogOpen}>
                <DialogContent className="max-w-md bg-popover border-border shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">Add MCP Server</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground/60">Connect a new tool server to Orchestra</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Name</label>
                            <input
                                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                value={newMcpName}
                                onChange={e => setNewMcpName(e.target.value)}
                                placeholder="e.g. filesystem"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Command</label>
                            <input
                                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                value={newMcpCommand}
                                onChange={e => setNewMcpCommand(e.target.value)}
                                placeholder="npx @modelcontextprotocol/server-filesystem /"
                            />
                        </div>
                        <Button onClick={handleCreateMCPServer} disabled={!newMcpName || !newMcpCommand || creating} className="w-full h-9 bg-blue-600 text-white font-bold uppercase text-[10px] tracking-widest rounded-lg shadow-lg shadow-blue-600/20">
                            {creating ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Plus size={12} className="mr-1.5" />}
                            Add Server
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ---- Skill / Profile Dialog ---- */}
            <Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
                <DialogContent className="max-w-md bg-popover border-border shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">Create Profile</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground/60">Create a new agent profile / sub-agent</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Name</label>
                            <input
                                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                value={newSkillName}
                                onChange={e => setNewSkillName(e.target.value)}
                                placeholder="e.g. code-review"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Provider</label>
                            <div className="flex items-center gap-2">
                                {PROVIDERS.map(id => (
                                    <button
                                        key={id}
                                        onClick={() => setNewSkillAgent(id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all ${
                                            newSkillAgent === id
                                                ? 'bg-primary/10 border-primary text-primary'
                                                : 'bg-muted/20 border-transparent text-muted-foreground hover:border-border'
                                        }`}
                                    >
                                        {getAgentIcon(id, 12)}
                                        {id}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Scope</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setScope('global')}
                                    className={`px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all ${
                                        scope === 'global' ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/20 border-transparent text-muted-foreground hover:border-border'
                                    }`}
                                >
                                    Global
                                </button>
                                <button
                                    onClick={() => setScope('project')}
                                    className={`px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all ${
                                        scope === 'project' ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/20 border-transparent text-muted-foreground hover:border-border'
                                    }`}
                                >
                                    Project
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Content</label>
                            <textarea
                                className="w-full h-32 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                value={newSkillContent}
                                onChange={e => setNewSkillContent(e.target.value)}
                                placeholder={"---\ndescription: A helpful agent\n---\n\nYour instructions here..."}
                            />
                        </div>
                        <Button
                            onClick={handleCreateSkill}
                            disabled={!newSkillName || creating}
                            className="w-full h-9 bg-primary text-primary-foreground font-bold uppercase text-[10px] tracking-widest rounded-lg shadow-lg shadow-primary/20"
                        >
                            {creating ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Plus size={12} className="mr-1.5" />}
                            Create Profile
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Local Card component                                               */
/* ------------------------------------------------------------------ */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-2xl border border-border bg-card shadow-sm transition-all overflow-hidden ${className}`}>
            {children}
        </div>
    )
}
