import { useCallback, useEffect, useState } from 'react'
import { fetchAgentProviderKeys } from '@/lib/orchestra-client'
import type { BackendConfig } from '@/lib/orchestra-client'
import { type ChatProviderConfig, CHAT_PROVIDERS } from '../lib/types'

export function useProviderConfig(config: BackendConfig | null) {
  const [providerConfig, setProviderConfig] = useState<ChatProviderConfig>({
    providerId: 'openrouter',
    modelId: CHAT_PROVIDERS[0].models[0],
    apiKey: '',
  })
  const [availableKeys, setAvailableKeys] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

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
        const firstConfigured = CHAT_PROVIDERS.find(p => keys[p.id])
        if (firstConfigured) {
          setProviderConfig({
            providerId: firstConfigured.id,
            modelId: firstConfigured.models[0],
            apiKey: keys[firstConfigured.id],
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [config])

  const updateProvider = useCallback((providerId: ChatProviderConfig['providerId'], modelId?: string) => {
    const provider = CHAT_PROVIDERS.find(p => p.id === providerId)
    if (!provider) return
    setProviderConfig({
      providerId,
      modelId: modelId ?? provider.models[0],
      apiKey: availableKeys[providerId] ?? '',
    })
  }, [availableKeys])

  return { providerConfig, setProviderConfig, updateProvider, availableKeys, loading }
}
