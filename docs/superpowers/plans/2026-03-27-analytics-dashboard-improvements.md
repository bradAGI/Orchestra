# Analytics Dashboard — Performance, Multi-Agent Tracking & Refined Metrics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the analytics dashboard for speed, track all agent providers (not just Codex), and add refined metrics including success/failure rates, duration tracking, cost trends, and per-project breakdowns.

**Architecture:** The current `AnalyticsDashboard.tsx` (885 lines) is a monolith component. The backend `GetGlobalStats()` query aggregates all data on every request with no caching or pagination. We will: (1) split the dashboard into focused chart components, (2) add a backend stats cache with TTL, (3) extend the DB schema to track success/failure status and duration per session, (4) add time-range filtering, and (5) add per-provider session counts and success rates.

**Tech Stack:** React 19, TypeScript, Recharts 3, Go (chi router), SQLite (modernc.org/sqlite)

---

### Task 1: Add `status` and `duration_seconds` columns to sessions table

**Files:**
- Modify: `apps/backend/internal/db/schema.go`
- Modify: `apps/backend/internal/db/projects.go`
- Test: `apps/backend/internal/db/projects_test.go`

- [ ] **Step 1: Write the failing test**

```go
// apps/backend/internal/db/projects_test.go
func TestSessionStatusAndDuration(t *testing.T) {
    db := setupTestDB(t)

    // Insert a session with status and duration
    _, err := db.Exec(`INSERT INTO sessions (id, project_id, provider, model, status, duration_seconds, created_at, updated_at)
        VALUES ('s1', 'p1', 'claude', 'claude-sonnet-4-6', 'completed', 120.5, datetime('now'), datetime('now'))`)
    if err != nil {
        t.Fatalf("failed to insert session with status: %v", err)
    }

    var status string
    var duration float64
    err = db.QueryRow(`SELECT status, duration_seconds FROM sessions WHERE id = 's1'`).Scan(&status, &duration)
    if err != nil {
        t.Fatalf("failed to query session status: %v", err)
    }
    if status != "completed" {
        t.Errorf("expected status 'completed', got '%s'", status)
    }
    if duration != 120.5 {
        t.Errorf("expected duration 120.5, got %f", duration)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && go test ./internal/db/... -run TestSessionStatusAndDuration -v`
Expected: FAIL — columns don't exist yet

- [ ] **Step 3: Add migration for new columns**

In `apps/backend/internal/db/schema.go`, add to the migration section after existing migrations:

```go
// Add status and duration_seconds columns to sessions
migrateColumn(db, "sessions", "status", "TEXT NOT NULL DEFAULT 'unknown'")
migrateColumn(db, "sessions", "duration_seconds", "REAL NOT NULL DEFAULT 0")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && go test ./internal/db/... -run TestSessionStatusAndDuration -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/db/schema.go apps/backend/internal/db/projects_test.go
git commit -m "feat(backend): add status and duration_seconds columns to sessions table"
```

---

### Task 2: Extend `GlobalStats` to include success rates and per-provider session counts

**Files:**
- Modify: `apps/backend/internal/db/projects.go` (GetGlobalStats query)
- Modify: `apps/desktop/src/lib/orchestra-types.ts` (TypeScript types)

- [ ] **Step 1: Write the failing test**

```go
// Add to projects_test.go
func TestGlobalStatsProviderSessions(t *testing.T) {
    db := setupTestDB(t)

    // Insert sessions for different providers with different statuses
    for _, s := range []struct{ id, provider, status string }{
        {"s1", "claude", "completed"},
        {"s2", "claude", "failed"},
        {"s3", "codex", "completed"},
        {"s4", "gemini", "completed"},
    } {
        _, err := db.Exec(`INSERT INTO sessions (id, project_id, provider, status, duration_seconds, created_at, updated_at)
            VALUES (?, 'p1', ?, ?, 60, datetime('now'), datetime('now'))`, s.id, s.provider, s.status)
        if err != nil {
            t.Fatalf("insert %s: %v", s.id, err)
        }
    }

    stats, err := GetGlobalStats(context.Background(), db)
    if err != nil {
        t.Fatalf("GetGlobalStats: %v", err)
    }

    if stats.ProviderSessions == nil {
        t.Fatal("expected ProviderSessions to be populated")
    }
    if stats.ProviderSessions["claude"].Total != 2 {
        t.Errorf("expected claude total=2, got %d", stats.ProviderSessions["claude"].Total)
    }
    if stats.ProviderSessions["claude"].Completed != 1 {
        t.Errorf("expected claude completed=1, got %d", stats.ProviderSessions["claude"].Completed)
    }
    if stats.ProviderSessions["claude"].Failed != 1 {
        t.Errorf("expected claude failed=1, got %d", stats.ProviderSessions["claude"].Failed)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && go test ./internal/db/... -run TestGlobalStatsProviderSessions -v`
Expected: FAIL — `ProviderSessions` field doesn't exist

- [ ] **Step 3: Add ProviderSessionStats to GlobalStats struct**

In `apps/backend/internal/db/projects.go`, add the new types and extend the query:

```go
// Add after existing types:
type ProviderSessionStats struct {
    Total     int64   `json:"total"`
    Completed int64   `json:"completed"`
    Failed    int64   `json:"failed"`
    AvgDuration float64 `json:"avg_duration"`
}

// Add field to GlobalStats struct:
type GlobalStats struct {
    // ... existing fields ...
    ProviderSessions map[string]ProviderSessionStats `json:"provider_sessions"`
}
```

In `GetGlobalStats()`, add a second query after the existing one:

```go
// Per-provider session counts
providerSessionRows, err := db.QueryContext(ctx, `
    SELECT provider,
           COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
           AVG(duration_seconds) as avg_duration
    FROM sessions
    WHERE provider != ''
    GROUP BY provider
`)
if err == nil {
    defer providerSessionRows.Close()
    stats.ProviderSessions = make(map[string]ProviderSessionStats)
    for providerSessionRows.Next() {
        var provider string
        var ps ProviderSessionStats
        if err := providerSessionRows.Scan(&provider, &ps.Total, &ps.Completed, &ps.Failed, &ps.AvgDuration); err == nil {
            stats.ProviderSessions[provider] = ps
        }
    }
}
```

- [ ] **Step 4: Update TypeScript types**

In `apps/desktop/src/lib/orchestra-types.ts`, add:

```typescript
export type ProviderSessionStats = {
    total: number
    completed: number
    failed: number
    avg_duration: number
}

// Add to GlobalStats:
export type GlobalStats = {
    // ... existing fields ...
    provider_sessions?: Record<string, ProviderSessionStats>
}
```

- [ ] **Step 5: Run tests**

Run: `cd apps/backend && go test ./internal/db/... -run TestGlobalStatsProviderSessions -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/internal/db/projects.go apps/backend/internal/db/projects_test.go apps/desktop/src/lib/orchestra-types.ts
git commit -m "feat(backend): add per-provider session counts and success rates to GlobalStats"
```

---

### Task 3: Add time-range filtering to the stats endpoint

**Files:**
- Modify: `apps/backend/internal/db/projects.go` (add `since` parameter)
- Modify: `apps/backend/internal/api/state.go` (parse query param)
- Modify: `apps/desktop/src/lib/orchestra-client.ts` (pass range param)

- [ ] **Step 1: Write the failing test**

```go
func TestGlobalStatsWithTimeRange(t *testing.T) {
    db := setupTestDB(t)

    // Insert old session (30 days ago) and recent session
    _, _ = db.Exec(`INSERT INTO sessions (id, project_id, provider, created_at, updated_at)
        VALUES ('old', 'p1', 'codex', datetime('now', '-30 days'), datetime('now', '-30 days'))`)
    _, _ = db.Exec(`INSERT INTO events (id, session_id, input_tokens, output_tokens) VALUES ('e-old', 'old', 1000, 2000)`)

    _, _ = db.Exec(`INSERT INTO sessions (id, project_id, provider, created_at, updated_at)
        VALUES ('recent', 'p1', 'claude', datetime('now', '-1 day'), datetime('now', '-1 day'))`)
    _, _ = db.Exec(`INSERT INTO events (id, session_id, input_tokens, output_tokens) VALUES ('e-recent', 'recent', 500, 1000)`)

    // Query with 7-day range — should only include 'recent'
    since := time.Now().AddDate(0, 0, -7)
    stats, err := GetGlobalStats(context.Background(), db, WithSince(since))
    if err != nil {
        t.Fatalf("GetGlobalStats with since: %v", err)
    }

    if stats.TotalTokens != 1500 {
        t.Errorf("expected 1500 tokens (recent only), got %d", stats.TotalTokens)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && go test ./internal/db/... -run TestGlobalStatsWithTimeRange -v`
Expected: FAIL — `WithSince` doesn't exist

- [ ] **Step 3: Add functional options to GetGlobalStats**

```go
// In projects.go, add option types:
type StatsOption func(*statsOpts)

type statsOpts struct {
    since *time.Time
}

func WithSince(t time.Time) StatsOption {
    return func(o *statsOpts) { o.since = &t }
}

// Modify GetGlobalStats signature:
func GetGlobalStats(ctx context.Context, db *sql.DB, opts ...StatsOption) (*GlobalStats, error) {
    var o statsOpts
    for _, fn := range opts {
        fn(&o)
    }

    // Add WHERE clause to all queries when since is set:
    sinceClause := ""
    var sinceArg []interface{}
    if o.since != nil {
        sinceClause = " AND s.created_at >= ?"
        sinceArg = append(sinceArg, o.since.Format(time.RFC3339))
    }
    // ... apply sinceClause to existing SQL queries ...
}
```

- [ ] **Step 4: Add query parameter parsing in API handler**

In `apps/backend/internal/api/state.go`, in the warehouse stats handler:

```go
// Parse optional time range
var opts []db.StatsOption
if since := r.URL.Query().Get("since"); since != "" {
    if t, err := time.Parse(time.RFC3339, since); err == nil {
        opts = append(opts, db.WithSince(t))
    }
}
stats, err := db.GetGlobalStats(r.Context(), s.db, opts...)
```

- [ ] **Step 5: Update frontend client**

In `apps/desktop/src/lib/orchestra-client.ts`, update `fetchWarehouseStats`:

```typescript
export async function fetchWarehouseStats(config: BackendConfig, since?: string): Promise<GlobalStats> {
    const url = new URL(`${config.baseUrl}/api/v1/warehouse/stats`)
    if (since) url.searchParams.set('since', since)
    const res = await fetch(url.toString(), { headers: authHeaders(config) })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
}
```

- [ ] **Step 6: Run tests**

Run: `cd apps/backend && go test ./internal/db/... -run TestGlobalStatsWithTimeRange -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/backend/internal/db/projects.go apps/backend/internal/db/projects_test.go apps/backend/internal/api/state.go apps/desktop/src/lib/orchestra-client.ts
git commit -m "feat: add time-range filtering to warehouse stats endpoint"
```

---

### Task 4: Add backend stats caching with TTL

**Files:**
- Modify: `apps/backend/internal/api/state.go`

- [ ] **Step 1: Add a simple in-memory cache**

In `apps/backend/internal/api/state.go`, add a cache struct:

```go
type statsCache struct {
    mu       sync.RWMutex
    data     map[string]*cachedStats
}

type cachedStats struct {
    stats   *db.GlobalStats
    fetchedAt time.Time
}

const statsCacheTTL = 30 * time.Second

var globalStatsCache = &statsCache{data: make(map[string]*cachedStats)}

func (c *statsCache) get(key string) (*db.GlobalStats, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    entry, ok := c.data[key]
    if !ok || time.Since(entry.fetchedAt) > statsCacheTTL {
        return nil, false
    }
    return entry.stats, true
}

func (c *statsCache) set(key string, stats *db.GlobalStats) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.data[key] = &cachedStats{stats: stats, fetchedAt: time.Now()}
}
```

- [ ] **Step 2: Use the cache in the handler**

```go
// In the warehouse stats handler:
cacheKey := "global"
if since := r.URL.Query().Get("since"); since != "" {
    cacheKey = "global:" + since
}

if cached, ok := globalStatsCache.get(cacheKey); ok {
    json.NewEncoder(w).Encode(cached)
    return
}

stats, err := db.GetGlobalStats(r.Context(), s.db, opts...)
if err != nil { /* handle */ }

globalStatsCache.set(cacheKey, stats)
json.NewEncoder(w).Encode(stats)
```

- [ ] **Step 3: Run backend tests**

Run: `cd apps/backend && go test ./... -count=1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/api/state.go
git commit -m "perf(backend): add 30s TTL cache for warehouse stats endpoint"
```

---

### Task 5: Split the monolith dashboard into focused chart components

**Files:**
- Create: `apps/desktop/src/components/analytics/charts/ProviderUsageChart.tsx`
- Create: `apps/desktop/src/components/analytics/charts/CostBreakdownChart.tsx`
- Create: `apps/desktop/src/components/analytics/charts/TokenTrendChart.tsx`
- Create: `apps/desktop/src/components/analytics/charts/CostOverTimeChart.tsx`
- Create: `apps/desktop/src/components/analytics/charts/ProjectTokenChart.tsx`
- Create: `apps/desktop/src/components/analytics/charts/ProviderSuccessChart.tsx`
- Create: `apps/desktop/src/components/analytics/StatsCards.tsx`
- Modify: `apps/desktop/src/components/analytics/AnalyticsDashboard.tsx`

- [ ] **Step 1: Create ProviderUsageChart component**

```typescript
// apps/desktop/src/components/analytics/charts/ProviderUsageChart.tsx
import React from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

const chartConfig = {
  claude: { label: 'Claude', color: 'hsl(var(--chart-1))' },
  codex: { label: 'Codex', color: 'hsl(var(--chart-2))' },
  gemini: { label: 'Gemini', color: 'hsl(var(--chart-3))' },
  opencode: { label: 'OpenCode', color: 'hsl(var(--chart-4))' },
  other: { label: 'Other', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig

type Props = {
  data: { name: string; value: number; fill: string }[]
}

export const ProviderUsageChart: React.FC<Props> = ({ data }) => {
  if (data.length === 0) return <p className="text-xs text-muted-foreground text-center py-8">No provider data</p>

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[200px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={entry.fill || CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 2: Create ProviderSuccessChart (new chart — uses provider_sessions)**

```typescript
// apps/desktop/src/components/analytics/charts/ProviderSuccessChart.tsx
import React from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ProviderSessionStats } from '@/lib/orchestra-types'

const chartConfig = {
  completed: { label: 'Completed', color: 'hsl(var(--chart-1))' },
  failed: { label: 'Failed', color: 'hsl(0 84% 60%)' },
} satisfies ChartConfig

type Props = {
  providerSessions: Record<string, ProviderSessionStats> | undefined
}

export const ProviderSuccessChart: React.FC<Props> = ({ providerSessions }) => {
  if (!providerSessions || Object.keys(providerSessions).length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-8">No session data</p>
  }

  const data = Object.entries(providerSessions).map(([provider, stats]) => ({
    provider: provider.charAt(0).toUpperCase() + provider.slice(1),
    completed: stats.completed,
    failed: stats.failed,
    successRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
        <XAxis dataKey="provider" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="failed" stackId="a" fill="var(--color-failed)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 3: Create remaining chart components**

Extract `CostBreakdownChart`, `TokenTrendChart`, `CostOverTimeChart`, `ProjectTokenChart` following the same pattern — each takes typed props and renders a single chart. Move the `useMemo` computations from `AnalyticsDashboard.tsx` into these components.

- [ ] **Step 4: Create StatsCards component for the top-level KPI cards**

```typescript
// apps/desktop/src/components/analytics/StatsCards.tsx
import React from 'react'
import { TrendingUp, Zap, Cpu, DollarSign } from 'lucide-react'
import type { GlobalStats } from '@/lib/orchestra-types'

type Props = {
  stats: GlobalStats
  totalSpend: number
}

export const StatsCards: React.FC<Props> = ({ stats, totalSpend }) => {
  const cards = [
    { label: 'Total Tokens', value: stats.total_tokens.toLocaleString(), icon: Zap, color: 'text-primary' },
    { label: 'Input Tokens', value: stats.total_input.toLocaleString(), icon: TrendingUp, color: 'text-blue-500' },
    { label: 'Output Tokens', value: stats.total_output.toLocaleString(), icon: Cpu, color: 'text-emerald-500' },
    { label: 'Est. Cost', value: `$${totalSpend.toFixed(2)}`, icon: DollarSign, color: 'text-amber-500' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border/20 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2">
            <card.icon className={`h-4 w-4 ${card.color}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{card.label}</span>
          </div>
          <p className="text-xl font-black">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Add time-range selector to the dashboard**

In the refactored `AnalyticsDashboard.tsx`, add a time-range selector at the top:

```typescript
const TIME_RANGES = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 0 },
] as const

// Add state:
const [timeRange, setTimeRange] = useState(30)

// Pass to data fetching:
const since = timeRange > 0
  ? new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000).toISOString()
  : undefined
```

- [ ] **Step 6: Rewrite AnalyticsDashboard as a composition of the new components**

The main dashboard becomes a layout shell that passes data to child components — reducing from ~885 lines to ~150 lines.

- [ ] **Step 7: Run all tests**

Run: `cd apps/desktop && npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/components/analytics/
git commit -m "refactor(desktop): split analytics dashboard into focused chart components, add time-range filter and success rate chart"
```

---

### Task 6: Update session status tracking in the orchestrator

**Files:**
- Modify: `apps/backend/internal/orchestrator/orchestrator.go` (where runs complete)
- Modify: `apps/backend/internal/db/projects.go` (update session status)

- [ ] **Step 1: Write a helper to update session status and duration**

```go
// In projects.go, add:
func UpdateSessionStatus(ctx context.Context, db *sql.DB, sessionID string, status string, durationSeconds float64) error {
    _, err := db.ExecContext(ctx, `UPDATE sessions SET status = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?`,
        status, durationSeconds, sessionID)
    return err
}
```

- [ ] **Step 2: Call it from the orchestrator when runs complete**

In the orchestrator's run completion handler, add:

```go
elapsed := time.Since(runStartTime).Seconds()
status := "completed"
if err != nil {
    status = "failed"
}
_ = db.UpdateSessionStatus(ctx, s.db, sessionID, status, elapsed)
```

- [ ] **Step 3: Run backend tests**

Run: `cd apps/backend && go test ./... -count=1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/orchestrator/ apps/backend/internal/db/projects.go
git commit -m "feat(backend): track session status (completed/failed) and duration on run completion"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full backend test suite**

Run: `cd apps/backend && go test ./... -count=1 -race`
Expected: PASS

- [ ] **Step 2: Run full frontend test suite**

Run: `cd apps/desktop && npx vitest run && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 3: Manual verification checklist**

1. Open Analytics dashboard — should load quickly (< 1s with cache)
2. Toggle time ranges (7d, 30d, 90d, All) — data should filter
3. Provider Usage pie chart — should show all providers, not just Codex
4. New "Provider Success Rate" chart — should show stacked completed/failed bars
5. Cost breakdown — should reflect all providers
6. Session list — should show status badges (completed, failed, unknown)
