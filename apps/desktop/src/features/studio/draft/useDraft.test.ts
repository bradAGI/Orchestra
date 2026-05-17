import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDraft } from './useDraft'
import type { StudioDraft } from '@core/api/client'

const empty: StudioDraft = {
  session_id: 'sess1',
  title: '',
  description: '',
  acceptance_criteria: [],
  attachments: [],
  suggested_provider: '',
  suggested_model: '',
  template_vars: {},
  agent_guidance: {},
}

describe('useDraft', () => {
  it('starts null when no initial value', () => {
    const { result } = renderHook(() => useDraft('sess1'))
    expect(result.current.draft).toBeNull()
  })

  it('applies a server snapshot', () => {
    const { result } = renderHook(() => useDraft('sess1'))
    act(() => result.current.applyServerSnapshot(empty))
    expect(result.current.draft).toEqual(empty)
  })

  it('setLocal merges into the current draft', () => {
    const { result } = renderHook(() => useDraft('sess1'))
    act(() => result.current.applyServerSnapshot(empty))
    act(() => result.current.setLocal({ title: 'Optimistic' }))
    expect(result.current.draft?.title).toBe('Optimistic')
  })

  it('setLocal is a no-op before a snapshot lands', () => {
    const { result } = renderHook(() => useDraft('sess1'))
    act(() => result.current.setLocal({ title: 'X' }))
    expect(result.current.draft).toBeNull()
  })

  it('server snapshot replaces optimistic edits', () => {
    const { result } = renderHook(() => useDraft('sess1'))
    act(() => result.current.applyServerSnapshot(empty))
    act(() => result.current.setLocal({ title: 'Optimistic' }))
    act(() => result.current.applyServerSnapshot({ ...empty, title: 'Server' }))
    expect(result.current.draft?.title).toBe('Server')
  })
})
