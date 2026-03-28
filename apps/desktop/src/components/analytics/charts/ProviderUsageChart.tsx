import React from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

const config = {
  tokens: { label: 'Tokens', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

interface ProviderUsageChartProps {
  data: Array<{ name: string; tokens: number }> | null
  loading?: boolean
  error?: string | null
}

export const ProviderUsageChart: React.FC<ProviderUsageChartProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Provider Usage" loading={false}>
        <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Provider Usage" loading={loading} error={error}>
      <div className="flex items-center gap-6">
        <ChartContainer config={config} className="h-[200px] w-[200px] flex-shrink-0">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toLocaleString()} tokens`} nameKey="name" />} />
            <Pie data={data ?? []} dataKey="tokens" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} strokeWidth={2} stroke="hsl(var(--background))">
              {(data ?? []).map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex-1 space-y-2">
          {(data ?? []).map((entry, idx) => (
            <div key={entry.name} className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
              <span className="text-xs font-bold text-foreground/80 flex-1 truncate">{entry.name}</span>
              <span className="text-[10px] font-mono font-black text-muted-foreground tabular-nums">{(entry.tokens / 1000).toFixed(1)}k</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}
