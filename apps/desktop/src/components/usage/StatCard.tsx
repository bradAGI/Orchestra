import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  hint?: string
}) {
  return (
    <div className="surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="shrink-0 text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}
