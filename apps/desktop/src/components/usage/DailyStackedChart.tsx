import { useMemo, useState } from 'react'
import type { UsageProvider, UsageDailyPoint } from '@/lib/orchestra-client'
import type { ProviderUsageBundle } from './useUsage'
import { providerBg, providerLabel } from './provider-meta'
import { formatTokens } from './format'

const PROVIDERS: UsageProvider[] = ['claude', 'codex', 'gemini', 'opencode']

type Stack = { provider: UsageProvider; tokens: number }
type Column = {
  day: string
  total: number
  stacks: Stack[]
}

function pointTotal(p: UsageDailyPoint): number {
  return p.input_tokens + p.output_tokens + p.cache_read_tokens + p.cache_write_tokens + p.reasoning_tokens
}

export function DailyStackedChart({ bundles }: { bundles: Record<UsageProvider, ProviderUsageBundle> }) {
  const columns = useMemo(() => buildColumns(bundles), [bundles])
  const [hover, setHover] = useState<number | null>(null)

  if (columns.length === 0) {
    return (
      <div className="px-4 py-10 rounded-md border border-dashed border-border/40 text-center">
        <p className="text-[12px] text-muted-foreground/55">No usage in selected window.</p>
      </div>
    )
  }

  const maxTotal = columns.reduce((m, c) => Math.max(m, c.total), 0) || 1
  const tooltip = hover !== null ? columns[hover] : null

  return (
    <div className="space-y-2">
      <div className="relative h-40 flex items-end gap-[2px]">
        {columns.map((col, i) => {
          const heightPct = (col.total / maxTotal) * 100
          return (
            <div
              key={col.day}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              className="flex-1 min-w-0 h-full flex flex-col-reverse cursor-default"
              style={{ height: '100%' }}
            >
              <div
                className="relative w-full overflow-hidden rounded-sm"
                style={{ height: `${heightPct}%` }}
              >
                {col.stacks.map((seg) => {
                  if (seg.tokens === 0) return null
                  const segHeight = (seg.tokens / col.total) * 100
                  return (
                    <span
                      key={seg.provider}
                      className={`block w-full ${providerBg(seg.provider)} ${hover === i ? 'opacity-100' : 'opacity-80'} transition-opacity`}
                      style={{ height: `${segHeight}%` }}
                      title={`${providerLabel(seg.provider)}: ${formatTokens(seg.tokens)}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Tooltip */}
        {tooltip && (
          <div className="absolute bottom-full left-0 right-0 mb-2 flex justify-center pointer-events-none">
            <div className="bg-popover border border-border/60 rounded-md shadow-lg px-3 py-2 text-[11px]">
              <div className="font-mono text-muted-foreground/70 mb-1">{tooltip.day}</div>
              <div className="space-y-0.5">
                {tooltip.stacks.filter((s) => s.tokens > 0).map((s) => (
                  <div key={s.provider} className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${providerBg(s.provider)}`} />
                    <span className="text-foreground/90 font-medium tracking-tight">{providerLabel(s.provider)}</span>
                    <span className="ml-auto font-mono text-muted-foreground/70 tabular-nums">{formatTokens(s.tokens)}</span>
                  </div>
                ))}
                <div className="pt-1 mt-1 border-t border-border/30 flex items-center gap-2">
                  <span className="text-foreground/85 font-medium">Total</span>
                  <span className="ml-auto font-mono tabular-nums">{formatTokens(tooltip.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* X-axis */}
      <div className="flex justify-between text-[9.5px] font-mono text-muted-foreground/45 tabular-nums px-px">
        <span>{columns[0]?.day}</span>
        <span>{columns[columns.length - 1]?.day}</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground/65 pt-1">
        {PROVIDERS.map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${providerBg(p)}`} />
            {providerLabel(p)}
          </span>
        ))}
      </div>
    </div>
  )
}

function buildColumns(bundles: Record<UsageProvider, ProviderUsageBundle>): Column[] {
  const byDay = new Map<string, Column>()
  for (const provider of PROVIDERS) {
    const points = bundles[provider]?.daily ?? []
    for (const pt of points) {
      const total = pointTotal(pt)
      if (total === 0) continue
      let col = byDay.get(pt.day)
      if (!col) {
        col = { day: pt.day, total: 0, stacks: PROVIDERS.map((p) => ({ provider: p, tokens: 0 })) }
        byDay.set(pt.day, col)
      }
      const stack = col.stacks.find((s) => s.provider === provider)!
      stack.tokens += total
      col.total += total
    }
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))
}
