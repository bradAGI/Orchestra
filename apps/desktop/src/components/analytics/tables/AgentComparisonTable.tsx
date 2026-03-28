import React, { useState } from 'react'
import { ChartCard } from '../ChartCard'
import type { ProductivityRecord } from '../useAnalyticsData'

type SortKey = 'provider' | 'sessions' | 'avg_cost_per_session' | 'avg_lines_changed' | 'success_rate'

interface AgentComparisonTableProps {
  data: ProductivityRecord[] | null
  loading?: boolean
  error?: string | null
}

export const AgentComparisonTable: React.FC<AgentComparisonTableProps> = ({ data, loading, error }) => {
  const [sortKey, setSortKey] = useState<SortKey>('sessions')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...(data ?? [])].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const indicator = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : ''

  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Agent Comparison" loading={false}>
        <div className="flex items-center justify-center h-[100px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Agent Comparison" subtitle="Claude vs Codex vs Gemini vs OpenCode" loading={loading} error={error}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 border-b border-border/40">
              <th className="px-4 py-2.5 cursor-pointer select-none" onClick={() => handleSort('provider')}>Provider{indicator('provider')}</th>
              <th className="px-4 py-2.5 text-right cursor-pointer select-none" onClick={() => handleSort('sessions')}>Sessions{indicator('sessions')}</th>
              <th className="px-4 py-2.5 text-right cursor-pointer select-none" onClick={() => handleSort('avg_cost_per_session')}>Avg Cost{indicator('avg_cost_per_session')}</th>
              <th className="px-4 py-2.5 text-right">Avg Tokens</th>
              <th className="px-4 py-2.5 text-right cursor-pointer select-none" onClick={() => handleSort('avg_lines_changed')}>Avg Lines{indicator('avg_lines_changed')}</th>
              <th className="px-4 py-2.5 text-right cursor-pointer select-none" onClick={() => handleSort('success_rate')}>Success{indicator('success_rate')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {sorted.map((p) => (
              <tr key={p.provider} className="hover:bg-primary/[0.03] transition-all">
                <td className="px-4 py-3 text-sm font-bold text-foreground/80 capitalize">{p.provider}</td>
                <td className="px-4 py-3 text-right text-xs font-mono font-black tabular-nums">{p.sessions}</td>
                <td className="px-4 py-3 text-right text-xs font-mono tabular-nums text-primary">${p.avg_cost_per_session.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">{p.avg_tokens_per_session.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">{p.avg_lines_changed}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-mono font-black tabular-nums ${p.success_rate >= 0.9 ? 'text-emerald-500' : p.success_rate >= 0.7 ? 'text-amber-500' : 'text-red-500'}`}>
                    {(p.success_rate * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
