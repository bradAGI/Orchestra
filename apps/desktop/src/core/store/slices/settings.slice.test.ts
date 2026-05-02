import { describe, it, expect } from 'vitest'
import { createSettingsSlice } from './settings.slice'
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
  const slice = createSettingsSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsSlice — default initialization', () => {
  it('initializes config to null', () => {
    const { state } = createTestSlice()
    expect(state.config).toBeNull()
  })

  it('initializes loadingConfig to true', () => {
    const { state } = createTestSlice()
    expect(state.loadingConfig).toBe(true)
  })

  it('initializes backendProfiles to null', () => {
    const { state } = createTestSlice()
    expect(state.backendProfiles).toBeNull()
  })

  it('initializes activeProfileId to null', () => {
    const { state } = createTestSlice()
    expect(state.activeProfileId).toBeNull()
  })
})

describe('SettingsSlice — setConfig', () => {
  it('updates config', () => {
    const { get, state } = createTestSlice()
    const config = { agentProvider: 'CLAUDE', maxConcurrent: 3 } as any
    state.setConfig(config)
    expect(get().config).toEqual(config)
  })

  it('accepts null', () => {
    const { get, state } = createTestSlice()
    state.setConfig({ agentProvider: 'CLAUDE' } as any)
    state.setConfig(null)
    expect(get().config).toBeNull()
  })
})

describe('SettingsSlice — simple setters', () => {
  it('setLoadingConfig updates loadingConfig', () => {
    const { get, state } = createTestSlice()
    state.setLoadingConfig(false)
    expect(get().loadingConfig).toBe(false)
  })

  it('setBackendProfiles updates backendProfiles', () => {
    const { get, state } = createTestSlice()
    const profiles = { profiles: [], activeId: '' } as any
    state.setBackendProfiles(profiles)
    expect(get().backendProfiles).toEqual(profiles)
  })

  it('setActiveProfileId updates activeProfileId', () => {
    const { get, state } = createTestSlice()
    state.setActiveProfileId('profile-abc')
    expect(get().activeProfileId).toBe('profile-abc')
  })
})
