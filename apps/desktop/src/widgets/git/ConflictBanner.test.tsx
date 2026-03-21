import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictBanner } from './ConflictBanner'

const defaultProps = {
  conflicts: { in_merge: true, files: ['src/index.ts', 'src/app.tsx'] },
  onResolve: vi.fn(),
  onAbort: vi.fn(),
}

describe('ConflictBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when in_merge is false', () => {
    const { container } = render(
      <ConflictBanner
        conflicts={{ in_merge: false, files: ['src/index.ts'] }}
        onResolve={vi.fn()}
        onAbort={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when files array is empty', () => {
    const { container } = render(
      <ConflictBanner
        conflicts={{ in_merge: true, files: [] }}
        onResolve={vi.fn()}
        onAbort={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows banner when in_merge with conflicts', () => {
    render(<ConflictBanner {...defaultProps} />)
    expect(screen.getByText(/Merge in progress/)).toBeTruthy()
  })

  it('lists conflicted file paths', () => {
    render(<ConflictBanner {...defaultProps} />)
    expect(screen.getByText('src/index.ts')).toBeTruthy()
    expect(screen.getByText('src/app.tsx')).toBeTruthy()
  })

  it('calls onResolve with file when "Mark Resolved" clicked', () => {
    const onResolve = vi.fn()
    render(<ConflictBanner {...defaultProps} onResolve={onResolve} />)
    const resolveButtons = screen.getAllByText('Mark Resolved')
    fireEvent.click(resolveButtons[0])
    expect(onResolve).toHaveBeenCalledWith('src/index.ts')
  })

  it('calls onAbort when "Abort Merge" clicked', () => {
    const onAbort = vi.fn()
    render(<ConflictBanner {...defaultProps} onAbort={onAbort} />)
    fireEvent.click(screen.getByText('Abort Merge'))
    expect(onAbort).toHaveBeenCalledOnce()
  })

  it('shows conflict count in header', () => {
    render(<ConflictBanner {...defaultProps} />)
    expect(screen.getByText(/2 conflicted files/)).toBeTruthy()
  })
})
