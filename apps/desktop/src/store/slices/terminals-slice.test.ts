import { describe, it, expect } from 'vitest'
import { createTerminalsSlice } from './terminals-slice'
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
  const slice = createTerminalsSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TerminalsSlice — default initialization', () => {
  it('initializes openTerminals to empty array', () => {
    const { state } = createTestSlice()
    expect(state.openTerminals).toEqual([])
  })
})

describe('TerminalsSlice — setOpenTerminals', () => {
  it('updates openTerminals', () => {
    const { get, state } = createTestSlice()
    const terminals = [{ id: 'term-1', issueId: '123' }] as any
    state.setOpenTerminals(terminals)
    expect(get().openTerminals).toEqual(terminals)
  })

  it('replaces previous terminals list', () => {
    const { get, state } = createTestSlice()
    state.setOpenTerminals([{ id: 'term-1' }] as any)
    state.setOpenTerminals([{ id: 'term-2' }, { id: 'term-3' }] as any)
    expect(get().openTerminals).toHaveLength(2)
  })

  it('accepts empty array to clear terminals', () => {
    const { get, state } = createTestSlice()
    state.setOpenTerminals([{ id: 'term-1' }] as any)
    state.setOpenTerminals([])
    expect(get().openTerminals).toEqual([])
  })
})
