/**
 * Browser slice — manages embedded browser tabs, navigation state, and active tab.
 */

import type { StateCreator } from 'zustand'
import type { AppState, BrowserSlice } from '../types'

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createBrowserSlice: StateCreator<AppState, [], [], BrowserSlice> = (set, get) => ({
  // ---- State ----------------------------------------------------------------
  browserTabs: [],
  activeBrowserTabId: null,

  // ---- Actions --------------------------------------------------------------
  openBrowserTab: (url?: string) => {
    const id = crypto.randomUUID()
    const newTab = {
      id,
      url: url || 'about:blank',
      title: 'New Tab',
      loading: false,
      canGoBack: false,
      canGoForward: false,
    }
    set((s) => ({
      browserTabs: [...s.browserTabs, newTab],
      activeBrowserTabId: id,
      activeWorkspaceTab: { type: 'browser' as const, id },
    }))
  },

  closeBrowserTab: (tabId: string) => {
    const { browserTabs, activeBrowserTabId } = get()
    const idx = browserTabs.findIndex((t) => t.id === tabId)
    if (idx === -1) return
    const next = browserTabs.filter((t) => t.id !== tabId)
    let nextActive = activeBrowserTabId
    if (activeBrowserTabId === tabId) {
      if (next.length === 0) {
        nextActive = null
      } else {
        const prevIdx = Math.max(0, idx - 1)
        nextActive = next[prevIdx].id
      }
    }
    set({ browserTabs: next, activeBrowserTabId: nextActive })
  },

  setActiveBrowserTab: (tabId: string) => set({ activeBrowserTabId: tabId }),

  updateBrowserTab: (tabId: string, updates: Partial<AppState['browserTabs'][number]>) =>
    set((s) => ({
      browserTabs: s.browserTabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
    })),
})
