import { CustomDropdown } from '@/components/app-shell/shared/controls'
import { CHAT_PROVIDERS, type ChatProviderConfig } from '../lib/types'

interface ProviderSelectorProps {
  config: ChatProviderConfig
  availableKeys: Record<string, string>
  onUpdate: (providerId: ChatProviderConfig['providerId'], modelId?: string) => void
}

export function ProviderSelector({ config, availableKeys, onUpdate }: ProviderSelectorProps) {
  const currentProvider = CHAT_PROVIDERS.find((p) => p.id === config.providerId)
  const models = currentProvider?.models ?? []

  const providerOptions = CHAT_PROVIDERS.map((p) => ({
    label: availableKeys[p.id] ? p.label : `${p.label} (no key)`,
    value: p.id,
  }))

  const modelOptions = models.map((m) => ({
    label: m,
    value: m,
  }))

  return (
    <div className="flex items-center gap-1.5">
      <CustomDropdown
        value={config.providerId}
        options={providerOptions}
        onChange={(v) => onUpdate(v as ChatProviderConfig['providerId'])}
        className="min-w-[90px]"
      />
      <CustomDropdown
        value={config.modelId}
        options={modelOptions}
        onChange={(v) => onUpdate(config.providerId, v as string)}
        className="min-w-[100px]"
      />
    </div>
  )
}
