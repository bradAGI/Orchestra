import { useCallback, useEffect, useState } from 'react'
import { fetchAgentProviderKeys } from '@/lib/orchestra-client'
import type { BackendConfig } from '@/lib/orchestra-client'
import { type ChatProviderConfig, CHAT_PROVIDERS } from '../lib/types'
import { fetchProviderModels, type ModelInfo } from '../lib/providers'

export function useProviderConfig(config: BackendConfig | null) {
  const [providerConfig, setProviderConfig] = useState<ChatProviderConfig>({
    providerId: 'openrouter',
    modelId: '',
    apiKey: '',
  })
  const [availableKeys, setAvailableKeys] = useState<Record<string, string>>({})
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchCount, setFetchCount] = useState(0)

  // Fetch keys on mount AND whenever fetchCount bumps
  useEffect(() => {
    if (!config) return
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    fetchAgentProviderKeys(config)
      .then((result) => {
        const keys: Record<string, string> = {}
        for (const [id, info] of Object.entries(result.providers)) {
          if (info.configured && info.api_key) {
            keys[id] = info.api_key
          }
        }
        setAvailableKeys(keys)

        // Auto-select first configured provider
        const firstConfigured = CHAT_PROVIDERS.find(p => keys[p.id])
        if (firstConfigured) {
          setProviderConfig(prev => ({
            providerId: firstConfigured.id,
            modelId: prev.modelId || '',
            apiKey: keys[firstConfigured.id],
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [config, fetchCount])

  // Fetch models when provider or key changes
  useEffect(() => {
    const key = availableKeys[providerConfig.providerId]
    if (!key) {
      setModels([])
      return
    }

    let cancelled = false
    setModelsLoading(true)
    fetchProviderModels(providerConfig.providerId, key)
      .then((fetched) => {
        if (cancelled) return
        setModels(fetched)
        if (!providerConfig.modelId && fetched.length > 0) {
          setProviderConfig(prev => ({ ...prev, modelId: fetched[0].id }))
        }
      })
      .catch(() => {
        if (!cancelled) setModels([])
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerConfig.providerId, availableKeys])

  const updateProvider = useCallback((providerId: ChatProviderConfig['providerId'], modelId?: string) => {
    setProviderConfig({
      providerId,
      modelId: modelId ?? '',
      apiKey: availableKeys[providerId] ?? '',
    })
  }, [availableKeys])

  // Call this to re-fetch keys from the backend (e.g. after settings change)
  const refetchKeys = useCallback(() => {
    setFetchCount(c => c + 1)
  }, [])

  return { providerConfig, setProviderConfig, updateProvider, availableKeys, models, modelsLoading, loading, refetchKeys }
}
