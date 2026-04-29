import type { UsageProvider } from '@/lib/orchestra-client'

export function providerLabel(provider: UsageProvider): string {
  switch (provider) {
    case 'claude':
      return 'Claude'
    case 'codex':
      return 'Codex'
    case 'gemini':
      return 'Gemini'
    case 'opencode':
      return 'OpenCode'
  }
}

export function providerInitial(provider: UsageProvider): string {
  switch (provider) {
    case 'claude':
      return 'C'
    case 'codex':
      return 'X'
    case 'gemini':
      return 'G'
    case 'opencode':
      return 'O'
  }
}

// Tailwind text color used for the provider's accent (chart segments + initials)
export function providerColor(provider: UsageProvider): string {
  switch (provider) {
    case 'claude':
      return 'text-orange-500'
    case 'codex':
      return 'text-emerald-500'
    case 'gemini':
      return 'text-blue-500'
    case 'opencode':
      return 'text-fuchsia-500'
  }
}

export function providerBg(provider: UsageProvider): string {
  switch (provider) {
    case 'claude':
      return 'bg-orange-500'
    case 'codex':
      return 'bg-emerald-500'
    case 'gemini':
      return 'bg-blue-500'
    case 'opencode':
      return 'bg-fuchsia-500'
  }
}

export function ProviderIcon({ provider, size = 12 }: { provider: UsageProvider; size?: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-bold ${providerColor(provider)}`}
      style={{ fontSize: `${size}px`, width: `${size + 2}px`, height: `${size + 2}px` }}
      aria-hidden
    >
      {providerInitial(provider)}
    </span>
  )
}
