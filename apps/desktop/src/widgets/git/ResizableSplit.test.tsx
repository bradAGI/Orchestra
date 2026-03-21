import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResizableSplit } from './ResizableSplit'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('ResizableSplit', () => {
  beforeEach(() => { localStorageMock.clear(); vi.clearAllMocks() })

  it('renders left and right children', () => {
    render(<ResizableSplit left={<div>Left Panel</div>} right={<div>Right Panel</div>} />)
    expect(screen.getByText('Left Panel')).toBeTruthy()
    expect(screen.getByText('Right Panel')).toBeTruthy()
  })

  it('renders the drag handle with separator role', () => {
    render(<ResizableSplit left={<div>Left</div>} right={<div>Right</div>} />)
    const handle = screen.getByRole('separator')
    expect(handle).toBeTruthy()
    expect(handle.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('applies default left width of 300px', () => {
    const { container } = render(
      <ResizableSplit left={<div>Left</div>} right={<div>Right</div>} />
    )
    const leftPanel = container.querySelector('[data-panel="left"]') as HTMLElement
    expect(leftPanel).toBeTruthy()
    expect(leftPanel.style.width).toBe('300px')
  })

  it('applies custom defaultLeftWidth', () => {
    const { container } = render(
      <ResizableSplit left={<div>Left</div>} right={<div>Right</div>} defaultLeftWidth={350} />
    )
    const leftPanel = container.querySelector('[data-panel="left"]') as HTMLElement
    expect(leftPanel.style.width).toBe('350px')
  })

  it('renders data-panel attributes on both panels', () => {
    const { container } = render(
      <ResizableSplit left={<div>Left</div>} right={<div>Right</div>} />
    )
    expect(container.querySelector('[data-panel="left"]')).toBeTruthy()
    expect(container.querySelector('[data-panel="right"]')).toBeTruthy()
  })

  it('reads initial width from localStorage', () => {
    localStorageMock.setItem('git-tab-split-width', '400')
    const { container } = render(
      <ResizableSplit left={<div>Left</div>} right={<div>Right</div>} />
    )
    const leftPanel = container.querySelector('[data-panel="left"]') as HTMLElement
    expect(leftPanel.style.width).toBe('400px')
  })

  it('uses custom storageKey for localStorage', () => {
    localStorageMock.setItem('my-custom-key', '420')
    const { container } = render(
      <ResizableSplit left={<div>Left</div>} right={<div>Right</div>} storageKey="my-custom-key" />
    )
    const leftPanel = container.querySelector('[data-panel="left"]') as HTMLElement
    expect(leftPanel.style.width).toBe('420px')
  })

  it('falls back to defaultLeftWidth when localStorage is empty', () => {
    const { container } = render(
      <ResizableSplit left={<div>Left</div>} right={<div>Right</div>} defaultLeftWidth={275} />
    )
    const leftPanel = container.querySelector('[data-panel="left"]') as HTMLElement
    expect(leftPanel.style.width).toBe('275px')
  })
})
