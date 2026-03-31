// apps/desktop/src/widgets/agents/AgentsDashboard.tsx
import { useState, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import type { BackendConfig, SnapshotPayload } from '@/lib/orchestra-types'
import { Skeleton } from '@/components/ui/skeleton'
import { ProviderTabs } from './ProviderTabs'
import { ProviderHeader } from './ProviderHeader'
import { CategoryList } from './CategoryList'
import { SettingsPanel } from './panels/SettingsPanel'
import { InstructionsPanel } from './panels/InstructionsPanel'
import { SkillsPanel } from './panels/SkillsPanel'
import { HooksPanel } from './panels/HooksPanel'
import { MCPPanel } from './panels/MCPPanel'
import { RulesPanel } from './panels/RulesPanel'
import { SubAgentsPanel } from './panels/SubAgentsPanel'
import { PermissionsPanel } from './panels/PermissionsPanel'
import { useClaudeConfig } from './hooks/useClaudeConfig'
import { useAgentConfig } from './hooks/useAgentConfig'
import { CATEGORIES, LEGACY_CATEGORIES } from './constants'
import type { Provider, CategoryId, Scope, PanelProps } from './types'

interface AgentsDashboardProps {
  config: BackendConfig | null
  snapshot: SnapshotPayload | null
}

export function AgentsDashboard({ config }: AgentsDashboardProps) {
  const [provider, setProvider] = useState<Provider>('claude')
  const [category, setCategory] = useState<CategoryId>('settings')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('GLOBAL')
  const [projectId, setProjectId] = useState('')

  const isClaude = provider === 'claude'

  // Claude uses dedicated hook
  const claude = useClaudeConfig(
    isClaude ? config : null,
    scope,
    projectId || undefined,
  )

  // Other providers use legacy hook
  const legacy = useAgentConfig(
    !isClaude ? config : null,
    provider,
    scope,
    projectId || undefined,
  )

  const state = isClaude ? claude : legacy
  const categories = isClaude ? CATEGORIES : LEGACY_CATEGORIES

  // Category counts for Claude
  const claudeCounts = useMemo((): Record<string, number> => {
    if (!isClaude) return {}
    return {
      settings: 1,
      instructions: claude.instructionsExists ? 1 : 0,
      permissions: (claude.permissions.allow.length + claude.permissions.deny.length + claude.permissions.ask.length),
      hooks: claude.hooks.length,
      mcp: claude.providerMcpServers.length + claude.orchestraMcpServers.length,
      rules: claude.rules.length,
      skills: claude.skills.length,
      agents: claude.subagents.length,
    }
  }, [isClaude, claude])

  // Legacy category counts
  const legacyCounts = useMemo((): Record<string, number> => {
    if (isClaude || !('categoryCounts' in legacy)) return {}
    return (legacy as ReturnType<typeof useAgentConfig>).categoryCounts
  }, [isClaude, legacy])

  const categoryCounts = isClaude ? claudeCounts : legacyCounts

  // Items for the category sidebar (file-list categories)
  const claudeItemsForCategory = useMemo(() => {
    if (!isClaude || !category) return []
    switch (category) {
      case 'rules': return claude.rules
      case 'skills': return claude.skills
      case 'agents': return claude.subagents
      default: return []
    }
  }, [isClaude, category, claude.rules, claude.skills, claude.subagents])

  const legacyItemsForCategory = useMemo(() => {
    if (isClaude || !category) return []
    const legacyState = legacy as ReturnType<typeof useAgentConfig>
    return legacyState.configsByCategory(category).map(c => ({
      name: c.name.split('/').pop() ?? c.name,
      path: c.path,
    }))
  }, [isClaude, category, legacy])

  const itemsForCategory = isClaude ? claudeItemsForCategory : legacyItemsForCategory

  const handleSelectCategory = (id: CategoryId) => {
    setCategory(id)
    if (isClaude) {
      // Auto-select first item for list-based categories
      if (['rules', 'skills', 'agents'].includes(id)) {
        const items = id === 'rules' ? claude.rules : id === 'skills' ? claude.skills : claude.subagents
        setSelectedItem(items.length > 0 ? items[0].name : null)
      } else {
        setSelectedItem(null)
      }
    } else {
      const legacyState = legacy as ReturnType<typeof useAgentConfig>
      const items = legacyState.configsByCategory(id)
      if (['instructions', 'skills', 'rules', 'agents'].includes(id) && items.length > 0) {
        setSelectedItem(items[0].path)
      } else {
        setSelectedItem(null)
      }
    }
  }

  const handleAddNew = () => {
    if (!category) return
    if (isClaude) {
      const name = window.prompt(`New ${category} name:`)
      if (!name?.trim()) return
      switch (category) {
        case 'rules': claude.saveRule(name.trim(), ''); break
        case 'skills': claude.saveSkill(name.trim(), ''); break
        case 'agents': claude.saveSubAgent(name.trim(), ''); break
      }
    } else {
      const typeMap: Record<string, string> = {
        instructions: 'CORE', skills: 'SKILL', hooks: '', mcp: '', rules: 'RULE', agents: 'AGENT',
      }
      const type = typeMap[category] ?? ''
      if (!type) return
      const name = window.prompt(`New ${category} name:`)
      if (name?.trim()) {
        (legacy as ReturnType<typeof useAgentConfig>).createResource(type, name.trim())
      }
    }
  }

  // Legacy panel props for non-Claude providers
  const legacyPanelProps: PanelProps | null = !isClaude ? {
    items: (legacy as ReturnType<typeof useAgentConfig>).configsByCategory(category ?? 'instructions'),
    selectedItem,
    onSelectItem: setSelectedItem,
    onSave: (legacy as ReturnType<typeof useAgentConfig>).saveConfig,
    onDelete: async (path) => {
      const name = path.split('/').pop() ?? path
      if (window.confirm(`Delete "${name}"? This will remove the file from disk.`)) {
        await (legacy as ReturnType<typeof useAgentConfig>).deleteConfig(path)
      }
    },
    onCreate: async (name) => {
      const typeMap: Record<string, string> = {
        instructions: 'CORE', skills: 'SKILL', rules: 'RULE', agents: 'AGENT',
      }
      const type = category ? (typeMap[category] ?? '') : ''
      if (type) await (legacy as ReturnType<typeof useAgentConfig>).createResource(type, name)
    },
    loading: legacy.loading,
    saving: legacy.saving,
    provider,
  } : null

  const showAddNew = isClaude
    ? ['rules', 'skills', 'agents'].includes(category ?? '')
    : ['instructions', 'skills', 'rules', 'agents'].includes(category ?? '')

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
        <ProviderTabs
          selected={provider}
          onSelect={(p) => {
            setProvider(p)
            setCategory(p === 'claude' ? 'settings' : 'instructions')
            setSelectedItem(null)
          }}
          configuredSet={new Set<Provider>(['claude'])}
        />

        {/* Column 2+3 wrapper */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header bar */}
          <ProviderHeader
            provider={provider}
            modelConfig={isClaude ? claude.modelConfig : (legacy as ReturnType<typeof useAgentConfig>).modelConfig}
            permissions={isClaude ? claude.permissions : (legacy as ReturnType<typeof useAgentConfig>).permissions}
            scope={scope}
            projectId={projectId}
            projects={isClaude ? claude.projects : (legacy as ReturnType<typeof useAgentConfig>).projects}
            onModelChange={(m) => isClaude ? claude.saveModel(m) : (legacy as ReturnType<typeof useAgentConfig>).saveModel(m)}
            onPermissionsChange={(p) => isClaude ? claude.savePermissions(p) : (legacy as ReturnType<typeof useAgentConfig>).savePermissions(p)}
            onScopeChange={(s, pid) => { setScope(s); setProjectId(pid) }}
          />

          {/* Main content: category list + detail panel */}
          <div className="flex flex-1 min-h-0">
            {/* Column 2: Category list */}
            <CategoryList
              categories={categories}
              selectedCategory={category}
              selectedItem={selectedItem}
              categoryCounts={categoryCounts}
              itemsForCategory={itemsForCategory}
              onSelectCategory={handleSelectCategory}
              onSelectItem={setSelectedItem}
              onAddNew={showAddNew ? handleAddNew : undefined}
            />

            {/* Column 3: Detail panel */}
            <div className="flex-1 min-w-0 min-h-0">
              {state.loading ? (
                <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[300px] w-full" /></div>
              ) : isClaude ? (
                <>
                  {category === 'settings' && (
                    <SettingsPanel
                      settings={claude.settings}
                      settingsPath={claude.settingsPath}
                      settingsExists={claude.settingsExists}
                      saving={claude.saving}
                      onSave={claude.saveSettings}
                    />
                  )}
                  {category === 'instructions' && (
                    <InstructionsPanel
                      content={claude.instructions}
                      path={claude.instructionsPath}
                      exists={claude.instructionsExists}
                      saving={claude.saving}
                      onSave={claude.saveInstructions}
                    />
                  )}
                  {category === 'permissions' && (
                    <PermissionsPanel
                      permissions={claude.permissions}
                      saving={claude.saving}
                      onSave={claude.savePermissions}
                    />
                  )}
                  {category === 'hooks' && (
                    <HooksPanel hooks={claude.hooks} onSave={claude.saveHooks} loading={claude.loading} saving={claude.saving} provider="claude" />
                  )}
                  {category === 'mcp' && (
                    <MCPPanel
                      providerServers={claude.providerMcpServers}
                      orchestraServers={claude.orchestraMcpServers}
                      onAddProvider={claude.addMCPServer}
                      onDeleteProvider={claude.deleteMCPServer}
                      onDeleteOrchestra={claude.deleteOrchestraMCPServer}
                      loading={claude.loading}
                      saving={claude.saving}
                      provider="claude"
                    />
                  )}
                  {category === 'rules' && (
                    <RulesPanel
                      items={claude.rules}
                      saving={claude.saving}
                      onSave={claude.saveRule}
                      onDelete={claude.removeRule}
                    />
                  )}
                  {category === 'skills' && (
                    <SkillsPanel
                      items={claude.skills}
                      saving={claude.saving}
                      onSave={claude.saveSkill}
                      onDelete={claude.removeSkill}
                    />
                  )}
                  {category === 'agents' && (
                    <SubAgentsPanel
                      items={claude.subagents}
                      saving={claude.saving}
                      onSave={claude.saveSubAgent}
                      onDelete={claude.removeSubAgent}
                    />
                  )}
                </>
              ) : (
                <>
                  {category === 'instructions' && legacyPanelProps && <InstructionsPanel content="" path="" exists={false} saving={null} onSave={async () => {}} />}
                  {category === 'skills' && legacyPanelProps && <SkillsPanel items={[]} saving={null} onSave={async () => {}} onDelete={async () => {}} />}
                  {category === 'hooks' && <HooksPanel hooks={(legacy as ReturnType<typeof useAgentConfig>).hooks} onSave={(legacy as ReturnType<typeof useAgentConfig>).saveHooks} loading={legacy.loading} saving={legacy.saving} provider={provider} />}
                  {category === 'mcp' && <MCPPanel providerServers={(legacy as ReturnType<typeof useAgentConfig>).providerMcpServers} orchestraServers={(legacy as ReturnType<typeof useAgentConfig>).orchestraMcpServers} onAddProvider={(legacy as ReturnType<typeof useAgentConfig>).addMCPServer} onDeleteProvider={(legacy as ReturnType<typeof useAgentConfig>).deleteMCPServer} onDeleteOrchestra={(legacy as ReturnType<typeof useAgentConfig>).deleteOrchestraMCPServer} loading={legacy.loading} saving={legacy.saving} provider={provider} />}
                  {category === 'rules' && <RulesPanel items={[]} saving={null} onSave={async () => {}} onDelete={async () => {}} />}
                  {category === 'agents' && <SubAgentsPanel items={[]} saving={null} onSave={async () => {}} onDelete={async () => {}} />}
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
