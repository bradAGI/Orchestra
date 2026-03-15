import React, { useMemo } from 'react'
import {
    Database,
    TrendingUp,
    Zap,
    Cpu,
    History as HistoryIcon,
    Eye,
    Folder,
    RefreshCcw,
    DollarSign,
} from 'lucide-react'
import type { GlobalStats, SessionSummary } from '@/lib/orchestra-types'
import { Badge } from '@/components/ui/badge'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { AppTooltip } from '../ui/tooltip-wrapper'
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart'

// ---------------------------------------------------------------------------
// Provider pricing: harness -> default model
// ---------------------------------------------------------------------------
const PROVIDER_PRICING: Record<
    string,
    { name: string; model: string; input: number; output: number; color: string }
> = {
    claude: { name: 'Claude', model: 'Sonnet 4.6', input: 3.0, output: 15.0, color: 'hsl(var(--chart-1))' },
    codex: { name: 'Codex', model: 'GPT-5.4', input: 2.5, output: 15.0, color: 'hsl(var(--chart-2))' },
    gemini: { name: 'Gemini', model: '2.5 Pro', input: 1.25, output: 10.0, color: 'hsl(var(--chart-3))' },
    opencode: { name: 'OpenCode', model: 'Configurable', input: 2.5, output: 10.0, color: 'hsl(var(--chart-4))' },
}

const CHART_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
]

function getProviderPricing(provider?: string) {
    const key = provider?.toLowerCase() || ''
    return PROVIDER_PRICING[key] || { name: provider || 'Unknown', model: 'Default', input: 2.5, output: 10.0, color: 'hsl(var(--chart-5))' }
}

function calculateCost(tokens: number, type: 'input' | 'output', provider?: string): number {
    const p = getProviderPricing(provider)
    const rate = type === 'input' ? p.input : p.output
    return (tokens / 1_000_000) * rate
}

function calculateWeightedCost(inputTokens: number, outputTokens: number, providerUsage: Record<string, number>, totalTokens: number): number {
    let cost = 0
    for (const [provider, tokens] of Object.entries(providerUsage)) {
        const fraction = totalTokens > 0 ? tokens / totalTokens : 0
        const providerInput = inputTokens * fraction
        const providerOutput = outputTokens * fraction
        cost += calculateCost(providerInput, 'input', provider) + calculateCost(providerOutput, 'output', provider)
    }
    return cost
}

// ---------------------------------------------------------------------------
// Chart configs
// ---------------------------------------------------------------------------
const providerChartConfig = {
    claude: { label: 'Claude', color: 'hsl(var(--chart-1))' },
    codex: { label: 'Codex', color: 'hsl(var(--chart-2))' },
    gemini: { label: 'Gemini', color: 'hsl(var(--chart-3))' },
    opencode: { label: 'OpenCode', color: 'hsl(var(--chart-4))' },
    other: { label: 'Other', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig

const costOverTimeConfig = {
    claude: { label: 'Claude', color: 'hsl(var(--chart-1))' },
    codex: { label: 'Codex', color: 'hsl(var(--chart-2))' },
    gemini: { label: 'Gemini', color: 'hsl(var(--chart-3))' },
    opencode: { label: 'OpenCode', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig

const tokenTrendConfig = {
    input: { label: 'Input Tokens', color: 'hsl(var(--chart-1))' },
    output: { label: 'Output Tokens', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

const projectChartConfig = {
    tokens: { label: 'Tokens', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface AnalyticsDashboardProps {
    stats: GlobalStats | null
    loading: boolean
    onInspectSession?: (sessionId: string) => void
    onCloneSession?: (session: SessionSummary) => void
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
    stats,
    loading,
    onInspectSession,
    onCloneSession,
}) => {
    // -----------------------------------------------------------------------
    // Derived data
    // -----------------------------------------------------------------------

    const totalSpend = useMemo(() => {
        if (!stats) return 0
        return calculateWeightedCost(stats.total_input, stats.total_output, stats.provider_usage, stats.total_tokens)
    }, [stats])

    const inputCost = useMemo(() => {
        if (!stats) return 0
        let cost = 0
        const total = stats.total_tokens || 1
        for (const [provider, tokens] of Object.entries(stats.provider_usage)) {
            const fraction = tokens / total
            cost += calculateCost(stats.total_input * fraction, 'input', provider)
        }
        return cost
    }, [stats])

    const outputCost = useMemo(() => {
        if (!stats) return 0
        let cost = 0
        const total = stats.total_tokens || 1
        for (const [provider, tokens] of Object.entries(stats.provider_usage)) {
            const fraction = tokens / total
            cost += calculateCost(stats.total_output * fraction, 'output', provider)
        }
        return cost
    }, [stats])

    // Per-provider cost breakdown
    const providerCostData = useMemo(() => {
        if (!stats?.provider_usage) return []
        const total = stats.total_tokens || 1
        return Object.entries(stats.provider_usage).map(([provider, tokens]) => {
            const fraction = tokens / total
            const iCost = calculateCost(stats.total_input * fraction, 'input', provider)
            const oCost = calculateCost(stats.total_output * fraction, 'output', provider)
            const pricing = getProviderPricing(provider)
            return {
                provider,
                name: pricing.name,
                inputCost: parseFloat(iCost.toFixed(4)),
                outputCost: parseFloat(oCost.toFixed(4)),
                total: parseFloat((iCost + oCost).toFixed(4)),
                fill: pricing.color,
            }
        }).sort((a, b) => b.total - a.total)
    }, [stats])

    // Per-project token usage (top 5 + Other)
    const projectTokenData = useMemo(() => {
        if (!stats?.recent_sessions) return []
        const map = new Map<string, number>()
        for (const s of stats.recent_sessions) {
            const name = s.project_name || 'Unassigned'
            map.set(name, (map.get(name) || 0) + s.total_input + s.total_output)
        }
        const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
        const top5 = sorted.slice(0, 5)
        const rest = sorted.slice(5).reduce((acc, [, v]) => acc + v, 0)
        const result = top5.map(([name, tokens], i) => ({
            name,
            tokens,
            fill: CHART_COLORS[i % CHART_COLORS.length],
        }))
        if (rest > 0) {
            result.push({ name: 'Other', tokens: rest, fill: 'hsl(var(--chart-5))' })
        }
        return result
    }, [stats?.recent_sessions])

    // Cost over time (by date, stacked by provider)
    const costOverTimeData = useMemo(() => {
        if (!stats?.recent_sessions) return []
        const dateMap = new Map<string, Record<string, number>>()
        for (const s of stats.recent_sessions) {
            const date = new Date(s.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
            if (!dateMap.has(date)) dateMap.set(date, {})
            const bucket = dateMap.get(date)!
            const provider = s.provider?.toLowerCase() || 'other'
            const cost = calculateCost(s.total_input, 'input', provider) + calculateCost(s.total_output, 'output', provider)
            bucket[provider] = (bucket[provider] || 0) + cost
        }
        return [...dateMap.entries()].map(([date, costs]) => ({
            date,
            claude: parseFloat((costs.claude || 0).toFixed(4)),
            codex: parseFloat((costs.codex || 0).toFixed(4)),
            gemini: parseFloat((costs.gemini || 0).toFixed(4)),
            opencode: parseFloat((costs.opencode || 0).toFixed(4)),
        }))
    }, [stats?.recent_sessions])

    // Session metrics: tokens per session per day (input vs output trend lines)
    const tokenTrendData = useMemo(() => {
        if (!stats?.recent_sessions) return []
        const dateMap = new Map<string, { inputSum: number; outputSum: number; count: number }>()
        for (const s of stats.recent_sessions) {
            const date = new Date(s.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
            if (!dateMap.has(date)) dateMap.set(date, { inputSum: 0, outputSum: 0, count: 0 })
            const bucket = dateMap.get(date)!
            bucket.inputSum += s.total_input
            bucket.outputSum += s.total_output
            bucket.count += 1
        }
        return [...dateMap.entries()].map(([date, d]) => ({
            date,
            input: Math.round(d.inputSum / d.count),
            output: Math.round(d.outputSum / d.count),
        }))
    }, [stats?.recent_sessions])

    // -----------------------------------------------------------------------
    // Loading state
    // -----------------------------------------------------------------------
    if (loading || !stats) {
        return (
            <div className="p-4 space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-background/40 rounded-xl border border-white/5" />
                    ))}
                </div>
                <div className="h-64 bg-background/40 rounded-xl border border-white/5" />
                <div className="h-64 bg-background/40 rounded-xl border border-white/5" />
            </div>
        )
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full custom-scrollbar bg-background/20">
            {/* ============================================================= */}
            {/* 1. Header                                                      */}
            {/* ============================================================= */}
            <div className="flex items-center gap-4 mb-8">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5 group transition-all hover:scale-105 active:scale-95 cursor-default">
                    <Database className="text-primary h-6 w-6 group-hover:animate-pulse" strokeWidth={2.5} />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight leading-none bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                        Warehouse Analytics
                    </h1>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em] opacity-60 mt-1.5">
                        Fleet spend est. <span className="text-primary font-black">${totalSpend.toFixed(2)}</span> across all providers
                    </p>
                </div>
            </div>

            {/* ============================================================= */}
            {/* 2. Stat Cards Row                                              */}
            {/* ============================================================= */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Input */}
                <div className="bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-5 relative overflow-hidden group shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:border-emerald-500/20">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-emerald-500">
                        <Zap size={64} />
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/40" />
                        Total Input
                    </div>
                    <h3 className="text-3xl font-black leading-tight tracking-tighter tabular-nums">
                        {(stats.total_input / 1000).toFixed(1)}k
                    </h3>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] text-emerald-500 font-black tabular-nums bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                            ${inputCost.toFixed(2)}
                        </span>
                        <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest leading-none">
                            Est. USD
                        </span>
                    </div>
                </div>

                {/* Total Output */}
                <div className="bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-5 relative overflow-hidden group shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:border-primary/20">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-primary">
                        <TrendingUp size={64} />
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                        Total Output
                    </div>
                    <h3 className="text-3xl font-black leading-tight tracking-tighter tabular-nums">
                        {(stats.total_output / 1000).toFixed(1)}k
                    </h3>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] text-primary font-black tabular-nums bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded">
                            ${outputCost.toFixed(2)}
                        </span>
                        <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest leading-none">
                            Est. USD
                        </span>
                    </div>
                </div>

                {/* Efficiency */}
                <div className="bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-5 relative overflow-hidden group shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:border-blue-500/20">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-blue-500">
                        <Cpu size={64} />
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500/40" />
                        Efficiency
                    </div>
                    <h3 className="text-3xl font-black leading-tight tracking-tighter tabular-nums">
                        {((stats.total_output / Math.max(stats.total_input, 1)) * 100).toFixed(1)}%
                    </h3>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] text-blue-500 font-black tabular-nums bg-blue-500/5 border border-blue-500/10 px-1.5 py-0.5 rounded">
                            {(stats.total_output / Math.max(stats.total_input, 1)).toFixed(2)}x
                        </span>
                        <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest leading-none">
                            Ratio
                        </span>
                    </div>
                </div>

                {/* Fleet Total Cost */}
                <div className="bg-primary/5 backdrop-blur-xl border border-primary/20 rounded-2xl p-5 relative overflow-hidden group shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40 ring-1 ring-primary/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-primary">
                        <DollarSign size={64} strokeWidth={2.5} />
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary/60 mb-2 relative z-10">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
                        Fleet Total Cost
                    </div>
                    <h3 className="text-4xl font-black leading-tight tracking-tighter text-primary tabular-nums relative z-10">
                        ${totalSpend.toFixed(2)}
                    </h3>
                    <p className="text-[9px] text-muted-foreground/60 font-black uppercase tracking-widest mt-2 relative z-10">
                        Est. Aggregate Spend
                    </p>
                </div>
            </div>

            {/* ============================================================= */}
            {/* 3. Per-Provider Cost Breakdown (Glowing Bar Chart)              */}
            {/* ============================================================= */}
            {providerCostData.length > 0 && (
                <div className="group relative bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-6 shadow-lg transition-all hover:border-primary/10 overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            <DollarSign size={12} className="text-primary" />
                            Per-Provider Cost Breakdown
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary px-1.5 h-4 bg-primary/5 uppercase">
                            Est. by Default Model
                        </Badge>
                    </div>
                    <ChartContainer config={providerChartConfig} className="h-[220px] w-full">
                        <BarChart data={providerCostData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                                <filter id="barGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="6" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" horizontal={false} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                stroke="currentColor"
                                className="text-muted-foreground/40"
                                fontSize={10}
                                fontWeight={700}
                                axisLine={false}
                                tickLine={false}
                                width={80}
                            />
                            <XAxis
                                type="number"
                                stroke="currentColor"
                                className="text-muted-foreground/40 font-mono"
                                fontSize={9}
                                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                                axisLine={false}
                                tickLine={false}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={(value) => `$${Number(value).toFixed(4)}`}
                                        nameKey="name"
                                    />
                                }
                            />
                            <Bar dataKey="inputCost" stackId="cost" name="Input Cost" filter="url(#barGlow)" radius={[0, 0, 0, 0]}>
                                {providerCostData.map((entry, index) => (
                                    <Cell key={`input-${index}`} fill={entry.fill} fillOpacity={0.8} />
                                ))}
                            </Bar>
                            <Bar dataKey="outputCost" stackId="cost" name="Output Cost" filter="url(#barGlow)" radius={[0, 4, 4, 0]}>
                                {providerCostData.map((entry, index) => (
                                    <Cell key={`output-${index}`} fill={entry.fill} fillOpacity={1} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                </div>
            )}

            {/* ============================================================= */}
            {/* 4. Per-Project Token Usage (Pie Chart)                         */}
            {/* ============================================================= */}
            {projectTokenData.length > 0 && (
                <div className="group relative bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-6 shadow-lg transition-all hover:border-primary/10 overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            <Folder size={12} className="text-primary" />
                            Per-Project Token Usage
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary px-1.5 h-4 bg-primary/5 uppercase">
                            Top 5 Projects
                        </Badge>
                    </div>
                    <div className="flex items-center gap-8">
                        <ChartContainer config={projectChartConfig} className="h-[240px] w-[240px] flex-shrink-0">
                            <PieChart>
                                <defs>
                                    <filter id="pieGlow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="4" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>
                                <ChartTooltip
                                    content={
                                        <ChartTooltipContent
                                            formatter={(value) => `${Number(value).toLocaleString()} tokens`}
                                            nameKey="name"
                                        />
                                    }
                                />
                                <Pie
                                    data={projectTokenData}
                                    dataKey="tokens"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={90}
                                    strokeWidth={2}
                                    stroke="hsl(var(--background))"
                                    filter="url(#pieGlow)"
                                >
                                    {projectTokenData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>
                        <div className="flex-1 space-y-2">
                            {projectTokenData.map((entry) => (
                                <div key={entry.name} className="flex items-center gap-3">
                                    <div
                                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: entry.fill }}
                                    />
                                    <span className="text-xs font-bold text-foreground/80 flex-1 truncate">
                                        {entry.name}
                                    </span>
                                    <span className="text-[10px] font-mono font-black text-muted-foreground tabular-nums">
                                        {(entry.tokens / 1000).toFixed(1)}k
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================= */}
            {/* 5. Cost Over Time (Gradient Area Chart)                        */}
            {/* ============================================================= */}
            {costOverTimeData.length > 0 && (
                <div className="group relative bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-6 shadow-lg transition-all hover:border-primary/10 overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            <TrendingUp size={12} className="text-primary" />
                            Cost Over Time
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary px-1.5 h-4 bg-primary/5 uppercase">
                            Est. USD by Provider
                        </Badge>
                    </div>
                    <ChartContainer config={costOverTimeConfig} className="h-[280px] w-full">
                        <AreaChart data={costOverTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradClaude" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradCodex" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradGemini" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradOpencode" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                                </linearGradient>
                                <filter id="areaGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="4" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="currentColor"
                                className="text-muted-foreground/40 font-mono"
                                fontSize={9}
                                tickMargin={10}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="currentColor"
                                className="text-muted-foreground/40 font-mono"
                                fontSize={9}
                                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                                width={50}
                                axisLine={false}
                                tickLine={false}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={(value) => `$${Number(value).toFixed(4)}`}
                                    />
                                }
                            />
                            <Area type="monotone" dataKey="claude" stackId="1" stroke="hsl(var(--chart-1))" strokeWidth={2} fillOpacity={1} fill="url(#gradClaude)" filter="url(#areaGlow)" />
                            <Area type="monotone" dataKey="codex" stackId="1" stroke="hsl(var(--chart-2))" strokeWidth={2} fillOpacity={1} fill="url(#gradCodex)" filter="url(#areaGlow)" />
                            <Area type="monotone" dataKey="gemini" stackId="1" stroke="hsl(var(--chart-3))" strokeWidth={2} fillOpacity={1} fill="url(#gradGemini)" filter="url(#areaGlow)" />
                            <Area type="monotone" dataKey="opencode" stackId="1" stroke="hsl(var(--chart-4))" strokeWidth={2} fillOpacity={1} fill="url(#gradOpencode)" filter="url(#areaGlow)" />
                        </AreaChart>
                    </ChartContainer>
                </div>
            )}

            {/* ============================================================= */}
            {/* 6. Session Success Metrics (Glowing Line Chart)                */}
            {/* ============================================================= */}
            {tokenTrendData.length > 0 && (
                <div className="group relative bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-6 shadow-lg transition-all hover:border-primary/10 overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            <Zap size={12} className="text-primary" />
                            Token Trend per Session
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary px-1.5 h-4 bg-primary/5 uppercase">
                            Avg. Tokens / Session / Day
                        </Badge>
                    </div>
                    <ChartContainer config={tokenTrendConfig} className="h-[240px] w-full">
                        <LineChart data={tokenTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="6" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="currentColor"
                                className="text-muted-foreground/40 font-mono"
                                fontSize={9}
                                tickMargin={10}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="currentColor"
                                className="text-muted-foreground/40 font-mono"
                                fontSize={9}
                                tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                                width={45}
                                axisLine={false}
                                tickLine={false}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={(value) => `${Number(value).toLocaleString()} tokens`}
                                    />
                                }
                            />
                            <Line
                                type="monotone"
                                dataKey="input"
                                stroke="hsl(var(--chart-1))"
                                strokeWidth={2.5}
                                dot={false}
                                filter="url(#lineGlow)"
                            />
                            <Line
                                type="monotone"
                                dataKey="output"
                                stroke="hsl(var(--chart-2))"
                                strokeWidth={2.5}
                                dot={false}
                                filter="url(#lineGlow)"
                            />
                        </LineChart>
                    </ChartContainer>
                </div>
            )}

            {/* ============================================================= */}
            {/* 7. Session Archive Table                                       */}
            {/* ============================================================= */}
            <div className="group relative bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-primary/10">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="p-4 border-b border-border/40 flex items-center justify-between bg-muted/10">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <HistoryIcon size={16} />
                        </div>
                        <h3 className="text-base font-black tracking-tight uppercase">Session Archive</h3>
                    </div>
                    <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-muted text-muted-foreground border-transparent px-2">
                        Last {stats.recent_sessions?.length || 0} sessions
                    </Badge>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/20 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 border-b border-border/40">
                                <th className="px-5 py-3.5">Session ID</th>
                                <th className="px-5 py-3.5">Provider</th>
                                <th className="px-5 py-3.5">Project</th>
                                <th className="px-5 py-3.5 text-right">Tokens</th>
                                <th className="px-5 py-3.5 text-right">Est. Cost</th>
                                <th className="px-5 py-3.5 text-right">Date</th>
                                <th className="px-5 py-3.5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {stats.recent_sessions?.map((session: SessionSummary) => {
                                const pricing = getProviderPricing(session.provider)
                                const sessionCost =
                                    calculateCost(session.total_input, 'input', session.provider) +
                                    calculateCost(session.total_output, 'output', session.provider)
                                return (
                                    <tr key={session.id} className="hover:bg-primary/[0.03] transition-all group/row">
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono text-[11px] font-black text-foreground/90">
                                                    {session.id.slice(0, 8)}...
                                                </span>
                                                <span className="text-[9px] font-mono text-muted-foreground/30 group-hover/row:text-muted-foreground/50 transition-colors">
                                                    {session.id}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="h-2 w-2 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: pricing.color }}
                                                />
                                                <span className="text-xs font-bold text-foreground/70">
                                                    {pricing.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2 text-sm font-bold text-foreground/70 group-hover/row:text-primary transition-colors">
                                                <Folder size={12} className="opacity-40 flex-shrink-0" />
                                                <span className="truncate max-w-[140px]">
                                                    {session.project_name || 'Global'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right font-mono text-xs font-black tabular-nums">
                                            {(session.total_input + session.total_output).toLocaleString()}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className="text-[11px] font-mono font-black text-primary tabular-nums">
                                                ${sessionCost.toFixed(4)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right text-[10px] font-bold text-muted-foreground/60 tabular-nums">
                                            <div className="flex flex-col items-end">
                                                <span>
                                                    {new Date(session.updated_at).toLocaleDateString([], {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                                <span className="font-medium text-[9px] opacity-50">
                                                    {new Date(session.updated_at).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {onCloneSession && (
                                                    <AppTooltip content="Clone session & optimize parameters">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 rounded-xl opacity-0 group-hover/row:opacity-100 transition-all hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20"
                                                            onClick={() => onCloneSession(session)}
                                                        >
                                                            <RefreshCcw size={14} className="text-amber-500" strokeWidth={2.5} />
                                                        </Button>
                                                    </AppTooltip>
                                                )}
                                                <AppTooltip content="Inspect telemetry data">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 rounded-xl opacity-0 group-hover/row:opacity-100 transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20"
                                                        onClick={() => onInspectSession?.(session.id)}
                                                    >
                                                        <Eye size={14} className="text-primary" strokeWidth={2.5} />
                                                    </Button>
                                                </AppTooltip>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {(!stats.recent_sessions || stats.recent_sessions.length === 0) && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic text-xs uppercase tracking-widest font-black opacity-20">
                                        No historical session telemetry indexed
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
