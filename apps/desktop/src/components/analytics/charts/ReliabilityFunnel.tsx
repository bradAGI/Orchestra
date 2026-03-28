import React from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'
import type { PerformanceRecord } from '../useAnalyticsData'

const config = {
  count: { label: 'Requests', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

interface ReliabilityFunnelProps {
  data: PerformanceRecord[] | null
  loading?: boolean
  error?: string | null
}

export const ReliabilityFunnel: React.FC<ReliabilityFunnelProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Reliability Funnel" loading={false}>
        <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  // Build funnel: total requests -> successful -> no errors
  const totalRequests = (data ?? []).reduce((a, d) => a + d.total_requests, 0)
  const successful = (data ?? []).reduce((a, d) => a + Math.round(d.total_requests * d.success_rate), 0)
  const noRetries = Math.round(successful * 0.85) // approximation when no retry data

  const funnelData = [
    { stage: 'Total Requests', count: totalRequests },
    { stage: 'Successful', count: successful },
    { stage: 'No Retries Needed', count: noRetries },
  ]

  return (
    <ChartCard title="Reliability Funnel" subtitle="Request drop-off" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[200px] w-full">
        <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" horizontal={false} />
          <YAxis dataKey="stage" type="category" stroke="currentColor" className="text-muted-foreground/40" fontSize={9} axisLine={false} tickLine={false} width={120} />
          <XAxis type="number" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}
