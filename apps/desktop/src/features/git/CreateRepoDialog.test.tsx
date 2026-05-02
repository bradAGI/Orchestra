import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateRepoDialog } from './CreateRepoDialog'

afterEach(() => {
  cleanup()
})

function renderDialog(overrides?: {
  projectName?: string
  onCancel?: () => void
  onCreate?: (opts: { name: string; description: string; private: boolean }) => Promise<void>
}) {
  const onCancel = overrides?.onCancel ?? vi.fn()
  const onCreate = overrides?.onCreate ?? vi.fn(async () => {})

  render(
    <CreateRepoDialog
      projectName={overrides?.projectName ?? 'My Cool Project'}
      onCancel={onCancel}
      onCreate={onCreate}
    />,
  )

  return { onCancel, onCreate }
}

describe('CreateRepoDialog', () => {
  it('renders name input with sanitized project name', () => {
    renderDialog({ projectName: 'My Cool Project' })

    const input = screen.getByDisplayValue('my-cool-project') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('my-cool-project')
  })

  it('renders description textarea', () => {
    renderDialog()

    const textarea = screen.getByPlaceholderText('Optional')
    expect(textarea).toBeTruthy()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('renders Private/Public toggle with Private selected by default', () => {
    renderDialog()

    const privateBtn = screen.getByText('Private')
    const publicBtn = screen.getByText('Public')

    expect(privateBtn).toBeTruthy()
    expect(publicBtn).toBeTruthy()
    // Private should be visually selected (has ring-primary styling)
    expect(privateBtn.closest('button')!.className).toContain('ring-primary')
    expect(publicBtn.closest('button')!.className).not.toContain('ring-primary')
  })

  it('disables Create button when name is empty', async () => {
    renderDialog()

    const input = screen.getByDisplayValue('my-cool-project') as HTMLInputElement
    await userEvent.clear(input)

    const createBtn = screen.getByText('Create repository') as HTMLButtonElement
    expect(createBtn.disabled).toBe(true)
  })

  it('enables Create button when name has value', () => {
    renderDialog()

    const createBtn = screen.getByText('Create repository') as HTMLButtonElement
    expect(createBtn.disabled).toBe(false)
  })

  it('calls onCreate with correct options', async () => {
    const onCreate = vi.fn(async () => {})
    renderDialog({ onCreate })

    const input = screen.getByDisplayValue('my-cool-project') as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, 'new-repo')

    const desc = screen.getByPlaceholderText('Optional') as HTMLTextAreaElement
    await userEvent.type(desc, 'A test repo')

    // Switch to public
    const publicBtn = screen.getByText('Public')
    fireEvent.click(publicBtn)

    const createBtn = screen.getByText('Create repository')
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: 'new-repo',
        description: 'A test repo',
        private: false,
      })
    })
  })

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })

    const cancelBtn = screen.getByText('Cancel')
    fireEvent.click(cancelBtn)

    expect(onCancel).toHaveBeenCalled()
  })

  it('shows loading state with Creating... button text', async () => {
    // onCreate that never resolves to keep loading state
    const onCreate = vi.fn(() => new Promise<void>(() => {}))
    renderDialog({ onCreate })

    const createBtn = screen.getByText('Create repository')
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(screen.getByText('Creating…')).toBeTruthy()
    })
  })
})
