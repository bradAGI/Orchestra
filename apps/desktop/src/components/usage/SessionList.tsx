import type { UsageSessionRow } from '@/lib/orchestra-client'
import { ProviderIcon } from './provider-meta'
import { formatTokens, formatUSD, formatRelativeTime } from './format'

export function SessionList({ rows }: { rows: UsageSessionRow[] }) {
  return (
    <div className="-mx-2">
      {rows.map((row) => (
        <div
          key={`${row.provider}::${row.session_id}`}
          className="group flex items-center gap-3 w-full px-2 py-2 rounded-md hover:bg-foreground/[0.03] transition-colors"
        >
          <span className="shrink-0">
            <ProviderIcon provider={row.provider} size={11} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="text-[12.5px] font-medium tracking-tight text-foreground/90 truncate">
                {row.project_label || row.session_id.slice(0, 8)}
              </span>
              {row.branch && (
                <span className="text-[10px] font-mono text-muted-foreground/55 truncate shrink-0 max-w-[160px]">
                  {row.branch}
                </span>
              )}
            </span>
            <span className="block text-[10.5px] text-muted-foreground/55 tabular-nums truncate">
              {row.model && <span className="font-mono">{row.model}</span>}
              {row.model && ' · '}
              {row.turns} turns
              {row.duration_minutes > 0 && ` · ${formatDuration(row.duration_minutes)}`}
              {' · '}
              {formatRelativeTime(row.last_active_at)}
            </span>
          </span>
          <span className="shrink-0 grid grid-cols-2 gap-x-5 text-[11px] text-muted-foreground/70 tabular-nums">
            <span className="text-right text-foreground/85 font-medium">{formatUSD(row.estimated_cost_usd ?? null)}</span>
            <span className="text-right">{formatTokens(row.input_tokens + row.output_tokens + row.cache_read_tokens + row.cache_write_tokens + row.reasoning_tokens)} tok</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}
