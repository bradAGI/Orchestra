# Agents Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1,373-line AgentsDashboard monolith with a modular 3-column package-manager UI in `widgets/agents/`.

**Architecture:** Three-column layout — provider tabs (left), category inventory (middle), detail/editor panel (right). A `useAgentConfig` hook centralizes all data fetching and mutations. Each category panel is its own file under `panels/`.

**Tech Stack:** React 19, TypeScript, Tailwind v4, existing `CustomDropdown`/`Button`/`Badge`/`Skeleton` components, existing `orchestra-client.ts` API functions.

---

## File Structure

```
apps/desktop/src/widgets/agents/
├── AgentsDashboard.tsx        — 3-column shell (~150 lines)
├── ProviderTabs.tsx           — Vertical icon tabs (~60 lines)
├── ProviderHeader.tsx         — Model/effort/permissions/scope controls (~100 lines)
├── CategoryList.tsx           — Category sidebar with counts (~120 lines)
├── panels/
│   ├── InstructionsPanel.tsx  — Markdown editor (~120 lines)
│   ├── SkillsPanel.tsx        — SKILL.md CRUD (~150 lines)
│   ├── HooksPanel.tsx         — Hook event management (~160 lines)
│   ├── MCPPanel.tsx           — MCP server management (~150 lines)
│   ├── RulesPanel.tsx         — Rules directory CRUD (~130 lines)
│   └── SubAgentsPanel.tsx     — Sub-agent CRUD (~130 lines)
├── hooks/
│   └── useAgentConfig.ts      — Data fetching + mutations (~200 lines)
├── constants.ts               — Provider metadata, models, events (~80 lines)
├── types.ts                   — Shared types (~40 lines)
└── index.ts                   — Re-exports (~3 lines)
```

---

### Task 1: Types and Constants

**Files:**
- Create: `apps/desktop/src/widgets/agents/types.ts`
- Create: `apps/desktop/src/widgets/agents/constants.ts`

- [ ] **Step 1: Create types.ts**

```ts
// apps/desktop/src/widgets/agents/types.ts
import type { AgentConfig, ProviderPermissions, ProviderModelConfig, ProviderHook } from '@/lib/orchestra-client'

export type Provider = 'claude' | 'codex' | 'gemini' | 'opencode'
export type CategoryId = 'instructions' | 'skills' | 'hooks' | 'mcp' | 'rules' | 'agents'
export type Scope = 'GLOBAL' | 'PROJECT'

export interface CategoryDef {
  id: CategoryId
  label: string
  icon: string
  pinned?: boolean
}

export interface PanelProps {
  items: AgentConfig[]
  selectedItem: string | null
  onSelectItem: (path: string | null) => void
  onSave: (path: string, content: string) => Promise<void>
  onDelete: (path: string) => Promise<void>
  onCreate: (name: string, content?: string) => Promise<void>
  loading: boolean
  saving: string | null
  provider: Provider
}
```

- [ ] **Step 2: Create constants.ts**

Extract all static data from the current monolith (`AgentsDashboard.tsx:457-511` for models, `457-462` for hook events, `59-64` for descriptions).

```ts
// apps/desktop/src/widgets/agents/constants.ts
import type { Provider, CategoryDef } from './types'

export const PROVIDERS: { id: Provider; label: string; description: string }[] = [
  { id: 'claude', label: 'Claude', description: "Anthropic's Claude Code — deep reasoning and careful analysis" },
  { id: 'codex', label: 'Codex', description: "OpenAI's Codex — fast iteration and broad knowledge" },
  { id: 'gemini', label: 'Gemini', description: "Google's Gemini CLI — multimodal and context-aware" },
  { id: 'opencode', label: 'OpenCode', description: 'Community-driven — flexible and extensible' },
]

export const CATEGORIES: CategoryDef[] = [
  { id: 'instructions', label: 'Instructions', icon: '📝', pinned: true },
  { id: 'skills', label: 'Skills', icon: '⚡' },
  { id: 'hooks', label: 'Hooks', icon: '🪝' },
  { id: 'mcp', label: 'MCP Servers', icon: '🔌' },
  { id: 'rules', label: 'Rules', icon: '📏' },
  { id: 'agents', label: 'Sub-agents', icon: '🤖' },
]

export const MODELS_BY_PROVIDER: Record<Provider, { value: string; label: string }[]> = {
  claude: [
    { value: 'sonnet', label: 'Sonnet (latest)' },
    { value: 'opus', label: 'Opus (latest)' },
    { value: 'haiku', label: 'Haiku (latest)' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-opus-4-6[1m]', label: 'Claude Opus 4.6 (1M context)' },
    { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  codex: [
    { value: 'gpt-5.3-codex', label: 'GPT 5.3 Codex' },
    { value: 'gpt-5.3-codex-spark', label: 'GPT 5.3 Codex Spark' },
    { value: 'gpt-5.2-codex', label: 'GPT 5.2 Codex' },
    { value: 'gpt-5.1-codex', label: 'GPT 5.1 Codex' },
    { value: 'gpt-5.1-codex-max', label: 'GPT 5.1 Codex Max' },
    { value: 'gpt-5.1-codex-mini', label: 'GPT 5.1 Codex Mini' },
    { value: 'gpt-5-codex', label: 'GPT 5 Codex' },
    { value: 'gpt-5.4', label: 'GPT 5.4' },
    { value: 'gpt-5.2', label: 'GPT 5.2' },
    { value: 'codex-mini-latest', label: 'Codex Mini (latest)' },
    { value: 'o3', label: 'o3' },
  ],
  gemini: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
  opencode: [
    { value: 'openai/gpt-5.3-codex', label: 'OpenAI GPT 5.3 Codex' },
    { value: 'openai/gpt-5.3-codex-spark', label: 'OpenAI GPT 5.3 Codex Spark' },
    { value: 'openai/gpt-5.2-codex', label: 'OpenAI GPT 5.2 Codex' },
    { value: 'openai/gpt-5.1-codex', label: 'OpenAI GPT 5.1 Codex' },
    { value: 'openai/gpt-5.1-codex-max', label: 'OpenAI GPT 5.1 Codex Max' },
    { value: 'openai/gpt-5.4', label: 'OpenAI GPT 5.4' },
    { value: 'openai/gpt-5.2', label: 'OpenAI GPT 5.2' },
    { value: 'openai/codex-mini-latest', label: 'OpenAI Codex Mini' },
    { value: 'opencode/big-pickle', label: 'Big Pickle' },
    { value: 'opencode/gpt-5-nano', label: 'GPT 5 Nano' },
    { value: 'opencode/mimo-v2-flash-free', label: 'Mimo V2 Flash (free)' },
    { value: 'opencode/minimax-m2.5-free', label: 'Minimax M2.5 (free)' },
    { value: 'opencode/nemotron-3-super-free', label: 'Nemotron 3 Super (free)' },
  ],
}

export const HOOK_EVENTS_BY_PROVIDER: Record<Provider, string[]> = {
  claude: ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Notification', 'Stop', 'SubagentStop', 'PreCompact'],
  codex: ['notify'],
  gemini: ['SessionStart', 'SessionEnd', 'BeforeAgent', 'AfterAgent', 'BeforeModel', 'AfterModel', 'BeforeToolSelection'],
  opencode: [],
}

export const EFFORT_LEVELS: Record<Provider, string[]> = {
  claude: ['low', 'medium', 'high'],
  codex: ['low', 'medium', 'high', 'very-high', 'max', 'reasoning'],
  gemini: ['low', 'medium', 'high'],
  opencode: ['low', 'medium', 'high'],
}

export const APPROVAL_MODES: Record<Provider, { label: string; value: string }[]> = {
  claude: [
    { label: 'Default (interactive)', value: 'default' },
    { label: 'Accept Edits', value: 'acceptEdits' },
    { label: 'Bypass Permissions', value: 'bypassPermissions' },
    { label: 'Plan', value: 'plan' },
  ],
  codex: [
    { label: 'Interactive', value: 'interactive' },
    { label: 'Auto-edit', value: 'auto-edit' },
    { label: 'Full-auto', value: 'full-auto' },
    { label: 'On-request', value: 'on-request' },
  ],
  gemini: [
    { label: 'Interactive', value: 'interactive' },
    { label: 'Auto-edit', value: 'auto-edit' },
    { label: 'Full-auto', value: 'full-auto' },
    { label: 'On-request', value: 'on-request' },
  ],
  opencode: [
    { label: 'Interactive', value: 'interactive' },
    { label: 'Auto-edit', value: 'auto-edit' },
    { label: 'Full-auto', value: 'full-auto' },
    { label: 'On-request', value: 'on-request' },
  ],
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep -E "(types|constants)" | head -5`
Expected: No errors from the new files.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/agents/types.ts apps/desktop/src/widgets/agents/constants.ts
git commit -m "feat(agents-dashboard): add types and constants for redesign"
```

---

### Task 2: useAgentConfig Hook

**Files:**
- Create: `apps/desktop/src/widgets/agents/hooks/useAgentConfig.ts`

- [ ] **Step 1: Create the hook**

This hook centralizes all data fetching and mutations. It extracts the logic from `AgentsDashboard.tsx` lines 91-454 (state declarations, `loadData`, `syncActiveConfig`, all save/delete/create handlers, `reloadProviderMcp`, `reloadProviderConfig`).

```ts
// apps/desktop/src/widgets/agents/hooks/useAgentConfig.ts
import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  AgentConfig, BackendConfig, Project,
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
      switch (category) {
        case 'instructions': return c.category === 'CORE' && nameMatch
        case 'skills': return c.category === 'SKILL' && !c.path.includes('/agents/') && nameMatch
        case 'rules': return c.category === 'RULE' && nameMatch
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
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep "useAgentConfig" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/widgets/agents/hooks/useAgentConfig.ts
git commit -m "feat(agents-dashboard): add useAgentConfig centralized data hook"
```

---

### Task 3: ProviderTabs Component

**Files:**
- Create: `apps/desktop/src/widgets/agents/ProviderTabs.tsx`

- [ ] **Step 1: Create ProviderTabs**

```tsx
// apps/desktop/src/widgets/agents/ProviderTabs.tsx
import { getAgentIcon } from '@/components/app-shell/shared/controls'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { PROVIDERS } from './constants'
import type { Provider } from './types'

interface ProviderTabsProps {
  selected: Provider
  onSelect: (provider: Provider) => void
  configuredSet: Set<Provider>
}

export function ProviderTabs({ selected, onSelect, configuredSet }: ProviderTabsProps) {
  return (
    <div className="flex flex-col items-center gap-1 py-4 px-1 border-r border-border/30 bg-card/30">
      {PROVIDERS.map(({ id, label, description }) => {
        const active = selected === id
        const configured = configuredSet.has(id)
        return (
          <AppTooltip key={id} side="right" content={<div className="flex flex-col gap-0.5"><span>{label}</span><span className="text-[8px] font-bold text-muted-foreground/70 normal-case tracking-normal">{description}</span></div>}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={`relative grid h-10 w-10 place-items-center rounded-lg transition-all ${
                active
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 border border-transparent'
              }`}
            >
              {getAgentIcon(id, 20)}
              <div className={`absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${configured ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`} />
            </button>
          </AppTooltip>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/widgets/agents/ProviderTabs.tsx
git commit -m "feat(agents-dashboard): add ProviderTabs component"
```

---

### Task 4: ProviderHeader Component

**Files:**
- Create: `apps/desktop/src/widgets/agents/ProviderHeader.tsx`

- [ ] **Step 1: Create ProviderHeader**

```tsx
// apps/desktop/src/widgets/agents/ProviderHeader.tsx
import type { ProviderPermissions, ProviderModelConfig, Project } from '@/lib/orchestra-client'
import { CustomDropdown } from '@/components/app-shell/shared/controls'
import { Folder } from 'lucide-react'
import { MODELS_BY_PROVIDER, EFFORT_LEVELS, APPROVAL_MODES } from './constants'
import type { Provider, Scope } from './types'

interface ProviderHeaderProps {
  provider: Provider
  modelConfig: ProviderModelConfig
  permissions: ProviderPermissions
  scope: Scope
  projectId: string
  projects: Project[]
  onModelChange: (model: ProviderModelConfig) => void
  onPermissionsChange: (perms: ProviderPermissions) => void
  onScopeChange: (scope: Scope, projectId: string) => void
}

export function ProviderHeader({
  provider, modelConfig, permissions, scope, projectId, projects,
  onModelChange, onPermissionsChange, onScopeChange,
}: ProviderHeaderProps) {
  const models = MODELS_BY_PROVIDER[provider] ?? []
  const efforts = EFFORT_LEVELS[provider] ?? []
  const approvalModes = APPROVAL_MODES[provider] ?? []

  const scopeOptions = [
    { label: 'Global', value: 'GLOBAL', icon: <Folder size={10} className="text-muted-foreground/50" /> },
    ...projects.map(p => ({ label: p.name, value: p.id, icon: <Folder size={10} className="text-primary/60" /> })),
  ]

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border/20 bg-card/20">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 shrink-0">Model</label>
        <CustomDropdown
          className="min-w-[140px]"
          value={modelConfig.model}
          options={models}
          onChange={(val) => onModelChange({ ...modelConfig, model: val })}
          placeholder="Select model"
        />

        {efforts.length > 0 && (
          <>
            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 shrink-0 ml-2">Effort</label>
            <div className="flex items-center gap-0.5">
              {efforts.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onModelChange({ ...modelConfig, effort: level })}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                    modelConfig.effort === level
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 border border-transparent'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 shrink-0 ml-2">Mode</label>
        <CustomDropdown
          className="min-w-[120px]"
          value={permissions.approval_mode}
          options={approvalModes}
          onChange={(val) => onPermissionsChange({ ...permissions, approval_mode: val })}
        />
      </div>

      <CustomDropdown
        className="min-w-[130px] shrink-0"
        value={scope === 'GLOBAL' ? 'GLOBAL' : projectId}
        options={scopeOptions}
        onChange={(val) => {
          if (val === 'GLOBAL') onScopeChange('GLOBAL', '')
          else onScopeChange('PROJECT', val)
        }}
        placeholder="Scope"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/widgets/agents/ProviderHeader.tsx
git commit -m "feat(agents-dashboard): add ProviderHeader inline controls"
```

---

### Task 5: CategoryList Component

**Files:**
- Create: `apps/desktop/src/widgets/agents/CategoryList.tsx`

- [ ] **Step 1: Create CategoryList**

```tsx
// apps/desktop/src/widgets/agents/CategoryList.tsx
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AgentConfig } from '@/lib/orchestra-client'
import { CATEGORIES } from './constants'
import type { CategoryId } from './types'

interface CategoryListProps {
  selectedCategory: CategoryId | null
  selectedItem: string | null
  categoryCounts: Record<CategoryId, number>
  itemsForCategory: AgentConfig[]
  onSelectCategory: (id: CategoryId) => void
  onSelectItem: (path: string) => void
  onAddNew: () => void
}

export function CategoryList({
  selectedCategory, selectedItem, categoryCounts, itemsForCategory,
  onSelectCategory, onSelectItem, onAddNew,
}: CategoryListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border/20 bg-card/10 w-[220px] shrink-0">
      <div className="flex-1 overflow-y-auto py-2">
        {CATEGORIES.map(cat => {
          const active = selectedCategory === cat.id
          const count = categoryCounts[cat.id] ?? 0
          return (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all ${
                  active
                    ? 'bg-primary/8 text-foreground'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/20'
                }`}
              >
                {cat.pinned && <span className="text-amber-500 text-[10px]">★</span>}
                <span className="text-xs font-semibold flex-1">{cat.label}</span>
                {count > 0 && (
                  <Badge variant="outline" className="text-[9px] font-bold h-4 px-1.5 rounded-full">
                    {count}
                  </Badge>
                )}
              </button>
              {/* Sub-item list when expanded */}
              {active && itemsForCategory.length > 0 && (
                <div className="ml-5 border-l border-border/20">
                  {itemsForCategory.map(item => {
                    const itemActive = selectedItem === item.path
                    const label = item.name.split('/').pop() ?? item.name
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => onSelectItem(item.path)}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-all truncate ${
                          itemActive
                            ? 'text-primary font-semibold bg-primary/5'
                            : 'text-muted-foreground/50 hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="border-t border-border/20 p-2">
        <button
          type="button"
          onClick={onAddNew}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 transition-all"
        >
          <Plus size={12} /> Add New
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/widgets/agents/CategoryList.tsx
git commit -m "feat(agents-dashboard): add CategoryList inventory sidebar"
```

---

### Task 6: Panel Components

**Files:**
- Create: `apps/desktop/src/widgets/agents/panels/InstructionsPanel.tsx`
- Create: `apps/desktop/src/widgets/agents/panels/SkillsPanel.tsx`
- Create: `apps/desktop/src/widgets/agents/panels/HooksPanel.tsx`
- Create: `apps/desktop/src/widgets/agents/panels/MCPPanel.tsx`
- Create: `apps/desktop/src/widgets/agents/panels/RulesPanel.tsx`
- Create: `apps/desktop/src/widgets/agents/panels/SubAgentsPanel.tsx`

- [ ] **Step 1: Create InstructionsPanel**

```tsx
// apps/desktop/src/widgets/agents/panels/InstructionsPanel.tsx
import { useState, useEffect } from 'react'
import { Save, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PanelProps } from '../types'

export function InstructionsPanel({ items, onSave, loading, saving, provider }: PanelProps) {
  const config = items[0] ?? null
  const [content, setContent] = useState(config?.content ?? '')
  const isDirty = config ? content !== config.content : content.trim().length > 0

  useEffect(() => {
    setContent(config?.content ?? '')
  }, [config])

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[300px] w-full" /></div>
  }

  const instructionFile = provider === 'codex' ? 'AGENTS.md' : provider === 'gemini' ? 'GEMINI.md' : 'CLAUDE.md'

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-sm font-bold">{instructionFile}</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Tell {provider} how to work on your code</p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>
            <Button size="sm" variant="ghost" onClick={() => setContent(config?.content ?? '')} className="h-7 text-[10px]">
              <RotateCcw size={10} className="mr-1" /> Discard
            </Button>
            <Button
              size="sm"
              onClick={() => config && onSave(config.path, content)}
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
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`# ${provider} Instructions\n\nDescribe how ${provider} should work on your codebase...\n\n- Coding style preferences\n- Testing requirements\n- Architecture guidelines`}
        className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
        spellCheck={false}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create SkillsPanel**

```tsx
// apps/desktop/src/widgets/agents/panels/SkillsPanel.tsx
import { useState, useEffect } from 'react'
import { Save, Loader2, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PanelProps } from '../types'

export function SkillsPanel({ items, selectedItem, onSelectItem, onSave, onDelete, loading, saving }: PanelProps) {
  const selected = items.find(i => i.path === selectedItem) ?? null
  const [content, setContent] = useState(selected?.content ?? '')
  const isDirty = selected ? content !== selected.content : false

  useEffect(() => { setContent(selected?.content ?? '') }, [selected])

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[200px] w-full" /></div>
  }

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/20">
        <div className="text-center space-y-2">
          <p className="text-sm font-bold uppercase tracking-widest">No skill selected</p>
          <p className="text-[10px]">Select a skill from the list or create a new one</p>
        </div>
      </div>
    )
  }

  const name = selected.name.split('/').pop() ?? selected.name

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold truncate">{name}</h3>
        <div className="flex items-center gap-2">
          {isDirty && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>}
          <Button size="sm" variant="ghost" onClick={() => onDelete(selected.path)} className="h-7 text-[10px] text-muted-foreground/40 hover:text-red-400">
            <Trash2 size={10} />
          </Button>
          {isDirty && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setContent(selected.content)} className="h-7 text-[10px]">
                <RotateCcw size={10} className="mr-1" /> Discard
              </Button>
              <Button size="sm" onClick={() => onSave(selected.path, content)} disabled={!!saving} className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg">
                {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />} Save
              </Button>
            </>
          )}
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Skill content..."
        className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
        spellCheck={false}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create HooksPanel**

```tsx
// apps/desktop/src/widgets/agents/panels/HooksPanel.tsx
import { useState } from 'react'
import { Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomDropdown } from '@/components/app-shell/shared/controls'
import type { ProviderHook } from '@/lib/orchestra-client'
import { HOOK_EVENTS_BY_PROVIDER } from '../constants'
import type { Provider } from '../types'

interface HooksPanelProps {
  hooks: ProviderHook[]
  onSave: (hooks: ProviderHook[]) => Promise<void>
  loading: boolean
  saving: string | null
  provider: Provider
}

export function HooksPanel({ hooks, onSave, loading, saving, provider }: HooksPanelProps) {
  const [localHooks, setLocalHooks] = useState(hooks)
  const [newEvent, setNewEvent] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newMatcher, setNewMatcher] = useState('')
  const events = HOOK_EVENTS_BY_PROVIDER[provider] ?? []

  // Sync from parent when hooks change (e.g. after save + reload)
  useState(() => { setLocalHooks(hooks) })

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[200px] w-full" /></div>
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/20">
        <p className="text-sm font-bold uppercase tracking-widest">{provider} does not support hooks</p>
      </div>
    )
  }

  const handleAdd = () => {
    if (!newEvent || !newCommand.trim()) return
    setLocalHooks(prev => [...prev, { event: newEvent, command: newCommand.trim(), matcher: newMatcher.trim() || undefined, type: 'command' }])
    setNewEvent('')
    setNewCommand('')
    setNewMatcher('')
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-sm font-bold">Lifecycle Hooks</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Run commands on {provider} events</p>
        </div>
        <Button size="sm" onClick={() => onSave(localHooks)} disabled={saving === 'hooks'} className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg">
          {saving === 'hooks' ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />} Save
        </Button>
      </div>

      {/* Existing hooks */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {localHooks.length === 0 && (
          <p className="text-[10px] text-muted-foreground/20 py-4 text-center">No hooks configured</p>
        )}
        {localHooks.map((hook, i) => (
          <div key={i} className="flex items-center gap-2 group rounded-lg border border-border/20 px-3 py-2">
            <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider shrink-0 w-[120px] truncate">{hook.event}</span>
            <code className="text-[11px] font-mono text-foreground/70 flex-1 truncate">{hook.command}</code>
            {hook.matcher && <span className="text-[9px] text-muted-foreground/40 shrink-0">({hook.matcher})</span>}
            <button
              onClick={() => setLocalHooks(prev => prev.filter((_, idx) => idx !== i))}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new hook */}
      <div className="shrink-0 flex items-center gap-2 border-t border-border/20 pt-3">
        <CustomDropdown className="w-[150px]" value={newEvent} options={events.map(e => ({ label: e, value: e }))} onChange={setNewEvent} placeholder="Event" />
        <input className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none" value={newCommand} onChange={e => setNewCommand(e.target.value)} placeholder="Command" />
        <input className="h-8 w-[100px] rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none" value={newMatcher} onChange={e => setNewMatcher(e.target.value)} placeholder="Matcher" />
        <Button size="sm" variant="outline" className="h-8 text-[9px] font-bold uppercase" disabled={!newEvent || !newCommand.trim()} onClick={handleAdd}>
          <Plus size={10} className="mr-1" /> Add
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create MCPPanel**

```tsx
// apps/desktop/src/widgets/agents/panels/MCPPanel.tsx
import { useState } from 'react'
import { Plus, Trash2, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { MCPServer, ProviderMCPServer } from '@/lib/orchestra-client'
import type { Provider } from '../types'

interface MCPPanelProps {
  providerServers: ProviderMCPServer[]
  orchestraServers: MCPServer[]
  onAddProvider: (name: string, command: string) => Promise<void>
  onDeleteProvider: (name: string) => Promise<void>
  onDeleteOrchestra: (name: string) => Promise<void>
  loading: boolean
  saving: string | null
  provider: Provider
}

export function MCPPanel({ providerServers, orchestraServers, onAddProvider, onDeleteProvider, onDeleteOrchestra, loading, saving, provider }: MCPPanelProps) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[200px] w-full" /></div>
  }

  const total = providerServers.length + orchestraServers.length

  const handleAdd = async () => {
    if (!name.trim() || !command.trim()) return
    await onAddProvider(name.trim(), command.trim())
    setName('')
    setCommand('')
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div>
        <h3 className="text-sm font-bold">MCP Servers</h3>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{total} server{total !== 1 ? 's' : ''} connected</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {total === 0 && <p className="text-[10px] text-muted-foreground/20 py-4 text-center">No MCP servers configured</p>}

        {providerServers.map(s => (
          <div key={s.name} className="flex items-center gap-2 group rounded-lg border border-border/20 px-3 py-2.5">
            <Server size={12} className="text-primary/50 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{s.name}</p>
              <p className="text-[10px] text-muted-foreground/40 font-mono truncate">{s.command}</p>
            </div>
            <Badge variant="outline" className="text-[8px] font-bold uppercase shrink-0">{provider}</Badge>
            <button onClick={() => onDeleteProvider(s.name)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
              <Trash2 size={10} />
            </button>
          </div>
        ))}

        {orchestraServers.map(s => (
          <div key={s.name} className="flex items-center gap-2 group rounded-lg border border-border/20 px-3 py-2.5">
            <Server size={12} className="text-muted-foreground/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{s.name}</p>
              <p className="text-[10px] text-muted-foreground/40 font-mono truncate">{s.command}</p>
            </div>
            <Badge variant="outline" className="text-[8px] font-bold uppercase shrink-0">orchestra</Badge>
            <button onClick={() => onDeleteOrchestra(s.name)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="shrink-0 flex items-center gap-2 border-t border-border/20 pt-3">
        <input className="h-8 w-[140px] rounded-lg border border-border bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20 outline-none" value={name} onChange={e => setName(e.target.value)} placeholder="Server name" />
        <input className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none" value={command} onChange={e => setCommand(e.target.value)} placeholder="npx -y @org/server" />
        <Button size="sm" variant="outline" className="h-8 text-[9px] font-bold uppercase" disabled={!name.trim() || !command.trim() || saving === 'mcp'} onClick={handleAdd}>
          <Plus size={10} className="mr-1" /> Add
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create RulesPanel** (same pattern as SkillsPanel)

```tsx
// apps/desktop/src/widgets/agents/panels/RulesPanel.tsx
import { useState, useEffect } from 'react'
import { Save, Loader2, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PanelProps } from '../types'

export function RulesPanel({ items, selectedItem, onSave, onDelete, loading, saving }: PanelProps) {
  const selected = items.find(i => i.path === selectedItem) ?? null
  const [content, setContent] = useState(selected?.content ?? '')
  const isDirty = selected ? content !== selected.content : false

  useEffect(() => { setContent(selected?.content ?? '') }, [selected])

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[200px] w-full" /></div>
  }

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/20">
        <div className="text-center space-y-2">
          <p className="text-sm font-bold uppercase tracking-widest">No rule selected</p>
          <p className="text-[10px]">Rules are path-scoped instructions in .claude/rules/*.md</p>
        </div>
      </div>
    )
  }

  const name = selected.name.split('/').pop() ?? selected.name

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold truncate">{name}</h3>
        <div className="flex items-center gap-2">
          {isDirty && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>}
          <Button size="sm" variant="ghost" onClick={() => onDelete(selected.path)} className="h-7 text-[10px] text-muted-foreground/40 hover:text-red-400">
            <Trash2 size={10} />
          </Button>
          {isDirty && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setContent(selected.content)} className="h-7 text-[10px]">
                <RotateCcw size={10} className="mr-1" /> Discard
              </Button>
              <Button size="sm" onClick={() => onSave(selected.path, content)} disabled={!!saving} className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg">
                {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />} Save
              </Button>
            </>
          )}
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Rule content..."
        className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
        spellCheck={false}
      />
    </div>
  )
}
```

- [ ] **Step 6: Create SubAgentsPanel** (same pattern as SkillsPanel)

```tsx
// apps/desktop/src/widgets/agents/panels/SubAgentsPanel.tsx
import { useState, useEffect } from 'react'
import { Save, Loader2, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PanelProps } from '../types'

export function SubAgentsPanel({ items, selectedItem, onSave, onDelete, loading, saving }: PanelProps) {
  const selected = items.find(i => i.path === selectedItem) ?? null
  const [content, setContent] = useState(selected?.content ?? '')
  const isDirty = selected ? content !== selected.content : false

  useEffect(() => { setContent(selected?.content ?? '') }, [selected])

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[200px] w-full" /></div>
  }

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/20">
        <div className="text-center space-y-2">
          <p className="text-sm font-bold uppercase tracking-widest">No sub-agent selected</p>
          <p className="text-[10px]">Sub-agents run in isolated contexts with their own tools and model</p>
        </div>
      </div>
    )
  }

  const name = selected.name.split('/').pop() ?? selected.name

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold truncate">{name}</h3>
        <div className="flex items-center gap-2">
          {isDirty && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>}
          <Button size="sm" variant="ghost" onClick={() => onDelete(selected.path)} className="h-7 text-[10px] text-muted-foreground/40 hover:text-red-400">
            <Trash2 size={10} />
          </Button>
          {isDirty && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setContent(selected.content)} className="h-7 text-[10px]">
                <RotateCcw size={10} className="mr-1" /> Discard
              </Button>
              <Button size="sm" onClick={() => onSave(selected.path, content)} disabled={!!saving} className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg">
                {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />} Save
              </Button>
            </>
          )}
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Sub-agent definition..."
        className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
        spellCheck={false}
      />
    </div>
  )
}
```

- [ ] **Step 7: Commit all panels**

```bash
git add apps/desktop/src/widgets/agents/panels/
git commit -m "feat(agents-dashboard): add all 6 panel components"
```

---

### Task 7: AgentsDashboard Shell + Index + Rewire

**Files:**
- Create: `apps/desktop/src/widgets/agents/AgentsDashboard.tsx`
- Create: `apps/desktop/src/widgets/agents/index.ts`
- Modify: `apps/desktop/src/components/agents/AgentsDashboard.tsx` — replace with re-export

- [ ] **Step 1: Create the new AgentsDashboard shell**

```tsx
// apps/desktop/src/widgets/agents/AgentsDashboard.tsx
import { useState, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import type { BackendConfig, SnapshotPayload } from '@/lib/orchestra-types'
import { Skeleton } from '@/components/ui/skeleton'
import { ProviderTabs } from './ProviderTabs'
import { ProviderHeader } from './ProviderHeader'
import { CategoryList } from './CategoryList'
import { InstructionsPanel } from './panels/InstructionsPanel'
import { SkillsPanel } from './panels/SkillsPanel'
import { HooksPanel } from './panels/HooksPanel'
import { MCPPanel } from './panels/MCPPanel'
import { RulesPanel } from './panels/RulesPanel'
import { SubAgentsPanel } from './panels/SubAgentsPanel'
import { useAgentConfig } from './hooks/useAgentConfig'
import type { Provider, CategoryId, Scope, PanelProps } from './types'

interface AgentsDashboardProps {
  config: BackendConfig | null
  snapshot: SnapshotPayload | null
}

export function AgentsDashboard({ config }: AgentsDashboardProps) {
  const [provider, setProvider] = useState<Provider>('claude')
  const [category, setCategory] = useState<CategoryId | null>('instructions')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('GLOBAL')
  const [projectId, setProjectId] = useState('')

  const state = useAgentConfig(config, provider, scope, projectId || undefined)

  const configuredSet = useMemo(() => {
    const set = new Set<Provider>()
    for (const c of state.configs) {
      if (c.category === 'CORE') {
        for (const p of ['claude', 'codex', 'gemini', 'opencode'] as Provider[]) {
          if (c.name.toLowerCase().includes(p)) set.add(p)
        }
      }
    }
    return set
  }, [state.configs])

  const itemsForCategory = category ? state.configsByCategory(category) : []

  // When category changes, auto-select first item (for text-based categories)
  const handleSelectCategory = (id: CategoryId) => {
    setCategory(id)
    const items = state.configsByCategory(id)
    if (['instructions', 'skills', 'rules', 'agents'].includes(id) && items.length > 0) {
      setSelectedItem(items[0].path)
    } else {
      setSelectedItem(null)
    }
  }

  const handleAddNew = () => {
    if (!category) return
    const typeMap: Record<CategoryId, string> = {
      instructions: 'CORE', skills: 'SKILL', hooks: '', mcp: '', rules: 'RULE', agents: 'AGENT',
    }
    const type = typeMap[category]
    if (!type) return
    const name = window.prompt(`New ${category} name:`)
    if (name?.trim()) {
      state.createResource(type, name.trim())
    }
  }

  const panelProps: PanelProps = {
    items: itemsForCategory,
    selectedItem,
    onSelectItem: setSelectedItem,
    onSave: state.saveConfig,
    onDelete: async (path) => {
      const name = path.split('/').pop() ?? path
      if (window.confirm(`Delete "${name}"? This will remove the file from disk.`)) {
        await state.deleteConfig(path)
      }
    },
    onCreate: state.createResource,
    loading: state.loading,
    saving: state.saving,
    provider,
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {state.error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 shrink-0">
          <AlertCircle size={12} className="text-red-400 shrink-0" />
          <span className="text-[10px] text-red-400 font-medium truncate">{state.error}</span>
          <button onClick={() => state.setError('')} className="ml-auto text-red-400/60 hover:text-red-400 text-xs">&times;</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Column 1: Provider tabs */}
        <ProviderTabs selected={provider} onSelect={(p) => { setProvider(p); setCategory('instructions'); setSelectedItem(null) }} configuredSet={configuredSet} />

        {/* Column 2+3 wrapper */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header bar */}
          <ProviderHeader
            provider={provider}
            modelConfig={state.modelConfig}
            permissions={state.permissions}
            scope={scope}
            projectId={projectId}
            projects={state.projects}
            onModelChange={(m) => state.saveModel(m)}
            onPermissionsChange={(p) => state.savePermissions(p)}
            onScopeChange={(s, pid) => { setScope(s); setProjectId(pid) }}
          />

          {/* Main content: category list + detail panel */}
          <div className="flex flex-1 min-h-0">
            {/* Column 2: Category list */}
            <CategoryList
              selectedCategory={category}
              selectedItem={selectedItem}
              categoryCounts={state.categoryCounts}
              itemsForCategory={itemsForCategory}
              onSelectCategory={handleSelectCategory}
              onSelectItem={setSelectedItem}
              onAddNew={handleAddNew}
            />

            {/* Column 3: Detail panel */}
            <div className="flex-1 min-w-0 min-h-0">
              {state.loading ? (
                <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[300px] w-full" /></div>
              ) : (
                <>
                  {category === 'instructions' && <InstructionsPanel {...panelProps} />}
                  {category === 'skills' && <SkillsPanel {...panelProps} />}
                  {category === 'hooks' && <HooksPanel hooks={state.hooks} onSave={state.saveHooks} loading={state.loading} saving={state.saving} provider={provider} />}
                  {category === 'mcp' && <MCPPanel providerServers={state.providerMcpServers} orchestraServers={state.orchestraMcpServers} onAddProvider={state.addMCPServer} onDeleteProvider={state.deleteMCPServer} onDeleteOrchestra={state.deleteOrchestraMCPServer} loading={state.loading} saving={state.saving} provider={provider} />}
                  {category === 'rules' && <RulesPanel {...panelProps} />}
                  {category === 'agents' && <SubAgentsPanel {...panelProps} />}
                  {!category && (
                    <div className="flex items-center justify-center h-full text-muted-foreground/20">
                      <p className="text-sm font-bold uppercase tracking-widest">Select a category</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create index.ts**

```ts
// apps/desktop/src/widgets/agents/index.ts
export { AgentsDashboard } from './AgentsDashboard'
```

- [ ] **Step 3: Replace old monolith with re-export**

Replace the entire contents of `apps/desktop/src/components/agents/AgentsDashboard.tsx` with:

```ts
// Re-export from widget — this file preserved for import compatibility
export { AgentsDashboard } from '@widgets/agents'
```

This keeps the `App.tsx` import at line 56 (`import { AgentsDashboard } from '@/components/agents/AgentsDashboard'`) working without changes.

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep -E "widgets/agents" | head -10`
Expected: No errors from the new files.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/agents/ apps/desktop/src/components/agents/AgentsDashboard.tsx
git commit -m "feat(agents-dashboard): wire up 3-column package manager UI, replace monolith with re-export"
```

---

### Task 8: Verify and Clean Up

- [ ] **Step 1: Full typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: No new errors from the agents widget files.

- [ ] **Step 2: Lint check**

Run: `cd apps/desktop && npm run lint 2>&1 | tail -20`
Fix any lint errors in the new files.

- [ ] **Step 3: Visual smoke test**

Run: `cd apps/desktop && npm run dev:linux`

Verify:
- Provider tabs render on the left (Claude/Codex/Gemini/OpenCode)
- Clicking a provider loads its config
- Header bar shows model/effort/mode/scope controls
- Category list shows categories with counts
- Clicking a category expands items and loads the panel
- Instructions editor loads and saves
- Hooks/MCP panels render correctly

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(agents-dashboard): lint fixes and cleanup"
```
