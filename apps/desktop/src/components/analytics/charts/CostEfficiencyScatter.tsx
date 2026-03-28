import React from 'react'
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartCard } from '../ChartCard'
import type { ProductivityRecord } from '../useAnalyticsData'

const CHART_COLORS: Record<string, string> = {
  claude: 'hsl(var(--chart-1))',
  codex: 'hsl(var(--chart-2))',
  gemini: 'hsl(var(--chart-3))',
  opencode: 'hsl(var(--chart-4))',
}

const config = {
  cost: { label: 'Cost', color: 'hsl(var(--chart-1))' },
  lines: { label: 'Lines Changed', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

interface CostEfficiencyScatterProps {
  data: ProductivityRecord[] | null
  loading?: boolean
  error?: string | null
}

export const CostEfficiencyScatter: React.FC<CostEfficiencyScatterProps> = ({ data, loading, error }) => {
  if (!data?.length && !loading && !error) {
    return (
      <ChartCard title="Cost Efficiency" loading={false}>
        <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  const scatterData = (data ?? []).map((d) => ({
    x: d.avg_cost_per_session,
    y: d.avg_lines_changed,
    z: d.sessions,
    provider: d.provider,
    fill: CHART_COLORS[d.provider.toLowerCase()] || 'hsl(var(--chart-5))',
  }))

  return (
    <ChartCard title="Cost Efficiency" subtitle="Cost vs lines changed per session" loading={loading} error={error}>
      <ChartContainer config={config} className="h-[200px] w-full">
        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" />
          <XAxis type="number" dataKey="x" name="Cost" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} tickFormatter={(v: number) => `$${v.toFixed(2)}`} axisLine={false} tickLine={false} />
          <YAxis type="number" dataKey="y" name="Lines" stroke="currentColor" className="text-muted-foreground/40 font-mono" fontSize={9} width={45} axisLine={false} tickLine={false} />
          <ZAxis type="number" dataKey="z" range={[40, 400]} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => name === 'Cost' ? `$${Number(value).toFixed(2)}` : `${value} lines`} />} />
          <Scatter data={scatterData} fill="hsl(var(--chart-1))">
            {/* Colors handled by fill prop on each data point */}
          </Scatter>
        </ScatterChart>
      </ChartContainer>
    </ChartCard>
  )
}
