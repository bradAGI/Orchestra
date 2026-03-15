import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
    Cpu, Save, RefreshCcw, Terminal,
    Zap, Code as CodeIcon,
    FileText, CheckCircle2, AlertCircle, Wrench,
    Settings, Globe, Layers, Plus, Loader2, Trash2,
    ChevronDown, Search, Network, File, Folder, HardDrive
} from 'lucide-react'
import type { AgentConfig, BackendConfig, Project, SnapshotPayload } from '@/lib/orchestra-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppTooltip } from '../ui/tooltip-wrapper'
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
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog'
import { CustomDropdown, getAgentIcon } from '@/components/app-shell/shared/controls'

interface AgentsDashboardProps {
    config: BackendConfig | null
    snapshot: SnapshotPayload | null
}

type MainTab = 'agents' | 'skills' | 'mcp'

export const AgentsDashboard: React.FC<AgentsDashboardProps> = ({ config, snapshot }) => {
    const [configs, setConfigs] = useState<AgentConfig[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [mcpTools, setMcpTools] = useState<MCPTool[]>([])
    const [mcpServers, setMcpServers] = useState<MCPServer[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<MainTab>('agents')

    // Agent Selection
    const [selectedAgent, setSelectedAgent] = useState<string>('claude')
    const [scope, setScope] = useState<'global' | 'project'>('global')
    const [selectedProjectID, setSelectedProjectID] = useState<string>('')

    // Editor State
    const [activeConfig, setActiveConfig] = useState<AgentConfig | null>(null)
    const [editedContent, setEditedContent] = useState('')
    const [error, setError] = useState('')

    // Creation State
    const [createDialogOpen, setCreateResourceDialogOpen] = useState(false)
    const [mcpDialogOpen, setMcpDialogOpen] = useState(false)
    const [newMcpName, setNewMcpName] = useState('')
    const [newMcpCommand, setNewMcpCommand] = useState('')
    const [creating, setCreating] = useState(false)

    // Skill Creation State
    const [skillDialogOpen, setSkillDialogOpen] = useState(false)
    const [newSkillName, setNewSkillName] = useState('')
    const [newSkillAgent, setNewSkillAgent] = useState('claude')

    const osOptions = useMemo(() => ({
        scrollbars: { autoHide: 'move' as const, theme: 'os-theme-custom' },
        overflow: { x: 'hidden' as const, y: 'scroll' as const }
    }), [])

    const loadData = async () => {
        if (!config) return
        setLoading(true)
        try {
            const [configsData, projectsData, mcpToolsData, mcpServersData] = await Promise.all([
                fetchAgentConfigs(config, scope === 'project' ? selectedProjectID : undefined),
                fetchProjects(config),
                fetchMCPTools(config),
                fetchMCPServers(config)
            ])
            setConfigs(configsData)
            setProjects(projectsData)
            setMcpTools(mcpToolsData)
            setMcpServers(mcpServersData)

            if (activeTab === 'agents') {
                syncActiveAgentConfig(selectedAgent, configsData)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const syncActiveAgentConfig = (agent: string, availableConfigs: AgentConfig[]) => {
        const match = availableConfigs.find(c =>
            c.scope === scope &&
            c.category === 'core' &&
            c.name.toLowerCase().includes(agent.toLowerCase())
        )
        if (match) {
            setActiveConfig(match)
            setEditedContent(match.content)
        } else {
            setActiveConfig(null)
            setEditedContent('')
        }
    }

    useEffect(() => { loadData() }, [config, scope, selectedProjectID, activeTab])
    useEffect(() => { syncActiveAgentConfig(selectedAgent, configs) }, [selectedAgent])

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
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to create skill')
        } finally {
            setCreating(false)
        }
    }

    const getFileFormat = (path: string): string => {
        if (path.endsWith('.json') || path.endsWith('.jsonc')) return 'JSON'
        if (path.endsWith('.toml')) return 'TOML'
        if (path.endsWith('.md')) return 'Markdown'
        if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'YAML'
        return 'Text'
    }

    const isDirty = activeConfig && activeConfig.content !== editedContent

    const skills = configs.filter(c => c.category === 'skill')

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Top Navigation */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10 shrink-0">
                <div className="flex items-center gap-1.5">
                    <AppTooltip content="Agent configurations">
                        <button
                            onClick={() => setActiveTab('agents')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'agents' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted/50'}`}
                        >
                            <Settings size={13} />
                            Agents
                        </button>
                    </AppTooltip>
                    <AppTooltip content="Skills">
                        <button
                            onClick={() => setActiveTab('skills')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'skills' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted/50'}`}
                        >
                            <Zap size={13} />
                            Skills
                        </button>
                    </AppTooltip>
                    <AppTooltip content="MCP Servers">
                        <button
                            onClick={() => setActiveTab('mcp')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'mcp' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted/50'}`}
                        >
                            <Network size={13} />
                            MCP Servers
                        </button>
                    </AppTooltip>
                </div>

                {isDirty && (
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved Changes</span>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!!saving}
                            className="h-8 bg-primary text-primary-foreground font-black uppercase text-[10px] px-4 rounded-xl shadow-lg shadow-primary/20"
                        >
                            {saving ? <Loader2 size={12} className="animate-spin mr-2" /> : <Save size={12} className="mr-2" />}
                            Save Config
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0">
                {activeTab === 'agents' && (
                    <div className="h-full flex flex-col">
                        {/* Agent & Scope Selectors */}
                        <div className="p-4 border-b border-border bg-background flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                {['claude', 'gemini', 'codex', 'opencode'].map(id => (
                                    <button
                                        key={id}
                                        onClick={() => setSelectedAgent(id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${selectedAgent === id
                                            ? 'bg-primary/10 border-primary text-primary shadow-sm'
                                            : 'bg-muted/20 border-transparent text-muted-foreground hover:border-border'}`}
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
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${scope === 'global' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Global Config
                                    </button>
                                    <button
                                        onClick={() => setScope('project')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${scope === 'project' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Project Overrides
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

                        {/* Editor */}
                        <div className="flex-1 min-h-0 bg-background flex flex-col p-4">
                            {!activeConfig ? (
                                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl opacity-30">
                                    <File size={48} strokeWidth={1} />
                                    <p className="mt-4 text-xs font-bold uppercase tracking-widest">No {scope} configuration found for {selectedAgent}</p>
                                </div>
                            ) : (
                                <div className="flex-1 relative border border-border rounded-2xl overflow-hidden shadow-inner bg-card/20 flex flex-col">
                                    {/* Editor Header */}
                                    <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/10 shrink-0">
                                        <p className="text-[10px] font-mono text-muted-foreground/60 truncate">{activeConfig.path}</p>
                                        <Badge variant="secondary" className="text-[8px] font-black uppercase shrink-0">{getFileFormat(activeConfig.path)}</Badge>
                                    </div>
                                    <div className="flex-1 relative min-h-0">
                                        <div className="absolute top-0 left-0 w-10 h-full bg-muted/20 border-r border-border pointer-events-none flex flex-col pt-6 items-center text-[10px] font-mono text-muted-foreground/30">
                                            {Array.from({ length: 50 }).map((_, i) => <div key={i} className="h-6 flex items-center">{i + 1}</div>)}
                                        </div>
                                        <textarea
                                            value={editedContent}
                                            onChange={(e) => setEditedContent(e.target.value)}
                                            className="w-full h-full bg-transparent pl-14 pr-6 py-6 font-mono text-[13px] leading-6 text-foreground focus:outline-none resize-none"
                                            spellCheck={false}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'skills' && (
                    <div className="h-full flex flex-col p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/70">Skill Inventory</h2>
                            <Button onClick={() => setSkillDialogOpen(true)} size="sm" variant="outline" className="h-8 rounded-lg text-[10px] font-black uppercase border-primary/30 text-primary">
                                <Plus size={14} className="mr-2" /> Add Skill
                            </Button>
                        </div>
                        {skills.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl opacity-30">
                                <Zap size={48} strokeWidth={1} />
                                <p className="mt-4 text-xs font-bold uppercase tracking-widest">No skills configured yet</p>
                                <p className="mt-2 text-[10px] text-muted-foreground max-w-sm text-center">
                                    Skills are reusable instructions and scripts for your agents. Click "Add Skill" to create one.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-auto custom-scrollbar pr-2">
                                {skills.map(skill => {
                                    const contentPreview = skill.content
                                        ? skill.content.split('\n').slice(0, 2).join('\n')
                                        : ''
                                    const agentName = skill.name.split('/')[0] || skill.name
                                    return (
                                        <Card key={skill.path} className="p-4 bg-card/40 border-border hover:border-primary/30 transition-all cursor-pointer group">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    {getAgentIcon(agentName, 16) || <Zap size={16} fill="currentColor" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-foreground truncate">{skill.name}</p>
                                                    <p className="text-[9px] font-black uppercase text-muted-foreground/40">{skill.scope}</p>
                                                </div>
                                            </div>
                                            {contentPreview ? (
                                                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed font-mono">
                                                    {contentPreview}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground/40 line-clamp-2 leading-relaxed italic">
                                                    No content preview
                                                </p>
                                            )}
                                        </Card>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'mcp' && (
                    <div className="h-full flex flex-col p-6">
                        {/* Provider MCP Configs */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Provider MCP Configuration</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                    { id: 'claude', path: '~/.claude/settings.json', field: 'extraKnownMarketplaces' },
                                    { id: 'codex', path: '~/.codex/config.toml', field: '[mcp_servers]' },
                                    { id: 'opencode', path: '~/.config/opencode/opencode.json', field: 'mcp' },
                                    { id: 'gemini', path: '~/.gemini/settings.json', field: 'mcpServers' },
                                ].map(provider => (
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

                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/70">MCP Servers</h2>
                            <Button onClick={() => setMcpDialogOpen(true)} size="sm" variant="default" className="h-8 rounded-lg text-[10px] font-black uppercase bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                                <Plus size={14} className="mr-2" /> Add Server
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(snapshot?.mcp_servers || {}).map(([name, cmd]) => {
                                const tools = mcpTools.filter(t => t.name.startsWith(name + "_"))
                                return (
                                    <Card key={name} className="p-5 bg-card/40 border-border/60 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                <span className="text-xs font-black uppercase tracking-wider">{name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-[8px] font-black">{tools.length} TOOLS</Badge>
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
                                                <Badge key={t.name} variant="outline" className="text-[7px] font-black tracking-tighter bg-background/50 border-border/40">
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
            </div>

            {/* MCP Dialog */}
            <Dialog open={mcpDialogOpen} onOpenChange={setMcpDialogOpen}>
                <DialogContent className="max-w-md bg-popover border-border shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Add MCP Server</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground/60">Connect a new tool server</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Name</label>
                            <input
                                className="h-10 w-full rounded-xl border border-border bg-background px-4 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                value={newMcpName}
                                onChange={e => setNewMcpName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Command</label>
                            <input
                                className="h-10 w-full rounded-xl border border-border bg-background px-4 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                value={newMcpCommand}
                                onChange={e => setNewMcpCommand(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleCreateMCPServer} className="w-full h-11 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl mt-4 shadow-lg shadow-blue-600/20">Add Server</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Skill Dialog */}
            <Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
                <DialogContent className="max-w-md bg-popover border-border shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Add Skill</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground/60">Create a new skill for an agent</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Name</label>
                            <input
                                className="h-10 w-full rounded-xl border border-border bg-background px-4 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                value={newSkillName}
                                onChange={e => setNewSkillName(e.target.value)}
                                placeholder="e.g. code-review"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Agent</label>
                            <div className="flex items-center gap-2">
                                {['claude', 'gemini', 'codex', 'opencode'].map(id => (
                                    <button
                                        key={id}
                                        onClick={() => setNewSkillAgent(id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all ${newSkillAgent === id
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-muted/20 border-transparent text-muted-foreground hover:border-border'}`}
                                    >
                                        {getAgentIcon(id, 12)}
                                        {id}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Button
                            onClick={handleCreateSkill}
                            disabled={!newSkillName || creating}
                            className="w-full h-11 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest rounded-xl mt-4 shadow-lg shadow-primary/20"
                        >
                            {creating ? <Loader2 size={12} className="animate-spin mr-2" /> : <Plus size={12} className="mr-2" />}
                            Create Skill
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function Card({ children, className = '', onClick, draggable, onDragStart }: { children: React.ReactNode; className?: string; onClick?: () => void; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void }) {
    return (
        <div
            onClick={onClick}
            draggable={draggable}
            onDragStart={onDragStart}
            className={`rounded-2xl border border-border bg-card shadow-sm transition-all overflow-hidden ${className}`}
        >
            {children}
        </div>
    )
}
