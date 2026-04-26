import { describe, it, expect } from 'vitest'
import { createRuntimeSlice } from './runtime-slice'
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
  const slice = createRuntimeSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockSnapshot = {
  counts: { running: 1, retrying: 0 },
  running: [],
  retrying: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RuntimeSlice — default initialization', () => {
  it('initializes snapshot to null', () => {
    const { state } = createTestSlice()
    expect(state.snapshot).toBeNull()
  })

  it('initializes timeline to empty array', () => {
    const { state } = createTestSlice()
    expect(state.timeline).toEqual([])
  })

  it('initializes loadingState to true', () => {
    const { state } = createTestSlice()
    expect(state.loadingState).toBe(true)
  })

  it('initializes statusMessage to empty string', () => {
    const { state } = createTestSlice()
    expect(state.statusMessage).toBe('')
  })

  it('initializes usePolling to false', () => {
    const { state } = createTestSlice()
    expect(state.usePolling).toBe(false)
  })

  it('initializes refreshPending to false', () => {
    const { state } = createTestSlice()
    expect(state.refreshPending).toBe(false)
  })
})

describe('RuntimeSlice — updateSnapshot', () => {
  it('sets snapshot when currently null', () => {
    const { get, state } = createTestSlice()
    state.updateSnapshot(mockSnapshot)
    expect(get().snapshot).toEqual(mockSnapshot)
  })

  it('returns same reference when snapshot content is unchanged', () => {
    const { get, state } = createTestSlice()
    state.updateSnapshot(mockSnapshot)
    const first = get().snapshot
    state.updateSnapshot(mockSnapshot)
    const second = get().snapshot
    expect(second).toBe(first)
  })

  it('replaces snapshot on actual change', () => {
    const { get, state } = createTestSlice()
    state.updateSnapshot(mockSnapshot)
    const first = get().snapshot
    state.updateSnapshot({ ...mockSnapshot, counts: { running: 2, retrying: 0 } })
    const second = get().snapshot
    expect(second).not.toBe(first)
    expect(second?.counts.running).toBe(2)
  })

  it('merges partial into existing snapshot', () => {
    const { get, state } = createTestSlice()
    state.updateSnapshot(mockSnapshot)
    state.updateSnapshot({ counts: { running: 5, retrying: 1 } })
    expect(get().snapshot?.counts).toEqual({ running: 5, retrying: 1 })
  })
})

describe('RuntimeSlice — setSnapshot', () => {
  it('sets snapshot directly', () => {
    const { get, state } = createTestSlice()
    state.setSnapshot(mockSnapshot as any)
    expect(get().snapshot).toEqual(mockSnapshot)
  })

  it('sets snapshot to null', () => {
    const { get, state } = createTestSlice()
    state.setSnapshot(mockSnapshot as any)
    state.setSnapshot(null)
    expect(get().snapshot).toBeNull()
  })
})

describe('RuntimeSlice — addTimelineEvent', () => {
  it('prepends event to empty timeline', () => {
    const { get, state } = createTestSlice()
    const event = { type: 'status', at: '2026-01-01T00:00:00Z', data: { message: 'hello' } } as any
    state.addTimelineEvent(event)
    expect(get().timeline[0]).toBe(event)
    expect(get().timeline).toHaveLength(1)
  })

  it('prepends new event before existing ones', () => {
    const { get, state } = createTestSlice()
    const first = { type: 'status', at: '2026-01-01T00:00:00Z', data: { message: 'first' } } as any
    const second = { type: 'status', at: '2026-01-01T00:01:00Z', data: { message: 'second' } } as any
    state.addTimelineEvent(first)
    state.addTimelineEvent(second)
    expect(get().timeline[0]).toBe(second)
    expect(get().timeline[1]).toBe(first)
  })

  it('deduplicates identical consecutive events', () => {
    const { get, state } = createTestSlice()
    const event = { type: 'status', at: '2026-01-01T00:00:00Z', data: { message: 'hello' } } as any
    state.addTimelineEvent(event)
    const ref = get().timeline
    state.addTimelineEvent(event)
    expect(get().timeline).toBe(ref)
    expect(get().timeline).toHaveLength(1)
  })

  it('caps timeline at 50 items', () => {
    const { get, state } = createTestSlice()
    for (let i = 0; i < 60; i++) {
      state.addTimelineEvent({ type: 'status', at: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`, data: { i } } as any)
    }
    expect(get().timeline).toHaveLength(50)
  })
})

describe('RuntimeSlice — togglePolling', () => {
  it('flips usePolling from false to true', () => {
    const { get, state } = createTestSlice()
    expect(get().usePolling).toBe(false)
    state.togglePolling()
    expect(get().usePolling).toBe(true)
  })

  it('flips usePolling back to false', () => {
    const { get, state } = createTestSlice()
    state.togglePolling()
    state.togglePolling()
    expect(get().usePolling).toBe(false)
  })
})

describe('RuntimeSlice — simple setters', () => {
  it('setLoadingState updates loadingState', () => {
    const { get, state } = createTestSlice()
    state.setLoadingState(false)
    expect(get().loadingState).toBe(false)
  })

  it('setStatusMessage updates statusMessage', () => {
    const { get, state } = createTestSlice()
    state.setStatusMessage('Connected')
    expect(get().statusMessage).toBe('Connected')
  })

  it('setUsePolling updates usePolling', () => {
    const { get, state } = createTestSlice()
    state.setUsePolling(true)
    expect(get().usePolling).toBe(true)
  })

  it('setRefreshPending updates refreshPending', () => {
    const { get, state } = createTestSlice()
    state.setRefreshPending(true)
    expect(get().refreshPending).toBe(true)
  })
})
