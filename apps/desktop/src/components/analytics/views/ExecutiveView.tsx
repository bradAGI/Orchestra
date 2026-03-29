import React, { useMemo } from 'react'
import type { GlobalStats } from '@/lib/orchestra-types'
import type { AnalyticsData } from '../useAnalyticsData'
import { StatsCards } from '../charts/StatsCards'
import { CostTrendChart } from '../charts/CostTrendChart'
import { BudgetGauge } from '../charts/BudgetGauge'
import { CostByProjectChart } from '../charts/CostByProjectChart'
import { CostByModelChart } from '../charts/CostByModelChart'
import { ROICard } from '../charts/ROICard'

interface ExecutiveViewProps {
  stats: GlobalStats | null
  analytics: AnalyticsData
  projects?: { id: string; name: string }[]
}

export const ExecutiveView: React.FC<ExecutiveViewProps> = ({ stats, analytics, projects }) => {
  const totalSpend = useMemo(() => {
    if (!analytics.cost.data?.length) {
      // Fallback to rough estimate from GlobalStats
      if (!stats) return 0
      return ((stats.total_input + stats.total_output) / 1_000_000) * 3
    }
    return analytics.cost.data.reduce((a, c) => a + c.total_cost, 0)
  }, [analytics.cost.data, stats])

  const totalTokens = stats?.total_tokens ?? 0
  const totalSessions = stats?.recent_sessions?.length ?? 0

  // Rough daily budget from budgets
  const dailyBudget = useMemo(() => {
    const budgets = analytics.budgets.data
    if (!budgets?.length) return undefined
    const first = budgets[0]
    if (first.period === 'daily') return first.limit
    if (first.period === 'monthly') return first.limit / 30
    return first.limit
  }, [analytics.budgets.data])

  return (
    <div className="space-y-6">
      {/* Row 1: Stats Cards */}
      <StatsCards
        totalSpend={totalSpend}
        totalTokens={totalTokens}
        totalSessions={totalSessions}
      />

      {/* Row 2: Cost Trend (2/3) + Budget Gauge (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CostTrendChart
            data={analytics.daily.data}
            budgetThreshold={dailyBudget}
            loading={analytics.daily.loading}
            error={analytics.daily.error}
          />
        </div>
        <BudgetGauge
          data={analytics.budgets.data}
          loading={analytics.budgets.loading}
          error={analytics.budgets.error}
        />
      </div>

      {/* Row 3: Cost by Project (1/2) + Cost by Model (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostByProjectChart
          data={analytics.costByProject.data}
          loading={analytics.costByProject.loading}
          error={analytics.costByProject.error}
          projects={projects}
        />
        <CostByModelChart
          data={analytics.cost.data}
          loading={analytics.cost.loading}
          error={analytics.cost.error}
        />
      </div>

      {/* Row 4: ROI Card */}
      <ROICard stats={stats} totalSpend={totalSpend} />
    </div>
  )
}
