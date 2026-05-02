import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type BackendConfig,
  type UsageProvider,
  type UsageScope,
  type UsageRange,
  type UsageScanState,
  type UsageSummary,
  type UsageDailyPoint,
  type UsageBreakdownRow,
  type UsageSessionRow,
  type RateLimitState,
  fetchUsageScanState,
  setUsageEnabled,
  refreshUsage,
  fetchUsageSummary,
  fetchUsageDaily,
  fetchUsageBreakdown,
  fetchUsageSessions,
  fetchRateLimits,
  refreshRateLimits,
} from '@/lib/orchestra-client'

export const USAGE_PROVIDERS: UsageProvider[] = ['claude', 'codex', 'gemini', 'opencode']

export type ProviderUsageBundle = {
  provider: UsageProvider
  scanState: UsageScanState | null
  summary: UsageSummary | null
  daily: UsageDailyPoint[]
  modelBreakdown: UsageBreakdownRow[]
  projectBreakdown: UsageBreakdownRow[]
  sessions: UsageSessionRow[]
  loading: boolean
  error: string | null
}

export type UsageState = {
  scope: UsageScope
  range: UsageRange
  setScope: (scope: UsageScope) => void
  setRange: (range: UsageRange) => void
  bundles: Record<UsageProvider, ProviderUsageBundle>
  rateLimits: RateLimitState | null
  refreshAll: (force?: boolean) => Promise<void>
  refreshProvider: (provider: UsageProvider, force?: boolean) => Promise<void>
  toggleProvider: (provider: UsageProvider, enabled: boolean) => Promise<void>
}

const emptyBundle = (provider: UsageProvider): ProviderUsageBundle => ({
  provider,
  scanState: null,
  summary: null,
  daily: [],
  modelBreakdown: [],
  projectBreakdown: [],
  sessions: [],
  loading: false,
  error: null,
})

export function useUsage(config: BackendConfig | null): UsageState {
  const [scope, setScope] = useState<UsageScope>('all')
  const [range, setRange] = useState<UsageRange>('30d')
  const [rateLimits, setRateLimits] = useState<RateLimitState | null>(null)
  const [bundles, setBundles] = useState<Record<UsageProvider, ProviderUsageBundle>>(() => ({
    claude: emptyBundle('claude'),
    codex: emptyBundle('codex'),
    gemini: emptyBundle('gemini'),
    opencode: emptyBundle('opencode'),
  }))

  // Per-provider request token. Each call increments the token; stale resolutions
  // (from a prior scope/range) compare against the current token and bail.
  const requestToken = useRef<Record<UsageProvider, number>>({
    claude: 0, codex: 0, gemini: 0, opencode: 0,
  })

  const loadProvider = useCallback(
    async (provider: UsageProvider, force = false): Promise<void> => {
      if (!config) return
      const token = ++requestToken.current[provider]
      const isFresh = () => requestToken.current[provider] === token
      setBundles((b) => ({ ...b, [provider]: { ...b[provider], loading: true, error: null } }))
      try {
        const scanState = await fetchUsageScanState(config, provider)
        if (!isFresh()) return
        let next = scanState
        if (scanState.enabled && (force || !scanState.last_scan_completed_at)) {
          next = await refreshUsage(config, provider, force)
          if (!isFresh()) return
        }
        if (!next.enabled || !next.has_any_data) {
          setBundles((b) => ({
            ...b,
            [provider]: {
              ...emptyBundle(provider),
              scanState: next,
            },
          }))
          return
        }
        const [summary, daily, modelBreakdown, projectBreakdown, sessions] = await Promise.all([
          fetchUsageSummary(config, provider, scope, range),
          fetchUsageDaily(config, provider, scope, range),
          fetchUsageBreakdown(config, provider, scope, range, 'model'),
          fetchUsageBreakdown(config, provider, scope, range, 'project'),
          fetchUsageSessions(config, provider, scope, range, 25),
        ])
        if (!isFresh()) return
        setBundles((b) => ({
          ...b,
          [provider]: {
            provider,
            scanState: next,
            summary,
            daily,
            modelBreakdown,
            projectBreakdown,
            sessions,
            loading: false,
            error: null,
          },
        }))
      } catch (err) {
        if (!isFresh()) return
        setBundles((b) => ({
          ...b,
          [provider]: {
            ...b[provider],
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load usage',
          },
        }))
      }
    },
    [config, scope, range],
  )

  const loadAll = useCallback(
    async (force = false) => {
      if (!config) return
      try {
        const limits = await fetchRateLimits(config)
        setRateLimits(limits)
      } catch {
        // non-fatal
      }
      await Promise.all(USAGE_PROVIDERS.map((p) => loadProvider(p, force)))
    },
    [config, loadProvider],
  )

  // Reload when config / scope / range changes.
  useEffect(() => {
    void loadAll(false)
  }, [loadAll])

  const toggleProvider = useCallback(
    async (provider: UsageProvider, enabled: boolean) => {
      if (!config) return
      try {
        const next = await setUsageEnabled(config, provider, enabled)
        setBundles((b) => ({
          ...b,
          [provider]: { ...b[provider], scanState: next },
        }))
        if (enabled) {
          await loadProvider(provider, true)
        }
      } catch (err) {
        setBundles((b) => ({
          ...b,
          [provider]: {
            ...b[provider],
            error: err instanceof Error ? err.message : 'Failed to toggle provider',
          },
        }))
      }
    },
    [config, loadProvider],
  )

  const refreshAll = useCallback(
    async (force = true) => {
      if (!config) return
      try {
        const limits = await refreshRateLimits(config)
        setRateLimits(limits)
      } catch {
        // non-fatal
      }
      await Promise.all(USAGE_PROVIDERS.map((p) => loadProvider(p, force)))
    },
    [config, loadProvider],
  )

  return useMemo<UsageState>(
    () => ({
      scope,
      range,
      setScope,
      setRange,
      bundles,
      rateLimits,
      refreshAll,
      refreshProvider: loadProvider,
      toggleProvider,
    }),
    [scope, range, bundles, rateLimits, refreshAll, loadProvider, toggleProvider],
  )
}
