/**
 * Workspace slice — file explorer, sidebar dimensions, and panel state.
 */

import type { StateCreator } from 'zustand'
import type { AppState, WorkspaceSlice, TreeNode } from '../types'

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
  leftSidebarOpen: true,
  leftSidebarWidth: 280,
  rightSidebarWidth: 320,
  rightSidebarOpen: true,
  expandedDirs: new Set<string>(),
  dirCache: {},
  gitStatusMap: {},
  searchQuery: '',
  searchResults: [],
  searchLoading: false,

  // ---- Actions --------------------------------------------------------------
  setExplorerRoot: (root) => set({ explorerRoot: root }),

  setActiveLeftPanel: (panel) => set({ activeLeftPanel: panel }),

  setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),

  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),

  setLeftSidebarWidth: (width) =>
    set({ leftSidebarWidth: clamp(width, LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_MAX) }),

  setRightSidebarWidth: (width) =>
    set({ rightSidebarWidth: clamp(width, RIGHT_SIDEBAR_MIN, RIGHT_SIDEBAR_MAX) }),

  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),

  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),

  toggleDir: (dirPath: string) =>
    set((s) => {
      const next = new Set(s.expandedDirs)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
      }
      return { expandedDirs: next }
    }),

  setDirChildren: (dirPath: string, children: TreeNode[]) =>
    set((s) => ({
      dirCache: { ...s.dirCache, [dirPath]: { children, loading: false } },
    })),

  setDirLoading: (dirPath: string, loading: boolean) =>
    set((s) => {
      const existing = s.dirCache[dirPath]
      return {
        dirCache: {
          ...s.dirCache,
          [dirPath]: { children: existing?.children ?? [], loading },
        },
      }
    }),

  setGitStatusMap: (statusMap: Record<string, string>) =>
    set({ gitStatusMap: statusMap }),

  clearExplorerCache: () =>
    set({ expandedDirs: new Set<string>(), dirCache: {}, gitStatusMap: {} }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),
})
