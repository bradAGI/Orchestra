import React from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'
import type { DailyStats } from '../useAnalyticsData'

const config = {
  cost: { label: 'Daily Cost', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

interface CostTrendChartProps {
  data: DailyStats[] | null
  budgetThreshold?: number
  loading?: boolean
  error?: string | null
}

export const CostTrendChart: React.FC<CostTrendChartProps> = ({
  data,
  budgetThreshold,
  loading,
  error,
}) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Cost Trend" loading={false}>
        <div className="flex items-center justify-center h-[240px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Cost Trend" subtitle="Daily estimated spend" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[240px] w-full">
        <AreaChart data={data ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="costTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
          <XAxis dataKey="date" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} axisLine={false} tickLine={false} />
          <YAxis stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={55} axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `$${Number(value).toFixed(4)}`} />} />
          <Area type="monotone" dataKey="cost" stroke="hsl(var(--chart-1))" strokeWidth={2} fillOpacity={1} fill="url(#costTrendGrad)" />
          {budgetThreshold != null && budgetThreshold > 0 && (
            <ReferenceLine y={budgetThreshold} stroke="hsl(var(--chart-5))" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'Budget', position: 'right', fill: 'hsl(var(--chart-5))', fontSize: 9 }} />
          )}
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  )
}
