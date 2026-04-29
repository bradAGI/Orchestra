import React, { useState } from 'react'
import type { GlobalStats, SessionSummary } from '@/lib/orchestra-types'
import type { BackendConfig } from '@/lib/orchestra-client'
import { TimeRangeSelector } from './TimeRangeSelector'
import { useAnalyticsData } from './useAnalyticsData'
import { AnalyticsLanding } from './AnalyticsLanding'
import { ExecutiveView } from './views/ExecutiveView'
import { OperationalView } from './views/OperationalView'
import { OptimizationView } from './views/OptimizationView'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewTab = 'executive' | 'operational' | 'optimization'

const TABS: { key: ViewTab; label: string }[] = [
  { key: 'executive', label: 'Executive' },
  { key: 'operational', label: 'Operational' },
  { key: 'optimization', label: 'Optimization' },
]

interface AnalyticsDashboardProps {
  stats: GlobalStats | null
  loading: boolean
  config: BackendConfig | null
  projects?: { id: string; name: string }[]
  onInspectSession?: (sessionId: string) => void
  onCloneSession?: (session: SessionSummary) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  stats,
  loading,
  config,
  projects,
  onInspectSession,
  onCloneSession,
}) => {
  const [activeView, setActiveView] = useState<ViewTab>('executive')
  const [timeRange, setTimeRange] = useState(30)
  const [providerFilter, setProviderFilter] = useState<string[]>([])
  const [projectFilter, setProjectFilter] = useState('')

  // Suppress unused-variable warnings — filters will be wired to UI controls in a follow-up
  void setProviderFilter
  void setProjectFilter

  const analytics = useAnalyticsData(config, timeRange, providerFilter, projectFilter)

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading || !stats) {
    return (
      <div className="p-4 space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-background/40 rounded-xl border border-border/30" />
          ))}
        </div>
        <div className="h-64 bg-background/40 rounded-xl border border-border/30" />
        <div className="h-64 bg-background/40 rounded-xl border border-border/30" />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full custom-scrollbar bg-background/20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-0">
          {TABS.map((tab) => {
            const isActive = activeView === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key)}
                className={`relative inline-flex items-center px-3 h-9 text-[12px] font-medium tracking-tight transition-colors ${
                  isActive ? 'text-foreground' : 'text-muted-foreground/70 hover:text-foreground'
                }`}
              >
                {tab.label}
                {isActive && <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />}
              </button>
            )
          })}
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Landing: stat cards + daily token chart */}
      <div className="flex flex-col gap-6">
        <AnalyticsLanding stats={stats} dailyData={analytics.daily.data} />
      </div>

      {/* Active view */}
      {activeView === 'executive' && (
        <ExecutiveView stats={stats} analytics={analytics} projects={projects} />
      )}
      {activeView === 'operational' && (
        <OperationalView
          analytics={analytics}
          sessions={stats.recent_sessions ?? []}
          onInspectSession={onInspectSession}
          onCloneSession={onCloneSession}
        />
      )}
      {activeView === 'optimization' && (
        <OptimizationView analytics={analytics} />
      )}
    </div>
  )
}
