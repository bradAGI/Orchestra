import React from 'react'
import type { SessionSummary } from '@/lib/orchestra-types'
import type { AnalyticsData } from '../useAnalyticsData'
import { ProviderHealthTable } from '../tables/ProviderHealthTable'
import { TokenUsageChart } from '../charts/TokenUsageChart'
import { LatencyChart } from '../charts/LatencyChart'
import { ReliabilityFunnel } from '../charts/ReliabilityFunnel'
import { ErrorBreakdown } from '../charts/ErrorBreakdown'
import { RecentSessionsTable } from '../tables/RecentSessionsTable'

interface OperationalViewProps {
  analytics: AnalyticsData
  sessions: SessionSummary[]
  onInspectSession?: (sessionId: string) => void
  onCloneSession?: (session: SessionSummary) => void
}

export const OperationalView: React.FC<OperationalViewProps> = ({
  analytics,
  sessions,
  onInspectSession,
  onCloneSession,
}) => {
  return (
    <div className="space-y-6">
      {/* Row 1: Provider Health Table */}
      <ProviderHealthTable
        data={analytics.performance.data}
        loading={analytics.performance.loading}
        error={analytics.performance.error}
      />

      {/* Row 2: Token Usage (1/2) + Latency (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TokenUsageChart
          data={analytics.daily.data}
          loading={analytics.daily.loading}
          error={analytics.daily.error}
        />
        <LatencyChart
          data={analytics.performance.data}
          loading={analytics.performance.loading}
          error={analytics.performance.error}
        />
      </div>

      {/* Row 3: Reliability Funnel (1/2) + Error Breakdown (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReliabilityFunnel
          data={analytics.performance.data}
          loading={analytics.performance.loading}
          error={analytics.performance.error}
        />
        <ErrorBreakdown
          data={analytics.performance.data}
          loading={analytics.performance.loading}
          error={analytics.performance.error}
        />
      </div>

      {/* Row 4: Recent Sessions Table */}
      <RecentSessionsTable
        sessions={sessions}
        onInspectSession={onInspectSession}
        onCloneSession={onCloneSession}
      />
    </div>
  )
}
