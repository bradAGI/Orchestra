import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentsDashboard } from './AgentsDashboard'

const mockUseClaudeConfig = vi.fn()
const mockUseCodexConfig = vi.fn()
const mockUseGeminiConfig = vi.fn()
const mockUseOpenCodeConfig = vi.fn()

vi.mock('./hooks/useClaudeConfig', () => ({
  useClaudeConfig: (...args: unknown[]) => mockUseClaudeConfig(...args),
}))

vi.mock('./hooks/useProviderDomainConfig', () => ({
  useCodexConfig: (...args: unknown[]) => mockUseCodexConfig(...args),
  useGeminiConfig: (...args: unknown[]) => mockUseGeminiConfig(...args),
  useOpenCodeConfig: (...args: unknown[]) => mockUseOpenCodeConfig(...args),
}))

vi.mock('./ProviderHeader', () => ({
  ProviderHeader: ({ onProviderChange }: { onProviderChange: (provider: 'claude' | 'codex' | 'gemini' | 'opencode') => void }) => (
    <div>
      <button onClick={() => onProviderChange('claude')}>Claude</button>
      <button onClick={() => onProviderChange('codex')}>Codex</button>
      <button onClick={() => onProviderChange('gemini')}>Gemini</button>
      <button onClick={() => onProviderChange('opencode')}>OpenCode</button>
    </div>
  ),
}))

vi.mock('./CategoryList', () => ({
  CategoryList: ({ categories, onSelectCategory }: { categories: Array<{ id: string; label: string }>; onSelectCategory: (id: string) => void }) => (
    <div>
      {categories.map((category) => (
        <button key={category.id} onClick={() => onSelectCategory(category.id)}>
          {category.label}
        </button>
      ))}
    </div>
  ),
}))

function marker(name: string) {
  return () => <div>{name}</div>
}

vi.mock('./panels/SettingsPanel', () => ({ SettingsPanel: marker('Claude Settings Panel') }))
vi.mock('./panels/InstructionsPanel', () => ({ InstructionsPanel: marker('Claude Instructions Panel') }))
vi.mock('./panels/SkillsPanel', () => ({ SkillsPanel: marker('Claude Skills Panel') }))
vi.mock('./panels/HooksPanel', () => ({ HooksPanel: marker('Hooks Panel') }))
vi.mock('./panels/MCPPanel', () => ({ MCPPanel: marker('MCP Panel') }))
vi.mock('./panels/RulesPanel', () => ({ RulesPanel: marker('Claude Rules Panel') }))
vi.mock('./panels/SubAgentsPanel', () => ({ SubAgentsPanel: marker('Claude SubAgents Panel') }))
vi.mock('./panels/PermissionsPanel', () => ({ PermissionsPanel: marker('Generic Permissions Panel') }))
vi.mock('./panels/CodexConfigPanel', () => ({ CodexConfigPanel: marker('Codex Config Panel') }))
vi.mock('./panels/CodexApprovalsPanel', () => ({ CodexApprovalsPanel: marker('Codex Approvals Panel') }))
vi.mock('./panels/CodexModelPanel', () => ({ CodexModelPanel: marker('Codex Model Panel') }))
vi.mock('./panels/CodexEnvironmentPanel', () => ({ CodexEnvironmentPanel: marker('Codex Environment Panel') }))
vi.mock('./panels/CodexProfilesPanel', () => ({ CodexProfilesPanel: marker('Codex Profiles Panel') }))
vi.mock('./panels/CodexInstructionsPanel', () => ({ CodexInstructionsPanel: marker('Codex Instructions Panel') }))
vi.mock('./panels/CodexSubAgentsPanel', () => ({ CodexSubAgentsPanel: marker('Codex SubAgents Panel') }))
vi.mock('./panels/CodexSkillsPanel', () => ({ CodexSkillsPanel: marker('Codex Skills Panel') }))
vi.mock('./panels/CodexRulesPanel', () => ({ CodexRulesPanel: marker('Codex Rules Panel') }))
vi.mock('./panels/GeminiSettingsPanel', () => ({ GeminiSettingsPanel: marker('Gemini Settings Panel') }))
vi.mock('./panels/GeminiModelPanel', () => ({ GeminiModelPanel: marker('Gemini Model Panel') }))
vi.mock('./panels/GeminiPermissionsPanel', () => ({ GeminiPermissionsPanel: marker('Gemini Permissions Panel') }))
vi.mock('./panels/GeminiContextPanel', () => ({ GeminiContextPanel: marker('Gemini Context Panel') }))
vi.mock('./panels/GeminiCommandsPanel', () => ({ GeminiCommandsPanel: marker('Gemini Commands Panel') }))
vi.mock('./panels/OpenCodeConfigPanel', () => ({ OpenCodeConfigPanel: marker('OpenCode Config Panel') }))
vi.mock('./panels/OpenCodeModelPanel', () => ({ OpenCodeModelPanel: marker('OpenCode Model Panel') }))
vi.mock('./panels/OpenCodeInstructionsPanel', () => ({ OpenCodeInstructionsPanel: marker('OpenCode Instructions Panel') }))
vi.mock('./panels/OpenCodePermissionsPanel', () => ({ OpenCodePermissionsPanel: marker('OpenCode Permissions Panel') }))
vi.mock('./panels/OpenCodeAgentsPanel', () => ({ OpenCodeAgentsPanel: marker('OpenCode Agents Panel') }))
vi.mock('./panels/OpenCodeCommandsPanel', () => ({ OpenCodeCommandsPanel: marker('OpenCode Commands Panel') }))
vi.mock('./panels/OpenCodeSkillsPanel', () => ({ OpenCodeSkillsPanel: marker('OpenCode Skills Panel') }))

function makeCommonState() {
  return {
    projects: [],
    permissions: { approval_mode: 'interactive', allow: [], deny: [], ask: [] },
    modelConfig: { model: '', effort: '', temperature: null },
    hooks: [],
    providerMcpServers: [],
    orchestraMcpServers: [],
    mcpTools: [],
    loading: false,
    error: '',
    saving: null,
    saveFile: vi.fn(),
    savePermissions: vi.fn(),
    saveModel: vi.fn(),
    saveHooks: vi.fn(),
    addMCPServer: vi.fn(),
    updateMCPServer: vi.fn(),
    toggleMCPServer: vi.fn(),
    deleteMCPServer: vi.fn(),
    deleteOrchestraMCPServer: vi.fn(),
    reload: vi.fn(),
    setError: vi.fn(),
  }
}

describe('AgentsDashboard', () => {
  it('routes Gemini categories to provider-specific panels', () => {
    mockUseClaudeConfig.mockReturnValue({
      ...makeCommonState(),
      settings: {},
      settingsPath: '',
      settingsExists: false,
      instructions: '',
      instructionsPath: '',
      instructionsExists: false,
      rules: [],
      skills: [],
      subagents: [],
      saveSettings: vi.fn(),
      saveInstructions: vi.fn(),
      deleteInstructions: vi.fn(),
      saveRule: vi.fn(),
      removeRule: vi.fn(),
      saveSkill: vi.fn(),
      removeSkill: vi.fn(),
      saveSubAgent: vi.fn(),
      removeSubAgent: vi.fn(),
    })
    mockUseCodexConfig.mockReturnValue({
      ...makeCommonState(),
      config: [],
      instructions: [],
      subagents: [],
      skills: [],
      rules: [],
    })
    mockUseGeminiConfig.mockReturnValue({
      ...makeCommonState(),
      settings: [{ path: '/tmp/settings.json', content: '{}', name: 'settings.json' }],
      context: [{ path: '/tmp/GEMINI.md', content: '# Context', name: 'GEMINI.md' }],
      commands: [{ path: '/tmp/cmd.toml', content: 'description = "x"', name: 'cmd.toml' }],
      saveSettingsFile: vi.fn(),
      saveContextFile: vi.fn(),
      saveCommandFile: vi.fn(),
      deleteCommandFile: vi.fn(),
      createSettingsResource: vi.fn(),
      createContextResource: vi.fn(),
      createCommandResource: vi.fn(),
    })
    mockUseOpenCodeConfig.mockReturnValue({
      ...makeCommonState(),
      config: [],
      agents: [],
      commands: [],
      skills: [],
    })

    render(<AgentsDashboard config={{ baseUrl: 'http://localhost:4010', apiToken: 'dev-token' }} snapshot={null} />)

    fireEvent.click(screen.getByText('Gemini'))
    expect(screen.getByText('Gemini Settings Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Models'))
    expect(screen.getByText('Gemini Model Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Permissions'))
    expect(screen.getByText('Gemini Permissions Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Context'))
    expect(screen.getByText('Gemini Context Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Commands'))
    expect(screen.getByText('Gemini Commands Panel')).toBeTruthy()
  })

  it('routes OpenCode categories to provider-specific panels', () => {
    mockUseClaudeConfig.mockReturnValue({
      ...makeCommonState(),
      settings: {},
      settingsPath: '',
      settingsExists: false,
      instructions: '',
      instructionsPath: '',
      instructionsExists: false,
      rules: [],
      skills: [],
      subagents: [],
      saveSettings: vi.fn(),
      saveInstructions: vi.fn(),
      deleteInstructions: vi.fn(),
      saveRule: vi.fn(),
      removeRule: vi.fn(),
      saveSkill: vi.fn(),
      removeSkill: vi.fn(),
      saveSubAgent: vi.fn(),
      removeSubAgent: vi.fn(),
    })
    mockUseCodexConfig.mockReturnValue({
      ...makeCommonState(),
      config: [],
      instructions: [],
      subagents: [],
      skills: [],
      rules: [],
    })
    mockUseGeminiConfig.mockReturnValue({
      ...makeCommonState(),
      settings: [],
      context: [],
      commands: [],
    })
    mockUseOpenCodeConfig.mockReturnValue({
      ...makeCommonState(),
      config: [{ path: '/tmp/opencode.json', content: '{}', name: 'opencode.json' }],
      agents: [{ path: '/tmp/agents/planner.md', content: '---\ndescription: Planner\n---\n', name: 'planner.md' }],
      commands: [{ path: '/tmp/commands/test.md', content: '---\ndescription: Test\n---\n', name: 'test.md' }],
      skills: [{ path: '/tmp/skills/release/SKILL.md', content: '---\nname: release\ndescription: Release\n---\n', name: 'release' }],
      saveConfigResource: vi.fn(),
      saveAgentFile: vi.fn(),
      saveCommandFile: vi.fn(),
      saveSkillFile: vi.fn(),
      deleteAgentFile: vi.fn(),
      deleteCommandResource: vi.fn(),
      deleteSkillResource: vi.fn(),
      createConfigResource: vi.fn(),
      createAgentResourceFile: vi.fn(),
      createCommandResource: vi.fn(),
      createSkillResourceFile: vi.fn(),
    })

    render(<AgentsDashboard config={{ baseUrl: 'http://localhost:4010', apiToken: 'dev-token' }} snapshot={null} />)

    fireEvent.click(screen.getByText('OpenCode'))
    expect(screen.getByText('OpenCode Config Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Models'))
    expect(screen.getByText('OpenCode Model Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Instructions'))
    expect(screen.getByText('OpenCode Instructions Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Agents'))
    expect(screen.getByText('OpenCode Agents Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Commands'))
    expect(screen.getByText('OpenCode Commands Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Skills'))
    expect(screen.getByText('OpenCode Skills Panel')).toBeTruthy()

    fireEvent.click(screen.getByText('Permissions'))
    expect(screen.getByText('OpenCode Permissions Panel')).toBeTruthy()
  })
})
