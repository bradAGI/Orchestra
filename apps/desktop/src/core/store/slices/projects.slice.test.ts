import { describe, it, expect } from 'vitest'
import { createProjectsSlice } from './projects.slice'
import type { AppState } from '../types'
import type { Project } from '@core/api/types'

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
  const slice = createProjectsSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectsSlice — default initialization', () => {
  it('initializes projects to empty array', () => {
    const { state } = createTestSlice()
    expect(state.projects).toEqual([])
  })

  it('initializes projectStats to empty object', () => {
    const { state } = createTestSlice()
    expect(state.projectStats).toEqual({})
  })

  it('initializes warehouseStats to null', () => {
    const { state } = createTestSlice()
    expect(state.warehouseStats).toBeNull()
  })

  it('initializes selectedProjectID to null', () => {
    const { state } = createTestSlice()
    expect(state.selectedProjectID).toBeNull()
  })

  it('initializes dataLoading to false', () => {
    const { state } = createTestSlice()
    expect(state.dataLoading).toBe(false)
  })
})

describe('ProjectsSlice — setProjects', () => {
  it('updates projects list', () => {
    const { get, state } = createTestSlice()
    const projects = [{ id: '1', name: 'Project A' }] as unknown as Project[]
    state.setProjects(projects)
    expect(get().projects).toEqual(projects)
  })

  it('replaces previous projects list', () => {
    const { get, state } = createTestSlice()
    state.setProjects([{ id: '1', name: 'A' }] as unknown as Project[])
    state.setProjects([{ id: '2', name: 'B' }, { id: '3', name: 'C' }] as unknown as Project[])
    expect(get().projects).toHaveLength(2)
    expect(get().projects[0].id).toBe('2')
  })
})

describe('ProjectsSlice — simple setters', () => {
  it('setDataLoading updates dataLoading', () => {
    const { get, state } = createTestSlice()
    state.setDataLoading(true)
    expect(get().dataLoading).toBe(true)
  })

  it('setSelectedProjectID updates selectedProjectID', () => {
    const { get, state } = createTestSlice()
    state.setSelectedProjectID('project-123')
    expect(get().selectedProjectID).toBe('project-123')
  })

  it('setWarehouseStats updates warehouseStats', () => {
    const { get, state } = createTestSlice()
    const stats = { totalIssues: 10 } as any
    state.setWarehouseStats(stats)
    expect(get().warehouseStats).toEqual(stats)
  })
})
