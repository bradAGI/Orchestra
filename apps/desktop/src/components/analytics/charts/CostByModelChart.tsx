import React from 'react'
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
  input_cost: { label: 'Input', color: 'hsl(var(--chart-1))' },
  output_cost: { label: 'Output', color: 'hsl(var(--chart-2))' },
  cache_read_cost: { label: 'Cache Read', color: 'hsl(var(--chart-3))' },
  thinking_cost: { label: 'Thinking', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig

interface CostByModelChartProps {
  data: CostRecord[] | null
  loading?: boolean
  error?: string | null
}

export const CostByModelChart: React.FC<CostByModelChartProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Cost by Model" loading={false}>
        <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Cost by Model" subtitle="Input + Output + Cache + Thinking breakdown" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[200px] w-full">
        <BarChart data={data ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
          <XAxis dataKey="group" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} axisLine={false} tickLine={false} />
          <YAxis stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={55} axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `$${Number(value).toFixed(4)}`} />} />
          <Bar dataKey="input_cost" stackId="cost" fill="hsl(var(--chart-1))" />
          <Bar dataKey="output_cost" stackId="cost" fill="hsl(var(--chart-2))" />
          <Bar dataKey="cache_read_cost" stackId="cost" fill="hsl(var(--chart-3))" />
          <Bar dataKey="thinking_cost" stackId="cost" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}
