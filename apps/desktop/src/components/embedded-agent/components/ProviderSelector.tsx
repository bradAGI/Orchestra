import { CHAT_PROVIDERS, type ChatProviderConfig } from '../lib/types'

interface ProviderSelectorProps {
  config: ChatProviderConfig
  availableKeys: Record<string, string>
  onUpdate: (providerId: ChatProviderConfig['providerId'], modelId?: string) => void
}

export function ProviderSelector({ config, availableKeys, onUpdate }: ProviderSelectorProps) {
  const currentProvider = CHAT_PROVIDERS.find((p) => p.id === config.providerId)
  const models = currentProvider?.models ?? []

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={config.providerId}
        onChange={(e) =>
          onUpdate(e.target.value as ChatProviderConfig['providerId'])
        }
        className="h-7 rounded border border-border/50 bg-background px-1.5 text-[10px] outline-none focus:border-primary/50"
      >
        {CHAT_PROVIDERS.map((p) => {
          const hasKey = !!availableKeys[p.id]
          return (
            <option key={p.id} value={p.id} disabled={!hasKey}>
              {p.label}{!hasKey ? ' (no key)' : ''}
            </option>
          )
        })}
      </select>

      <select
        value={config.modelId}
        onChange={(e) => onUpdate(config.providerId, e.target.value)}
        className="h-7 min-w-0 flex-1 truncate rounded border border-border/50 bg-background px-1.5 text-[10px] outline-none focus:border-primary/50"
      >
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
