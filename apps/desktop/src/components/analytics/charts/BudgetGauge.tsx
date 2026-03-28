import React from 'react'
import { ChartCard } from '../ChartCard'
import type { BudgetRecord } from '../useAnalyticsData'

interface BudgetGaugeProps {
  data: BudgetRecord[] | null
  loading?: boolean
  error?: string | null
}

export const BudgetGauge: React.FC<BudgetGaugeProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Budget" loading={false}>
        <div className="flex items-center justify-center h-[240px] text-xs text-muted-foreground/40 font-bold uppercase">
          No budgets configured
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Budget" subtitle="Current period spend vs limit" loading={loading} error={error}>
      <div className="space-y-4">
        {(data ?? []).map((b) => {
          const pct = b.limit > 0 ? Math.min((b.spent / b.limit) * 100, 100) : 0
          const overBudget = b.spent > b.limit
          return (
            <div key={b.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground/80">{b.name}</span>
                <span className={`text-[10px] font-mono font-black tabular-nums ${overBudget ? 'text-red-500' : 'text-muted-foreground'}`}>
                  ${b.spent.toFixed(2)} / ${b.limit.toFixed(2)}
                </span>
              </div>
              <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    overBudget ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[9px] text-muted-foreground/50 font-bold">{b.period}</div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
