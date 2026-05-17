import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AcceptanceCriteria } from './AcceptanceCriteria'
import type { StudioDraft } from '@core/api/client'

const baseDraft: StudioDraft = {
  session_id: 's',
  title: '',
  description: '',
  acceptance_criteria: ['a', 'b'],
  attachments: [],
  suggested_provider: '',
  suggested_model: '',
  template_vars: {},
  agent_guidance: {},
}

describe('AcceptanceCriteria', () => {
  it('adds on Enter', () => {
    const onChange = vi.fn()
    render(<AcceptanceCriteria draft={baseDraft} onChange={onChange} />)
    const input = screen.getByPlaceholderText('Add criterion…')
    fireEvent.change(input, { target: { value: 'c' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith({ acceptance_criteria: ['a', 'b', 'c'] })
  })

  it('ignores empty input', () => {
    const onChange = vi.fn()
    render(<AcceptanceCriteria draft={baseDraft} onChange={onChange} />)
    const input = screen.getByPlaceholderText('Add criterion…')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes by index', () => {
    const onChange = vi.fn()
    render(<AcceptanceCriteria draft={baseDraft} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Remove criterion 1'))
    expect(onChange).toHaveBeenCalledWith({ acceptance_criteria: ['b'] })
  })
})
