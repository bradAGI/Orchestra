import { useEffect, useState, useCallback } from 'react'
import type { BackendConfig } from '@/lib/orchestra-client'
import {
  fetchAnalyticsDaily,
  fetchAnalyticsCost,
  fetchAnalyticsCostOptimization,
  fetchAnalyticsPerformance,
  fetchAnalyticsRateLimits,
  fetchAnalyticsProductivity,
  fetchAnalyticsBudgets,
  fetchExternalReconcile,
  fetchExternalStatus,
} from '@/lib/orchestra-client'
import { sinceFromDays } from './TimeRangeSelector'

// ---------------------------------------------------------------------------
// Types for analytics endpoint responses
// ---------------------------------------------------------------------------

export type DailyStats = {
  date: string
  sessions: number
  tokens: number
  input_tokens: number
  output_tokens: number
  cost: number
  [key: string]: unknown
}

export type CostRecord = {
  group: string
  input_cost: number
  output_cost: number
  cache_read_cost: number
  cache_write_cost: number
  thinking_cost: number
  total_cost: number
  input_tokens: number
  output_tokens: number
  [key: string]: unknown
}

export type CostOptimization = {
  cache_hit_rate: number
  thinking_token_ratio: number
  model_downgrades: Array<{ from: string; to: string; savings: number; [key: string]: unknown }>
  anomalies: Array<{ date: string; amount: number; expected: number; description: string; [key: string]: unknown }>
  [key: string]: unknown
}

export type PerformanceRecord = {
  provider: string
  p50_latency: number
  p95_latency: number
  p99_latency: number
  success_rate: number
  error_rate: number
  error_breakdown: Record<string, number>
  total_requests: number
  [key: string]: unknown
}

export type ProductivityRecord = {
  provider: string
  avg_lines_changed: number
  avg_cost_per_session: number
  avg_tokens_per_session: number
  sessions: number
  success_rate: number
  [key: string]: unknown
}

export type BudgetRecord = {
  name: string
  limit: number
  spent: number
  period: string
  [key: string]: unknown
}

export type ExternalStatus = {
  enabled: boolean
  provider: string
  last_sync: string
  [key: string]: unknown
}

export type ExternalReconciliation = {
  discrepancies: Array<{ date: string; internal: number; external: number; [key: string]: unknown }>
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Per-domain fetch state
// ---------------------------------------------------------------------------

type FetchState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

function initState<T>(): FetchState<T> {
  return { data: null, loading: false, error: null }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type AnalyticsData = {
  daily: FetchState<DailyStats[]>
  cost: FetchState<CostRecord[]>
  costByProject: FetchState<CostRecord[]>
  optimization: FetchState<CostOptimization>
  performance: FetchState<PerformanceRecord[]>
  rateLimits: FetchState<unknown>
  productivity: FetchState<ProductivityRecord[]>
  budgets: FetchState<BudgetRecord[]>
  external: FetchState<ExternalReconciliation>
  externalStatus: FetchState<ExternalStatus>
  refetch: () => void
}

async function safeFetch<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn()
    return { data, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // Treat 404 as "not available" rather than an error
    if (msg.includes('404') || msg.includes('not found') || msg.includes('Not Found')) {
      return { data: null, error: 'Not available' }
    }
    return { data: null, error: msg }
  }
}

export function useAnalyticsData(
  config: BackendConfig | null,
  timeRange: number,
  _providerFilter: string[],
  _projectFilter: string,
): AnalyticsData {
  const [daily, setDaily] = useState<FetchState<DailyStats[]>>(initState)
  const [cost, setCost] = useState<FetchState<CostRecord[]>>(initState)
  const [costByProject, setCostByProject] = useState<FetchState<CostRecord[]>>(initState)
  const [optimization, setOptimization] = useState<FetchState<CostOptimization>>(initState)
  const [performance, setPerformance] = useState<FetchState<PerformanceRecord[]>>(initState)
  const [rateLimits, setRateLimits] = useState<FetchState<unknown>>(initState)
  const [productivity, setProductivity] = useState<FetchState<ProductivityRecord[]>>(initState)
  const [budgets, setBudgets] = useState<FetchState<BudgetRecord[]>>(initState)
  const [external, setExternal] = useState<FetchState<ExternalReconciliation>>(initState)
  const [externalStatus, setExternalStatus] = useState<FetchState<ExternalStatus>>(initState)

  const doFetch = useCallback(async () => {
    if (!config) return
    const since = sinceFromDays(timeRange)

    // Set all loading
    setDaily((s) => ({ ...s, loading: true }))
    setCost((s) => ({ ...s, loading: true }))
    setCostByProject((s) => ({ ...s, loading: true }))
    setOptimization((s) => ({ ...s, loading: true }))
    setPerformance((s) => ({ ...s, loading: true }))
    setRateLimits((s) => ({ ...s, loading: true }))
    setProductivity((s) => ({ ...s, loading: true }))
    setBudgets((s) => ({ ...s, loading: true }))
    setExternal((s) => ({ ...s, loading: true }))
    setExternalStatus((s) => ({ ...s, loading: true }))

    // Parallel fetches
    const [
      dailyR, costR, costByProjectR, optR, perfR, rlR, prodR, budR, extR, extSR,
    ] = await Promise.all([
      safeFetch(() => fetchAnalyticsDaily(config, since)),
      safeFetch(() => fetchAnalyticsCost(config, since, 'model')),
      safeFetch(() => fetchAnalyticsCost(config, since, 'project')),
      safeFetch(() => fetchAnalyticsCostOptimization(config)),
      safeFetch(() => fetchAnalyticsPerformance(config, since)),
      safeFetch(() => fetchAnalyticsRateLimits(config)),
      safeFetch(() => fetchAnalyticsProductivity(config, since)),
      safeFetch(() => fetchAnalyticsBudgets(config)),
      safeFetch(() => fetchExternalReconcile(config, since)),
      safeFetch(() => fetchExternalStatus(config)),
    ])

    setDaily({ data: dailyR.data, loading: false, error: dailyR.error })
    setCost({ data: costR.data, loading: false, error: costR.error })
    setCostByProject({ data: costByProjectR.data, loading: false, error: costByProjectR.error })
    setOptimization({ data: optR.data, loading: false, error: optR.error })
    setPerformance({ data: perfR.data, loading: false, error: perfR.error })
    setRateLimits({ data: rlR.data, loading: false, error: rlR.error })
    setProductivity({ data: prodR.data, loading: false, error: prodR.error })
    setBudgets({ data: budR.data, loading: false, error: budR.error })
    setExternal({ data: extR.data, loading: false, error: extR.error })
    setExternalStatus({ data: extSR.data, loading: false, error: extSR.error })
  }, [config, timeRange])

  useEffect(() => {
    void doFetch()
  }, [doFetch])

  return {
    daily,
    cost,
    costByProject,
    optimization,
    performance,
    rateLimits,
    productivity,
    budgets,
    external,
    externalStatus,
    refetch: doFetch,
  }
}
