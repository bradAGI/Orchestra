# Analytics Dashboard — E2E Testing Guide

End-to-end browser testing for the Analytics dashboard using `expect-cli`.

## Prerequisites

```bash
# Install expect-cli globally
npm install -g expect-cli

# Verify installation
expect-cli --version

# Ensure backend and frontend are running
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
ORCHESTRA_API_TOKEN=dev-token ORCHESTRA_WORKSPACE_ROOT=/tmp/orchestra ./orchestrad &
cd apps/desktop && npm run dev:linux
```

The frontend dev server runs on `http://localhost:5173`. The backend runs on `http://localhost:4010`.

---

## Quick Smoke Test

Run this after any analytics change to verify nothing crashes:

```bash
EXPECT_BASE_URL=http://localhost:5173 expect-cli -m "Navigate to Analytics dashboard. Click all 3 tabs (Executive, Operational, Optimization). Change time range on each. Verify no crashes or JS errors." -y
```

---

## Full Analytics Test Suite

### Test 1: Executive Tab — KPI Cards and Cost Charts

```bash
EXPECT_BASE_URL=http://localhost:5173 expect-cli -m "Navigate to Analytics dashboard (Executive tab).

1. Verify KPI cards render: Total Spend (dollar amount, not NaN), Total Tokens, Total Sessions, ROI estimate
2. Scroll down — verify Cost Trend area chart renders with data points
3. Verify Cost by Model stacked bar chart shows model breakdowns
4. Verify Cost by Project bar chart shows project breakdowns
5. Check Budget gauge section renders (may show 'No budgets configured')
6. Check ROI card computes a value

Change time range: 7d → 30d → 90d → All. Verify charts update and no crashes. Check console for JS errors." -y
```

**Expected results:**
- Total Spend shows a dollar value (e.g., `$12.45`)
- Cost Trend chart has data points following the date axis
- Cost by Model shows stacked bars with input/output/cache/thinking cost breakdowns
- Time range changes trigger data refetch without crashes

### Test 2: Operational Tab — Provider Health and Latency

```bash
EXPECT_BASE_URL=http://localhost:5173 expect-cli -m "Navigate to Analytics dashboard, click Operational tab.

1. Verify Provider Health table loads — check for provider names, latency values (p50/p95/p99 in ms), request counts, success rates
2. Verify Token Usage area chart renders with input/output token areas
3. Verify Latency chart renders with p50/p95/p99 lines
4. Check Error Breakdown pie chart (may show 'No data' if no errors)
5. Check Reliability Funnel visualization
6. Verify Recent Sessions table shows sessions with provider, status, token counts, cost, date
7. Click a session row if available — verify inspect action works

Change time range: 7d → 30d. Check console for JS errors." -y
```

**Expected results:**
- Provider Health table has rows per active provider
- Latency values are in milliseconds (e.g., `245ms`)
- Token Usage chart shows stacked areas for input vs output tokens
- Recent Sessions table shows real session data

### Test 3: Optimization Tab — Cache and Cost Efficiency

```bash
EXPECT_BASE_URL=http://localhost:5173 expect-cli -m "Navigate to Analytics dashboard, click Optimization tab.

1. Verify Cache Hit Rate gauge shows a percentage (donut chart with number)
2. Verify Thinking Token Ratio chart renders
3. Check Agent Comparison table — provider names, sessions, cost/session, lines/session
4. Check Cost Efficiency scatter plot renders (dots by provider)
5. Check Model Downgrade table (may show empty)
6. Check Spend Anomaly list (may show empty)

Change time range. Check console for JS errors." -y
```

**Expected results:**
- Cache Hit Rate gauge shows a percentage like `23.5%` (not `NaN%`)
- Agent Comparison table shows per-provider productivity metrics
- Empty tables show "No data" message, not crashes

### Test 4: Tab Switching and Edge Cases

```bash
EXPECT_BASE_URL=http://localhost:5173 expect-cli -m "Navigate to Analytics dashboard. Test edge cases:

1. Rapidly click Executive → Operational → Optimization → Executive 5 times
2. While on Executive tab, rapidly cycle time range: 7d → 30d → 90d → All → 7d
3. Switch to Operational tab while data is still loading
4. Switch to Optimization tab, change time range, then immediately switch back to Executive
5. Check browser console for any JavaScript errors after all actions
6. Check network tab — verify all analytics API calls return 200, no 404s or 500s

Report any crashes, error boundaries, or console errors." -y
```

**Expected results:**
- No crashes or error boundaries triggered
- No JavaScript errors in console
- All API calls return HTTP 200
- Tab switches are smooth, data loads without flicker

### Test 5: Data Integrity Validation

```bash
EXPECT_BASE_URL=http://localhost:5173 expect-cli -m "Navigate to Analytics dashboard. Validate data consistency:

1. On Executive tab: note the Total Spend value
2. On Executive tab: sum the Cost by Model chart values mentally — should roughly match Total Spend
3. On Operational tab: check that Token Usage chart totals align with the Total Tokens KPI card
4. On Operational tab: verify Recent Sessions count aligns with Total Sessions KPI
5. On Optimization tab: verify Cache Hit Rate is between 0% and 100%
6. Cross-check: the providers shown in Provider Health table should match providers in Agent Comparison table

Report any inconsistencies between displayed values." -y
```

---

## API Endpoint Verification

Test individual endpoints directly:

```bash
# Daily metrics
curl -s http://localhost:4010/api/v1/analytics/daily \
  -H "Authorization: Bearer dev-token" | python3 -m json.tool | head -20

# Cost by model
curl -s "http://localhost:4010/api/v1/analytics/cost?group_by=model" \
  -H "Authorization: Bearer dev-token" | python3 -m json.tool | head -30

# Cost by project
curl -s "http://localhost:4010/api/v1/analytics/cost?group_by=project" \
  -H "Authorization: Bearer dev-token" | python3 -m json.tool | head -30

# Cost optimization
curl -s http://localhost:4010/api/v1/analytics/cost/optimization \
  -H "Authorization: Bearer dev-token" | python3 -m json.tool

# Performance metrics
curl -s http://localhost:4010/api/v1/analytics/performance \
  -H "Authorization: Bearer dev-token" | python3 -m json.tool | head -40

# Productivity
curl -s http://localhost:4010/api/v1/analytics/productivity \
  -H "Authorization: Bearer dev-token" | python3 -m json.tool

# Budgets
curl -s http://localhost:4010/api/v1/analytics/budgets \
  -H "Authorization: Bearer dev-token" | python3 -m json.tool

# All endpoints should return 200
for ep in analytics/daily analytics/cost analytics/cost/optimization \
  analytics/performance analytics/rate-limits analytics/productivity \
  analytics/budgets external/status external/reconcile; do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:4010/api/v1/$ep" -H "Authorization: Bearer dev-token")
  echo "$code $ep"
done
```

---

## Response Shape Reference

Each endpoint returns a specific shape. The client functions in `orchestra-client.ts` unwrap wrapper objects automatically.

| Endpoint | Raw Response | Client Returns |
|----------|-------------|----------------|
| `/analytics/daily` | `DailyRow[]` | `DailyStats[]` (passthrough) |
| `/analytics/cost` | `{ groups, daily, ... }` | `CostRecord[]` (unwraps `.groups`) |
| `/analytics/cost/optimization` | `{ cache_hit_rate: {}, thinking_ratio: {}, ... }` | `CostOptimization` (averages maps into numbers) |
| `/analytics/performance` | `{ provider_health, ... }` | `PerformanceRecord[]` (unwraps + remaps field names) |
| `/analytics/rate-limits` | `{ rate_limits }` | `unknown` (unwraps `.rate_limits`) |
| `/analytics/productivity` | `{ agent_comparison, ... }` | `ProductivityRecord[]` (unwraps `.agent_comparison`) |
| `/analytics/budgets` | `{ budgets }` | `BudgetRecord[]` (unwraps `.budgets`) |
| `/external/reconcile` | `{ reconciliation, since }` | `ExternalReconciliation` (maps to `.discrepancies`) |
| `/external/status` | `{ enabled, providers }` | `ExternalStatus` (passthrough) |

---

## Troubleshooting

**"Analytics failed to render" error boundary:**
- Usually a data shape mismatch — check that the client function unwraps the response correctly
- Open browser console, look for the actual error message
- Test the endpoint directly with curl to see the raw response

**Charts show "No data":**
- Normal if no agent runs have occurred for that time range
- Check `/analytics/daily` endpoint — if it returns `[]`, no data exists
- Verify `daily_metrics` table has data: `sqlite3 ~/.orchestra/workspaces/.orchestra/warehouse.db "SELECT COUNT(*) FROM daily_metrics"`

**$NaN or NaN% values:**
- Cost is estimated from tokens using default pricing when `cost_cents` is 0
- If tokens are also 0, cost will be 0 (shown as `$0.00`, not `$NaN`)
- Check that the pricing module fallback is working: `cost` field should be non-zero if tokens exist

**All endpoints return 404:**
- Routes may not be registered — check `apps/backend/internal/api/router.go` for analytics route block
- Rebuild the backend: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`
- Restart the backend process
