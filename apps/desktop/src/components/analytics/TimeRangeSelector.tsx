import React from 'react'

const TIME_RANGES = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 0 },
] as const

interface TimeRangeSelectorProps {
  value: number
  onChange: (days: number) => void
}

/** Returns an ISO date string for "days ago", or undefined for 0 (All). */
export function sinceFromDays(days: number): string | undefined {
  if (days <= 0) return undefined
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/40">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
            value === range.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
