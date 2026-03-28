import React from 'react'
import { ChartCard } from '../ChartCard'
import type { PerformanceRecord } from '../useAnalyticsData'

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'hsl(var(--chart-1))',
  codex: 'hsl(var(--chart-2))',
  gemini: 'hsl(var(--chart-3))',
  opencode: 'hsl(var(--chart-4))',
}

interface ProviderHealthTableProps {
  data: PerformanceRecord[] | null
  loading?: boolean
  error?: string | null
}

export const ProviderHealthTable: React.FC<ProviderHealthTableProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Provider Health" loading={false}>
        <div className="flex items-center justify-center h-[100px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Provider Health" loading={loading} error={error}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 border-b border-border/40">
              <th className="px-4 py-2.5">Provider</th>
              <th className="px-4 py-2.5 text-right">Success Rate</th>
              <th className="px-4 py-2.5 text-right">p50</th>
              <th className="px-4 py-2.5 text-right">p95</th>
              <th className="px-4 py-2.5 text-right">p99</th>
              <th className="px-4 py-2.5 text-right">Requests</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {(data ?? []).map((p) => (
              <tr key={p.provider} className="hover:bg-primary/[0.03] transition-all">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[p.provider.toLowerCase()] || 'hsl(var(--chart-5))' }} />
                    <span className="text-sm font-bold text-foreground/80 capitalize">{p.provider}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-mono font-black tabular-nums ${p.success_rate >= 0.95 ? 'text-emerald-500' : p.success_rate >= 0.8 ? 'text-amber-500' : 'text-red-500'}`}>
                    {(p.success_rate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">{p.p50_latency}ms</td>
                <td className="px-4 py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">{p.p95_latency}ms</td>
                <td className="px-4 py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">{p.p99_latency}ms</td>
                <td className="px-4 py-3 text-right text-xs font-mono font-black tabular-nums">{p.total_requests.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
