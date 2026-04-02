// apps/desktop/src/widgets/agents/AgentsDashboard.tsx
import { useState, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import type { BackendConfig, SnapshotPayload } from '@/lib/orchestra-types'
import type { AgentConfig } from '@/lib/orchestra-types'
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
import { FileResourcePanel, type FileResourceItem } from './panels/FileResourcePanel'
import { ProviderConfigPanel } from './panels/ProviderConfigPanel'
import { PermissionsPanel } from './panels/PermissionsPanel'
import { useClaudeConfig } from './hooks/useClaudeConfig'
import { useAgentConfig } from './hooks/useAgentConfig'
import { CLAUDE_CATEGORIES, CODEX_CATEGORIES, GEMINI_CATEGORIES, OPENCODE_CATEGORIES } from './constants'
import type { Provider, CategoryId, Scope } from './types'

interface AgentsDashboardProps {
  config: BackendConfig | null
  snapshot: SnapshotPayload | null
}

export function AgentsDashboard({ config }: AgentsDashboardProps) {
  const [provider, setProvider] = useState<Provider>('claude')
  const [category, setCategory] = useState<CategoryId>('settings')
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

  const categories = useMemo(() => {
    switch (provider) {
      case 'claude':
        return CLAUDE_CATEGORIES
      case 'codex':
        return CODEX_CATEGORIES
      case 'gemini':
        return GEMINI_CATEGORIES
      case 'opencode':
        return OPENCODE_CATEGORIES
      default:
        return CLAUDE_CATEGORIES
    }
  }, [provider])

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
    if (isClaude) return {}
    const legacyState = legacy as ReturnType<typeof useAgentConfig>
    const items = legacyState.configs.filter(configItem => configItem.name.toLowerCase().startsWith(provider))

    const codexConfig = items.filter(configItem => configItem.resource_type === 'config')
    const codexInstructions = items.filter(configItem => configItem.resource_type === 'instructions')
    const codexAgents = items.filter(configItem => configItem.resource_type === 'agents')
    const codexSkills = items.filter(configItem => configItem.resource_type === 'skills')

    const geminiSettings = items.filter(configItem => configItem.resource_type === 'settings')
    const geminiContext = items.filter(configItem => configItem.resource_type === 'context')
    const geminiCommands = items.filter(configItem => configItem.resource_type === 'commands')

    const openCodeConfig = items.filter(configItem => configItem.resource_type === 'config')
    const openCodeAgents = items.filter(configItem => configItem.resource_type === 'agents')
    const openCodeCommands = items.filter(configItem => configItem.resource_type === 'commands')
    const openCodeSkills = items.filter(configItem => configItem.resource_type === 'skills')

    if (provider === 'codex') {
      return {
        config: codexConfig.length,
        instructions: codexInstructions.length,
        agents: codexAgents.length,
        skills: codexSkills.length,
        mcp: legacyState.providerMcpServers.length + legacyState.orchestraMcpServers.length,
      }
    }

    if (provider === 'gemini') {
      return {
        settings: geminiSettings.length,
        context: geminiContext.length,
        commands: geminiCommands.length,
        mcp: legacyState.providerMcpServers.length + legacyState.orchestraMcpServers.length,
      }
    }

    return {
      config: openCodeConfig.length,
      instructions: openCodeConfig.length,
      agents: openCodeAgents.length,
      commands: openCodeCommands.length,
      skills: openCodeSkills.length,
      mcp: legacyState.providerMcpServers.length + legacyState.orchestraMcpServers.length,
      permissions: 1,
    }
  }, [isClaude, legacy, provider])

  const categoryCounts = isClaude ? claudeCounts : legacyCounts
  const legacyState = legacy as ReturnType<typeof useAgentConfig>

  const providerItems = useMemo(() => {
    if (isClaude) {
      return {
        config: [] as FileResourceItem[],
        instructions: [] as FileResourceItem[],
        context: [] as FileResourceItem[],
        agents: [] as FileResourceItem[],
        skills: [] as FileResourceItem[],
        commands: [] as FileResourceItem[],
      }
    }

    const items = legacyState.configs.filter(configItem => configItem.name.toLowerCase().startsWith(provider))
    const toResourceItems = (configs: AgentConfig[]): FileResourceItem[] => configs.map(configItem => ({
      key: configItem.path,
      name: buildResourceName(provider, configItem),
      path: configItem.path,
      content: configItem.content,
      badge: buildResourceBadge(provider, configItem),
      priority: configItem.priority,
      origin: configItem.origin,
      depth: configItem.depth,
    }))

    return {
      config: toResourceItems(items.filter(configItem => {
        if (provider === 'codex') return configItem.resource_type === 'config'
        if (provider === 'gemini') return configItem.resource_type === 'settings'
        return configItem.resource_type === 'config'
      })),
      instructions: toResourceItems(items.filter(configItem => {
        if (provider === 'codex') return configItem.resource_type === 'instructions'
        if (provider === 'opencode') return configItem.resource_type === 'config'
        return false
      })).sort(compareStackItems),
      context: toResourceItems(items.filter(configItem => configItem.resource_type === 'context')).sort(compareStackItems),
      agents: toResourceItems(items.filter(configItem => {
        if (provider === 'codex') return configItem.resource_type === 'agents'
        if (provider === 'opencode') return configItem.resource_type === 'agents'
        return false
      })),
      skills: toResourceItems(items.filter(configItem => {
        if (provider === 'codex') return configItem.resource_type === 'skills'
        if (provider === 'opencode') return configItem.resource_type === 'skills'
        return false
      })),
      commands: toResourceItems(items.filter(configItem => {
        if (provider === 'gemini') return configItem.resource_type === 'commands'
        if (provider === 'opencode') return configItem.resource_type === 'commands'
        return false
      })),
    }
  }, [isClaude, legacyState.configs, provider])

  const handleSelectCategory = (id: CategoryId) => {
    setCategory(id)
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
            setCategory(
              p === 'claude'
                ? 'settings'
                : p === 'gemini'
                  ? 'settings'
                  : 'config',
            )
          }}
          scope={scope}
          projectId={projectId}
          projects={isClaude ? claude.projects : legacyState.projects}
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
                  {category === 'config' && (
                    <ProviderConfigPanel
                      provider={provider}
                      title={provider === 'opencode' ? 'OpenCode Config' : 'Provider Config'}
                      subtitle={provider === 'codex' ? 'config.toml files' : 'Primary configuration files'}
                      emptyTitle="No config found"
                      emptyDescription="This provider does not have a discovered configuration file for the selected scope."
                      items={providerItems.config}
                      saving={legacy.saving}
                      onSave={legacyState.saveConfig}
                      onCreate={() => legacyState.createResource(provider === 'gemini' ? 'settings' : 'config', 'config')}
                      createLabel={provider === 'gemini' ? 'Create Settings' : 'Create Config'}
                      createDescription="Create the primary configuration file for this provider in the selected scope."
                    />
                  )}
                  {category === 'settings' && (
                    provider === 'gemini' ? (
                      <ProviderConfigPanel
                        provider={provider}
                        title="Gemini Settings"
                        subtitle="settings.json files"
                        emptyTitle="No settings found"
                        emptyDescription="Gemini uses settings.json for global and project configuration."
                        items={providerItems.config}
                        saving={legacy.saving}
                        onSave={legacyState.saveConfig}
                        onCreate={() => legacyState.createResource('settings', 'settings')}
                        createLabel="Create Settings"
                        createDescription="Create Gemini settings.json for the selected scope."
                      />
                    ) : null
                  )}
                  {category === 'instructions' && (
                    <FileResourcePanel
                      title={provider === 'codex' ? 'Instruction Stack' : 'Instructions'}
                      subtitle={provider === 'codex' ? 'AGENTS.md and override files' : 'Instructions are configured in opencode.json'}
                      emptyTitle={provider === 'codex' ? 'No instruction files found' : 'No instruction config found'}
                      emptyDescription={
                        provider === 'codex'
                          ? 'Codex instructions come from AGENTS.md files at global and project scope.'
                          : 'OpenCode instructions are configured through opencode.json and applied from config.'
                      }
                      infoTitle={provider === 'codex' ? 'Instruction Stack' : 'Config-backed Instructions'}
                      infoDescription={
                        provider === 'codex'
                          ? 'Codex reads AGENTS.md files as a stack. More specific project files and override files take precedence over broader instructions.'
                          : 'OpenCode instructions are configured in opencode.json. Edit the config file directly in this panel.'
                      }
                      items={providerItems.instructions}
                      saving={legacy.saving}
                      onSave={legacyState.saveConfig}
                      onCreate={() => legacyState.createResource('instructions', 'instructions')}
                      createLabel={provider === 'codex' ? 'Create Instructions' : 'Create Instructions Config'}
                      createDescription={
                        provider === 'codex'
                          ? 'Create the default AGENTS.md file for the selected scope.'
                          : 'Create the base OpenCode config file used to hold instruction settings.'
                      }
                    />
                  )}
                  {category === 'context' && (
                    <FileResourcePanel
                      title="Context Files"
                      subtitle="GEMINI.md context discovery"
                      emptyTitle="No context files found"
                      emptyDescription="Gemini loads workspace context from GEMINI.md files."
                      infoTitle="Context Layers"
                      infoDescription="Gemini loads context from global and workspace files. More specific workspace files should be treated as closer context than global files."
                      items={providerItems.context}
                      saving={legacy.saving}
                      onSave={legacyState.saveConfig}
                      onCreate={() => legacyState.createResource('context', 'context')}
                      createLabel="Create Context"
                      createDescription="Create a GEMINI.md context file for the selected scope."
                    />
                  )}
                  {category === 'skills' && (
                    <FileResourcePanel
                      title="Skills"
                      subtitle={provider === 'codex' ? '.agents/skills/' : 'Provider skill files'}
                      emptyTitle="No skills found"
                      emptyDescription="No editable skills were discovered for this provider in the selected scope."
                      items={providerItems.skills}
                      saving={legacy.saving}
                      onSave={legacyState.saveConfig}
                      onCreate={(name) => legacyState.createResource('skills', name)}
                      createLabel="Add Skill"
                      createDescription="Create a new skill resource for this provider in the selected scope."
                    />
                  )}
                  {category === 'commands' && (
                    <FileResourcePanel
                      title="Commands"
                      subtitle="Provider command definitions"
                      emptyTitle="No commands found"
                      emptyDescription="No command definitions were discovered for this provider in the selected scope."
                      items={providerItems.commands}
                      saving={legacy.saving}
                      onSave={legacyState.saveConfig}
                      onCreate={(name) => legacyState.createResource('commands', name)}
                      createLabel="Add Command"
                      createDescription="Create a new command for this provider in the selected scope."
                    />
                  )}
                  {category === 'agents' && (
                    <FileResourcePanel
                      title={provider === 'codex' ? 'Sub-agents' : 'Agents'}
                      subtitle="Provider agent definitions"
                      emptyTitle="No agents found"
                      emptyDescription="No agent definitions were discovered for this provider in the selected scope."
                      items={providerItems.agents}
                      saving={legacy.saving}
                      onSave={legacyState.saveConfig}
                      onCreate={(name) => legacyState.createResource('agents', name)}
                      createLabel={provider === 'codex' ? 'Add Sub-agent' : 'Add Agent'}
                      createDescription="Create a new provider-specific agent definition in the selected scope."
                    />
                  )}
                  {category === 'hooks' && <HooksPanel hooks={legacyState.hooks} onSave={legacyState.saveHooks} loading={legacy.loading} saving={legacy.saving} provider={provider} />}
                  {category === 'mcp' && <MCPPanel providerServers={legacyState.providerMcpServers} orchestraServers={legacyState.orchestraMcpServers} onAddProvider={legacyState.addMCPServer} onUpdateProvider={legacyState.updateMCPServer} onToggleProvider={legacyState.toggleMCPServer} onDeleteProvider={legacyState.deleteMCPServer} onDeleteOrchestra={legacyState.deleteOrchestraMCPServer} loading={legacy.loading} saving={legacy.saving} provider={provider} />}
                  {category === 'permissions' && <PermissionsPanel permissions={legacyState.permissions} saving={legacy.saving} onSave={legacyState.savePermissions} provider={provider} />}
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

function buildResourceBadge(provider: Provider, configItem: AgentConfig): string {
  const originBadge = configItem.origin === 'workspace'
    ? 'Workspace'
    : configItem.scope === 'GLOBAL'
      ? 'Global'
      : 'Project'

  if (provider === 'codex') {
    if (configItem.variant === 'override') return `${originBadge} Override`
    if (configItem.variant === 'stack') return `${originBadge} Stack`
  }

  if (provider === 'gemini' && configItem.resource_type === 'context') {
    return `${originBadge} Context`
  }

  return originBadge
}

function buildResourceName(provider: Provider, configItem: AgentConfig): string {
  const path = configItem.path
  const parts = path.split('/')
  const base = parts[parts.length - 1] ?? path
  const parent = parts[parts.length - 2] ?? ''

  if (provider === 'codex') {
    if (configItem.resource_type === 'config') return 'config.toml'
    if (configItem.variant === 'override') return 'AGENTS.override.md'
    if (configItem.resource_type === 'instructions') return 'AGENTS.md'
    if (configItem.resource_type === 'agents') return base
    if (configItem.resource_type === 'skills') return parent || base
  }

  if (provider === 'gemini') {
    if (configItem.resource_type === 'settings') return 'settings.json'
    if (configItem.resource_type === 'context') return 'GEMINI.md'
    if (configItem.resource_type === 'commands') return base
  }

  if (provider === 'opencode') {
    if (configItem.resource_type === 'config') return base
    if (configItem.resource_type === 'agents' || configItem.resource_type === 'commands') return base
    if (configItem.resource_type === 'skills') return parent || base
  }

  return base
}

function compareStackItems(a: FileResourceItem, b: FileResourceItem): number {
  return stackWeight(a) - stackWeight(b)
    || (a.depth ?? 0) - (b.depth ?? 0)
    || a.path.localeCompare(b.path)
}

function stackWeight(item: FileResourceItem): number {
  return typeof item.priority === 'number'
    ? item.priority
    : ((item.badge?.toLowerCase().includes('global') ?? false) ? 80 : 90)
}
