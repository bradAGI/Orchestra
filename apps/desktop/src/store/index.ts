/**
 * Root Zustand store — composes all 9 domain slices into a single store.
 *
 * Slice implementations are created in Tasks 2-5. Until then this file
 * will not compile, which is expected.
 */

import { create } from 'zustand'

import type { AppState } from './types'
import { createUISlice } from './slices/ui'
import { createRuntimeSlice } from './slices/runtime'
import { createIssuesSlice } from './slices/issues'
import { createProjectsSlice } from './slices/projects'
import { createAgentsSlice } from './slices/agents'
import { createSettingsSlice } from './slices/settings'
import { createTerminalsSlice } from './slices/terminals'
import { createWorkspaceSlice } from './slices/workspace'
import { createEditorSlice } from './slices/editor'
import { createBrowserSlice } from './slices/browser'
import { createThemeSlice } from './slices/theme-slice'

export const useAppStore = create<AppState>()((...a) => ({
  ...createUISlice(...a),
  ...createRuntimeSlice(...a),
  ...createIssuesSlice(...a),
  ...createProjectsSlice(...a),
  ...createAgentsSlice(...a),
  ...createSettingsSlice(...a),
  ...createTerminalsSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createEditorSlice(...a),
  ...createBrowserSlice(...a),
  ...createThemeSlice(...a),
}))

/**
 * Reset the store to its initial state.
 * Useful in tests to prevent state leaking between test cases.
 */
export function resetAppStore(): void {
  const initial = useAppStore.getInitialState()
  useAppStore.setState(initial, true)
}

export type { AppState } from './types'
