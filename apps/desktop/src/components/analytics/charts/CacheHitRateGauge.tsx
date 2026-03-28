import React from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'

const config = {
  hit: { label: 'Cache Hit', color: 'hsl(var(--chart-1))' },
  miss: { label: 'Cache Miss', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig

interface CacheHitRateGaugeProps {
  hitRate: number | null | undefined
  loading?: boolean
  error?: string | null
}

export const CacheHitRateGauge: React.FC<CacheHitRateGaugeProps> = ({ hitRate, loading, error }) => {
  const rate = hitRate ?? 0
  const data = [
    { name: 'Hit', value: rate },
    { name: 'Miss', value: 1 - rate },
  ]

  if (hitRate == null && !loading && !error) {
    return (
      <ChartCard title="Cache Hit Rate" loading={false}>
        <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Cache Hit Rate" loading={loading} error={error}>
      <div className="flex flex-col items-center">
        <ChartContainer config={config} className="h-[140px] w-[140px]">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} startAngle={90} endAngle={-270} strokeWidth={0}>
              <Cell fill="hsl(var(--chart-1))" />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="text-2xl font-black tabular-nums -mt-4">{(rate * 100).toFixed(1)}%</div>
        <div className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest mt-1">Cache Hit Rate</div>
      </div>
    </ChartCard>
  )
}
