/**
 * Projects slice — project list, stats, and selection state.
 */

import type { StateCreator } from 'zustand'
import type { AppState, ProjectsSlice } from '../types'

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createProjectsSlice: StateCreator<AppState, [], [], ProjectsSlice> = (set) => ({
  // ---- State ----------------------------------------------------------------
  projects: [],
  projectStats: {},
  warehouseStats: null,
  selectedProjectID: null,
  dataLoading: false,

  // ---- Actions --------------------------------------------------------------
  setProjects: (projects) => set({ projects }),
  setProjectStats: (stats) => set({ projectStats: stats }),
  setWarehouseStats: (stats) => set({ warehouseStats: stats }),
  setSelectedProjectID: (id) => set({ selectedProjectID: id }),
  setDataLoading: (loading) => set({ dataLoading: loading }),
})
