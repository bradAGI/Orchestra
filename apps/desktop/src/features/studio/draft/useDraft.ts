import { useCallback, useState } from 'react'
import type { StudioDraft } from '@core/api/client'

export interface UseDraftResult {
  draft: StudioDraft | null
  applyServerSnapshot: (snap: StudioDraft) => void
  setLocal: (patch: Partial<StudioDraft>) => void
}

export function useDraft(_sessionId: string): UseDraftResult {
  const [draft, setDraft] = useState<StudioDraft | null>(null)

  const applyServerSnapshot = useCallback((snap: StudioDraft) => {
    setDraft(snap)
  }, [])

  const setLocal = useCallback((patch: Partial<StudioDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }, [])

  return { draft, applyServerSnapshot, setLocal }
}
