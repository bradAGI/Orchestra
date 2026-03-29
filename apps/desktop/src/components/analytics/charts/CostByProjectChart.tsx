import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'
import type { CostRecord } from '../useAnalyticsData'

const config = {
  total_cost: { label: 'Total Cost', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig

interface CostByProjectChartProps {
  data: CostRecord[] | null
  loading?: boolean
  error?: string | null
  projects?: { id: string; name: string }[]
}

export const CostByProjectChart: React.FC<CostByProjectChartProps> = ({ data, loading, error, projects }) => {
  const chartData = useMemo(() => {
    if (!data) return null
    const nameMap = new Map(projects?.map(p => [p.id, p.name]))
    return data.map(d => ({ ...d, group: nameMap.get(d.group) ?? d.group }))
  }, [data, projects])
  if (!chartData?.length && !loading && !error) {
    return (
      <ChartCard title="Cost by Project" loading={false}>
        <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Cost by Project" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[200px] w-full">
        <BarChart data={chartData ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
          <XAxis dataKey="group" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} axisLine={false} tickLine={false} />
          <YAxis stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={55} axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `$${Number(value).toFixed(4)}`} />} />
          <Bar dataKey="total_cost" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}
