/**
 * Workspace slice — file explorer, sidebar dimensions, and panel state.
 */

import type { StateCreator } from 'zustand'
import type { AppState, WorkspaceSlice } from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEFT_SIDEBAR_MIN = 220
const LEFT_SIDEBAR_MAX = 500
const RIGHT_SIDEBAR_MIN = 280
const RIGHT_SIDEBAR_MAX = 500

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createWorkspaceSlice: StateCreator<AppState, [], [], WorkspaceSlice> = (set) => ({
  // ---- State ----------------------------------------------------------------
  explorerRoot: null,
  activeLeftPanel: 'explorer',
  leftSidebarWidth: 280,
  rightSidebarWidth: 320,
  rightSidebarOpen: true,

  // ---- Actions --------------------------------------------------------------
  setExplorerRoot: (root) => set({ explorerRoot: root }),

  setActiveLeftPanel: (panel) => set({ activeLeftPanel: panel }),

  setLeftSidebarWidth: (width) =>
    set({ leftSidebarWidth: clamp(width, LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_MAX) }),

  setRightSidebarWidth: (width) =>
    set({ rightSidebarWidth: clamp(width, RIGHT_SIDEBAR_MIN, RIGHT_SIDEBAR_MAX) }),

  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),

  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
})
