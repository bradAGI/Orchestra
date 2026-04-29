import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCcw, AlertTriangle } from 'lucide-react'
import {
  type BackendConfig,
  type UsageProvider,
  type ProviderRateLimits,
  type RateLimitState,
  type UsageScanState,
  fetchRateLimits,
  refreshRateLimits,
  fetchUsageScanState,
  fetchUsageSummary,
  type UsageSummary,
} from '@/lib/orchestra-client'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { providerInitial, providerLabel, providerColor, providerBg } from './provider-meta'
import { formatTokens, formatUSD } from './format'

const PROVIDERS: UsageProvider[] = ['claude', 'codex', 'gemini', 'opencode']
const POLL_MS = 5 * 60 * 1000   // 5 min — quota windows are slow-moving
const SUMMARY_MS = 90 * 1000    // 90s — usage summary refresh while page open
const FOCUS_MIN_MS = 30 * 1000  // refetch on focus if older than 30s

type ProviderSnapshot = {
  scan: UsageScanState | null
  summary: UsageSummary | null
}

export function UsageStatusBar({ config }: { config: BackendConfig | null }) {
  const [rateLimits, setRateLimits] = useState<RateLimitState | null>(null)
  const [snapshots, setSnapshots] = useState<Record<UsageProvider, ProviderSnapshot>>(() => ({
    claude: { scan: null, summary: null },
    codex: { scan: null, summary: null },
    gemini: { scan: null, summary: null },
    opencode: { scan: null, summary: null },
  }))
  const [refreshing, setRefreshing] = useState(false)
  const lastFetchRef = useRef(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  const compact = width < 900
  const iconOnly = width < 540

  // ResizeObserver to drive responsive collapses
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Aggregate fetch
  const loadAll = useCallback(
    async (force: boolean) => {
      if (!config) return
      lastFetchRef.current = Date.now()
      try {
        const [limits, claudeScan, codexScan, geminiScan, opencodeScan] = await Promise.all([
          force ? refreshRateLimits(config) : fetchRateLimits(config),
          fetchUsageScanState(config, 'claude'),
          fetchUsageScanState(config, 'codex'),
          fetchUsageScanState(config, 'gemini'),
          fetchUsageScanState(config, 'opencode'),
        ])
        setRateLimits(limits)
        const scans = { claude: claudeScan, codex: codexScan, gemini: geminiScan, opencode: opencodeScan }
        // Fetch summaries only for providers with data.
        const summaries = await Promise.all(
          PROVIDERS.map(async (p) => {
            if (!scans[p].enabled || !scans[p].has_any_data) return null
            try {
              return await fetchUsageSummary(config, p, 'all', '7d')
            } catch {
              return null
            }
          }),
        )
        setSnapshots({
          claude: { scan: claudeScan, summary: summaries[0] },
          codex: { scan: codexScan, summary: summaries[1] },
          gemini: { scan: geminiScan, summary: summaries[2] },
          opencode: { scan: opencodeScan, summary: summaries[3] },
        })
      } catch {
        // non-fatal
      }
    },
    [config],
  )

  // Initial + polled load
  useEffect(() => {
    if (!config) return
    void loadAll(false)
    const id = window.setInterval(() => void loadAll(false), Math.min(POLL_MS, SUMMARY_MS))
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

  const visibleProviders = useMemo(
    () =>
      PROVIDERS.filter((p) => {
        const snap = snapshots[p]
        // Show if enabled (gives an explicit "no data yet" state),
        // hide if not installed AND we've never enabled.
        return snap.scan?.enabled || (snap.scan?.source_path_exists ?? false)
      }),
    [snapshots],
  )

  if (!config) return null

  return (
    <div
      ref={containerRef}
      className="flex items-center h-7 min-h-[28px] px-3 gap-3 border-t border-border/40 bg-background/95 backdrop-blur text-xs select-none shrink-0 relative z-10"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {visibleProviders.length === 0 ? (
          <span className="text-[10.5px] text-muted-foreground/45">No agent usage tracked</span>
        ) : (
          visibleProviders.map((p) => (
            <ProviderSegment
              key={p}
              provider={p}
              snapshot={snapshots[p]}
              limits={rateLimits?.[p] ?? null}
              compact={compact}
              iconOnly={iconOnly}
            />
          ))
        )}
        <AppTooltip content="Refresh usage data">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground/65 hover:text-foreground hover:bg-foreground/[0.04] transition-colors disabled:opacity-40"
            aria-label="Refresh usage"
          >
            <RefreshCcw size={11} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </AppTooltip>
      </div>
      <div className="flex-1" />
    </div>
  )
}

function ProviderSegment({
  provider,
  snapshot,
  limits,
  compact,
  iconOnly,
}: {
  provider: UsageProvider
  snapshot: ProviderSnapshot
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

  const enabled = snapshot.scan?.enabled ?? false
  const hasError = limits?.status === 'error'
  const hasLimits = limits?.session || limits?.weekly
  const sessionPct = limits?.session?.used_percent
  const weeklyPct = limits?.weekly?.used_percent
  const summary = snapshot.summary

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 h-6 px-1.5 rounded transition-colors ${
          open ? 'bg-foreground/[0.06] text-foreground' : 'text-foreground/85 hover:bg-foreground/[0.04] hover:text-foreground'
        }`}
        aria-label={`Open ${providerLabel(provider)} usage details`}
      >
        <span className={`inline-flex items-center justify-center font-mono font-bold text-[10.5px] ${providerColor(provider)}`}>
          {providerInitial(provider)}
        </span>

        {!iconOnly && hasLimits && !compact && (
          <>
            <PercentBar pct={100 - (sessionPct ?? 0)} />
            <span className="text-[10.5px] tabular-nums font-medium">
              <SpanPct pct={sessionPct} suffix="" />
              {' · '}
              <SpanPct pct={weeklyPct} suffix="wk" />
            </span>
          </>
        )}

        {!iconOnly && !hasLimits && enabled && summary?.has_any_data && (
          <span className="text-[10.5px] tabular-nums font-medium text-muted-foreground/70">
            {formatUSD(summary.estimated_cost_usd ?? null)}
          </span>
        )}

        {!iconOnly && !enabled && (
          <span className="text-[10.5px] text-muted-foreground/45">off</span>
        )}

        {hasError && <AlertTriangle size={10} className="text-amber-500" />}
      </button>

      {open && (
        <DetailPopover
          provider={provider}
          snapshot={snapshot}
          limits={limits}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function PercentBar({ pct }: { pct: number }) {
  const safe = Math.max(0, Math.min(100, pct))
  const color =
    safe > 40 ? 'bg-emerald-500/70' : safe > 20 ? 'bg-amber-500/70' : 'bg-destructive/70'
  return (
    <span className="relative inline-block w-10 h-1.5 rounded-full bg-muted/60 overflow-hidden">
      <span className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${safe}%` }} />
    </span>
  )
}

function SpanPct({ pct, suffix }: { pct: number | undefined; suffix: string }) {
  if (pct === undefined) return <span className="text-muted-foreground/45">—</span>
  const remaining = Math.max(0, 100 - pct)
  const color = remaining > 40 ? 'text-emerald-500' : remaining > 20 ? 'text-amber-500' : 'text-destructive'
  return <span className={color}>{Math.round(remaining)}%{suffix && ` ${suffix}`}</span>
}

function DetailPopover({
  provider,
  snapshot,
  limits,
  onClose: _onClose,
}: {
  provider: UsageProvider
  snapshot: ProviderSnapshot
  limits: ProviderRateLimits | null
  onClose: () => void
}) {
  const summary = snapshot.summary
  const enabled = snapshot.scan?.enabled ?? false
  const sourceMissing = snapshot.scan && !snapshot.scan.source_path_exists

  return (
    <div className="absolute bottom-full left-0 mb-1.5 bg-popover border border-border/60 rounded-lg shadow-xl py-2.5 z-50 min-w-[280px]">
      <div className="px-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center w-4 h-4 font-mono font-bold text-[11px] ${providerColor(provider)}`}>
            {providerInitial(provider)}
          </span>
          <span className="text-[12.5px] font-semibold tracking-tight">{providerLabel(provider)}</span>
        </div>
        {limits && limits.updated_at > 0 && (
          <span className="text-[10px] text-muted-foreground/55 font-mono tabular-nums">
            {timeAgo(limits.updated_at)}
          </span>
        )}
      </div>

      <div className="h-px bg-border/40" />

      {!enabled && (
        <p className="px-3 py-3 text-[11.5px] text-muted-foreground/60">
          Tracking disabled. Toggle on from the Usage page.
        </p>
      )}

      {enabled && sourceMissing && (
        <p className="px-3 py-3 text-[11.5px] text-muted-foreground/60">
          No CLI logs at <span className="font-mono">{snapshot.scan?.source_path}</span>
        </p>
      )}

      {enabled && !sourceMissing && (
        <div className="px-3 pt-2 pb-1 space-y-2.5">
          {summary && summary.has_any_data ? (
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">7d cost</div>
                <div className="text-[14px] font-black tabular-nums mt-0.5">{formatUSD(summary.estimated_cost_usd ?? null)}</div>
              </div>
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Tokens</div>
                <div className="text-[14px] font-black tabular-nums mt-0.5">{formatTokens(summary.total_tokens)}</div>
              </div>
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Sessions</div>
                <div className="text-[14px] font-black tabular-nums mt-0.5">{summary.sessions}</div>
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] text-muted-foreground/55">No usage in last 7 days.</p>
          )}
        </div>
      )}

      {limits && (limits.session || limits.weekly) && (
        <>
          <div className="h-px bg-border/40 my-1.5" />
          <div className="px-3 space-y-2">
            {limits.session && (
              <RateLimitRow label="Session" pct={limits.session.used_percent} reset={limits.session.reset_description} />
            )}
            {limits.weekly && (
              <RateLimitRow label="Weekly" pct={limits.weekly.used_percent} reset={limits.weekly.reset_description} />
            )}
          </div>
        </>
      )}

      {limits?.error && (
        <div className="px-3 mt-2 text-[10.5px] text-destructive flex items-start gap-1.5">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          {limits.error}
        </div>
      )}

      {summary && summary.top_model && (
        <>
          <div className="h-px bg-border/40 my-1.5" />
          <div className="px-3 pb-1 grid grid-cols-2 gap-3 text-[10.5px]">
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/55">Top model</div>
              <div className="font-mono text-foreground/90 truncate mt-0.5">{summary.top_model}</div>
            </div>
            {summary.top_project && (
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/55">Top project</div>
                <div className="font-mono text-foreground/90 truncate mt-0.5">{summary.top_project}</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RateLimitRow({ label, pct, reset }: { label: string; pct: number; reset: string | null | undefined }) {
  const remaining = Math.max(0, 100 - pct)
  const color =
    remaining > 40 ? 'bg-emerald-500/70' : remaining > 20 ? 'bg-amber-500/70' : 'bg-destructive/70'
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10.5px]">
        <span className="text-muted-foreground/70">{label}</span>
        <span className="tabular-nums font-medium text-foreground/90">{Math.round(remaining)}% left</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <span className={`block h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      {reset && <div className="mt-0.5 text-[9.5px] text-muted-foreground/45">{reset}</div>}
    </div>
  )
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 0) return 'now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Make providerBg tree-shakeable by referencing it in unused export form.
// (It's used by other files; keep import live.)
export const _kept = providerBg
