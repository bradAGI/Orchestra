import type { UsageProvider, UsageBreakdownRow } from '@/lib/orchestra-client'
import { providerColor, providerInitial } from './provider-meta'
import { formatNumber, formatTokens, formatUSD } from './format'

type Row = UsageBreakdownRow & { provider?: UsageProvider }

export function BreakdownTable({ rows, dimension }: { rows: Row[]; dimension: 'model' | 'project' }) {
  return (
    <div className="-mx-2">
      {rows.map((row, i) => (
        <div
          key={`${row.provider ?? ''}::${row.key}::${i}`}
          className="group flex items-center gap-3 w-full px-2 py-2 rounded-md hover:bg-foreground/[0.03] transition-colors"
        >
          {row.provider ? (
            <span
              className={`shrink-0 inline-flex items-center justify-center w-4 h-4 font-mono font-bold text-[10.5px] ${providerColor(row.provider)}`}
              title={row.provider}
            >
              {providerInitial(row.provider)}
            </span>
          ) : (
            <span className="shrink-0 w-4" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-mono text-foreground/90 truncate" title={row.label}>
              {row.label || '(unknown)'}
            </span>
            {dimension === 'model' && row.has_inferred_pricing && (
              <span className="block text-[10px] text-amber-500 mt-0.5">cost estimated</span>
            )}
          </span>
          <span className="shrink-0 grid grid-cols-3 gap-x-5 text-[11px] text-muted-foreground/70 tabular-nums">
            <span className="text-right text-foreground/85 font-medium">{formatUSD(row.estimated_cost_usd ?? null)}</span>
            <span className="text-right">{formatTokens(row.total_tokens)} tok</span>
            <span className="text-right">{formatNumber(row.sessions)} sess</span>
          </span>
        </div>
      ))}
    </div>
  )
}
