/**
 * Settings slice — backend config, profiles, and loading state.
 */

import type { StateCreator } from 'zustand'
import type { AppState, SettingsSlice } from '../types'

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
  // ---- State ----------------------------------------------------------------
  config: null,
  loadingConfig: true,
  backendProfiles: null,
  activeProfileId: null,

  // ---- Actions --------------------------------------------------------------
  setConfig: (config) => set({ config }),
  setLoadingConfig: (loading) => set({ loadingConfig: loading }),
  setBackendProfiles: (profiles) => set({ backendProfiles: profiles }),
  setActiveProfileId: (id) => set({ activeProfileId: id }),
})
