import React from 'react'
import { ArrowDown } from 'lucide-react'
import { ChartCard } from '../ChartCard'
import type { CostOptimization } from '../useAnalyticsData'

interface ModelDowngradeTableProps {
  data: CostOptimization | null
  loading?: boolean
  error?: string | null
}

export const ModelDowngradeTable: React.FC<ModelDowngradeTableProps> = ({ data, loading, error }) => {
  const downgrades = data?.model_downgrades ?? []

  if (!downgrades.length && !loading && !error) {
    return (
      <ChartCard title="Model Downgrade Opportunities" loading={false}>
        <div className="flex items-center justify-center h-[100px] text-xs text-muted-foreground/40 font-bold uppercase">
          No downgrade opportunities
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Model Downgrade Opportunities" subtitle="Potential savings by switching models" loading={loading} error={error}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 border-b border-border/40">
              <th className="px-4 py-2.5">Current Model</th>
              <th className="px-4 py-2.5 text-center">Switch</th>
              <th className="px-4 py-2.5">Suggested Model</th>
              <th className="px-4 py-2.5 text-right">Est. Savings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {downgrades.map((d, i) => (
              <tr key={i} className="hover:bg-primary/[0.03] transition-all">
                <td className="px-4 py-3 text-xs font-mono font-bold text-foreground/80">{d.from}</td>
                <td className="px-4 py-3 text-center">
                  <ArrowDown size={12} className="text-muted-foreground/40 mx-auto" />
                </td>
                <td className="px-4 py-3 text-xs font-mono font-bold text-emerald-500">{d.to}</td>
                <td className="px-4 py-3 text-right text-xs font-mono font-black text-emerald-500 tabular-nums">
                  ${d.savings.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
