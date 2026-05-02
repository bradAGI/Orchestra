/**
 * Agents slice — agent configuration, available agents, and tool registry.
 */

import type { StateCreator } from 'zustand'
import type { AppState, AgentsSlice } from '../types'

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createAgentsSlice: StateCreator<AppState, [], [], AgentsSlice> = (set) => ({
  // ---- State ----------------------------------------------------------------
  agentConfig: null,
  availableAgents: [],
  allTools: [],

  // ---- Actions --------------------------------------------------------------
  setAgentConfig: (config) => set({ agentConfig: config }),
  setAvailableAgents: (agents) => set({ availableAgents: agents }),
  setAllTools: (tools) => set({ allTools: tools }),
})
