import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CommitTimeline } from './CommitTimeline'

const commits = [
  { hash: 'abc1234def5678', message: 'feat: add login page', author: 'Alice Smith', date: '2026-03-20T10:00:00Z' },
  { hash: 'def5678abc1234', message: 'fix: resolve crash on startup', author: 'Bob Jones', date: '2026-03-19T08:00:00Z' },
  { hash: '1111222233334444', message: 'chore: update deps', author: 'Carol Ng', date: '2026-03-18T12:00:00Z' },
]

const defaultProps = {
  commits,
  selectedHash: null as string | null,
  onSelectCommit: vi.fn(),
}

describe('CommitTimeline', () => {
  it('renders commit messages', () => {
    render(<CommitTimeline {...defaultProps} />)
    expect(screen.getByText('feat: add login page')).toBeTruthy()
    expect(screen.getByText('fix: resolve crash on startup')).toBeTruthy()
    expect(screen.getByText('chore: update deps')).toBeTruthy()
  })

  it('renders short hashes (7 chars)', () => {
    render(<CommitTimeline {...defaultProps} />)
    expect(screen.getByText('abc1234')).toBeTruthy()
    expect(screen.getByText('def5678')).toBeTruthy()
    expect(screen.getByText('1111222')).toBeTruthy()
  })

  it('renders author names', () => {
    render(<CommitTimeline {...defaultProps} />)
    expect(screen.getByText(/Alice Smith/)).toBeTruthy()
    expect(screen.getByText(/Bob Jones/)).toBeTruthy()
    expect(screen.getByText(/Carol Ng/)).toBeTruthy()
  })

  it('highlights selected commit', () => {
    const { container } = render(
      <CommitTimeline {...defaultProps} selectedHash="abc1234def5678" />,
    )
    const selected = container.querySelector('[data-selected="true"]')
    expect(selected).toBeTruthy()
    expect(selected!.textContent).toContain('feat: add login page')
  })

  it('calls onSelectCommit when clicked', async () => {
    const onSelectCommit = vi.fn()
    render(<CommitTimeline {...defaultProps} onSelectCommit={onSelectCommit} />)
    const btn = screen.getByText('feat: add login page')
    fireEvent.click(btn.closest('button')!)
    expect(onSelectCommit).toHaveBeenCalledWith('abc1234def5678')
  })

  it('filters by search text', async () => {
    const user = userEvent.setup()
    render(<CommitTimeline {...defaultProps} />)
    const input = screen.getByPlaceholderText('Search commits…')
    await user.type(input, 'login')
    expect(screen.getByText('feat: add login page')).toBeTruthy()
    expect(screen.queryByText('fix: resolve crash on startup')).toBeFalsy()
    expect(screen.queryByText('chore: update deps')).toBeFalsy()
  })

  it('shows "No commits" when empty', () => {
    render(<CommitTimeline commits={[]} selectedHash={null} onSelectCommit={vi.fn()} />)
    expect(screen.getByText('No commits')).toBeTruthy()
  })

  it('renders timeline dots for each commit', () => {
    const { container } = render(<CommitTimeline {...defaultProps} />)
    const dots = container.querySelectorAll('[data-testid="timeline-dot"]')
    expect(dots.length).toBe(3)
  })
})
