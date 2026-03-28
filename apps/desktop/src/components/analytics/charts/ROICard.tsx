import React, { useState } from 'react'
import { ChartCard } from '../ChartCard'
import type { GlobalStats } from '@/lib/orchestra-types'

interface ROICardProps {
  stats: GlobalStats | null
  totalSpend: number
}

export const ROICard: React.FC<ROICardProps> = ({ stats, totalSpend }) => {
  const [hourlyRate, setHourlyRate] = useState(75)

  if (!stats) {
    return (
      <ChartCard title="ROI Estimate" loading={false}>
        <div className="flex items-center justify-center h-[80px] text-xs text-muted-foreground/40 font-bold uppercase">
          No data
        </div>
      </ChartCard>
    )
  }

  const sessionCount = stats.recent_sessions?.length || 0
  // Rough estimate: each session saves ~30min of developer time
  const hoursSaved = sessionCount * 0.5
  const dollarsSaved = hoursSaved * hourlyRate
  const roi = totalSpend > 0 ? dollarsSaved / totalSpend : 0

  return (
    <ChartCard title="ROI Estimate" subtitle="Estimated developer time savings vs agent spend">
      <div className="flex items-center gap-8">
        <div className="flex-1 grid grid-cols-4 gap-4">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Sessions</div>
            <div className="text-xl font-black tabular-nums">{sessionCount}</div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Hours Saved</div>
            <div className="text-xl font-black tabular-nums">{hoursSaved.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Value Created</div>
            <div className="text-xl font-black tabular-nums text-emerald-500">${dollarsSaved.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">ROI</div>
            <div className="text-xl font-black tabular-nums text-primary">{roi.toFixed(1)}x</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">$/hr</label>
          <input
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
            className="w-16 h-7 text-xs font-mono bg-muted/30 border border-border/40 rounded-md px-2 text-center"
          />
        </div>
      </div>
    </ChartCard>
  )
}
