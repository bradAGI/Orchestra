import { describe, it, expect } from 'vitest'
import { createEditorSlice } from './editor-slice'
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
  const slice = createEditorSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorSlice — placeholder', () => {
  it('initializes without error', () => {
    const { state } = createTestSlice()
    expect(state).toBeDefined()
  })

  it('returns an empty object', () => {
    let state = {} as AppState
    const set = () => {}
    const get = () => state
    const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
    const slice = createEditorSlice(set as any, get, api)
    expect(slice).toEqual({})
  })
})
