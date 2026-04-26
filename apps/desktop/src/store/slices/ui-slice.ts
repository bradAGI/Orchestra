/**
 * UI slice — navigation, theme, modals, and palette state.
 */

import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { UISlice } from '../types'

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------

function getInitialTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('orchestra-theme')
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    // localStorage or matchMedia not available (e.g. in tests)
  }
  return 'dark'
}

function applyTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem('orchestra-theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  } catch {
    // DOM not available (e.g. in tests)
  }
}

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) => ({
  // ---- State ----------------------------------------------------------------
  activeSection: 'ISSUES',
  sidebarCollapsed: false,
  theme: getInitialTheme(),
  activePeriod: 'Week',
  paletteOpen: false,
  inspectDialogOpen: false,
  sessionInspectDialogOpen: false,
  createTaskDialogOpen: false,
  createTaskInitialState: null,
  createProjectDialogOpen: false,
  settingsInitialTab: undefined,

  // ---- Actions --------------------------------------------------------------
  setActiveSection: (section) => set({ activeSection: section }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },

  setActivePeriod: (period) => set({ activePeriod: period }),

  setPaletteOpen: (open) => set({ paletteOpen: open }),

  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  setInspectDialogOpen: (open) => set({ inspectDialogOpen: open }),

  setSessionInspectDialogOpen: (open) => set({ sessionInspectDialogOpen: open }),

  openCreateTaskDialog: (initialState?) =>
    set({ createTaskDialogOpen: true, createTaskInitialState: initialState ?? null }),

  closeCreateTaskDialog: () =>
    set({ createTaskDialogOpen: false, createTaskInitialState: null }),

  setCreateProjectDialogOpen: (open) => set({ createProjectDialogOpen: open }),

  setSettingsInitialTab: (tab) => set({ settingsInitialTab: tab }),
})
