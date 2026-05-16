import { useCallback, useEffect, useState } from 'react'
import {
  createStudioTemplate,
  deleteStudioTemplate,
  listStudioTemplates,
  updateStudioTemplate,
  type BackendConfig,
  type StudioTemplate,
} from '@core/api/client'

export interface UseTemplatesResult {
  templates: StudioTemplate[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  save: (name: string, content: string) => Promise<void>
  remove: (name: string) => Promise<void>
}

export function useTemplates(config: BackendConfig): UseTemplatesResult {
  const [templates, setTemplates] = useState<StudioTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listStudioTemplates(config)
      setTemplates(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [config])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (name: string, content: string) => {
      try {
        await createStudioTemplate(config, name, content)
      } catch {
        await updateStudioTemplate(config, name, content)
      }
      await refresh()
    },
    [config, refresh],
  )

  const remove = useCallback(
    async (name: string) => {
      await deleteStudioTemplate(config, name)
      await refresh()
    },
    [config, refresh],
  )

  return { templates, loading, error, refresh, save, remove }
}
