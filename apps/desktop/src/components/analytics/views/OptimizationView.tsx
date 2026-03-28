import React from 'react'
import type { AnalyticsData } from '../useAnalyticsData'
import { CacheHitRateGauge } from '../charts/CacheHitRateGauge'
import { ThinkingTokenRatio } from '../charts/ThinkingTokenRatio'
import { AgentComparisonTable } from '../tables/AgentComparisonTable'
import { CostEfficiencyScatter } from '../charts/CostEfficiencyScatter'
import { ModelDowngradeTable } from '../tables/ModelDowngradeTable'
import { SpendAnomalyList } from '../charts/SpendAnomalyList'
import { ChartCard } from '../ChartCard'

interface OptimizationViewProps {
  analytics: AnalyticsData
}

export const OptimizationView: React.FC<OptimizationViewProps> = ({ analytics }) => {
  const externalEnabled = analytics.externalStatus.data?.enabled ?? false

  return (
    <div className="space-y-6">
      {/* Row 1: Cache Hit Rate (1/3) + Thinking Token Ratio (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CacheHitRateGauge
          hitRate={analytics.optimization.data?.cache_hit_rate}
          loading={analytics.optimization.loading}
          error={analytics.optimization.error}
        />
        <div className="lg:col-span-2">
          <ThinkingTokenRatio
            data={analytics.cost.data}
            loading={analytics.cost.loading}
            error={analytics.cost.error}
          />
        </div>
      </div>

      {/* Row 2: Agent Comparison Table */}
      <AgentComparisonTable
        data={analytics.productivity.data}
        loading={analytics.productivity.loading}
        error={analytics.productivity.error}
      />

      {/* Row 3: Cost Efficiency (1/2) + Model Downgrade Table (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostEfficiencyScatter
          data={analytics.productivity.data}
          loading={analytics.productivity.loading}
          error={analytics.productivity.error}
        />
        <ModelDowngradeTable
          data={analytics.optimization.data}
          loading={analytics.optimization.loading}
          error={analytics.optimization.error}
        />
      </div>

      {/* Row 4: Spend Anomalies */}
      <SpendAnomalyList
        data={analytics.optimization.data}
        loading={analytics.optimization.loading}
        error={analytics.optimization.error}
      />

      {/* Row 5: Reconciliation (only if external sync enabled) */}
      {externalEnabled && (
        <ChartCard
          title="External Reconciliation"
          subtitle={`Provider: ${analytics.externalStatus.data?.provider ?? 'Unknown'} | Last sync: ${analytics.externalStatus.data?.last_sync ?? 'Never'}`}
          loading={analytics.external.loading}
          error={analytics.external.error}
        >
          {analytics.external.data?.discrepancies?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 border-b border-border/40">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Internal</th>
                    <th className="px-4 py-2.5 text-right">External</th>
                    <th className="px-4 py-2.5 text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {analytics.external.data.discrepancies.map((d, i) => (
                    <tr key={i} className="hover:bg-primary/[0.03]">
                      <td className="px-4 py-3 text-xs font-mono">{d.date}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">${d.internal.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">${d.external.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right text-xs font-mono font-black tabular-nums ${Math.abs(d.internal - d.external) > 1 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        ${(d.internal - d.external).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[60px] text-xs text-muted-foreground/40 font-bold uppercase">
              No discrepancies found
            </div>
          )}
        </ChartCard>
      )}
    </div>
  )
}
