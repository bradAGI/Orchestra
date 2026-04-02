// apps/desktop/src/widgets/agents/AgentsDashboard.tsx
import { useState, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import type { BackendConfig, SnapshotPayload } from '@/lib/orchestra-types'
import { Skeleton } from '@/components/ui/skeleton'
import { ProviderHeader } from './ProviderHeader'
import { CategoryList } from './CategoryList'
import { SettingsPanel } from './panels/SettingsPanel'
import { InstructionsPanel } from './panels/InstructionsPanel'
import { SkillsPanel } from './panels/SkillsPanel'
import { HooksPanel } from './panels/HooksPanel'
import { MCPPanel } from './panels/MCPPanel'
import { RulesPanel } from './panels/RulesPanel'
import { SubAgentsPanel } from './panels/SubAgentsPanel'
import { useClaudeConfig } from './hooks/useClaudeConfig'
import { useAgentConfig } from './hooks/useAgentConfig'
import { CATEGORIES, LEGACY_CATEGORIES } from './constants'
import type { Provider, CategoryId, Scope } from './types'

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


  const handleSelectCategory = (id: CategoryId) => {
    setCategory(id)
    setSelectedItem(null)
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

      <div className="flex flex-col flex-1 min-h-0">
        {/* Header bar: provider tabs + scope */}
        <ProviderHeader
          provider={provider}
          onProviderChange={(p) => {
            setProvider(p)
            setCategory(p === 'claude' ? 'settings' : 'instructions')
            setSelectedItem(null)
          }}
          scope={scope}
          projectId={projectId}
          projects={isClaude ? claude.projects : (legacy as ReturnType<typeof useAgentConfig>).projects}
          onScopeChange={(s, pid) => { setScope(s); setProjectId(pid) }}
        />

        {/* Main content: category list + detail panel */}
        <div className="flex flex-1 min-h-0">
            {/* Column 2: Category list */}
            <CategoryList
              categories={categories}
              selectedCategory={category}
              categoryCounts={categoryCounts}
              onSelectCategory={handleSelectCategory}
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
                      onDelete={claude.deleteInstructions}
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
                      onUpdateProvider={claude.updateMCPServer}
                      onToggleProvider={claude.toggleMCPServer}
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
                  {category === 'instructions' && <InstructionsPanel content="" path="" exists={false} saving={null} onSave={async () => {}} />}
                  {category === 'skills' && <SkillsPanel items={[]} saving={null} onSave={async () => {}} onDelete={async () => {}} />}
                  {category === 'hooks' && <HooksPanel hooks={(legacy as ReturnType<typeof useAgentConfig>).hooks} onSave={(legacy as ReturnType<typeof useAgentConfig>).saveHooks} loading={legacy.loading} saving={legacy.saving} provider={provider} />}
                  {category === 'mcp' && <MCPPanel providerServers={(legacy as ReturnType<typeof useAgentConfig>).providerMcpServers} orchestraServers={(legacy as ReturnType<typeof useAgentConfig>).orchestraMcpServers} onAddProvider={(legacy as ReturnType<typeof useAgentConfig>).addMCPServer} onUpdateProvider={(legacy as ReturnType<typeof useAgentConfig>).updateMCPServer} onToggleProvider={(legacy as ReturnType<typeof useAgentConfig>).toggleMCPServer} onDeleteProvider={(legacy as ReturnType<typeof useAgentConfig>).deleteMCPServer} onDeleteOrchestra={(legacy as ReturnType<typeof useAgentConfig>).deleteOrchestraMCPServer} loading={legacy.loading} saving={legacy.saving} provider={provider} />}
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
  )
}
