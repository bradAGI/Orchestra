import React, { useMemo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'
import type { PerformanceRecord } from '../useAnalyticsData'

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

const config = {
  count: { label: 'Errors', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig

interface ErrorBreakdownProps {
  data: PerformanceRecord[] | null
  loading?: boolean
  error?: string | null
}

export const ErrorBreakdown: React.FC<ErrorBreakdownProps> = ({ data, loading, error }) => {
  const pieData = useMemo(() => {
    if (!data) return []
    const merged: Record<string, number> = {}
    for (const p of data) {
      if (p.error_breakdown) {
        for (const [k, v] of Object.entries(p.error_breakdown)) {
          merged[k] = (merged[k] || 0) + v
        }
      }
    }
    return Object.entries(merged).map(([name, count]) => ({ name, count }))
  }, [data])

  if (!pieData.length && !loading && !error) {
    return (
      <ChartCard title="Error Breakdown" loading={false}>
        <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
          No errors
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Error Breakdown" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[200px] w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie data={pieData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={75} strokeWidth={2} stroke="hsl(var(--background))">
            {pieData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartCard>
  )
}
