import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { GlobalStats, SessionSummary } from '@/lib/orchestra-types'
import type { DailyStats } from './useAnalyticsData'
import { StatCard } from './StatCard'
import { estimateCost } from '@/lib/pricing'

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(dollars: number): string {
  return `$${dollars.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Time range helpers
// ---------------------------------------------------------------------------

type TimeRange = '7d' | '30d' | '90d' | 'all'

const TIME_RANGE_OPTIONS: { key: TimeRange; label: string; days: number }[] = [
  { key: '7d', label: '7d', days: 7 },
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: 'all', label: 'All', days: Infinity },
]

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// Build daily chart data from session summaries when no daily data provided
// ---------------------------------------------------------------------------

type ChartDay = {
  date: string
  tokens: number
}

function buildDailyFromSessions(sessions: SessionSummary[], cutoff: Date): ChartDay[] {
  const map = new Map<string, number>()
  for (const s of sessions) {
    const raw = s.updated_at ?? (s.created_at as string | undefined)
    if (!raw) continue
    const d = new Date(raw)
    if (d < cutoff) continue
    const key = d.toISOString().slice(0, 10)
    map.set(key, (map.get(key) ?? 0) + (s.total_input + s.total_output))
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, tokens]) => ({ date: date.slice(5), tokens })) // MM-DD
}

function filterDailyStats(data: DailyStats[], cutoff: Date): ChartDay[] {
  return data
    .filter((d) => new Date(d.date) >= cutoff)
    .map((d) => ({ date: d.date.slice(5), tokens: d.tokens }))
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnalyticsLandingProps {
  stats: GlobalStats | null
  dailyData?: DailyStats[] | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AnalyticsLanding: React.FC<AnalyticsLandingProps> = ({ stats, dailyData }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const cutoff = useMemo(() => {
    const opt = TIME_RANGE_OPTIONS.find((o) => o.key === timeRange)!
    return opt.days === Infinity ? new Date(0) : daysAgo(opt.days)
  }, [timeRange])

  // Chart data: prefer provided dailyData, fall back to sessions
  const chartData = useMemo<ChartDay[]>(() => {
    if (dailyData?.length) {
      return filterDailyStats(dailyData, cutoff)
    }
    if (!stats?.recent_sessions?.length) return []
    return buildDailyFromSessions(stats.recent_sessions, cutoff)
  }, [dailyData, stats, cutoff])

  // Derived stat values
  const totalTokens = stats?.total_tokens ?? 0
  const totalSessions = stats?.recent_sessions?.length ?? 0
  const totalInput = stats?.total_input ?? 0
  const totalOutput = stats?.total_output ?? 0
  const estimatedCost = estimateCost(totalInput, totalOutput)

  // Provider breakdown for detail card
  const topProvider = useMemo(() => {
    const usage = stats?.provider_usage
    if (!usage) return null
    const entries = Object.entries(usage)
    if (!entries.length) return null
    entries.sort((a, b) => b[1] - a[1])
    return entries[0][0]
  }, [stats?.provider_usage])

  // Model breakdown
  const topModel = useMemo(() => {
    const usage = stats?.model_usage
    if (!usage) return null
    const entries = Object.entries(usage)
    if (!entries.length) return null
    entries.sort((a, b) => b[1] - a[1])
    return entries[0][0]
  }, [stats?.model_usage])

  const cacheTokens = (stats?.total_cache_read ?? 0) + (stats?.total_cache_write ?? 0)

  if (!stats) return null

  return (
    <div className="space-y-4">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Tokens"
          value={formatTokenCount(totalTokens)}
          detail={`${formatTokenCount(totalInput)} in · ${formatTokenCount(totalOutput)} out`}
        />
        <StatCard
          label="Est. Cost"
          value={formatCost(estimatedCost)}
          detail={topModel ? `via ${topModel}` : undefined}
        />
        <StatCard
          label="Sessions"
          value={totalSessions.toLocaleString()}
          detail={topProvider ? `Top: ${topProvider}` : undefined}
        />
        <StatCard
          label="Cache Tokens"
          value={formatTokenCount(cacheTokens)}
          detail={totalTokens > 0 ? `${((cacheTokens / totalTokens) * 100).toFixed(1)}% of total` : undefined}
        />
        <StatCard
          label="Thinking Tokens"
          value={formatTokenCount(stats.total_thinking ?? 0)}
          detail={
            totalTokens > 0 && (stats.total_thinking ?? 0) > 0
              ? `${(((stats.total_thinking ?? 0) / totalTokens) * 100).toFixed(1)}% of total`
              : undefined
          }
        />
      </div>

      {/* Daily token chart */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card via-card to-muted/20 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Daily Token Usage
            </div>
            <div className="text-[9px] text-muted-foreground/40 mt-0.5">
              Input + output tokens per day
            </div>
          </div>

          {/* Time range buttons */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/40">
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTimeRange(opt.key)}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                  timeRange === opt.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border/20"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9 }}
                stroke="currentColor"
                className="text-muted-foreground/40 font-mono"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9 }}
                stroke="currentColor"
                className="text-muted-foreground/40 font-mono"
                tickFormatter={(v: number) => formatTokenCount(v)}
                width={48}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value) => [formatTokenCount(Number(value ?? 0)), 'Tokens']}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', fontWeight: 700 }}
              />
              <Bar
                dataKey="tokens"
                fill="hsl(var(--primary))"
                opacity={0.8}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/40 font-bold uppercase">
            No session data available for this range
          </div>
        )}
      </div>
    </div>
  )
}
