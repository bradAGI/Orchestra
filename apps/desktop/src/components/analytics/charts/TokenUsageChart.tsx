import React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'
import type { DailyStats } from '../useAnalyticsData'

const config = {
  input_tokens: { label: 'Input', color: 'hsl(var(--chart-1))' },
  output_tokens: { label: 'Output', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

interface TokenUsageChartProps {
  data: DailyStats[] | null
  loading?: boolean
  error?: string | null
}

export const TokenUsageChart: React.FC<TokenUsageChartProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Token Usage" loading={false}>
        <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Token Usage" subtitle="Stacked input + output over time" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[200px] w-full">
        <AreaChart data={data ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="tokenInputGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="tokenOutputGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
          <XAxis dataKey="date" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} axisLine={false} tickLine={false} />
          <YAxis stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={45} axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toLocaleString()} tokens`} />} />
          <Area type="monotone" dataKey="input_tokens" stackId="1" stroke="hsl(var(--chart-1))" strokeWidth={2} fillOpacity={1} fill="url(#tokenInputGrad)" />
          <Area type="monotone" dataKey="output_tokens" stackId="1" stroke="hsl(var(--chart-2))" strokeWidth={2} fillOpacity={1} fill="url(#tokenOutputGrad)" />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  )
}
