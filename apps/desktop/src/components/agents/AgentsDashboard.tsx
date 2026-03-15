import React, { useState, useEffect, useMemo } from 'react'
import {
    Save, Plus, Loader2, Trash2,
    ArrowLeft, AlertCircle, Folder,
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

const PROVIDERS = ['claude', 'codex', 'gemini', 'opencode'] as const
type Provider = (typeof PROVIDERS)[number]

const PROVIDER_DESCRIPTIONS: Record<Provider, string> = {
    claude: 'Anthropic\'s Claude Code — deep reasoning and careful analysis',
    codex: 'OpenAI\'s Codex — fast iteration and broad knowledge',
    gemini: 'Google\'s Gemini CLI — multimodal and context-aware',
    opencode: 'Community-driven — flexible and extensible',
}

const instructionFiles: Record<Provider, { global: string; project: string; label: string }> = {
    claude:   { global: '~/.claude/CLAUDE.md',           project: 'CLAUDE.md',  label: 'CLAUDE.md' },
    codex:    { global: '~/.codex/AGENTS.md',            project: 'AGENTS.md',  label: 'AGENTS.md' },
    gemini:   { global: '~/.gemini/GEMINI.md',           project: 'GEMINI.md',  label: 'GEMINI.md' },
    opencode: { global: '~/.config/opencode/AGENTS.md',  project: 'AGENTS.md',  label: 'AGENTS.md' },
}

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
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
    const [scope, setScope] = useState<'global' | 'project'>('global')
    const [selectedProjectID, setSelectedProjectID] = useState<string>('')

    /* ---------- instructions state ---------- */
    const [activeConfig, setActiveConfig] = useState<AgentConfig | null>(null)
    const [editedContent, setEditedContent] = useState('')

    /* ---------- profiles state ---------- */
    const [skillDialogOpen, setSkillDialogOpen] = useState(false)
    const [newSkillName, setNewSkillName] = useState('')
    const [newSkillContent, setNewSkillContent] = useState('')

    const [createType, setCreateType] = useState<'skill' | 'agent'>('skill')

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

            if (selectedAgent) {
                syncActiveConfig(selectedAgent as Provider, configsData)
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

    useEffect(() => { loadData() }, [config, scope, selectedProjectID])
    useEffect(() => {
        if (selectedAgent) {
            syncActiveConfig(selectedAgent as Provider, configs)
        }
    }, [selectedAgent])

    /* ---------- instruction save ---------- */
    const handleSave = async () => {
        if (!config || !selectedAgent) return
        const provider = selectedAgent as Provider

        if (activeConfig) {
            setSaving(activeConfig.path)
            try {
                await updateAgentConfigByPath(config, activeConfig.path, editedContent)
                setConfigs(prev => prev.map(c => c.path === activeConfig.path ? { ...c, content: editedContent } : c))
                setActiveConfig(prev => prev ? { ...prev, content: editedContent } : prev)
                setError('')
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                setError(message || 'Save failed')
            } finally {
                setSaving(null)
            }
        } else {
            // Create new config
            setSaving('new')
            try {
                await createAgentResource(config, {
                    provider,
                    type: 'core',
                    name: provider,
                    scope,
                    ...(scope === 'project' && selectedProjectID ? { project_id: selectedProjectID } : {}),
                })
                await loadData()
                setError('')
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                setError(message || 'Failed to create config')
            } finally {
                setSaving(null)
            }
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
        if (!config || !newSkillName || !selectedAgent) return
        setCreating(true)
        try {
            await createAgentResource(config, {
                provider: selectedAgent,
                type: 'skill',
                name: newSkillName,
                scope,
                ...(scope === 'project' && selectedProjectID ? { project_id: selectedProjectID } : {}),
            })
            await loadData()
            setSkillDialogOpen(false)
            setNewSkillName('')
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
    const hasNewContent = !activeConfig && editedContent.trim().length > 0

    // Skills: SKILL.md files — portable instruction sets (skills/<name>/SKILL.md)
    const skills = useMemo(() => {
        if (!selectedAgent) return []
        return configs.filter(c =>
            c.category === 'skill' &&
            !c.path.includes('/agents/') &&
            c.name.toLowerCase().includes(selectedAgent.toLowerCase()),
        )
    }, [configs, selectedAgent])

    // Sub-agents: agents/*.md files — isolated execution specialists
    const subAgents = useMemo(() => {
        if (!selectedAgent) return []
        return configs.filter(c =>
            c.path.includes('/agents/') &&
            c.name.toLowerCase().includes(selectedAgent.toLowerCase()),
        )
    }, [configs, selectedAgent])

    const hasCoreConfig = (provider: Provider) =>
        configs.some(c => c.category === 'core' && c.name.toLowerCase().includes(provider))

    /* ---------- scope dropdown options ---------- */
    const scopeOptions = useMemo(() => {
        const opts: { label: string; value: string; icon?: React.ReactNode }[] = [
            { label: 'All Projects', value: 'global', icon: <Folder size={12} className="text-muted-foreground/50" /> },
            ...projects.map(p => ({ label: p.name, value: p.id, icon: <Folder size={12} className="text-primary/60" /> })),
        ]
        return opts
    }, [projects])

    const handleScopeChange = (value: string) => {
        if (value === 'global') {
            setScope('global')
            setSelectedProjectID('')
        } else {
            setScope('project')
            setSelectedProjectID(value)
        }
    }

    const scopeValue = scope === 'global' ? 'global' : selectedProjectID

    /* ================================================================ */
    /*  RENDER                                                          */
    /* ================================================================ */

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* ---- Error bar ---- */}
            {error && (
                <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 shrink-0">
                    <AlertCircle size={12} className="text-red-400 shrink-0" />
                    <span className="text-[10px] text-red-400 font-medium truncate">{error}</span>
                    <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400 text-xs">&times;</button>
                </div>
            )}

            {/* ---- Content ---- */}
            <div className="flex-1 min-h-0 overflow-auto">

                {/* ============================================================ */}
                {/* MAIN VIEW: Agent Grid                                        */}
                {/* ============================================================ */}
                {selectedAgent === null && (
                    <div className="h-full flex items-center justify-center p-8">
                        <div className="grid grid-cols-2 gap-5 max-w-2xl w-full">
                            {PROVIDERS.map(id => {
                                const configured = hasCoreConfig(id)
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setSelectedAgent(id)}
                                        className="bg-card/60 border border-border/30 rounded-2xl p-6 hover:border-primary/30 transition-all cursor-pointer text-left group"
                                    >
                                        <div className="flex flex-col items-center text-center gap-4">
                                            <div className="py-2">
                                                {getAgentIcon(id, 32)}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold capitalize group-hover:text-primary transition-colors">
                                                    {id}
                                                </h3>
                                                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${configured ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`} />
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${configured ? 'text-emerald-500' : 'text-muted-foreground/30'}`}>
                                                        {configured ? 'Configured' : 'Not configured'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground/50 mt-3 leading-relaxed">
                                                    {PROVIDER_DESCRIPTIONS[id]}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* DETAIL VIEW: Agent selected                                  */}
                {/* ============================================================ */}
                {selectedAgent !== null && (
                    <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
                        {/* ---- Header ---- */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedAgent(null)
                                        setActiveConfig(null)
                                        setEditedContent('')
                                    }}
                                    className="h-8 w-8 p-0 rounded-lg"
                                >
                                    <ArrowLeft size={16} />
                                </Button>
                                <div className="flex items-center gap-3">
                                    {getAgentIcon(selectedAgent, 28)}
                                    <h1 className="text-lg font-bold capitalize">{selectedAgent}</h1>
                                </div>
                            </div>
                            <CustomDropdown
                                value={scopeValue}
                                onChange={handleScopeChange}
                                options={scopeOptions}
                                className="min-w-[180px]"
                                placeholder="All Projects"
                            />
                        </div>

                        {/* ---- Section 1: Instructions ---- */}
                        <div className="border border-border/20 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Instructions</label>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">
                                        Tell {selectedAgent} how to work on your code
                                    </p>
                                </div>
                                {(isDirty || hasNewContent) && (
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
                            <textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                placeholder={`# ${selectedAgent} Instructions\n\nDescribe how ${selectedAgent} should work on your codebase...\n\n- Coding style preferences\n- Testing requirements\n- Architecture guidelines`}
                                className="w-full min-h-[200px] bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-y transition-colors"
                                spellCheck={false}
                            />
                        </div>

                        {/* ---- Section 2: MCP Servers ---- */}
                        <div className="border border-border/20 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">MCP Servers</label>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">
                                        Tools available to {selectedAgent}
                                    </p>
                                </div>
                                <Button
                                    onClick={() => setMcpDialogOpen(true)}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 rounded-lg text-[9px] font-bold uppercase"
                                >
                                    <Plus size={12} className="mr-1" /> Add Server
                                </Button>
                            </div>

                            {Object.keys(snapshot?.mcp_servers || {}).length === 0 ? (
                                <div className="py-6 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/20">
                                        No MCP servers configured
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/15">
                                    {Object.entries(snapshot?.mcp_servers || {}).map(([name, cmd]) => {
                                        const tools = mcpTools.filter(t => t.name.startsWith(name + '_'))
                                        return (
                                            <div key={name} className="flex items-center gap-3 py-2.5 group">
                                                <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs font-bold uppercase tracking-wider">{name}</span>
                                                    <p className="text-[9px] font-mono text-muted-foreground/40 truncate">{cmd}</p>
                                                </div>
                                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-[8px] font-bold shrink-0">
                                                    {tools.length} TOOLS
                                                </Badge>
                                                <button
                                                    onClick={() => handleDeleteMCPServer(name)}
                                                    className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete server"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ---- Section 3: Skills ---- */}
                        <div className="border border-border/20 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Skills</label>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">
                                        Reusable instruction sets — portable across agents
                                    </p>
                                </div>
                                <Button
                                    onClick={() => { setCreateType('skill'); setSkillDialogOpen(true) }}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 rounded-lg text-[9px] font-bold uppercase"
                                >
                                    <Plus size={12} className="mr-1" /> Add Skill
                                </Button>
                            </div>

                            {skills.length === 0 ? (
                                <div className="py-4 text-center">
                                    <p className="text-[10px] text-muted-foreground/20">
                                        No skills configured. Skills are reusable knowledge packages (SKILL.md) that get injected into the agent's context.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/15">
                                    {skills.map(skill => {
                                        const shortName = skill.name.includes('/') ? skill.name.split('/').slice(1).join('/') : skill.name
                                        const preview = skill.content.replace(/^---[\s\S]*?---\s*/, '').trim().slice(0, 80)
                                        return (
                                            <div key={skill.path} className="flex items-center gap-3 py-2.5">
                                                <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                                                    <span className="text-[9px] font-bold text-amber-500">S</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-foreground truncate">{shortName}</p>
                                                    <p className="text-[9px] text-muted-foreground/40 truncate">{preview || 'No content'}</p>
                                                </div>
                                                <Badge variant="outline" className="text-[8px] font-bold uppercase shrink-0">
                                                    {skill.scope}
                                                </Badge>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ---- Section 4: Sub-agents ---- */}
                        <div className="border border-border/20 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Sub-agents</label>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">
                                        Isolated workers with their own context, tools, and model
                                    </p>
                                </div>
                                <Button
                                    onClick={() => { setCreateType('agent'); setSkillDialogOpen(true) }}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 rounded-lg text-[9px] font-bold uppercase"
                                >
                                    <Plus size={12} className="mr-1" /> Add Agent
                                </Button>
                            </div>

                            {subAgents.length === 0 ? (
                                <div className="py-4 text-center">
                                    <p className="text-[10px] text-muted-foreground/20">
                                        No sub-agents configured. Sub-agents run in isolated contexts with their own tools and model.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/15">
                                    {subAgents.map(agent => {
                                        const shortName = agent.name.includes('/') ? agent.name.split('/').slice(1).join('/') : agent.name
                                        const preview = agent.content.replace(/^---[\s\S]*?---\s*/, '').trim().slice(0, 80)
                                        return (
                                            <div key={agent.path} className="flex items-center gap-3 py-2.5">
                                                <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                                                    <span className="text-[9px] font-bold text-blue-500">A</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-foreground truncate">{shortName}</p>
                                                    <p className="text-[9px] text-muted-foreground/40 truncate">{preview || 'No content'}</p>
                                                </div>
                                                <Badge variant="outline" className="text-[8px] font-bold uppercase shrink-0">
                                                    {agent.scope}
                                                </Badge>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
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

            {/* ---- Create Skill / Sub-agent Dialog ---- */}
            <Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
                <DialogContent className="max-w-md bg-popover border-border shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                            {createType === 'skill' ? 'Create Skill' : 'Create Sub-agent'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground/60">
                            {createType === 'skill'
                                ? 'A reusable instruction set that gets injected into the agent\'s context'
                                : 'An isolated worker with its own context window, tools, and model'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Name</label>
                            <input
                                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                value={newSkillName}
                                onChange={e => setNewSkillName(e.target.value)}
                                placeholder={createType === 'skill' ? 'e.g. testing-guide' : 'e.g. code-reviewer'}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Content</label>
                            <textarea
                                className="w-full h-40 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                value={newSkillContent}
                                onChange={e => setNewSkillContent(e.target.value)}
                                placeholder={createType === 'skill'
                                    ? "---\nname: testing-guide\ndescription: How to write tests for this project\n---\n\nAlways use vitest for testing.\nPlace tests next to source files.\nAim for 80% coverage."
                                    : "---\nname: code-reviewer\ndescription: Reviews code for quality and security\ntools:\n  write: false\n  edit: false\n---\n\nYou are a code reviewer. Check for:\n- Security vulnerabilities\n- Performance issues\n- Missing error handling"}
                            />
                        </div>
                        <Button
                            onClick={handleCreateSkill}
                            disabled={!newSkillName || creating}
                            className="w-full h-9 bg-primary text-primary-foreground font-bold uppercase text-[10px] tracking-widest rounded-lg shadow-lg shadow-primary/20"
                        >
                            {creating ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Plus size={12} className="mr-1.5" />}
                            {createType === 'skill' ? 'Create Skill' : 'Create Sub-agent'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
