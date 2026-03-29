import React from 'react'
import { DollarSign, Zap, Cpu, type LucideIcon } from 'lucide-react'

interface StatCard {
  icon: LucideIcon
  label: string
  value: string
  trend?: { value: string; positive: boolean }
  color: string
}

interface StatsCardsProps {
  totalSpend: number
  totalTokens: number
  totalSessions: number
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  totalSpend,
  totalTokens,
  totalSessions,
}) => {
  const cards: StatCard[] = [
    {
      icon: DollarSign,
      label: 'Total Spend',
      value: `$${totalSpend.toFixed(2)}`,
      color: 'text-emerald-500',
    },
    {
      icon: Zap,
      label: 'Total Tokens',
      value: totalTokens >= 1_000_000
        ? `${(totalTokens / 1_000_000).toFixed(1)}M`
        : `${(totalTokens / 1000).toFixed(1)}k`,
      color: 'text-primary',
    },
    {
      icon: Cpu,
      label: 'Total Sessions',
      value: totalSessions.toLocaleString(),
      color: 'text-blue-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-5 relative overflow-hidden group shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${card.color}`}>
              <Icon size={64} />
            </div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
              <div className={`h-1.5 w-1.5 rounded-full ${card.color} opacity-40`} style={{ backgroundColor: 'currentColor' }} />
              {card.label}
            </div>
            <h3 className="text-3xl font-black leading-tight tracking-tighter tabular-nums">
              {card.value}
            </h3>
            {card.trend && (
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded ${
                  card.trend.positive
                    ? 'text-emerald-500 bg-emerald-500/5 border border-emerald-500/10'
                    : 'text-red-500 bg-red-500/5 border border-red-500/10'
                }`}>
                  {card.trend.value}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
