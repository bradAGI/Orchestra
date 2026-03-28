// apps/desktop/src/widgets/agents/hooks/useAgentConfig.ts
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { AgentConfig, Project } from '@/lib/orchestra-types'
import type {
  BackendConfig,
  MCPServer, MCPTool, ProviderMCPServer,
  ProviderPermissions, ProviderModelConfig, ProviderHook,
} from '@/lib/orchestra-client'
import {
  fetchAgentConfigs, updateAgentConfigByPath, createAgentResource,
  fetchProjects, fetchMCPTools, fetchMCPServers, createMCPServer, deleteMCPServer,
  fetchProviderMCPServers, addProviderMCPServer, deleteProviderMCPServer,
  fetchProviderPermissions, updateProviderPermissions,
  fetchProviderModel, updateProviderModel,
  fetchProviderHooks, updateProviderHooks,
} from '@/lib/orchestra-client'
import type { Provider, Scope, CategoryId } from '../types'

export interface AgentConfigState {
  // Data
  configs: AgentConfig[]
  projects: Project[]
  permissions: ProviderPermissions
  modelConfig: ProviderModelConfig
  hooks: ProviderHook[]
  providerMcpServers: ProviderMCPServer[]
  orchestraMcpServers: MCPServer[]
  mcpTools: MCPTool[]

  // State
  loading: boolean
  error: string
  saving: string | null

  // Mutations
  saveConfig: (path: string, content: string) => Promise<void>
  deleteConfig: (path: string) => Promise<void>
  createResource: (type: string, name: string) => Promise<void>
  savePermissions: (perms: ProviderPermissions) => Promise<void>
  saveModel: (model: ProviderModelConfig) => Promise<void>
  saveHooks: (hooks: ProviderHook[]) => Promise<void>
  addMCPServer: (name: string, command: string) => Promise<void>
  deleteMCPServer: (name: string) => Promise<void>
  deleteOrchestraMCPServer: (name: string) => Promise<void>

  // Helpers
  configsByCategory: (category: CategoryId) => AgentConfig[]
  categoryCounts: Record<CategoryId, number>
  setError: (msg: string) => void
}

export function useAgentConfig(
  backendConfig: BackendConfig | null,
  provider: Provider,
  scope: Scope,
  projectId?: string,
): AgentConfigState {
  const [configs, setConfigs] = useState<AgentConfig[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([])
  const [orchestraMcpServers, setOrchestraMcpServers] = useState<MCPServer[]>([])
  const [providerMcpServers, setProviderMcpServers] = useState<ProviderMCPServer[]>([])
  const [permissions, setPermissions] = useState<ProviderPermissions>({ approval_mode: 'default', allow: [], deny: [], ask: [] })
  const [modelConfig, setModelConfig] = useState<ProviderModelConfig>({ model: '', effort: '', temperature: null })
  const [hooks, setHooks] = useState<ProviderHook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  // Load all data when provider/scope/project changes
  useEffect(() => {
    if (!backendConfig) return
    let cancelled = false
    setLoading(true)

    const projId = scope === 'PROJECT' ? projectId : undefined

    Promise.all([
      fetchAgentConfigs(backendConfig, projId),
      fetchProjects(backendConfig),
      fetchMCPTools(backendConfig),
      fetchMCPServers(backendConfig),
      fetchProviderMCPServers(backendConfig, provider, projId).catch(() => [] as ProviderMCPServer[]),
      fetchProviderPermissions(backendConfig, provider, projId).catch(() => ({ approval_mode: 'default', allow: [], deny: [], ask: [] }) as ProviderPermissions),
      fetchProviderModel(backendConfig, provider).catch(() => ({ model: '', effort: '', temperature: null }) as ProviderModelConfig),
      fetchProviderHooks(backendConfig, provider).catch(() => [] as ProviderHook[]),
    ]).then(([cfgs, projs, tools, servers, provMcp, perms, model, hks]) => {
      if (cancelled) return
      setConfigs(cfgs)
      setProjects(projs)
      setMcpTools(tools)
      setOrchestraMcpServers(servers)
      setProviderMcpServers(provMcp)
      setPermissions(perms)
      setModelConfig(model)
      setHooks(hks)
      setError('')
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [backendConfig, provider, scope, projectId])

  const configsByCategory = useCallback((category: CategoryId): AgentConfig[] => {
    return configs.filter(c => {
      const p = provider.toLowerCase()
      const nameMatch = c.name.toLowerCase().includes(p)
      const cat = c.category as string
      switch (category) {
        case 'instructions': return cat === 'CORE' && nameMatch
        case 'skills': return cat === 'SKILL' && !c.path.includes('/agents/') && nameMatch
        case 'rules': return cat === 'RULE' && nameMatch
        case 'agents': return c.path.includes('/agents/') && nameMatch
        default: return false
      }
    })
  }, [configs, provider])

  const categoryCounts = useMemo((): Record<CategoryId, number> => ({
    instructions: configsByCategory('instructions').length,
    skills: configsByCategory('skills').length,
    hooks: hooks.length,
    mcp: providerMcpServers.length + orchestraMcpServers.length,
    rules: configsByCategory('rules').length,
    agents: configsByCategory('agents').length,
  }), [configsByCategory, hooks, providerMcpServers, orchestraMcpServers])

  const reload = useCallback(async () => {
    if (!backendConfig) return
    const projId = scope === 'PROJECT' ? projectId : undefined
    const cfgs = await fetchAgentConfigs(backendConfig, projId)
    setConfigs(cfgs)
  }, [backendConfig, scope, projectId])

  const reloadMcp = useCallback(async () => {
    if (!backendConfig) return
    const projId = scope === 'PROJECT' ? projectId : undefined
    const servers = await fetchProviderMCPServers(backendConfig, provider, projId).catch(() => [] as ProviderMCPServer[])
    setProviderMcpServers(servers)
    const orch = await fetchMCPServers(backendConfig)
    setOrchestraMcpServers(orch)
  }, [backendConfig, provider, scope, projectId])

  const saveConfig = useCallback(async (path: string, content: string) => {
    if (!backendConfig) return
    setSaving(path)
    try {
      await updateAgentConfigByPath(backendConfig, path, content)
      setConfigs(prev => prev.map(c => c.path === path ? { ...c, content } : c))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }, [backendConfig])

  const deleteConfig = useCallback(async (path: string) => {
    if (!backendConfig) return
    setSaving(path)
    try {
      await updateAgentConfigByPath(backendConfig, path, '')
      await reload()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(null)
    }
  }, [backendConfig, reload])

  const createResource = useCallback(async (type: string, name: string) => {
    if (!backendConfig) return
    setSaving('new')
    try {
      await createAgentResource(backendConfig, {
        provider,
        type,
        name,
        scope,
        ...(scope === 'PROJECT' && projectId ? { project_id: projectId } : {}),
      })
      await reload()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(null)
    }
  }, [backendConfig, provider, scope, projectId, reload])

  const savePermissions = useCallback(async (perms: ProviderPermissions) => {
    if (!backendConfig) return
    setSaving('permissions')
    try {
      await updateProviderPermissions(backendConfig, provider, perms)
      setPermissions(perms)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally {
      setSaving(null)
    }
  }, [backendConfig, provider])

  const saveModel = useCallback(async (model: ProviderModelConfig) => {
    if (!backendConfig) return
    setSaving('model')
    try {
      await updateProviderModel(backendConfig, provider, model)
      setModelConfig(model)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model config')
    } finally {
      setSaving(null)
    }
  }, [backendConfig, provider])

  const saveHooks = useCallback(async (hks: ProviderHook[]) => {
    if (!backendConfig) return
    setSaving('hooks')
    try {
      await updateProviderHooks(backendConfig, provider, hks)
      setHooks(hks)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hooks')
    } finally {
      setSaving(null)
    }
  }, [backendConfig, provider])

  const addMCP = useCallback(async (name: string, command: string) => {
    if (!backendConfig) return
    setSaving('mcp')
    try {
      await addProviderMCPServer(backendConfig, provider, { name, command })
      await reloadMcp()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add MCP server')
    } finally {
      setSaving(null)
    }
  }, [backendConfig, provider, reloadMcp])

  const deleteMCP = useCallback(async (name: string) => {
    if (!backendConfig) return
    try {
      await deleteProviderMCPServer(backendConfig, provider, name)
      await reloadMcp()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete MCP server')
    }
  }, [backendConfig, provider, reloadMcp])

  const deleteOrchMCP = useCallback(async (name: string) => {
    if (!backendConfig) return
    const server = orchestraMcpServers.find(s => s.name === name)
    if (!server?.id) return
    try {
      await deleteMCPServer(backendConfig, server.id)
      await reloadMcp()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete MCP server')
    }
  }, [backendConfig, orchestraMcpServers, reloadMcp])

  return {
    configs, projects, permissions, modelConfig, hooks,
    providerMcpServers, orchestraMcpServers, mcpTools,
    loading, error, saving,
    saveConfig, deleteConfig, createResource,
    savePermissions, saveModel, saveHooks,
    addMCPServer: addMCP, deleteMCPServer: deleteMCP,
    deleteOrchestraMCPServer: deleteOrchMCP,
    configsByCategory, categoryCounts, setError,
  }
}
