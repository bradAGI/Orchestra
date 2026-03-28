# Agents Dashboard — Full Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Agents dashboard from a single 83KB monolith into a modular, navigable multi-panel interface with clear information hierarchy, real-time agent status, and intuitive configuration management.

**Architecture:** Replace the current `AgentsDashboard.tsx` (83,256 bytes, ~2400 lines) with a composition of focused components. The new layout uses a sidebar for agent selection with live status indicators, and a tabbed detail panel for configuration sections (Instructions, Permissions, Model, Hooks, MCP, Skills, Sub-agents). Each tab is a standalone component with its own data fetching and save logic. A new `useAgentConfig` hook centralizes the data layer. The backend API remains unchanged — this is a pure frontend redesign.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide icons

---

### Task 1: Create the `useAgentConfig` data hook

**Files:**
- Create: `apps/desktop/src/components/agents/hooks/useAgentConfig.ts`
- Test: `apps/desktop/src/components/agents/hooks/useAgentConfig.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/desktop/src/components/agents/hooks/useAgentConfig.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/orchestra-client', () => ({
  fetchAgentConfigs: vi.fn().mockResolvedValue([
    { name: '.claude', content: '# Instructions', path: '/home/.orchestra/agents/.claude', category: 'CORE', scope: 'GLOBAL' },
  ]),
  fetchProviderPermissions: vi.fn().mockResolvedValue({ approval_mode: 'default', allow: [], deny: [], ask: [] }),
  fetchProviderModel: vi.fn().mockResolvedValue({ model: 'claude-sonnet-4-6', effort: 'medium', temperature: null }),
  fetchProviderHooks: vi.fn().mockResolvedValue([]),
  fetchProviderMCPServers: vi.fn().mockResolvedValue([]),
  fetchProjects: vi.fn().mockResolvedValue([]),
  fetchMCPServers: vi.fn().mockResolvedValue([]),
  fetchMCPTools: vi.fn().mockResolvedValue([]),
}))

describe('useAgentConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should load all config data for a selected agent', async () => {
    const { useAgentConfig } = await import('./useAgentConfig')
    const { result } = renderHook(() => useAgentConfig({
      config: { baseUrl: 'http://localhost:4010', token: 'dev-token' },
      selectedAgent: 'claude',
      scope: 'GLOBAL',
    }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.configs).toHaveLength(1)
    expect(result.current.permissions.approval_mode).toBe('default')
    expect(result.current.modelConfig.model).toBe('claude-sonnet-4-6')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run src/components/agents/hooks/useAgentConfig.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement the hook**

```typescript
// apps/desktop/src/components/agents/hooks/useAgentConfig.ts
import { useState, useEffect, useCallback } from 'react'
import type { BackendConfig } from '@/lib/orchestra-client'
import {
  fetchAgentConfigs,
  fetchProviderPermissions,
  fetchProviderModel,
  fetchProviderHooks,
  fetchProviderMCPServers,
  fetchProjects,
  fetchMCPServers,
  fetchMCPTools,
  updateProviderPermissions,
  updateProviderModel,
  updateProviderHooks,
  updateAgentConfigByPath,
  type ProviderPermissions,
  type ProviderModelConfig,
  type ProviderHook,
  type ProviderMCPServer,
} from '@/lib/orchestra-client'
import type { AgentConfig } from '@/lib/orchestra-types'

type AgentConfigState = {
  configs: AgentConfig[]
  permissions: ProviderPermissions
  modelConfig: ProviderModelConfig
  hooks: ProviderHook[]
  providerMcp: ProviderMCPServer[]
  orchestraMcp: { id: string; name: string; command: string }[]
  mcpTools: { server: string; name: string }[]
  projects: { id: string; name: string }[]
  loading: boolean
  error: string | null
  // Save functions
  savePermissions: (perms: ProviderPermissions) => Promise<void>
  saveModel: (model: ProviderModelConfig) => Promise<void>
  saveHooks: (hooks: ProviderHook[]) => Promise<void>
  saveInstructions: (path: string, content: string) => Promise<void>
  reload: () => void
}

type UseAgentConfigParams = {
  config: BackendConfig | null
  selectedAgent: string | null
  scope: 'GLOBAL' | 'PROJECT'
  selectedProjectId?: string
}

const DEFAULT_PERMISSIONS: ProviderPermissions = { approval_mode: 'default', allow: [], deny: [], ask: [] }
const DEFAULT_MODEL: ProviderModelConfig = { model: '', effort: 'medium', temperature: null }

export function useAgentConfig({ config, selectedAgent, scope, selectedProjectId }: UseAgentConfigParams): AgentConfigState {
  const [configs, setConfigs] = useState<AgentConfig[]>([])
  const [permissions, setPermissions] = useState<ProviderPermissions>(DEFAULT_PERMISSIONS)
  const [modelConfig, setModelConfig] = useState<ProviderModelConfig>(DEFAULT_MODEL)
  const [hooks, setHooks] = useState<ProviderHook[]>([])
  const [providerMcp, setProviderMcp] = useState<ProviderMCPServer[]>([])
  const [orchestraMcp, setOrchestraMcp] = useState<{ id: string; name: string; command: string }[]>([])
  const [mcpTools, setMcpTools] = useState<{ server: string; name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!config) return
    setLoading(true)
    setError(null)
    try {
      const [cfgs, projs, tools, servers] = await Promise.all([
        fetchAgentConfigs(config, selectedProjectId),
        fetchProjects(config),
        fetchMCPTools(config),
        fetchMCPServers(config),
      ])
      setConfigs(cfgs)
      setProjects(projs)
      setMcpTools(tools)
      setOrchestraMcp(servers)

      if (selectedAgent) {
        const [perms, model, hks, mcp] = await Promise.all([
          fetchProviderPermissions(config, selectedAgent, selectedProjectId).catch(() => DEFAULT_PERMISSIONS),
          fetchProviderModel(config, selectedAgent).catch(() => DEFAULT_MODEL),
          fetchProviderHooks(config, selectedAgent).catch(() => []),
          fetchProviderMCPServers(config, selectedAgent, selectedProjectId).catch(() => []),
        ])
        setPermissions(perms)
        setModelConfig(model)
        setHooks(hks)
        setProviderMcp(mcp)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent config')
    } finally {
      setLoading(false)
    }
  }, [config, selectedAgent, scope, selectedProjectId])

  useEffect(() => { loadData() }, [loadData])

  const savePermissions = useCallback(async (perms: ProviderPermissions) => {
    if (!config || !selectedAgent) return
    await updateProviderPermissions(config, selectedAgent, perms)
    setPermissions(perms)
  }, [config, selectedAgent])

  const saveModel = useCallback(async (model: ProviderModelConfig) => {
    if (!config || !selectedAgent) return
    await updateProviderModel(config, selectedAgent, model)
    setModelConfig(model)
  }, [config, selectedAgent])

  const saveHooks = useCallback(async (newHooks: ProviderHook[]) => {
    if (!config || !selectedAgent) return
    await updateProviderHooks(config, selectedAgent, newHooks)
    setHooks(newHooks)
  }, [config, selectedAgent])

  const saveInstructions = useCallback(async (path: string, content: string) => {
    if (!config) return
    await updateAgentConfigByPath(config, path, content)
  }, [config])

  return {
    configs, permissions, modelConfig, hooks, providerMcp, orchestraMcp,
    mcpTools, projects, loading, error,
    savePermissions, saveModel, saveHooks, saveInstructions,
    reload: loadData,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && npx vitest run src/components/agents/hooks/useAgentConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/agents/hooks/
git commit -m "feat(desktop): create useAgentConfig hook for agents dashboard data layer"
```

---

### Task 2: Create the AgentSidebar component

**Files:**
- Create: `apps/desktop/src/components/agents/AgentSidebar.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/desktop/src/components/agents/AgentSidebar.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentSidebar } from './AgentSidebar'

describe('AgentSidebar', () => {
  const providers = ['claude', 'codex', 'gemini', 'opencode']

  it('should render all four provider cards', () => {
    render(<AgentSidebar providers={providers} selectedAgent={null} onSelect={() => {}} configuredProviders={['claude']} />)
    expect(screen.getByText('Claude')).toBeDefined()
    expect(screen.getByText('Codex')).toBeDefined()
    expect(screen.getByText('Gemini')).toBeDefined()
    expect(screen.getByText('OpenCode')).toBeDefined()
  })

  it('should highlight the selected agent', () => {
    render(<AgentSidebar providers={providers} selectedAgent="claude" onSelect={() => {}} configuredProviders={['claude']} />)
    const claudeCard = screen.getByText('Claude').closest('button')
    expect(claudeCard?.className).toContain('border-primary')
  })

  it('should show configured badge for configured providers', () => {
    render(<AgentSidebar providers={providers} selectedAgent={null} onSelect={() => {}} configuredProviders={['claude', 'codex']} />)
    const badges = screen.getAllByText('Configured')
    expect(badges).toHaveLength(2)
  })

  it('should call onSelect when clicking a provider', () => {
    const onSelect = vi.fn()
    render(<AgentSidebar providers={providers} selectedAgent={null} onSelect={onSelect} configuredProviders={[]} />)
    fireEvent.click(screen.getByText('Claude'))
    expect(onSelect).toHaveBeenCalledWith('claude')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run src/components/agents/AgentSidebar.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement AgentSidebar**

```typescript
// apps/desktop/src/components/agents/AgentSidebar.tsx
import React from 'react'
import { Bot, CheckCircle2 } from 'lucide-react'

const PROVIDER_META: Record<string, { label: string; description: string; color: string }> = {
  claude: { label: 'Claude', description: 'Anthropic\'s AI assistant', color: 'text-orange-400' },
  codex: { label: 'Codex', description: 'OpenAI\'s coding agent', color: 'text-emerald-400' },
  gemini: { label: 'Gemini', description: 'Google\'s AI model', color: 'text-blue-400' },
  opencode: { label: 'OpenCode', description: 'Community coding agent', color: 'text-purple-400' },
}

type Props = {
  providers: string[]
  selectedAgent: string | null
  onSelect: (provider: string) => void
  configuredProviders: string[]
}

export const AgentSidebar: React.FC<Props> = ({ providers, selectedAgent, onSelect, configuredProviders }) => {
  return (
    <div className="w-56 shrink-0 border-r border-border/30 bg-card/30 p-3 space-y-2 overflow-y-auto">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-3">Agents</p>
      {providers.map((p) => {
        const meta = PROVIDER_META[p] || { label: p, description: '', color: 'text-foreground' }
        const isSelected = selectedAgent === p
        const isConfigured = configuredProviders.includes(p)

        return (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className={`w-full rounded-lg p-3 text-left transition-all ${
              isSelected
                ? 'bg-primary/10 border border-primary/40'
                : 'border border-transparent hover:bg-muted/30 hover:border-border/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bot className={`h-4 w-4 ${meta.color}`} />
              <span className="text-sm font-bold">{meta.label}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">{meta.description}</p>
            {isConfigured && (
              <div className="flex items-center gap-1 mt-2">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                <span className="text-[9px] text-emerald-500 font-semibold">Configured</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && npx vitest run src/components/agents/AgentSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/agents/AgentSidebar.tsx apps/desktop/src/components/agents/AgentSidebar.test.tsx
git commit -m "feat(desktop): create AgentSidebar component for agents dashboard"
```

---

### Task 3: Create tabbed detail panel components

**Files:**
- Create: `apps/desktop/src/components/agents/tabs/InstructionsTab.tsx`
- Create: `apps/desktop/src/components/agents/tabs/PermissionsTab.tsx`
- Create: `apps/desktop/src/components/agents/tabs/ModelTab.tsx`
- Create: `apps/desktop/src/components/agents/tabs/HooksTab.tsx`
- Create: `apps/desktop/src/components/agents/tabs/MCPTab.tsx`
- Create: `apps/desktop/src/components/agents/tabs/SkillsTab.tsx`

- [ ] **Step 1: Create InstructionsTab**

```typescript
// apps/desktop/src/components/agents/tabs/InstructionsTab.tsx
import React, { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import type { AgentConfig } from '@/lib/orchestra-types'

type Props = {
  config: AgentConfig | undefined
  onSave: (path: string, content: string) => Promise<void>
}

export const InstructionsTab: React.FC<Props> = ({ config, onSave }) => {
  const [content, setContent] = useState(config?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setContent(config?.content ?? '')
    setDirty(false)
  }, [config])

  const handleSave = async () => {
    if (!config?.path) return
    setSaving(true)
    try {
      await onSave(config.path, content)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground">Agent Instructions</p>
        {dirty && <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Unsaved</span>}
      </div>
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setDirty(true) }}
        placeholder="Write instructions for this agent..."
        className="w-full h-64 rounded-lg border border-border/30 bg-background p-3 text-sm font-mono resize-y focus:border-primary focus:outline-none"
      />
      <button
        onClick={handleSave}
        disabled={saving || !dirty}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create PermissionsTab**

```typescript
// apps/desktop/src/components/agents/tabs/PermissionsTab.tsx
import React, { useState } from 'react'
import { Save, Plus, X, Loader2 } from 'lucide-react'
import type { ProviderPermissions } from '@/lib/orchestra-client'

type Props = {
  permissions: ProviderPermissions
  provider: string
  onSave: (perms: ProviderPermissions) => Promise<void>
}

const APPROVAL_MODES: Record<string, string[]> = {
  claude: ['default', 'acceptEdits', 'bypassPermissions', 'plan'],
  codex: ['interactive', 'auto-edit', 'full-auto', 'on-request'],
  gemini: ['interactive', 'auto-edit', 'full-auto', 'on-request'],
  opencode: ['interactive', 'auto-edit', 'full-auto', 'on-request'],
}

export const PermissionsTab: React.FC<Props> = ({ permissions, provider, onSave }) => {
  const [perms, setPerms] = useState(permissions)
  const [saving, setSaving] = useState(false)
  const [newAllow, setNewAllow] = useState('')
  const [newDeny, setNewDeny] = useState('')

  const modes = APPROVAL_MODES[provider] || APPROVAL_MODES.codex

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(perms) } finally { setSaving(false) }
  }

  const addRule = (field: 'allow' | 'deny', value: string) => {
    if (!value.trim()) return
    setPerms(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }))
    if (field === 'allow') setNewAllow('')
    else setNewDeny('')
  }

  const removeRule = (field: 'allow' | 'deny', index: number) => {
    setPerms(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }))
  }

  return (
    <div className="space-y-4">
      {/* Approval Mode */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Approval Mode</label>
        <select
          value={perms.approval_mode}
          onChange={(e) => setPerms(prev => ({ ...prev, approval_mode: e.target.value }))}
          className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm"
        >
          {modes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Allow Rules */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Allow Rules</label>
        <div className="space-y-1">
          {perms.allow.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 rounded bg-muted/20 px-2 py-1 text-xs font-mono">
              <span className="flex-1">{rule}</span>
              <button onClick={() => removeRule('allow', i)} className="text-muted-foreground/40 hover:text-destructive"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={newAllow} onChange={(e) => setNewAllow(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRule('allow', newAllow)}
              placeholder="e.g. Read, Bash(git *)" className="flex-1 rounded border border-border/30 bg-background px-2 py-1 text-xs font-mono" />
            <button onClick={() => addRule('allow', newAllow)} className="px-2 py-1 rounded bg-primary/10 text-primary text-xs"><Plus className="h-3 w-3" /></button>
          </div>
        </div>
      </div>

      {/* Deny Rules */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deny Rules</label>
        <div className="space-y-1">
          {perms.deny.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 rounded bg-muted/20 px-2 py-1 text-xs font-mono">
              <span className="flex-1">{rule}</span>
              <button onClick={() => removeRule('deny', i)} className="text-muted-foreground/40 hover:text-destructive"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={newDeny} onChange={(e) => setNewDeny(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRule('deny', newDeny)}
              placeholder="e.g. Bash(rm -rf *)" className="flex-1 rounded border border-border/30 bg-background px-2 py-1 text-xs font-mono" />
            <button onClick={() => addRule('deny', newDeny)} className="px-2 py-1 rounded bg-primary/10 text-primary text-xs"><Plus className="h-3 w-3" /></button>
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save Permissions
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create ModelTab**

```typescript
// apps/desktop/src/components/agents/tabs/ModelTab.tsx
import React, { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
import type { ProviderModelConfig } from '@/lib/orchestra-client'

const PROVIDER_MODELS: Record<string, string[]> = {
  claude: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5', 'claude-opus-4-5', 'claude-sonnet-4-5'],
  codex: ['gpt-5.4', 'gpt-5.3-codex', 'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'o3'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3-flash', 'gemini-3.1-pro'],
  opencode: ['user-configured'],
}

const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'] as const

type Props = {
  modelConfig: ProviderModelConfig
  provider: string
  onSave: (config: ProviderModelConfig) => Promise<void>
}

export const ModelTab: React.FC<Props> = ({ modelConfig, provider, onSave }) => {
  const [config, setConfig] = useState(modelConfig)
  const [saving, setSaving] = useState(false)

  const models = PROVIDER_MODELS[provider] || []

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(config) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</label>
        <select value={config.model} onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
          className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm font-mono">
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Effort Level</label>
        <div className="flex gap-1">
          {EFFORT_LEVELS.map(level => (
            <button key={level} onClick={() => setConfig(prev => ({ ...prev, effort: level }))}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                config.effort === level ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
              }`}>
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Temperature</label>
        <input type="number" min={0} max={2} step={0.1}
          value={config.temperature ?? ''} onChange={(e) => setConfig(prev => ({ ...prev, temperature: e.target.value ? parseFloat(e.target.value) : null }))}
          placeholder="Default" className="w-32 rounded-lg border border-border/30 bg-background px-3 py-2 text-sm font-mono" />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save Model Config
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create HooksTab, MCPTab, and SkillsTab**

Follow the same pattern for each:
- **HooksTab**: Renders hooks list with event/command/matcher fields, add/remove UI, save button. Uses `ProviderHook[]` as props.
- **MCPTab**: Shows provider MCP servers + Orchestra MCP servers, add server dialog, delete button. Uses `ProviderMCPServer[]` and Orchestra server list.
- **SkillsTab**: Lists skills and sub-agents filtered by provider, expandable editor, create dialog. Uses `AgentConfig[]` filtered by `category === 'SKILL'`.

Each component is self-contained with its own state and save logic.

- [ ] **Step 5: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/agents/tabs/
git commit -m "feat(desktop): create tabbed detail panel components for agents dashboard"
```

---

### Task 4: Create the AgentDetailPanel with tab navigation

**Files:**
- Create: `apps/desktop/src/components/agents/AgentDetailPanel.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/desktop/src/components/agents/AgentDetailPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentDetailPanel } from './AgentDetailPanel'

const mockProps = {
  provider: 'claude',
  configs: [],
  permissions: { approval_mode: 'default', allow: [], deny: [], ask: [] },
  modelConfig: { model: 'claude-sonnet-4-6', effort: 'medium', temperature: null },
  hooks: [],
  providerMcp: [],
  orchestraMcp: [],
  mcpTools: [],
  onSavePermissions: vi.fn(),
  onSaveModel: vi.fn(),
  onSaveHooks: vi.fn(),
  onSaveInstructions: vi.fn(),
}

describe('AgentDetailPanel', () => {
  it('should render tab navigation', () => {
    render(<AgentDetailPanel {...mockProps} />)
    expect(screen.getByText('Instructions')).toBeDefined()
    expect(screen.getByText('Permissions')).toBeDefined()
    expect(screen.getByText('Model')).toBeDefined()
  })

  it('should switch tabs on click', () => {
    render(<AgentDetailPanel {...mockProps} />)
    fireEvent.click(screen.getByText('Permissions'))
    expect(screen.getByText('Approval Mode')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run src/components/agents/AgentDetailPanel.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement AgentDetailPanel**

```typescript
// apps/desktop/src/components/agents/AgentDetailPanel.tsx
import React, { useState } from 'react'
import { FileText, Shield, Cpu, Webhook, Server, Sparkles } from 'lucide-react'
import { InstructionsTab } from './tabs/InstructionsTab'
import { PermissionsTab } from './tabs/PermissionsTab'
import { ModelTab } from './tabs/ModelTab'
import { HooksTab } from './tabs/HooksTab'
import { MCPTab } from './tabs/MCPTab'
import { SkillsTab } from './tabs/SkillsTab'
import type { AgentConfig } from '@/lib/orchestra-types'
import type { ProviderPermissions, ProviderModelConfig, ProviderHook, ProviderMCPServer } from '@/lib/orchestra-client'

const TABS = [
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'model', label: 'Model', icon: Cpu },
  { id: 'hooks', label: 'Hooks', icon: Webhook },
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'skills', label: 'Skills & Agents', icon: Sparkles },
] as const

type TabId = typeof TABS[number]['id']

type Props = {
  provider: string
  configs: AgentConfig[]
  permissions: ProviderPermissions
  modelConfig: ProviderModelConfig
  hooks: ProviderHook[]
  providerMcp: ProviderMCPServer[]
  orchestraMcp: { id: string; name: string; command: string }[]
  mcpTools: { server: string; name: string }[]
  onSavePermissions: (perms: ProviderPermissions) => Promise<void>
  onSaveModel: (config: ProviderModelConfig) => Promise<void>
  onSaveHooks: (hooks: ProviderHook[]) => Promise<void>
  onSaveInstructions: (path: string, content: string) => Promise<void>
}

export const AgentDetailPanel: React.FC<Props> = (props) => {
  const [activeTab, setActiveTab] = useState<TabId>('instructions')

  const coreConfig = props.configs.find(c => c.category === 'CORE' && c.name.includes(props.provider))
  const skills = props.configs.filter(c => c.category === 'SKILL')

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 bg-card/30 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20'
            }`}>
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'instructions' && <InstructionsTab config={coreConfig} onSave={props.onSaveInstructions} />}
        {activeTab === 'permissions' && <PermissionsTab permissions={props.permissions} provider={props.provider} onSave={props.onSavePermissions} />}
        {activeTab === 'model' && <ModelTab modelConfig={props.modelConfig} provider={props.provider} onSave={props.onSaveModel} />}
        {activeTab === 'hooks' && <HooksTab hooks={props.hooks} provider={props.provider} onSave={props.onSaveHooks} />}
        {activeTab === 'mcp' && <MCPTab providerMcp={props.providerMcp} orchestraMcp={props.orchestraMcp} mcpTools={props.mcpTools} provider={props.provider} />}
        {activeTab === 'skills' && <SkillsTab skills={skills} provider={props.provider} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && npx vitest run src/components/agents/AgentDetailPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/agents/AgentDetailPanel.tsx apps/desktop/src/components/agents/AgentDetailPanel.test.tsx
git commit -m "feat(desktop): create AgentDetailPanel with tabbed navigation"
```

---

### Task 5: Rewrite AgentsDashboard as a composition shell

**Files:**
- Modify: `apps/desktop/src/components/agents/AgentsDashboard.tsx` (full rewrite)

- [ ] **Step 1: Back up the old file**

```bash
cp apps/desktop/src/components/agents/AgentsDashboard.tsx apps/desktop/src/components/agents/AgentsDashboard.old.tsx
```

- [ ] **Step 2: Rewrite the dashboard**

```typescript
// apps/desktop/src/components/agents/AgentsDashboard.tsx
import React, { useState, useMemo } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { AgentSidebar } from './AgentSidebar'
import { AgentDetailPanel } from './AgentDetailPanel'
import { useAgentConfig } from './hooks/useAgentConfig'
import type { BackendConfig } from '@/lib/orchestra-client'

const PROVIDERS = ['claude', 'codex', 'gemini', 'opencode']

interface AgentsDashboardProps {
  config: BackendConfig | null
}

export const AgentsDashboard: React.FC<AgentsDashboardProps> = ({ config }) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [scope, setScope] = useState<'GLOBAL' | 'PROJECT'>('GLOBAL')
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()

  const {
    configs, permissions, modelConfig, hooks, providerMcp, orchestraMcp,
    mcpTools, projects, loading, error,
    savePermissions, saveModel, saveHooks, saveInstructions, reload,
  } = useAgentConfig({ config, selectedAgent, scope, selectedProjectId })

  const configuredProviders = useMemo(() => {
    return PROVIDERS.filter(p => configs.some(c => c.category === 'CORE' && c.name.includes(p)))
  }, [configs])

  if (loading && !selectedAgent) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
      </div>
    )
  }

  return (
    <div className="w-full h-full flex">
      <AgentSidebar
        providers={PROVIDERS}
        selectedAgent={selectedAgent}
        onSelect={setSelectedAgent}
        configuredProviders={configuredProviders}
      />

      {selectedAgent ? (
        <AgentDetailPanel
          provider={selectedAgent}
          configs={configs}
          permissions={permissions}
          modelConfig={modelConfig}
          hooks={hooks}
          providerMcp={providerMcp}
          orchestraMcp={orchestraMcp}
          mcpTools={mcpTools}
          onSavePermissions={savePermissions}
          onSaveModel={saveModel}
          onSaveHooks={saveHooks}
          onSaveInstructions={saveInstructions}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground/30">
          <div className="text-center space-y-2">
            <p className="text-sm font-bold uppercase tracking-widest">Select an Agent</p>
            <p className="text-[10px]">Choose a provider from the sidebar to configure</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-4 right-4 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-xs text-destructive">{error}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update any imports in App.tsx if needed**

Check if `App.tsx` imports the dashboard differently — the component name and default export should remain the same.

- [ ] **Step 4: Run all tests**

Run: `cd apps/desktop && npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Remove backup file**

```bash
rm apps/desktop/src/components/agents/AgentsDashboard.old.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/agents/
git commit -m "refactor(desktop): rewrite AgentsDashboard from 83KB monolith to modular composition"
```

---

### Task 6: Add scope selector and project dropdown to the detail panel header

**Files:**
- Modify: `apps/desktop/src/components/agents/AgentDetailPanel.tsx`

- [ ] **Step 1: Add scope controls above the tab bar**

```typescript
// In AgentDetailPanel, add props:
scope: 'GLOBAL' | 'PROJECT'
projects: { id: string; name: string }[]
selectedProjectId?: string
onScopeChange: (scope: 'GLOBAL' | 'PROJECT') => void
onProjectChange: (projectId: string) => void

// Add above the tab bar:
<div className="flex items-center gap-3 px-4 py-2 border-b border-border/30">
  <p className="text-sm font-black capitalize">{props.provider}</p>
  <div className="flex-1" />
  <select value={props.scope} onChange={(e) => props.onScopeChange(e.target.value as 'GLOBAL' | 'PROJECT')}
    className="rounded-lg border border-border/30 bg-background px-2 py-1 text-[11px] font-bold">
    <option value="GLOBAL">All Projects</option>
    <option value="PROJECT">Project Scope</option>
  </select>
  {props.scope === 'PROJECT' && (
    <select value={props.selectedProjectId ?? ''} onChange={(e) => props.onProjectChange(e.target.value)}
      className="rounded-lg border border-border/30 bg-background px-2 py-1 text-[11px]">
      <option value="">Select project...</option>
      {props.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  )}
</div>
```

- [ ] **Step 2: Wire up scope state from AgentsDashboard**

Pass `scope`, `projects`, `selectedProjectId`, `onScopeChange`, and `onProjectChange` through from the dashboard.

- [ ] **Step 3: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/agents/
git commit -m "feat(desktop): add scope selector and project dropdown to agents detail panel"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd apps/desktop && npx vitest run && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 2: Manual verification checklist**

1. Open Agents dashboard — sidebar shows 4 providers
2. Click Claude — detail panel opens with tabbed sections
3. Switch tabs (Instructions, Permissions, Model, Hooks, MCP, Skills) — each renders correctly
4. Edit instructions → save → "Unsaved" badge clears
5. Change approval mode and add allow/deny rules → save
6. Select a model and effort level → save
7. Switch between Global and Project scope → data reloads
8. Click different providers in sidebar → detail panel updates
9. No FOUC or layout shifts during loading
