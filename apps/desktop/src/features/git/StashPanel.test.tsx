import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StashPanel } from './StashPanel'

const stashes = [
  { ref: 'stash@{0}', message: 'WIP on main: fix tests' },
  { ref: 'stash@{1}', message: 'WIP on feature: add button' },
]

const defaultProps = {
  stashes,
  onStash: vi.fn(),
  onApply: vi.fn(),
  onDrop: vi.fn(),
  onClose: vi.fn(),
}

describe('StashPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders stash entries with messages', () => {
    render(<StashPanel {...defaultProps} />)
    expect(screen.getByText('WIP on main: fix tests')).toBeTruthy()
    expect(screen.getByText('WIP on feature: add button')).toBeTruthy()
  })

  it('shows "No stashes" when empty', () => {
    render(<StashPanel {...defaultProps} stashes={[]} />)
    expect(screen.getByText('No stashes')).toBeTruthy()
  })

  it('calls onApply with ref when Apply clicked', () => {
    const onApply = vi.fn()
    render(<StashPanel {...defaultProps} onApply={onApply} />)
    const applyButtons = screen.getAllByText('Apply')
    fireEvent.click(applyButtons[0])
    expect(onApply).toHaveBeenCalledWith('stash@{0}')
  })

  it('calls onDrop with ref when Drop clicked', () => {
    const onDrop = vi.fn()
    render(<StashPanel {...defaultProps} onDrop={onDrop} />)
    const dropButtons = screen.getAllByText('Drop')
    fireEvent.click(dropButtons[1])
    expect(onDrop).toHaveBeenCalledWith('stash@{1}')
  })

  it('calls onStash when "Stash Changes" clicked', () => {
    const onStash = vi.fn()
    render(<StashPanel {...defaultProps} onStash={onStash} />)
    fireEvent.click(screen.getByText('Stash changes'))
    expect(onStash).toHaveBeenCalled()
  })

  it('shows ref for each entry', () => {
    render(<StashPanel {...defaultProps} />)
    expect(screen.getByText('stash@{0}')).toBeTruthy()
    expect(screen.getByText('stash@{1}')).toBeTruthy()
  })
})
