import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { ChartCard } from '../ChartCard'
import type { CostOptimization } from '../useAnalyticsData'

interface SpendAnomalyListProps {
  data: CostOptimization | null
  loading?: boolean
  error?: string | null
}

export const SpendAnomalyList: React.FC<SpendAnomalyListProps> = ({ data, loading, error }) => {
  const anomalies = data?.anomalies ?? []

  if (!anomalies.length && !loading && !error) {
    return (
      <ChartCard title="Spend Anomalies" loading={false}>
        <div className="flex items-center justify-center h-[80px] text-xs text-muted-foreground/40 font-bold uppercase">
          No anomalies detected
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Spend Anomalies" loading={loading} error={error}>
      <div className="space-y-2">
        {anomalies.map((a, i) => {
          const delta = a.amount - a.expected
          const pctOver = a.expected > 0 ? ((delta / a.expected) * 100).toFixed(0) : '?'
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground/80">{a.description}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {a.date} — ${a.amount.toFixed(2)} vs expected ${a.expected.toFixed(2)} (+{pctOver}%)
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
