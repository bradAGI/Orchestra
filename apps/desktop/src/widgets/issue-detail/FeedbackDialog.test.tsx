import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FeedbackDialog } from './FeedbackDialog'

function getSubmitButton() {
  return screen.getByRole('button', { name: /send to re-execute/i })
}

describe('FeedbackDialog', () => {
  it('renders textarea with placeholder', () => {
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText('What needs to change?')).toBeTruthy()
  })

  it('renders Cancel and Submit buttons', () => {
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Cancel')).toBeTruthy()
    expect(getSubmitButton()).toBeTruthy()
  })

  it('disables Submit when feedback is empty', () => {
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    const btn = getSubmitButton()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables Submit when feedback has text', async () => {
    const user = userEvent.setup()
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('What needs to change?'), 'Fix the tests')
    const btn = getSubmitButton()
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('calls onSubmit with feedback text and default target state (In Progress)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<FeedbackDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('What needs to change?'), 'Fix the tests')
    await user.click(getSubmitButton())
    expect(onSubmit).toHaveBeenCalledWith('Fix the tests', 'In Progress')
  })

  it('calls onSubmit with Todo target state when Re-plan is selected', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<FeedbackDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('What needs to change?'), 'Rethink approach')
    await user.click(screen.getByText('Re-plan'))
    await user.click(screen.getByRole('button', { name: /send to re-plan/i }))
    expect(onSubmit).toHaveBeenCalledWith('Rethink approach', 'Todo')
  })

  it('changes submit button text based on selected action', async () => {
    const user = userEvent.setup()
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send to re-execute/i })).toBeTruthy()
    await user.click(screen.getByText('Re-plan'))
    expect(screen.getByRole('button', { name: /send to re-plan/i })).toBeTruthy()
  })

  it('calls onCancel when Cancel clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<FeedbackDialog onSubmit={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
