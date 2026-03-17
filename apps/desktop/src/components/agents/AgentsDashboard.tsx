import React, { useState, useEffect, useMemo } from 'react'
import {
    Save, Plus, Loader2, Trash2,
    ArrowLeft, AlertCircle, Folder, X,
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
    fetchProviderMCPServers,
    addProviderMCPServer,
    deleteProviderMCPServer,
    fetchProviderPermissions,
    updateProviderPermissions,
    fetchProviderModel,
    updateProviderModel,
    fetchProviderHooks,
    updateProviderHooks,
    type MCPServer,
    type MCPTool,
    type ProviderMCPServer,
    type ProviderPermissions,
    type ProviderModelConfig,
    type ProviderHook,
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

function ConfigItemRow({ icon, color, name, preview, scope }: { icon: string; color: string; name: string; preview: string; scope: string }) {
    return (
        <div className="flex items-center gap-3 py-2.5">
            <div className={`h-6 w-6 rounded bg-${color}-500/10 flex items-center justify-center shrink-0`}>
                <span className={`text-[9px] font-bold text-${color}-500`}>{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{name}</p>
                <p className="text-[9px] text-muted-foreground/40 truncate">{preview || 'No content'}</p>
            </div>
            <Badge variant="outline" className="text-[8px] font-bold uppercase shrink-0">{scope}</Badge>
        </div>
    )
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
    const [scope, setScope] = useState<'GLOBAL' | 'PROJECT'>('GLOBAL')
    const [selectedProjectID, setSelectedProjectID] = useState<string>('')

    /* ---------- instructions state ---------- */
    const [activeConfig, setActiveConfig] = useState<AgentConfig | null>(null)
    const [editedContent, setEditedContent] = useState('')

    /* ---------- profiles state ---------- */
    const [expandedItem, setExpandedItem] = useState<string | null>(null)
    const [editingItemContent, setEditingItemContent] = useState('')
    const [savingItem, setSavingItem] = useState<string | null>(null)
    const [skillDialogOpen, setSkillDialogOpen] = useState(false)
    const [newSkillName, setNewSkillName] = useState('')
    const [newSkillContent, setNewSkillContent] = useState('')

    const [createType, setCreateType] = useState<'skill' | 'agent'>('skill')

    /* ---------- permissions state ---------- */
    const [permissions, setPermissions] = useState<ProviderPermissions>({ approval_mode: 'default', allow: [], deny: [], ask: [] })
    const [newAllowRule, setNewAllowRule] = useState('')
    const [newDenyRule, setNewDenyRule] = useState('')
    const [newAskRule, setNewAskRule] = useState('')
    const [savingPermissions, setSavingPermissions] = useState(false)

    /* ---------- model config state ---------- */
    const [modelConfig, setModelConfig] = useState<ProviderModelConfig>({ model: '', effort: '', temperature: null })
    const [savingModel, setSavingModel] = useState(false)

    /* ---------- hooks state ---------- */
    const [hooks, setHooks] = useState<ProviderHook[]>([])
    const [newHookEvent, setNewHookEvent] = useState('')
    const [newHookCommand, setNewHookCommand] = useState('')
    const [newHookMatcher, setNewHookMatcher] = useState('')
    const [savingHooks, setSavingHooks] = useState(false)

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
                fetchAgentConfigs(config, scope === 'PROJECT' ? selectedProjectID : undefined),
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
            c.category === 'CORE' &&
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
                    type: 'CORE',
                    name: provider,
                    scope,
                    ...(scope === 'PROJECT' && selectedProjectID ? { project_id: selectedProjectID } : {}),
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
    const handleDeleteProviderMCPServer = async (name: string) => {
        if (!config || !selectedAgent) return
        if (!window.confirm(`Delete MCP server "${name}" from ${selectedAgent}?`)) return
        try {
            await deleteProviderMCPServer(config, selectedAgent, name)
            await reloadProviderMcp()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to delete MCP server')
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

    const handleExpandItem = (path: string, content: string) => {
        if (expandedItem === path) {
            setExpandedItem(null)
        } else {
            setExpandedItem(path)
            setEditingItemContent(content)
        }
    }

    const handleSaveItem = async (path: string) => {
        if (!config) return
        setSavingItem(path)
        try {
            await updateAgentConfigByPath(config, path, editingItemContent)
            setConfigs(prev => prev.map(c => c.path === path ? { ...c, content: editingItemContent } : c))
            setExpandedItem(null)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Save failed')
        } finally {
            setSavingItem(null)
        }
    }

    const handleDeleteItem = async (path: string, name: string) => {
        if (!config) return
        if (!window.confirm(`Delete "${name}"? This will remove the file from disk.`)) return
        try {
            await updateAgentConfigByPath(config, path, '')
            await loadData()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Delete failed')
        }
    }

    const handleCreateMCPServer = async () => {
        if (!config || !newMcpName || !newMcpCommand) return
        setCreating(true)
        try {
            if (selectedAgent) {
                await addProviderMCPServer(config, selectedAgent, { name: newMcpName, command: newMcpCommand })
                await reloadProviderMcp()
            } else {
                await createMCPServer(config, newMcpName, newMcpCommand)
                await loadData()
            }
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
                type: 'SKILL',
                name: newSkillName,
                scope,
                ...(scope === 'PROJECT' && selectedProjectID ? { project_id: selectedProjectID } : {}),
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
            c.category === 'SKILL' &&
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

    // Fetch MCP servers from provider config files via backend API
    const [providerMcpServers, setProviderMcpServers] = useState<ProviderMCPServer[]>([])

    const reloadProviderMcp = React.useCallback(async () => {
        if (!config || !selectedAgent) {
            setProviderMcpServers([])
            return
        }
        try {
            const projId = scope === 'PROJECT' ? selectedProjectID : undefined
            const servers = await fetchProviderMCPServers(config, selectedAgent, projId)
            setProviderMcpServers(servers)
        } catch {
            setProviderMcpServers([])
        }
    }, [config, selectedAgent, scope, selectedProjectID])

    useEffect(() => {
        reloadProviderMcp()
    }, [reloadProviderMcp])

    /* ---------- load permissions, model, hooks on agent change ---------- */
    const reloadProviderConfig = React.useCallback(async () => {
        if (!config || !selectedAgent) return
        try {
            const projId = scope === 'PROJECT' ? selectedProjectID : undefined
            const [perms, model, hks] = await Promise.all([
                fetchProviderPermissions(config, selectedAgent, projId),
                fetchProviderModel(config, selectedAgent),
                fetchProviderHooks(config, selectedAgent),
            ])
            setPermissions(perms)
            setModelConfig(model)
            setHooks(hks)
        } catch {
            // defaults on error
            setPermissions({ approval_mode: 'default', allow: [], deny: [], ask: [] })
            setModelConfig({ model: '', effort: '', temperature: null })
            setHooks([])
        }
    }, [config, selectedAgent, scope, selectedProjectID])

    useEffect(() => {
        reloadProviderConfig()
    }, [reloadProviderConfig])

    /* ---------- permissions save ---------- */
    const handleSavePermissions = async () => {
        if (!config || !selectedAgent) return
        setSavingPermissions(true)
        try {
            await updateProviderPermissions(config, selectedAgent, permissions)
            setError('')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to save permissions')
        } finally {
            setSavingPermissions(false)
        }
    }

    /* ---------- model save ---------- */
    const handleSaveModel = async () => {
        if (!config || !selectedAgent) return
        setSavingModel(true)
        try {
            await updateProviderModel(config, selectedAgent, modelConfig)
            setError('')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to save model config')
        } finally {
            setSavingModel(false)
        }
    }

    /* ---------- hooks save ---------- */
    const handleSaveHooks = async () => {
        if (!config || !selectedAgent) return
        setSavingHooks(true)
        try {
            await updateProviderHooks(config, selectedAgent, hooks)
            setError('')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message || 'Failed to save hooks')
        } finally {
            setSavingHooks(false)
        }
    }

    /* ---------- hook events per provider ---------- */
    const hookEventsForProvider: Record<string, string[]> = {
        claude: ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Notification', 'Stop', 'SubagentStop', 'PreCompact'],
        codex: ['notify'],
        gemini: ['SessionStart', 'SessionEnd', 'BeforeAgent', 'AfterAgent', 'BeforeModel', 'AfterModel', 'BeforeToolSelection'],
        opencode: [],
    }

    const hasCoreConfig = (provider: Provider) =>
        configs.some(c => c.category === 'CORE' && c.name.toLowerCase().includes(provider))

    /* ---------- scope dropdown options ---------- */
    const scopeOptions = useMemo(() => {
        const opts: { label: string; value: string; icon?: React.ReactNode }[] = [
            { label: 'All Projects', value: 'GLOBAL', icon: <Folder size={12} className="text-muted-foreground/50" /> },
            ...projects.map(p => ({ label: p.name, value: p.id, icon: <Folder size={12} className="text-primary/60" /> })),
        ]
        return opts
    }, [projects])

    const handleScopeChange = (value: string) => {
        if (value === 'GLOBAL') {
            setScope('GLOBAL')
            setSelectedProjectID('')
        } else {
            setScope('PROJECT')
            setSelectedProjectID(value)
        }
    }

    const scopeValue = scope === 'GLOBAL' ? 'GLOBAL' : selectedProjectID

    /* ================================================================ */
    /*  RENDER                                                          */
    /* ================================================================ */

    return (
        <div className="flex flex-col h-full overflow-hidden">
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
                    <div className="h-full p-6">
                        <div className="grid grid-cols-2 gap-4 h-full">
                            {PROVIDERS.map(id => {
                                const configured = hasCoreConfig(id)
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setSelectedAgent(id)}
                                        className="relative bg-gradient-to-b from-card via-card to-muted/20 border border-border/40 rounded-xl p-8 hover:border-primary/30 transition-all cursor-pointer group flex flex-col items-center justify-center overflow-hidden"
                                    >
                                        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <div className="flex flex-col items-center text-center gap-4 flex-1 justify-center relative">
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
                    <div className="w-full px-6 py-8 px-6 space-y-6">
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

                        {/* ---- Section 2: Permissions ---- */}
                        <div className="border border-border/20 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Permissions</label>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">
                                        Control what {selectedAgent} is allowed to do
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={handleSavePermissions}
                                    disabled={savingPermissions}
                                    className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
                                >
                                    {savingPermissions ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                                    Save
                                </Button>
                            </div>

                            {/* Approval Mode */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Approval Mode</label>
                                <select
                                    value={permissions.approval_mode}
                                    onChange={e => setPermissions(p => ({ ...p, approval_mode: e.target.value }))}
                                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    {selectedAgent === 'claude' ? (
                                        <>
                                            <option value="default">Default (interactive)</option>
                                            <option value="acceptEdits">Accept Edits</option>
                                            <option value="bypassPermissions">Bypass Permissions</option>
                                            <option value="plan">Plan</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="interactive">Interactive</option>
                                            <option value="auto-edit">Auto-edit</option>
                                            <option value="full-auto">Full-auto</option>
                                            <option value="on-request">On-request</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Allowed */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Allowed</label>
                                </div>
                                {permissions.allow.length === 0 && (
                                    <p className="text-[10px] text-muted-foreground/20">No allow rules configured</p>
                                )}
                                {permissions.allow.map((rule, i) => (
                                    <div key={i} className="flex items-center gap-2 group">
                                        <span className="flex-1 text-xs font-mono bg-muted/10 rounded px-2 py-1 border border-border/20">{rule}</span>
                                        <button
                                            onClick={() => setPermissions(p => ({ ...p, allow: p.allow.filter((_, idx) => idx !== i) }))}
                                            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2">
                                    <input
                                        className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={newAllowRule}
                                        onChange={e => setNewAllowRule(e.target.value)}
                                        placeholder="e.g. Read, Bash(git *)"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newAllowRule.trim()) {
                                                setPermissions(p => ({ ...p, allow: [...p.allow, newAllowRule.trim()] }))
                                                setNewAllowRule('')
                                            }
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-lg text-[9px] font-bold uppercase"
                                        disabled={!newAllowRule.trim()}
                                        onClick={() => {
                                            if (newAllowRule.trim()) {
                                                setPermissions(p => ({ ...p, allow: [...p.allow, newAllowRule.trim()] }))
                                                setNewAllowRule('')
                                            }
                                        }}
                                    >
                                        <Plus size={10} className="mr-1" /> Add
                                    </Button>
                                </div>
                            </div>

                            {/* Denied */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Denied</label>
                                </div>
                                {permissions.deny.length === 0 && (
                                    <p className="text-[10px] text-muted-foreground/20">No deny rules configured</p>
                                )}
                                {permissions.deny.map((rule, i) => (
                                    <div key={i} className="flex items-center gap-2 group">
                                        <span className="flex-1 text-xs font-mono bg-muted/10 rounded px-2 py-1 border border-border/20">{rule}</span>
                                        <button
                                            onClick={() => setPermissions(p => ({ ...p, deny: p.deny.filter((_, idx) => idx !== i) }))}
                                            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2">
                                    <input
                                        className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={newDenyRule}
                                        onChange={e => setNewDenyRule(e.target.value)}
                                        placeholder="e.g. Bash(rm -rf *)"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newDenyRule.trim()) {
                                                setPermissions(p => ({ ...p, deny: [...p.deny, newDenyRule.trim()] }))
                                                setNewDenyRule('')
                                            }
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-lg text-[9px] font-bold uppercase"
                                        disabled={!newDenyRule.trim()}
                                        onClick={() => {
                                            if (newDenyRule.trim()) {
                                                setPermissions(p => ({ ...p, deny: [...p.deny, newDenyRule.trim()] }))
                                                setNewDenyRule('')
                                            }
                                        }}
                                    >
                                        <Plus size={10} className="mr-1" /> Add
                                    </Button>
                                </div>
                            </div>

                            {/* Ask (Claude only) */}
                            {selectedAgent === 'claude' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Ask</label>
                                    </div>
                                    {permissions.ask.length === 0 && (
                                        <p className="text-[10px] text-muted-foreground/20">No ask rules configured</p>
                                    )}
                                    {permissions.ask.map((rule, i) => (
                                        <div key={i} className="flex items-center gap-2 group">
                                            <span className="flex-1 text-xs font-mono bg-muted/10 rounded px-2 py-1 border border-border/20">{rule}</span>
                                            <button
                                                onClick={() => setPermissions(p => ({ ...p, ask: p.ask.filter((_, idx) => idx !== i) }))}
                                                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <input
                                            className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                            value={newAskRule}
                                            onChange={e => setNewAskRule(e.target.value)}
                                            placeholder="e.g. WebFetch, Bash(curl *)"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && newAskRule.trim()) {
                                                    setPermissions(p => ({ ...p, ask: [...p.ask, newAskRule.trim()] }))
                                                    setNewAskRule('')
                                                }
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 rounded-lg text-[9px] font-bold uppercase"
                                            disabled={!newAskRule.trim()}
                                            onClick={() => {
                                                if (newAskRule.trim()) {
                                                    setPermissions(p => ({ ...p, ask: [...p.ask, newAskRule.trim()] }))
                                                    setNewAskRule('')
                                                }
                                            }}
                                        >
                                            <Plus size={10} className="mr-1" /> Add
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Sandbox (Codex only) */}
                            {selectedAgent === 'codex' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Sandbox</label>
                                    <select
                                        value={permissions.sandbox || ''}
                                        onChange={e => setPermissions(p => ({ ...p, sandbox: e.target.value }))}
                                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                    >
                                        <option value="">None</option>
                                        <option value="workspace-write">Workspace Write</option>
                                        <option value="workspace-read">Workspace Read</option>
                                        <option value="none">Disabled</option>
                                    </select>
                                </div>
                            )}

                            {/* Allowed Tools (Claude only, project scope) */}
                            {selectedAgent === 'claude' && scope === 'PROJECT' && permissions.allowed_tools && permissions.allowed_tools.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Project Allowed Tools</label>
                                    <p className="text-[9px] text-muted-foreground/40">Managed by Claude Code permission dialogs</p>
                                    <div className="space-y-1">
                                        {permissions.allowed_tools.map((tool, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                <span className="text-xs font-mono text-muted-foreground">{tool}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Enabled Plugins (Claude only) */}
                            {selectedAgent === 'claude' && permissions.enabled_plugins && permissions.enabled_plugins.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Plugins</label>
                                    <p className="text-[9px] text-muted-foreground/40">Enabled in Claude Code settings</p>
                                    <div className="space-y-1">
                                        {permissions.enabled_plugins.map((plugin, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                                                <span className="text-xs font-mono text-muted-foreground">{plugin}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ---- Section 3: Model ---- */}
                        <div className="border border-border/20 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Model</label>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">
                                        Configure which model {selectedAgent} uses
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={handleSaveModel}
                                    disabled={savingModel}
                                    className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
                                >
                                    {savingModel ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                                    Save
                                </Button>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Model</label>
                                <input
                                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={modelConfig.model}
                                    onChange={e => setModelConfig(m => ({ ...m, model: e.target.value }))}
                                    placeholder="e.g. claude-sonnet-4-6"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Effort</label>
                                <div className="flex gap-2">
                                    {['low', 'medium', 'high', 'max'].map(level => (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => setModelConfig(m => ({ ...m, effort: level }))}
                                            className={`flex-1 h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                                                modelConfig.effort === level
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-background border-border/30 text-muted-foreground/50 hover:border-primary/30 hover:text-foreground'
                                            }`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Temperature</label>
                                <input
                                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="2"
                                    value={modelConfig.temperature ?? ''}
                                    onChange={e => {
                                        const val = e.target.value
                                        setModelConfig(m => ({ ...m, temperature: val === '' ? null : parseFloat(val) }))
                                    }}
                                    placeholder="Default"
                                />
                            </div>
                        </div>

                        {/* ---- Section 4: Hooks ---- */}
                        <div className="border border-border/20 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Hooks</label>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">
                                        Commands that run on lifecycle events
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={handleSaveHooks}
                                    disabled={savingHooks}
                                    className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
                                >
                                    {savingHooks ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                                    Save
                                </Button>
                            </div>

                            {hooks.length === 0 && (hookEventsForProvider[selectedAgent]?.length ?? 0) === 0 ? (
                                <div className="py-4 text-center">
                                    <p className="text-[10px] text-muted-foreground/20">
                                        This provider uses a plugin-based system and does not support hooks.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {hooks.length === 0 ? (
                                        <div className="py-4 text-center">
                                            <p className="text-[10px] text-muted-foreground/20">
                                                No hooks configured
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/15">
                                            {hooks.map((hook, i) => (
                                                <div key={i} className="flex items-center gap-3 py-2.5 group">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs font-bold tracking-wider">{hook.event}</span>
                                                        {hook.matcher && (
                                                            <span className="text-[9px] text-muted-foreground/40 ml-1">[{hook.matcher}]</span>
                                                        )}
                                                        <p className="text-[9px] font-mono text-muted-foreground/40 truncate">{hook.command}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setHooks(h => h.filter((_, idx) => idx !== i))}
                                                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {(hookEventsForProvider[selectedAgent]?.length ?? 0) > 0 && (
                                        <div className="flex items-end gap-2 pt-2 border-t border-border/10">
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Event</label>
                                                <select
                                                    value={newHookEvent}
                                                    onChange={e => setNewHookEvent(e.target.value)}
                                                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                                >
                                                    <option value="">Select event...</option>
                                                    {(hookEventsForProvider[selectedAgent] || []).map(ev => (
                                                        <option key={ev} value={ev}>{ev}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Command</label>
                                                <input
                                                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                                    value={newHookCommand}
                                                    onChange={e => setNewHookCommand(e.target.value)}
                                                    placeholder="bash /path/to/hook.sh"
                                                />
                                            </div>
                                            {selectedAgent === 'claude' && (
                                                <div className="w-24 space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Matcher</label>
                                                    <input
                                                        className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                                        value={newHookMatcher}
                                                        onChange={e => setNewHookMatcher(e.target.value)}
                                                        placeholder="Bash"
                                                    />
                                                </div>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 rounded-lg text-[9px] font-bold uppercase shrink-0"
                                                disabled={!newHookEvent || !newHookCommand.trim()}
                                                onClick={() => {
                                                    if (newHookEvent && newHookCommand.trim()) {
                                                        setHooks(h => [...h, { event: newHookEvent, command: newHookCommand.trim(), matcher: newHookMatcher.trim() || undefined, type: 'command' }])
                                                        setNewHookEvent('')
                                                        setNewHookCommand('')
                                                        setNewHookMatcher('')
                                                    }
                                                }}
                                            >
                                                <Plus size={10} className="mr-1" /> Add
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ---- Section 5: MCP Servers ---- */}
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

                            {providerMcpServers.length === 0 && Object.keys(snapshot?.mcp_servers || {}).length === 0 ? (
                                <div className="py-6 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/20">
                                        No MCP servers configured
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/15">
                                    {/* Provider-specific MCP servers */}
                                    {providerMcpServers.map(server => (
                                        <div key={server.name} className="flex items-center gap-3 py-2.5 group">
                                            <div className={`h-2 w-2 rounded-full shrink-0 ${server.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-bold tracking-wider">{server.name}</span>
                                                <p className="text-[9px] font-mono text-muted-foreground/40 truncate">{server.command || server.url || 'configured'}</p>
                                            </div>
                                            <Badge variant="outline" className="text-[8px] font-bold uppercase shrink-0 text-emerald-500/60 border-emerald-500/20">
                                                {selectedAgent}
                                            </Badge>
                                            <button onClick={e => { e.stopPropagation(); handleDeleteProviderMCPServer(server.name) }}
                                                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}
                                    {/* Orchestra MCP servers */}
                                    {Object.entries(snapshot?.mcp_servers || {}).map(([name, cmd]) => {
                                        const tools = mcpTools.filter(t => t.name.startsWith(name + '_'))
                                        return (
                                            <div key={name} className="flex items-center gap-3 py-2.5 group">
                                                <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs font-bold tracking-wider">{name}</span>
                                                    <p className="text-[9px] font-mono text-muted-foreground/40 truncate">{cmd}</p>
                                                </div>
                                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-[8px] font-bold shrink-0">
                                                    {tools.length} tools
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

                        {/* ---- Section 6: Skills ---- */}
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
                                        const isExpanded = expandedItem === skill.path
                                        return (
                                            <div key={skill.path}>
                                                <div className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/10 transition-colors group"
                                                     onClick={() => handleExpandItem(skill.path, skill.content)}>
                                                    <ConfigItemRow icon="S" color="amber" name={shortName} preview={preview} scope={skill.scope} />
                                                    <button onClick={e => { e.stopPropagation(); handleDeleteItem(skill.path, shortName) }}
                                                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-3 pb-3 space-y-2">
                                                        <textarea
                                                            className="w-full min-h-[300px] rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none resize-y"
                                                            value={editingItemContent}
                                                            onChange={e => setEditingItemContent(e.target.value)}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="sm" className="h-6 text-[9px]" onClick={() => setExpandedItem(null)}>Cancel</Button>
                                                            <Button size="sm" className="h-6 text-[9px]" disabled={savingItem === skill.path}
                                                                onClick={() => handleSaveItem(skill.path)}>
                                                                {savingItem === skill.path ? <Loader2 size={10} className="animate-spin mr-1" /> : <Save size={10} className="mr-1" />}
                                                                Save
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ---- Section 7: Sub-agents ---- */}
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
                                        const isExpanded = expandedItem === agent.path
                                        return (
                                            <div key={agent.path}>
                                                <div className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/10 transition-colors group"
                                                     onClick={() => handleExpandItem(agent.path, agent.content)}>
                                                    <ConfigItemRow icon="A" color="blue" name={shortName} preview={preview} scope={agent.scope} />
                                                    <button onClick={e => { e.stopPropagation(); handleDeleteItem(agent.path, shortName) }}
                                                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-3 pb-3 space-y-2">
                                                        <textarea
                                                            className="w-full min-h-[300px] rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none resize-y"
                                                            value={editingItemContent}
                                                            onChange={e => setEditingItemContent(e.target.value)}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="sm" className="h-6 text-[9px]" onClick={() => setExpandedItem(null)}>Cancel</Button>
                                                            <Button size="sm" className="h-6 text-[9px]" disabled={savingItem === agent.path}
                                                                onClick={() => handleSaveItem(agent.path)}>
                                                                {savingItem === agent.path ? <Loader2 size={10} className="animate-spin mr-1" /> : <Save size={10} className="mr-1" />}
                                                                Save
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
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
                        <DialogDescription className="text-xs text-muted-foreground/60">{selectedAgent ? `Add an MCP server to ${selectedAgent}'s config` : 'Connect a new tool server to Orchestra'}</DialogDescription>
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
                                className="w-full min-h-[300px] rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none resize-y"
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
