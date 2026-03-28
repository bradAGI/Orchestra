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
  thinking_cost: { label: 'Thinking', color: 'hsl(var(--chart-4))' },
  output_cost: { label: 'Output', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

interface ThinkingTokenRatioProps {
  data: CostRecord[] | null
  loading?: boolean
  error?: string | null
}

export const ThinkingTokenRatio: React.FC<ThinkingTokenRatioProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Thinking Token Ratio" loading={false}>
        <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Thinking Token Ratio" subtitle="Thinking vs output cost per model" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[180px] w-full">
        <BarChart data={data ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
          <XAxis dataKey="group" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} axisLine={false} tickLine={false} />
          <YAxis stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={50} axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `$${Number(value).toFixed(4)}`} />} />
          <Bar dataKey="output_cost" stackId="a" fill="hsl(var(--chart-2))" />
          <Bar dataKey="thinking_cost" stackId="a" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}
