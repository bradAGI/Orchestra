import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  type BackendConfig,
  type UsageProvider,
  type ProviderRateLimits,
  type RateLimitState,
  fetchRateLimits,
  refreshRateLimits,
} from '@/lib/orchestra-client'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { providerLabel, ProviderIcon } from './provider-meta'
import {
  MiniBar,
  WindowSection,
  remainingPct,
  textColor,
  timeAgo,
  windowLabel,
} from './rate-limit-ui'

// Orca's status bar tracks only the providers that actually have plan windows.
// Gemini and OpenCode have no comparable rate-limit concept, so they don't
// belong in the bar — they're still tracked on the Usage page for token data.
const BAR_PROVIDERS: UsageProvider[] = ['claude', 'codex']
const POLL_MS = 5 * 60 * 1000     // 5 min — quota windows are slow-moving
const FOCUS_MIN_MS = 30 * 1000    // refetch on focus if older than 30s

export function UsageStatusBar({ config }: { config: BackendConfig | null }) {
  const [rateLimits, setRateLimits] = useState<RateLimitState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const lastFetchRef = useRef(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  const compact = width < 900
  const iconOnly = width < 540

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const loadAll = useCallback(
    async (force: boolean) => {
      if (!config) return
      lastFetchRef.current = Date.now()
      try {
        const limits = force ? await refreshRateLimits(config) : await fetchRateLimits(config)
        setRateLimits(limits)
      } catch {
        // non-fatal
      }
    },
    [config],
  )

  useEffect(() => {
    if (!config) return
    void loadAll(false)
    const id = window.setInterval(() => void loadAll(false), POLL_MS)
    const onFocus = () => {
      if (Date.now() - lastFetchRef.current > FOCUS_MIN_MS) void loadAll(false)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [config, loadAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadAll(true)
    } finally {
      setRefreshing(false)
    }
  }, [loadAll])

  const anyFetching = BAR_PROVIDERS.some((p) => rateLimits?.[p]?.status === 'fetching')

  if (!config) return null

  return (
    <div
      ref={containerRef}
      className="flex items-center h-6 min-h-[24px] px-3 gap-4 border-t border-border bg-[var(--bg-titlebar,var(--card))] text-xs select-none shrink-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        {BAR_PROVIDERS.map((p) => (
          <ProviderSegment
            key={p}
            provider={p}
            limits={rateLimits?.[p] ?? null}
            compact={compact}
            iconOnly={iconOnly}
          />
        ))}
        <AppTooltip content="Refresh usage data">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
            aria-label="Refresh rate limits"
          >
            <RefreshCw size={11} className={refreshing || anyFetching ? 'animate-spin' : ''} />
          </button>
        </AppTooltip>
      </div>
      <div className="flex-1" />
    </div>
  )
}

function ProviderSegment({
  provider,
  limits,
  compact,
  iconOnly,
}: {
  provider: UsageProvider
  limits: ProviderRateLimits | null
  compact: boolean
  iconOnly: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 h-6 px-1.5 rounded transition-colors ${
          open ? 'bg-muted text-foreground' : 'hover:bg-muted text-foreground/85 hover:text-foreground'
        }`}
        aria-label={`Open ${providerLabel(provider)} usage details`}
      >
        <SegmentBody limits={limits} provider={provider} compact={compact} iconOnly={iconOnly} />
      </button>
      {open && <DetailPopover provider={provider} limits={limits} />}
    </div>
  )
}

function SegmentBody({
  provider,
  limits,
  compact,
  iconOnly,
}: {
  provider: UsageProvider
  limits: ProviderRateLimits | null
  compact: boolean
  iconOnly: boolean
}) {
  // Idle / loading — no data yet
  if (!limits || limits.status === 'idle') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <ProviderIcon provider={provider} size={12} />
        <span className="animate-pulse">···</span>
      </span>
    )
  }

  // Fetching with no prior data
  if (limits.status === 'fetching' && !limits.session && !limits.weekly) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <ProviderIcon provider={provider} size={12} />
        <span className="animate-pulse">···</span>
      </span>
    )
  }

  // Unavailable (no plan / CLI not installed)
  if (limits.status === 'unavailable') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/60">
        <ProviderIcon provider={provider} size={12} />
        {!iconOnly && <span>--</span>}
      </span>
    )
  }

  // Error with no data
  if (limits.status === 'error' && !limits.session && !limits.weekly) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <ProviderIcon provider={provider} size={12} />
        <AlertTriangle size={11} className="text-yellow-500" />
        {!iconOnly && <span className="text-[11px] font-medium">Limited</span>}
      </span>
    )
  }

  // Ok / fetching-with-stale / error-with-stale: show real data.
  const sessionLeft = limits.session ? remainingPct(limits.session) : null
  const weeklyLeft = limits.weekly ? remainingPct(limits.weekly) : null
  const stale = limits.status === 'error'

  return (
    <span className="inline-flex items-center gap-1.5">
      <ProviderIcon provider={provider} size={12} />
      {limits.session && !compact && !iconOnly && <MiniBar leftPct={sessionLeft ?? 0} />}
      {!iconOnly && limits.session && (
        <span className={`text-[11px] tabular-nums font-medium ${textColor(sessionLeft ?? 0)}`}>
          {sessionLeft}% {windowLabel(limits.session)}
        </span>
      )}
      {!iconOnly && limits.session && limits.weekly && (
        <span className="text-muted-foreground/60">·</span>
      )}
      {!iconOnly && limits.weekly && (
        <span className={`text-[11px] tabular-nums font-medium ${textColor(weeklyLeft ?? 0)}`}>
          {weeklyLeft}% {windowLabel(limits.weekly)}
        </span>
      )}
      {stale && <AlertTriangle size={11} className="text-muted-foreground/80" />}
    </span>
  )
}

function DetailPopover({
  provider,
  limits,
}: {
  provider: UsageProvider
  limits: ProviderRateLimits | null
}) {
  return (
    <div className="absolute bottom-full left-0 mb-1.5 z-50 w-[280px] rounded-lg border border-border/60 bg-popover shadow-xl">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ProviderIcon provider={provider} size={14} />
          <span className="text-[13px] font-medium text-foreground">{providerLabel(provider)}</span>
        </div>
        {limits && limits.updated_at > 0 && (
          <span className="text-[10.5px] tabular-nums text-muted-foreground">
            {timeAgo(limits.updated_at)}
          </span>
        )}
      </div>

      <div className="h-px bg-border/60" />

      <div className="space-y-3 px-3 py-3">
        {!limits || limits.status === 'idle' || limits.status === 'fetching' ? (
          <p className="text-[12px] text-muted-foreground">Loading rate limits…</p>
        ) : limits.status === 'unavailable' ? (
          <p className="text-[12px] text-muted-foreground">
            {limits.error ?? `Rate limits unavailable for ${providerLabel(provider)}.`}
          </p>
        ) : limits.status === 'error' && !limits.session && !limits.weekly ? (
          <p className="text-[12px] text-muted-foreground">
            {limits.error ?? 'Unable to fetch rate limits.'}
          </p>
        ) : (
          <>
            {limits.session && <WindowSection w={limits.session} label="Session (5h)" />}
            {limits.weekly && <WindowSection w={limits.weekly} label="Weekly" />}
            {limits.status === 'error' && (limits.session || limits.weekly) && (
              <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <AlertTriangle size={10} className="shrink-0 text-muted-foreground/70" />
                <span>Showing cached data — auto-refresh paused</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

