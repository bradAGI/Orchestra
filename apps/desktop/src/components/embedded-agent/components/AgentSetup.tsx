import { useState } from 'react'
import { Check, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { CustomDropdown } from '@/components/app-shell/shared/controls'
import { CHAT_PROVIDERS, type ChatProviderConfig } from '../lib/types'

interface AgentSetupProps {
  providerConfig: ChatProviderConfig
  availableKeys: Record<string, string>
  backendBaseUrl: string
  onUpdateProvider: (providerId: ChatProviderConfig['providerId'], modelId?: string) => void
}

export function AgentSetup({ providerConfig, availableKeys, backendBaseUrl, onUpdateProvider }: AgentSetupProps) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')

  const currentProvider = CHAT_PROVIDERS.find(p => p.id === providerConfig.providerId)
  const hasKey = !!availableKeys[providerConfig.providerId]

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    setMessage('')
    try {
      const { saveAgentProviderKey } = await import('@/lib/orchestra-client')
      await saveAgentProviderKey({ baseUrl: backendBaseUrl, apiToken: '' }, providerConfig.providerId, apiKey.trim())
      setApiKey('')
      setMessage('Key saved — reload to activate.')
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!hasKey) return
    setTesting(true)
    setMessage('')
    try {
      const { createProvider } = await import('../lib/providers')
      const { generateText } = await import('ai')
      const provider = createProvider(providerConfig.providerId, availableKeys[providerConfig.providerId])
      await generateText({
        model: provider(providerConfig.modelId),
        prompt: 'Say "ok" and nothing else.',
      })
      setMessage('Connection verified.')
    } catch (err) {
      setMessage(`Test failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Provider */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Provider</label>
        <CustomDropdown
          className="w-full"
          value={providerConfig.providerId}
          options={CHAT_PROVIDERS.map(p => ({
            label: `${p.label}${availableKeys[p.id] ? ' (active)' : ''}`,
            value: p.id,
          }))}
          onChange={(v) => onUpdateProvider(v as ChatProviderConfig['providerId'])}
        />
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</label>
        <CustomDropdown
          className="w-full"
          value={providerConfig.modelId}
          options={(currentProvider?.models ?? []).map(m => ({ label: m, value: m }))}
          onChange={(v) => onUpdateProvider(providerConfig.providerId, v as string)}
        />
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          API Key
          {hasKey && <span className="ml-2 text-emerald-500">Active</span>}
        </label>
        {!hasKey ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={providerConfig.providerId === 'openrouter' ? 'sk-or-...' : providerConfig.providerId === 'claude' ? 'sk-ant-...' : 'sk-...'}
                disabled={saving}
                className="w-full rounded-lg bg-muted/10 px-3 pr-8 py-2 text-sm font-mono placeholder:text-muted-foreground/30 focus:bg-muted/20 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : <Check className="h-3 w-3" />}
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex-1 rounded-lg bg-muted/10 px-3 py-2 text-sm font-mono text-muted-foreground/40">
              {'*'.repeat(24)}
            </span>
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-50 transition-colors"
            >
              {testing ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : <ShieldCheck className="h-3 w-3" />}
              Test
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {message && (
        <p className={`text-[11px] font-medium ${message.includes('Failed') || message.includes('failed') ? 'text-red-500' : 'text-emerald-500'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
