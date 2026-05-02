import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CommitBar } from './CommitBar'

describe('CommitBar', () => {
  const defaultProps = {
    stagedCount: 3,
    onCommit: vi.fn(),
    onPush: vi.fn(),
  }

  it('renders commit message input', () => {
    render(<CommitBar {...defaultProps} />)
    const input = screen.getByPlaceholderText('Summary')
    expect(input).toBeTruthy()
  })

  it('disables commit when no staged files', () => {
    render(<CommitBar {...defaultProps} stagedCount={0} />)
    const btn = screen.getByRole('button', { name: /commit/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables commit when message is empty', () => {
    render(<CommitBar {...defaultProps} stagedCount={3} />)
    const btn = screen.getByRole('button', { name: /commit/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables commit when message and staged files present', async () => {
    const user = userEvent.setup()
    render(<CommitBar {...defaultProps} stagedCount={2} />)
    const input = screen.getByPlaceholderText('Summary')
    await user.type(input, 'fix: something')
    const btn = screen.getByRole('button', { name: /commit/i })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('calls onCommit with message when clicked', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<CommitBar {...defaultProps} onCommit={onCommit} stagedCount={2} />)
    const input = screen.getByPlaceholderText('Summary')
    await user.type(input, 'feat: new thing')
    const btn = screen.getByRole('button', { name: /commit/i })
    await user.click(btn)
    expect(onCommit).toHaveBeenCalledWith('feat: new thing')
  })

  it('clears input after commit', async () => {
    const user = userEvent.setup()
    render(<CommitBar {...defaultProps} stagedCount={2} />)
    const input = screen.getByPlaceholderText('Summary') as HTMLInputElement
    await user.type(input, 'feat: new thing')
    const btn = screen.getByRole('button', { name: /commit/i })
    await user.click(btn)
    expect(input.value).toBe('')
  })

  it('shows character count', async () => {
    const user = userEvent.setup()
    render(<CommitBar {...defaultProps} />)
    const input = screen.getByPlaceholderText('Summary')
    await user.type(input, 'hello')
    expect(screen.getByText('5/72')).toBeTruthy()
  })

  it('commits on Ctrl+Enter', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<CommitBar {...defaultProps} onCommit={onCommit} stagedCount={2} />)
    const input = screen.getByPlaceholderText('Summary')
    await user.type(input, 'fix: bug')
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onCommit).toHaveBeenCalledWith('fix: bug')
  })

  it('shows push button when aheadCount > 0', () => {
    render(<CommitBar {...defaultProps} aheadCount={3} />)
    const pushBtn = screen.getByRole('button', { name: /push/i })
    expect(pushBtn).toBeTruthy()
    expect(pushBtn.textContent).toContain('3')
  })

  it('hides push button when aheadCount is 0', () => {
    render(<CommitBar {...defaultProps} aheadCount={0} />)
    expect(screen.queryByRole('button', { name: /push/i })).toBeFalsy()
  })
})
