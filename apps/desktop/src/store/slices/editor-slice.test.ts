import { describe, it, expect } from 'vitest'
import { createEditorSlice, detectLanguage } from './editor-slice'
import type { AppState } from '../types'

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createEditorSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorSlice', () => {
  it('initializes with empty state', () => {
    const { get } = createTestSlice()
    expect(get().openFiles).toEqual([])
    expect(get().activeFileId).toBeNull()
  })

  it('openFile creates entry and sets active', () => {
    const { get } = createTestSlice()
    get().openFile('/tmp/foo.ts', 'foo.ts')
    expect(get().openFiles).toHaveLength(1)
    expect(get().openFiles[0].filePath).toBe('/tmp/foo.ts')
    expect(get().openFiles[0].language).toBe('typescript')
    expect(get().openFiles[0].content).toBeNull()
    expect(get().activeFileId).toBe('/tmp/foo.ts')
  })

  it('openFile same path activates existing instead of duplicating', () => {
    const { get } = createTestSlice()
    get().openFile('/tmp/foo.ts', 'foo.ts')
    get().openFile('/tmp/bar.ts', 'bar.ts')
    expect(get().openFiles).toHaveLength(2)
    expect(get().activeFileId).toBe('/tmp/bar.ts')

    get().openFile('/tmp/foo.ts', 'foo.ts')
    expect(get().openFiles).toHaveLength(2)
    expect(get().activeFileId).toBe('/tmp/foo.ts')
  })

  it('closeFile removes and activates previous', () => {
    const { get } = createTestSlice()
    get().openFile('/tmp/a.ts', 'a.ts')
    get().openFile('/tmp/b.ts', 'b.ts')
    get().openFile('/tmp/c.ts', 'c.ts')
    expect(get().activeFileId).toBe('/tmp/c.ts')

    get().closeFile('/tmp/c.ts')
    expect(get().openFiles).toHaveLength(2)
    expect(get().activeFileId).toBe('/tmp/b.ts')
  })

  it('closeFile first tab activates next', () => {
    const { get } = createTestSlice()
    get().openFile('/tmp/a.ts', 'a.ts')
    get().openFile('/tmp/b.ts', 'b.ts')
    get().setActiveFile('/tmp/a.ts')

    get().closeFile('/tmp/a.ts')
    expect(get().openFiles).toHaveLength(1)
    expect(get().activeFileId).toBe('/tmp/b.ts')
  })

  it('closeFile last tab sets active to null', () => {
    const { get } = createTestSlice()
    get().openFile('/tmp/a.ts', 'a.ts')
    get().closeFile('/tmp/a.ts')
    expect(get().openFiles).toHaveLength(0)
    expect(get().activeFileId).toBeNull()
  })

  it('setFileDirty updates flag', () => {
    const { get } = createTestSlice()
    get().openFile('/tmp/foo.ts', 'foo.ts')
    expect(get().openFiles[0].isDirty).toBe(false)
    get().setFileDirty('/tmp/foo.ts', true)
    expect(get().openFiles[0].isDirty).toBe(true)
  })

  it('setFileContent updates content', () => {
    const { get } = createTestSlice()
    get().openFile('/tmp/foo.ts', 'foo.ts')
    get().setFileContent('/tmp/foo.ts', 'hello world')
    expect(get().openFiles[0].content).toBe('hello world')
  })
})

describe('detectLanguage', () => {
  it('detects common extensions', () => {
    expect(detectLanguage('foo.ts')).toBe('typescript')
    expect(detectLanguage('foo.tsx')).toBe('typescript')
    expect(detectLanguage('foo.js')).toBe('javascript')
    expect(detectLanguage('foo.go')).toBe('go')
    expect(detectLanguage('foo.py')).toBe('python')
    expect(detectLanguage('foo.yml')).toBe('yaml')
    expect(detectLanguage('foo.svg')).toBe('xml')
  })

  it('returns plaintext for unknown extensions', () => {
    expect(detectLanguage('foo.xyz')).toBe('plaintext')
    expect(detectLanguage('noext')).toBe('plaintext')
  })
})
