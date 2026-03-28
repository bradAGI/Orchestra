import React from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'
import type { PerformanceRecord } from '../useAnalyticsData'

const config = {
  p50: { label: 'p50', color: 'hsl(var(--chart-1))' },
  p95: { label: 'p95', color: 'hsl(var(--chart-2))' },
  p99: { label: 'p99', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig

interface LatencyChartProps {
  data: PerformanceRecord[] | null
  loading?: boolean
  error?: string | null
}

export const LatencyChart: React.FC<LatencyChartProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Latency" loading={false}>
        <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  const chartData = (data ?? []).map((d) => ({
    provider: d.provider,
    p50: d.p50_latency,
    p95: d.p95_latency,
    p99: d.p99_latency,
  }))

  return (
    <ChartCard title="Latency" subtitle="p50 / p95 / p99 by provider" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[200px] w-full">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
          <XAxis dataKey="provider" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} axisLine={false} tickLine={false} />
          <YAxis stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} tickFormatter={(v: number) => `${v}ms`} width={50} axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(0)}ms`} />} />
          <Line type="monotone" dataKey="p50" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="p95" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="p99" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  )
}
