import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DiffViewer } from './DiffViewer'

afterEach(cleanup)

const sampleDiff = `--- a/src/app.tsx
+++ b/src/app.tsx
@@ -1,4 +1,5 @@
 import React from 'react';
-import { old } from './old';
+import { new } from './new';
+import { extra } from './extra';

 function App() {`

function renderViewer(overrides: Partial<Parameters<typeof DiffViewer>[0]> = {}) {
  const defaults = {
    filePath: 'src/app.tsx',
    diff: sampleDiff,
    mode: 'unified' as const,
    onModeChange: vi.fn(),
  }
  const props = { ...defaults, ...overrides }
  return { ...render(<DiffViewer {...props} />), onModeChange: props.onModeChange }
}

describe('DiffViewer', () => {
  // -----------------------------------------------------------------------
  // Empty states
  // -----------------------------------------------------------------------

  it('renders empty state when filePath is null', () => {
    renderViewer({ filePath: null })
    expect(screen.queryByText('Select a file to view its diff')).toBeTruthy()
  })

  it('renders empty state when diff is null', () => {
    renderViewer({ diff: null })
    expect(screen.queryByText('Select a file to view its diff')).toBeTruthy()
  })

  // -----------------------------------------------------------------------
  // Header
  // -----------------------------------------------------------------------

  it('renders file path in header when provided', () => {
    renderViewer({ filePath: 'src/app.tsx' })
    expect(screen.queryByText('src/app.tsx')).toBeTruthy()
  })

  it('renders unified/split toggle', () => {
    renderViewer()
    expect(screen.queryByText('Split')).toBeTruthy()
    expect(screen.queryByText('Unified')).toBeTruthy()
  })

  it('calls onModeChange when toggle clicked', () => {
    const { onModeChange } = renderViewer({ mode: 'unified' })
    fireEvent.click(screen.getByText('Split'))
    expect(onModeChange).toHaveBeenCalledWith('split')
  })

  // -----------------------------------------------------------------------
  // Diff rendering
  // -----------------------------------------------------------------------

  it('renders addition lines with green styling', () => {
    const { container } = renderViewer({ mode: 'unified' })
    // Find rows with addition content
    const addRows = container.querySelectorAll('tr.bg-emerald-500\\/10')
    expect(addRows.length).toBeGreaterThan(0)
    // Check that one of the additions contains our expected text
    const addTexts = Array.from(addRows).map((r) => r.textContent)
    expect(addTexts.some((t) => t?.includes("import { new } from './new'"))).toBe(true)
  })

  it('renders deletion lines with red styling', () => {
    const { container } = renderViewer({ mode: 'unified' })
    const delRows = container.querySelectorAll('tr.bg-red-500\\/10')
    expect(delRows.length).toBeGreaterThan(0)
    const delTexts = Array.from(delRows).map((r) => r.textContent)
    expect(delTexts.some((t) => t?.includes("import { old } from './old'"))).toBe(true)
  })

  it('renders hunk header', () => {
    renderViewer({ mode: 'unified' })
    expect(screen.queryByText(/@@ -1,4 \+1,5 @@/)).toBeTruthy()
  })
})
