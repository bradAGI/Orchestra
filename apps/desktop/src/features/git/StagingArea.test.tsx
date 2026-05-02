import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { GitStatusEntry } from '@core/api/client'
import { StagingArea } from './StagingArea'

const unstaged: GitStatusEntry[] = [
  { path: 'src/app.tsx', status: 'M' },
  { path: 'src/new.ts', status: '?' },
  { path: 'src/deleted.ts', status: 'D' },
]
const staged: GitStatusEntry[] = [
  { path: 'README.md', status: 'M' },
]

function renderArea(overrides: Partial<Parameters<typeof StagingArea>[0]> = {}) {
  const props = {
    unstaged,
    staged,
    selectedFile: null as string | null,
    onFileSelect: vi.fn(),
    onStage: vi.fn(),
    onUnstage: vi.fn(),
    onStageAll: vi.fn(),
    onUnstageAll: vi.fn(),
    ...overrides,
  }
  const result = render(<StagingArea {...props} />)
  return { ...result, props }
}

describe('StagingArea', () => {
  it('renders unstaged file count', () => {
    renderArea()
    const badge = screen.getByTestId('unstaged-count')
    expect(badge.textContent).toContain('3')
  })

  it('renders staged file count', () => {
    renderArea()
    const badge = screen.getByTestId('staged-count')
    expect(badge.textContent).toContain('1')
  })

  it('renders file paths', () => {
    const { container } = renderArea()
    expect(container.querySelector('[data-file-path="src/app.tsx"]')).toBeTruthy()
    expect(container.querySelector('[data-file-path="src/new.ts"]')).toBeTruthy()
    expect(container.querySelector('[data-file-path="src/deleted.ts"]')).toBeTruthy()
    expect(container.querySelector('[data-file-path="README.md"]')).toBeTruthy()
  })

  it('renders status badges (M, ?, D)', () => {
    renderArea()
    // M appears twice (unstaged + staged), ? once, D once
    const badges = screen.getAllByTestId('status-badge')
    const texts = badges.map((b) => b.textContent)
    expect(texts).toContain('M')
    expect(texts).toContain('?')
    expect(texts).toContain('D')
  })

  it('calls onFileSelect(path, false) when clicking unstaged file', () => {
    const { props } = renderArea()
    const row = screen.getByTestId('file-row-unstaged-src/app.tsx')
    fireEvent.click(row)
    expect(props.onFileSelect).toHaveBeenCalledWith('src/app.tsx', false)
  })

  it('calls onFileSelect(path, true) when clicking staged file', () => {
    const { props } = renderArea()
    const row = screen.getByTestId('file-row-staged-README.md')
    fireEvent.click(row)
    expect(props.onFileSelect).toHaveBeenCalledWith('README.md', true)
  })

  it('calls onStageAll when "Stage All" clicked', () => {
    const { props } = renderArea()
    const btn = screen.getByRole('button', { name: /^stage all/i })
    fireEvent.click(btn)
    expect(props.onStageAll).toHaveBeenCalled()
  })

  it('calls onUnstageAll when "Unstage All" clicked', () => {
    const { props } = renderArea()
    const btn = screen.getByRole('button', { name: /unstage all/i })
    fireEvent.click(btn)
    expect(props.onUnstageAll).toHaveBeenCalled()
  })

  it('highlights selected file (data-selected="true")', () => {
    renderArea({ selectedFile: 'src/app.tsx' })
    const row = screen.getByTestId('file-row-unstaged-src/app.tsx')
    expect(row.getAttribute('data-selected')).toBe('true')
    // Other rows should not be selected
    const otherRow = screen.getByTestId('file-row-unstaged-src/new.ts')
    expect(otherRow.getAttribute('data-selected')).not.toBe('true')
  })

  it('shows strikethrough for deleted files', () => {
    renderArea()
    const row = screen.getByTestId('file-row-unstaged-src/deleted.ts')
    const pathEl = row.querySelector('[data-file-path]')
    expect(pathEl).toBeTruthy()
    expect(pathEl!.className).toContain('line-through')
  })
})
