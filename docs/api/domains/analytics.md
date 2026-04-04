# Analytics Domain

## Scope

- `/api/v1/warehouse/stats`
- `/api/v1/telemetry/health`
- `/api/v1/analytics/*`
- `/api/v1/external/*`

## Canonical Resources

- `WarehouseStats`
- `TelemetryHealth`
- `AnalyticsDaily`
- `AnalyticsCost`
- `AnalyticsPerformance`
- `AnalyticsProductivity`
- `Budget`
- `ExternalSyncStatus`

## Current Weak Spots

- Analytics endpoints cover several separate report types and should not share vague generic objects.
- Short-path external endpoints should reuse the same schemas as their analytics-prefixed equivalents.
- Budget and optimization payloads likely need explicit request and response models.

## Shared Refs

- `common/id`
- `common/timestamp`
- `common/token-usage`
- `common/provider`

## Test Targets

- `/api/v1/warehouse/stats`
- `/api/v1/analytics/cost`
- `/api/v1/analytics/productivity`
- `/api/v1/external/status`
