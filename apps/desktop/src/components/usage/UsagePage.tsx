import { useMemo } from 'react'
import { RefreshCcw, Power, AlertTriangle } from 'lucide-react'
import type { BackendConfig, UsageProvider, UsageScope, UsageRange } from '@/lib/orchestra-client'
import { useUsage, USAGE_PROVIDERS, type ProviderUsageBundle } from './useUsage'
import { ProviderIcon, providerLabel } from './provider-meta'
import { DailyStackedChart } from './DailyStackedChart'
import { BreakdownTable } from './BreakdownTable'
import { SessionList } from './SessionList'
import { formatNumber, formatTokens, formatUSD, formatPercent } from './format'

export function UsagePage({ config }: { config: BackendConfig | null }) {
  const usage = useUsage(config)
  const { scope, range, setScope, setRange, bundles, refreshAll, refreshProvider, toggleProvider } = usage

  const aggregate = useMemo(() => combineSummaries(bundles), [bundles])

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="min-h-full px-10 py-12">
        <div className="w-full max-w-3xl mx-auto space-y-12">
          {/* Hero */}
          <header className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">Usage</p>
              <div className="flex items-center gap-2">
                <ScopeChips scope={scope} onChange={setScope} />
                <RangeChips range={range} onChange={setRange} />
                <button
                  onClick={() => void refreshAll(true)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                  title="Refresh"
                >
                  <RefreshCcw size={12} />
                </button>
              </div>
            </div>
            <h1 className="text-4xl font-black tracking-tight">{formatUSD(aggregate.cost)}</h1>
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px] text-muted-foreground/80 tabular-nums">
              <span><span className="text-foreground/90 font-medium">{formatTokens(aggregate.tokens)}</span> tokens</span>
              <span><span className="text-foreground/90 font-medium">{formatNumber(aggregate.sessions)}</span> sessions</span>
              <span><span className="text-foreground/90 font-medium">{formatNumber(aggregate.turns)}</span> turns</span>
              {aggregate.cacheReuse !== null && (
                <span><span className="text-foreground/90 font-medium">{formatPercent(aggregate.cacheReuse)}</span> cache reuse</span>
              )}
            </div>
          </header>

          {/* Daily activity, all providers stacked */}
          <section className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55 px-1">Daily activity</p>
            <DailyStackedChart bundles={bundles} />
          </section>

          {/* Per-provider sections */}
          <section className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55 px-1">Agents · {USAGE_PROVIDERS.length}</p>
            <div className="-mx-2 space-y-1">
              {USAGE_PROVIDERS.map((p) => (
                <ProviderRow
                  key={p}
                  bundle={bundles[p]}
                  onRefresh={() => void refreshProvider(p, true)}
                  onToggle={(enabled) => void toggleProvider(p, enabled)}
                />
              ))}
            </div>
          </section>

          {/* Models — combined across providers */}
          <ModelsSection bundles={bundles} />

          {/* Sessions — combined */}
          <SessionsSection bundles={bundles} />
        </div>
      </div>
    </div>
  )
}

function combineSummaries(bundles: Record<UsageProvider, ProviderUsageBundle>) {
  let cost = 0
  let costKnown = false
  let tokens = 0
  let sessions = 0
  let turns = 0
  let cacheReadTotal = 0
  let inputTotal = 0
  for (const b of Object.values(bundles)) {
    if (!b.summary) continue
    if (typeof b.summary.estimated_cost_usd === 'number') {
      cost += b.summary.estimated_cost_usd
      costKnown = true
    }
    tokens += b.summary.total_tokens
    sessions += b.summary.sessions
    turns += b.summary.turns
    cacheReadTotal += b.summary.cache_read_tokens
    inputTotal += b.summary.input_tokens
  }
  let cacheReuse: number | null = null
  if (cacheReadTotal + inputTotal > 0) {
    cacheReuse = cacheReadTotal / (cacheReadTotal + inputTotal)
  }
  return {
    cost: costKnown ? cost : null,
    tokens,
    sessions,
    turns,
    cacheReuse,
  }
}

function ScopeChips({ scope, onChange }: { scope: UsageScope; onChange: (s: UsageScope) => void }) {
  const items: { id: UsageScope; label: string; tooltip: string }[] = [
    { id: 'all', label: 'All', tooltip: 'All local CLI usage' },
    { id: 'orchestra', label: 'Project', tooltip: 'Sessions inside known project worktrees' },
  ]
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted/30 p-0.5">
      {items.map((item) => {
        const active = scope === item.id
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            title={item.tooltip}
            className={`inline-flex items-center h-6 px-2 rounded text-[11px] font-medium tracking-tight transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground/70 hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function RangeChips({ range, onChange }: { range: UsageRange; onChange: (r: UsageRange) => void }) {
  const items: UsageRange[] = ['7d', '30d', '90d', 'all']
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted/30 p-0.5">
      {items.map((item) => {
        const active = range === item
        return (
          <button
            key={item}
            onClick={() => onChange(item)}
            className={`inline-flex items-center h-6 px-2 rounded text-[11px] font-medium tabular-nums transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground/70 hover:text-foreground'
            }`}
          >
            {item}
          </button>
        )
      })}
    </div>
  )
}

function ProviderRow({
  bundle,
  onRefresh,
  onToggle,
}: {
  bundle: ProviderUsageBundle
  onRefresh: () => void
  onToggle: (enabled: boolean) => void
}) {
  const enabled = bundle.scanState?.enabled ?? false
  const sourceMissing = bundle.scanState && !bundle.scanState.source_path_exists
  const summary = bundle.summary

  return (
    <div className="group flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-foreground/[0.03] transition-colors">
      <span className="shrink-0 text-muted-foreground/70 group-hover:text-foreground transition-colors">
        <ProviderIcon provider={bundle.provider} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold tracking-tight text-foreground">{providerLabel(bundle.provider)}</span>
          {bundle.error && (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-destructive">
              <AlertTriangle size={10} />
              {bundle.error}
            </span>
          )}
          {sourceMissing && (
            <span className="text-[10.5px] text-muted-foreground/55">Not installed</span>
          )}
          {enabled && summary?.has_inferred_pricing && (
            <span className="text-[10.5px] text-amber-500">cost est.</span>
          )}
        </div>
        {enabled && summary && summary.has_any_data ? (
          <div className="flex items-baseline gap-3 mt-0.5 text-[10.5px] text-muted-foreground/60 tabular-nums">
            <span>{formatUSD(summary.estimated_cost_usd ?? null)}</span>
            <span>{formatTokens(summary.total_tokens)} tok</span>
            <span>{summary.sessions} sess</span>
            {summary.top_model && <span className="font-mono">{summary.top_model}</span>}
          </div>
        ) : (
          <p className="text-[10.5px] text-muted-foreground/45 mt-0.5">
            {!enabled ? 'Disabled — toggle to start scanning local logs.' : sourceMissing ? `No logs at ${bundle.scanState?.source_path}` : 'No usage in selected window.'}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {enabled && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
            title="Refresh"
          >
            <RefreshCcw size={11} className={bundle.loading ? 'animate-spin' : ''} />
          </button>
        )}
        <button
          onClick={() => onToggle(!enabled)}
          disabled={!!sourceMissing}
          className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors disabled:opacity-30 ${
            enabled ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.06]'
          }`}
          title={enabled ? 'Disable' : 'Enable'}
        >
          <Power size={11} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

function ModelsSection({ bundles }: { bundles: Record<UsageProvider, ProviderUsageBundle> }) {
  const rows = useMemo(() => {
    const all = Object.values(bundles).flatMap((b) =>
      b.modelBreakdown.map((row) => ({ ...row, provider: b.provider })),
    )
    all.sort((a, b) => b.total_tokens - a.total_tokens)
    return all
  }, [bundles])

  if (rows.length === 0) return null

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55 px-1">
        Models <span className="font-normal text-muted-foreground/40 tracking-normal normal-case">· {rows.length}</span>
      </p>
      <BreakdownTable rows={rows} dimension="model" />
    </section>
  )
}

function SessionsSection({ bundles }: { bundles: Record<UsageProvider, ProviderUsageBundle> }) {
  const rows = useMemo(() => {
    const all = Object.values(bundles).flatMap((b) => b.sessions)
    all.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())
    return all.slice(0, 50)
  }, [bundles])

  if (rows.length === 0) return null

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55 px-1">
        Sessions <span className="font-normal text-muted-foreground/40 tracking-normal normal-case">· {rows.length}</span>
      </p>
      <SessionList rows={rows} />
    </section>
  )
}
