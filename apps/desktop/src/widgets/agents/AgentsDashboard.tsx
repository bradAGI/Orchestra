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

  // Build a type-compatible onCreate for PanelProps based on current category
  const handlePanelCreate = async (name: string): Promise<void> => {
    const typeMap: Record<CategoryId, string> = {
      instructions: 'CORE', skills: 'SKILL', hooks: '', mcp: '', rules: 'RULE', agents: 'AGENT',
    }
    const type = category ? (typeMap[category] ?? '') : ''
    if (!type) return
    return state.createResource(type, name)
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
    onCreate: handlePanelCreate,
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
