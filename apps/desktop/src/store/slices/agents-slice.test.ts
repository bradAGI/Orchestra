import { describe, it, expect } from 'vitest'
import { createAgentsSlice } from './agents-slice'
import type { AppState } from '../types'

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createAgentsSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentsSlice — default initialization', () => {
  it('initializes agentConfig to null', () => {
    const { state } = createTestSlice()
    expect(state.agentConfig).toBeNull()
  })

  it('initializes availableAgents to empty array', () => {
    const { state } = createTestSlice()
    expect(state.availableAgents).toEqual([])
  })

  it('initializes allTools to empty array', () => {
    const { state } = createTestSlice()
    expect(state.allTools).toEqual([])
  })
})

describe('AgentsSlice — setAvailableAgents', () => {
  it('updates availableAgents', () => {
    const { get, state } = createTestSlice()
    state.setAvailableAgents(['claude', 'codex'])
    expect(get().availableAgents).toEqual(['claude', 'codex'])
  })

  it('replaces previous agents list', () => {
    const { get, state } = createTestSlice()
    state.setAvailableAgents(['claude'])
    state.setAvailableAgents(['gemini', 'opencode'])
    expect(get().availableAgents).toEqual(['gemini', 'opencode'])
  })
})

describe('AgentsSlice — simple setters', () => {
  it('setAgentConfig updates agentConfig', () => {
    const { get, state } = createTestSlice()
    const config = { provider: 'claude', model: 'sonnet' }
    state.setAgentConfig(config)
    expect(get().agentConfig).toEqual(config)
  })

  it('setAgentConfig accepts null', () => {
    const { get, state } = createTestSlice()
    state.setAgentConfig({ provider: 'claude' })
    state.setAgentConfig(null)
    expect(get().agentConfig).toBeNull()
  })

  it('setAllTools updates allTools', () => {
    const { get, state } = createTestSlice()
    const tools = [{ name: 'bash', description: 'Run bash commands' }]
    state.setAllTools(tools)
    expect(get().allTools).toEqual(tools)
  })
})
