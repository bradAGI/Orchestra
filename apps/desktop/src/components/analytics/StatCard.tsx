import React from 'react'

export interface StatCardProps {
  label: string
  value: string
  detail?: string
  trend?: 'up' | 'down' | 'neutral'
}

export function StatCard({ label, value, detail, trend }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
      {detail && (
        <span
          className={`text-xs ${
            trend === 'up'
              ? 'text-green-400'
              : trend === 'down'
                ? 'text-red-400'
                : 'text-muted-foreground'
          }`}
        >
          {detail}
        </span>
      )}
    </div>
  )
}
