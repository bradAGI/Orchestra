/**
 * Terminals slice — open terminal sessions.
 */

import type { StateCreator } from 'zustand'
import type { AppState, TerminalsSlice } from '../types'

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createTerminalsSlice: StateCreator<AppState, [], [], TerminalsSlice> = (set) => ({
  // ---- State ----------------------------------------------------------------
  openTerminals: [],

  // ---- Actions --------------------------------------------------------------
  setOpenTerminals: (terminals) => set({ openTerminals: terminals }),
})
