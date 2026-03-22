import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FeedbackDialog } from './FeedbackDialog'

function getRejectButton() {
  return screen.getByRole('button', { name: /reject/i })
}

describe('FeedbackDialog', () => {
  it('renders textarea with placeholder', () => {
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText('What needs to change?')).toBeTruthy()
  })

  it('renders Cancel and Submit buttons', () => {
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Cancel')).toBeTruthy()
    expect(getRejectButton()).toBeTruthy()
  })

  it('disables Submit when feedback is empty', () => {
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    const btn = getRejectButton()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables Submit when feedback has text', async () => {
    const user = userEvent.setup()
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('What needs to change?'), 'Fix the tests')
    const btn = getRejectButton()
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('calls onSubmit with feedback text', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<FeedbackDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('What needs to change?'), 'Fix the tests')
    await user.click(getRejectButton())
    expect(onSubmit).toHaveBeenCalledWith('Fix the tests')
  })

  it('calls onCancel when Cancel clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
