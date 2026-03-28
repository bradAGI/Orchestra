import React, { useState } from 'react'
import type { GlobalStats, SessionSummary } from '@/lib/orchestra-types'
import type { BackendConfig } from '@/lib/orchestra-client'
import { TimeRangeSelector } from './TimeRangeSelector'
import { useAnalyticsData } from './useAnalyticsData'
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
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/40">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                activeView === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Active view */}
      {activeView === 'executive' && (
        <ExecutiveView stats={stats} analytics={analytics} />
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
