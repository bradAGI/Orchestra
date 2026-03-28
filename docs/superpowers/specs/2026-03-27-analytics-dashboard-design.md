# Analytics Dashboard — Multi-Agent Usage, Cost, Performance & Productivity

**Status:** Approved
**Date:** 2026-03-27
**Epic:** #79
**Sub-issues:** #90, #91, #92, #93, #94, #95

---

## 1. Goal

Rebuild the analytics dashboard from a slow, Codex-only, 885-line monolith into a comprehensive multi-agent analytics platform with:

- Granular token tracking (input, output, cache read/write, thinking, tool) across Claude, Codex, Gemini, and OpenCode
- Accurate cost calculation with model-specific pricing, cache discounts, and thinking token adjustments
- Performance monitoring (latency, error rates, rate limits, reliability funnel)
- Git-based productivity metrics (lines, files, commits, PR merge rate) per agent session
- Optional external API integration (Anthropic Admin, OpenAI Usage, GCP billing)
- Three-view frontend: Executive, Operational, Optimization

## 2. Current State

### What exists
- `events` table: `input_tokens`, `output_tokens` (integers, no cache/thinking breakdown)
- `sessions` table: `provider`, `model` (no status, duration, cost)
- `GlobalStats`: aggregates totals, no time-range filtering, no caching
- `AnalyticsDashboard.tsx`: 885-line monolith, 6 hardcoded charts, client-side cost estimation with stale pricing
- Telemetry watcher (`internal/telemetry/watcher.go`): already ingests JSONL from all 4 providers
- Token extraction (`command_runner.go`): handles multiple naming conventions, misses cache/thinking fields

### What's missing
- Cache/thinking/tool token columns
- Session status (completed/failed) and duration
- Daily rollup table for fast dashboard queries
- Time-range filtering on stats endpoint
- Backend pricing service (currently hardcoded in frontend)
- Performance metrics (latency, errors, rate limits)
- Git productivity metrics
- External billing API integration
- Budget management
- Componentized frontend with multiple views

## 3. Schema Design

### 3.1 Modified tables

**events** — add columns:
```sql
cache_read_tokens    INTEGER DEFAULT 0
cache_write_tokens   INTEGER DEFAULT 0
thinking_tokens      INTEGER DEFAULT 0
tool_tokens          INTEGER DEFAULT 0
```

**sessions** — add columns:
```sql
status               TEXT NOT NULL DEFAULT 'unknown'   -- completed, failed, unknown
duration_seconds     REAL NOT NULL DEFAULT 0
cost_cents           INTEGER DEFAULT 0                 -- integer cents for precision
turn_count           INTEGER DEFAULT 0
```

### 3.2 New tables

**daily_metrics** (pre-aggregated rollup, owned by #90):
```sql
CREATE TABLE IF NOT EXISTS daily_metrics (
    date         TEXT NOT NULL,
    project_id   TEXT NOT NULL DEFAULT '',
    provider     TEXT NOT NULL DEFAULT '',
    model        TEXT NOT NULL DEFAULT '',
    input_tokens   INTEGER DEFAULT 0,
    output_tokens  INTEGER DEFAULT 0,
    cache_read     INTEGER DEFAULT 0,
    cache_write    INTEGER DEFAULT 0,
    thinking       INTEGER DEFAULT 0,
    cost_cents     INTEGER DEFAULT 0,
    request_count  INTEGER DEFAULT 0,
    session_count  INTEGER DEFAULT 0,
    completed      INTEGER DEFAULT 0,
    failed         INTEGER DEFAULT 0,
    avg_duration   REAL DEFAULT 0,
    PRIMARY KEY (date, project_id, provider, model)
) WITHOUT ROWID;
```

**api_requests** (per-LLM-call granularity, owned by #92):
```sql
CREATE TABLE IF NOT EXISTS api_requests (
    id             TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL,
    provider       TEXT NOT NULL,
    model          TEXT NOT NULL,
    input_tokens   INTEGER DEFAULT 0,
    output_tokens  INTEGER DEFAULT 0,
    latency_ms     INTEGER DEFAULT 0,
    status_code    INTEGER DEFAULT 200,
    error_type     TEXT,
    rate_limit_remaining_requests INTEGER,
    rate_limit_remaining_tokens   INTEGER,
    created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_requests_session ON api_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_time ON api_requests(created_at);
```

**session_git_metrics** (post-session git analysis, owned by #93):
```sql
CREATE TABLE IF NOT EXISTS session_git_metrics (
    session_id      TEXT PRIMARY KEY,
    lines_added     INTEGER DEFAULT 0,
    lines_removed   INTEGER DEFAULT 0,
    files_changed   INTEGER DEFAULT 0,
    test_files      INTEGER DEFAULT 0,
    commits         INTEGER DEFAULT 0,
    hunks           INTEGER DEFAULT 0,
    pr_url          TEXT,
    pr_merged       INTEGER DEFAULT 0,
    ci_passed       INTEGER DEFAULT -1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**external_usage** (synced billing data, owned by #94):
```sql
CREATE TABLE IF NOT EXISTS external_usage (
    id          TEXT PRIMARY KEY,
    provider    TEXT NOT NULL,
    source      TEXT NOT NULL,
    date        TEXT NOT NULL,
    model       TEXT,
    input_tokens  INTEGER,
    output_tokens INTEGER,
    cost_cents    INTEGER,
    raw_data      TEXT,
    synced_at     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_external_usage_date ON external_usage(date, provider);
```

**budgets** (spend limits, owned by #91):
```sql
CREATE TABLE IF NOT EXISTS budgets (
    id          TEXT PRIMARY KEY,
    project_id  TEXT,
    provider    TEXT,
    period      TEXT NOT NULL,
    limit_cents INTEGER NOT NULL,
    alert_pct   INTEGER DEFAULT 80,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3 Migration strategy

All migrations use the existing `migrateColumn()` pattern in `migrate.go`. Agent #90 owns `schema.go` and `migrate.go` and creates ALL table definitions and column migrations — including tables owned by other agents — so no other agent needs to touch these files.

## 4. Per-Provider Token Extraction

### 4.1 Claude Code
| Field | JSONL Path |
|-------|-----------|
| input_tokens | `message.usage.input_tokens` |
| output_tokens | `message.usage.output_tokens` |
| cache_read_tokens | `message.usage.cache_read_input_tokens` |
| cache_write_tokens | `message.usage.cache_creation_input_tokens` |

OTEL (when enabled): `claude_code.token.usage` with `type` attribute, `claude_code.cost.usage` in USD.

### 4.2 Codex CLI
| Field | JSONL Path |
|-------|-----------|
| input_tokens | `turn.completed.usage.input_tokens` or `payload.info.last_token_usage.input` |
| output_tokens | `turn.completed.usage.output_tokens` or `payload.info.last_token_usage.output` |
| cached_input_tokens | `turn.completed.usage.cached_input_tokens` |
| reasoning_tokens | API response `completion_tokens_details.reasoning_tokens` |

### 4.3 Gemini CLI
| Field | Session JSON Path |
|-------|------------------|
| input | `tokens.input` per message |
| output | `tokens.output` per message |
| cached | `tokens.cached` per message |
| thoughts | `tokens.thoughts` per message |
| tool | `tokens.tool` per message |

OTEL: `gemini_cli.token.usage`, `gen_ai.client.token.usage`

### 4.4 OpenCode
Standard `usage` object from underlying provider (Anthropic, OpenAI, Gemini, etc.). Fields depend on which provider is configured.

### 4.5 extractUsage() changes

Update `command_runner.go` to look for these additional fields in the nested JSON structures it already traverses:
- `cache_read_input_tokens`, `cache_creation_input_tokens` (Anthropic naming)
- `cached_input_tokens`, `cached_tokens` (OpenAI naming)
- `reasoning_tokens`, `completion_tokens_details.reasoning_tokens` (OpenAI)
- `thoughts`, `thoughtsTokenCount` (Gemini naming)
- `tool`, `toolUsePromptTokenCount` (Gemini naming)

## 5. Backend Services & API Endpoints

### 5.1 Token Usage (#90)

**Endpoints:**
```
GET /api/v1/warehouse/stats?since=&until=&provider=&project_id=
GET /api/v1/analytics/daily?since=&until=&provider=&model=
```

**Background workers:**
- Rollup worker: aggregates events → daily_metrics every 5 minutes
- Stats cache: 30-second TTL in-memory cache keyed by query params

**Files created/modified:**
- Modify: `db/schema.go`, `db/migrate.go`, `db/projects.go`, `api/state.go`
- Modify: `agents/command_runner.go` (extractUsage)
- Modify: `app/run.go` (rollup worker)
- Modify: `orchestra-types.ts` (extend GlobalStats, ProviderTokens)

### 5.2 Cost Tracking (#91)

**Endpoints:**
```
GET    /api/v1/analytics/cost?since=&until=&group_by=project|model|provider
GET    /api/v1/analytics/cost/optimization
POST   /api/v1/analytics/budgets
GET    /api/v1/analytics/budgets
DELETE /api/v1/analytics/budgets/{id}
```

**Files created:**
- `internal/pricing/pricing.go` — model pricing table, `CalculateSessionCost()`, cache/thinking discount math
- `internal/db/budgets.go` — budget CRUD
- `internal/api/analytics_cost.go` — cost + budget endpoints

**Pricing logic:**
- Cost stored as integer cents on sessions.cost_cents
- Anthropic: cache_read at 10% of input price, cache_write at 125% of input
- OpenAI: cached_input at 50% of input
- Gemini: thinking tokens at output rate
- All: thinking tokens at output rate

### 5.3 Performance (#92)

**Endpoints:**
```
GET /api/v1/analytics/performance?since=&provider=
GET /api/v1/analytics/rate-limits
```

**Files created:**
- `internal/db/api_requests.go` — insert/query api_requests
- `internal/api/analytics_performance.go` — performance + rate limit endpoints

**Data collection:**
- Parse agent stream-json output for per-turn timing
- Capture rate limit headers when proxying agent API calls
- Categorize errors: api_error, timeout, tool_failure, context_overflow

### 5.4 Git Productivity (#93)

**Endpoints:**
```
GET /api/v1/analytics/productivity?since=&provider=
GET /api/v1/analytics/productivity/sessions?since=
```

**Files created:**
- `internal/db/git_metrics.go` — git metrics CRUD
- `internal/api/analytics_productivity.go` — productivity endpoints
- `internal/workspace/git_analysis.go` — post-session `git diff --numstat` analysis

**Data collection:**
- After session/run completes in orchestrator, call `AnalyzeSessionOutput(worktreePath, sessionID)`
- Parse `git diff --numstat` for lines added/removed, files changed
- Detect test files by extension pattern (`*_test.*`, `*.test.*`, `*.spec.*`)
- Count commits via `git log --oneline`

### 5.5 External APIs (#94)

**Endpoints:**
```
POST /api/v1/analytics/external/sync
GET  /api/v1/analytics/external/status
GET  /api/v1/analytics/external/reconcile
```

**Files created:**
- `internal/db/external_usage.go` — external_usage CRUD
- `internal/api/analytics_external.go` — sync/status/reconcile endpoints
- `internal/analytics/anthropic_sync.go` — Anthropic Admin API client
- `internal/analytics/openai_sync.go` — OpenAI Organization API client

**Configuration (new env vars):**
- `ORCHESTRA_ANTHROPIC_ADMIN_KEY` — Anthropic Admin API key
- `ORCHESTRA_OPENAI_ADMIN_KEY` — OpenAI Organization Admin API key
- `ORCHESTRA_ANALYTICS_SYNC_INTERVAL` — default "1h", "0" to disable
- `ORCHESTRA_ANALYTICS_EXTERNAL_ENABLED` — default "false"

**Background worker:** syncs on configurable interval, off by default, manual trigger available.

### 5.6 Frontend (#95)

No backend changes. Consumes all endpoints above.

## 6. Frontend Architecture

### 6.1 Dashboard shell

```
AnalyticsDashboard.tsx (~120 lines)
├── Header: title + TimeRangeSelector + ProviderFilter + ProjectFilter
├── Tab bar: Executive | Operational | Optimization
└── Active view component
```

### 6.2 Data hook

```typescript
function useAnalyticsData(timeRange, providerFilter, projectFilter) {
  // Parallel fetches:
  //   fetchWarehouseStats(config, since)       → token totals + provider breakdown
  //   fetchAnalyticsDaily(config, since)       → daily rollups for time-series charts
  //   fetchAnalyticsCost(config, since)        → cost breakdowns + optimization insights
  //   fetchAnalyticsPerformance(config, since) → latency percentiles + error breakdown
  //   fetchAnalyticsProductivity(config, since)→ git metrics + agent comparison
  //   fetchExternalReconcile(config)           → billing comparison (optional)
  // Returns typed state with loading/error per domain
}
```

### 6.3 Executive View

| Component | Chart Type | Data |
|-----------|-----------|------|
| StatsCards | 4 KPI cards | Total spend, tokens, sessions, ROI |
| CostTrendChart | Line + budget threshold | daily_metrics cost_cents |
| CostByProjectChart | Horizontal bar | cost grouped by project |
| CostByModelChart | Stacked bar (input + output + cache + thinking) | cost grouped by model |
| BudgetGauge | Gauge chart | budget utilization |
| ROICard | KPI with configurable hourly rate | composite calculation |

### 6.4 Operational View

| Component | Chart Type | Data |
|-----------|-----------|------|
| ProviderHealthTable | Table with status dots | per-provider latency, errors, sessions |
| TokenUsageChart | Stacked area over time | daily_metrics token fields |
| LatencyChart | Line (p50/p95/p99) | session durations |
| ReliabilityFunnel | Funnel | dispatched → completed → PR merged |
| ErrorBreakdown | Pie chart | error types |
| RecentSessionsTable | Sortable table | sessions with cost, tokens, status |

### 6.5 Optimization View

| Component | Chart Type | Data |
|-----------|-----------|------|
| CacheHitRateGauge | Gauge per provider | cache_read / total_input |
| ThinkingTokenRatio | Bar per model | thinking / output |
| AgentComparisonTable | Side-by-side table | cross-provider metrics |
| CostEfficiencyScatter | Scatter (cost vs lines) | session cost × git metrics |
| ModelDowngradeTable | Recommendation table | success rate × cost analysis |
| SpendAnomalyList | Alert list | sessions > 2 sigma from mean |
| ReconciliationCard | Local vs actual | external_usage comparison |

### 6.6 File structure

```
src/components/analytics/
├── AnalyticsDashboard.tsx
├── TimeRangeSelector.tsx
├── ChartCard.tsx
├── useAnalyticsData.ts
├── views/
│   ├── ExecutiveView.tsx
│   ├── OperationalView.tsx
│   └── OptimizationView.tsx
├── charts/
│   ├── StatsCards.tsx
│   ├── CostTrendChart.tsx
│   ├── CostByProjectChart.tsx
│   ├── CostByModelChart.tsx
│   ├── TokenUsageChart.tsx
│   ├── ProviderUsageChart.tsx
│   ├── LatencyChart.tsx
│   ├── ReliabilityFunnel.tsx
│   ├── ErrorBreakdown.tsx
│   ├── CacheHitRateGauge.tsx
│   ├── ThinkingTokenRatio.tsx
│   ├── CostEfficiencyScatter.tsx
│   ├── BudgetGauge.tsx
│   ├── ROICard.tsx
│   └── SpendAnomalyList.tsx
└── tables/
    ├── RecentSessionsTable.tsx
    ├── ProviderHealthTable.tsx
    ├── AgentComparisonTable.tsx
    └── ModelDowngradeTable.tsx
```

## 7. File Ownership & Merge Strategy

### 7.1 Ownership table

| File | Owner | Others |
|------|-------|--------|
| `db/schema.go` | #90 | Read-only |
| `db/migrate.go` | #90 | Read-only |
| `db/projects.go` | #90 (extends GlobalStats) | Read-only |
| `db/budgets.go` | #91 (new) | #95 reads |
| `db/api_requests.go` | #92 (new) | #95 reads |
| `db/git_metrics.go` | #93 (new) | #95 reads |
| `db/external_usage.go` | #94 (new) | #95 reads |
| `internal/pricing/pricing.go` | #91 (new) | #95 reads |
| `internal/analytics/anthropic_sync.go` | #94 (new) | None |
| `internal/analytics/openai_sync.go` | #94 (new) | None |
| `internal/workspace/git_analysis.go` | #93 (new) | None |
| `internal/api/analytics_cost.go` | #91 (new) | None |
| `internal/api/analytics_performance.go` | #92 (new) | None |
| `internal/api/analytics_productivity.go` | #93 (new) | None |
| `internal/api/analytics_external.go` | #94 (new) | None |
| `api/state.go` | #90 (cache + time filter) | Others add new handler funcs |
| `api/router.go` | #90 adds analytics route group | Others add routes in labeled blocks |
| `app/run.go` | #90 adds rollup worker | #94 adds sync worker |
| `config/types.go` | #94 adds analytics config fields | None |
| `config/load.go` | #94 parses new env vars | None |
| `agents/command_runner.go` | #90 extends extractUsage | None |
| `orchestrator/orchestrator.go` | #93 adds post-completion git analysis call | None |
| `AnalyticsDashboard.tsx` | #95 (full rewrite) | None |
| `src/components/analytics/*` | #95 (all new files) | None |
| `src/lib/orchestra-types.ts` | #90 extends types | #95 reads |
| `src/lib/orchestra-client.ts` | #95 adds fetch functions | None |

### 7.2 Merge order

```
1. #90 Token Schema       — foundation, merges first
2. #91 Cost Tracking       — adds pricing, budgets
3. #92 Performance         — adds api_requests, latency
4. #93 Git Productivity    — adds git_metrics, workspace analysis
5. #94 External APIs       — adds sync workers, config
6. #95 Frontend            — consumes everything, merges last
```

### 7.3 Conflict hotspots

| File | Risk | Mitigation |
|------|------|-----------|
| `router.go` | Multiple agents add routes | Each agent uses labeled block comment |
| `orchestra-types.ts` | Multiple agents add types | #90 adds all shared types; #95 adds frontend-only types |
| `app/run.go` | #90 + #94 add workers | Separate named functions, no overlapping lines |

## 8. Pricing Reference

### Anthropic (per MTok)
| Model | Input | Output | Cache Write (5m) | Cache Read |
|-------|-------|--------|-----------------|------------|
| Opus 4.6 | $5.00 | $25.00 | $6.25 | $0.50 |
| Sonnet 4.6 | $3.00 | $15.00 | $3.75 | $0.30 |
| Haiku 4.5 | $1.00 | $5.00 | $1.25 | $0.10 |

### OpenAI (per MTok)
| Model | Input | Output | Cached Input |
|-------|-------|--------|-------------|
| GPT-5.4 | $2.50 | $15.00 | $1.25 |
| GPT-5.1 Codex | $1.25 | $10.00 | $0.625 |
| o3 | $10.00 | $40.00 | $5.00 |

### Google (per MTok)
| Model | Input | Output |
|-------|-------|--------|
| Gemini 2.5 Pro | $1.25 | $10.00 |
| Gemini 2.5 Flash | $0.30 | $2.50 |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 |

All providers: thinking tokens billed at output rate. Batch API = 50% off where available.

## 9. External API Reference

| API | Endpoint | Auth | Data |
|-----|----------|------|------|
| Anthropic Usage | `/v1/organizations/usage_report/messages` | Admin key | Token usage per 1m/1h/1d |
| Anthropic Cost | `/v1/organizations/cost_report` | Admin key | USD costs per day |
| Anthropic CC Analytics | `/v1/organizations/usage_report/claude_code` | Admin key | Per-user sessions, LOC, commits, PRs |
| OpenAI Usage | `/v1/organization/usage/completions` | Admin key | Token usage per 1m/1h/1d |
| OpenAI Cost | `/v1/organization/costs` | Admin key | USD costs per day |
| GCP Billing | BigQuery export table | GCP credentials | Per-SKU usage and cost |

## 10. OTEL Conventions

Using OpenTelemetry `gen_ai.*` namespace for any future instrumentation:
- `gen_ai.client.token.usage` — histogram, tokens
- `gen_ai.client.operation.duration` — histogram, seconds
- `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` — span attributes
- `gen_ai.system` = `openai` | `anthropic` | `google_ai`
- `gen_ai.request.model`, `gen_ai.response.model`

Provider-specific metrics already available:
- Claude Code: `claude_code.token.usage`, `claude_code.cost.usage`, `claude_code.api_request` events
- Gemini CLI: `gemini_cli.token.usage`, `gemini_cli.api.request.count`, `gemini_cli.tool.call.count`
- Codex CLI: OTEL spans with token attributes (exec mode has known gap: #12913)
