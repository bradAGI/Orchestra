/**
 * Editor slice — manages open file tabs, active file, and dirty state.
 */

import type { StateCreator } from 'zustand'
import type { AppState, EditorSlice, OpenFile } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    go: 'go',
    py: 'python',
    rs: 'rust',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql',
    graphql: 'graphql',
    dockerfile: 'dockerfile',
    xml: 'xml',
    svg: 'xml',
  }
  return map[ext] ?? 'plaintext'
}

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createEditorSlice: StateCreator<AppState, [], [], EditorSlice> = (set, get) => ({
  // ---- State ----------------------------------------------------------------
  openFiles: [],
  activeFileId: null,

  // ---- Actions --------------------------------------------------------------
  openFile: (filePath: string, relativePath: string) => {
    const { openFiles } = get()
    const existing = openFiles.find((f) => f.filePath === filePath)
    if (existing) {
      set({ activeFileId: existing.id, activeWorkspaceTab: { type: 'editor', id: existing.id } })
      return
    }
    const newFile: OpenFile = {
      id: filePath,
      filePath,
      relativePath,
      language: detectLanguage(filePath),
      isDirty: false,
      content: null,
    }
    set({ openFiles: [...openFiles, newFile], activeFileId: newFile.id, activeWorkspaceTab: { type: 'editor', id: newFile.id } })
  },

  closeFile: (fileId: string) => {
    const { openFiles, activeFileId } = get()
    const idx = openFiles.findIndex((f) => f.id === fileId)
    if (idx === -1) return
    const next = openFiles.filter((f) => f.id !== fileId)
    let nextActive = activeFileId
    if (activeFileId === fileId) {
      if (next.length === 0) {
        nextActive = null
      } else {
        // Activate the previous tab, or the first if closing the first
        const prevIdx = Math.max(0, idx - 1)
        nextActive = next[prevIdx].id
      }
    }
    set({ openFiles: next, activeFileId: nextActive })
  },

  setActiveFile: (fileId: string) => set({ activeFileId: fileId }),

  setFileDirty: (fileId: string, isDirty: boolean) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) => (f.id === fileId ? { ...f, isDirty } : f)),
    })),

  setFileContent: (fileId: string, content: string) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) => (f.id === fileId ? { ...f, content } : f)),
    })),
})
