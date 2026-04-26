/**
 * Runtime slice — SSE snapshot, timeline, and connection state.
 */

import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { RuntimeSlice } from '../types'
import { applySnapshotUpdate, appendTimelineEvent } from '@/lib/runtime-store'

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createRuntimeSlice: StateCreator<AppState, [], [], RuntimeSlice> = (set, get) => ({
  // ---- State ----------------------------------------------------------------
  snapshot: null,
  timeline: [],
  loadingState: true,
  statusMessage: '',
  usePolling: false,
  refreshPending: false,

  // ---- Actions --------------------------------------------------------------
  setSnapshot: (snapshot) => set({ snapshot }),

  updateSnapshot: (partial) => {
    const current = get().snapshot
    const merged = current ? { ...current, ...partial } : (partial as Parameters<typeof applySnapshotUpdate>[1])
    const next = applySnapshotUpdate(current, merged as Parameters<typeof applySnapshotUpdate>[1])
    set({ snapshot: next })
  },

  addTimelineEvent: (event) => {
    const current = get().timeline
    const next = appendTimelineEvent(current, event)
    set({ timeline: next })
  },

  setLoadingState: (loading) => set({ loadingState: loading }),

  setStatusMessage: (message) => set({ statusMessage: message }),

  setUsePolling: (polling) => set({ usePolling: polling }),

  togglePolling: () => set((s) => ({ usePolling: !s.usePolling })),

  setRefreshPending: (pending) => set({ refreshPending: pending }),
})
