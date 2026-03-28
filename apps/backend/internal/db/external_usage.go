package db

import (
	"context"
	"fmt"
)

// ExternalUsage represents a billing record synced from an external provider
// API (e.g. Anthropic Admin, OpenAI Organization).
type ExternalUsage struct {
	ID           string `json:"id"`
	Provider     string `json:"provider"`
	Source       string `json:"source"`
	Date         string `json:"date"`
	Model        string `json:"model,omitempty"`
	InputTokens  int64  `json:"input_tokens"`
	OutputTokens int64  `json:"output_tokens"`
	CostCents    int64  `json:"cost_cents"`
	RawData      string `json:"raw_data,omitempty"`
	SyncedAt     string `json:"synced_at"`
}

// ReconciliationRow compares local cost estimates against externally reported
// actuals for a given date and provider.
type ReconciliationRow struct {
	Date              string  `json:"date"`
	Provider          string  `json:"provider"`
	LocalCostCents    int64   `json:"local_cost_cents"`
	ExternalCostCents int64   `json:"external_cost_cents"`
	VariancePct       float64 `json:"variance_pct"`
}

// UpsertExternalUsage inserts or updates an external usage record. The unique
// key is the record ID (provider + date + model hash).
func (db *DB) UpsertExternalUsage(ctx context.Context, u ExternalUsage) error {
	query := `
		INSERT INTO external_usage (id, provider, source, date, model, input_tokens, output_tokens, cost_cents, raw_data, synced_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			input_tokens  = excluded.input_tokens,
			output_tokens = excluded.output_tokens,
			cost_cents    = excluded.cost_cents,
			raw_data      = excluded.raw_data,
			synced_at     = CURRENT_TIMESTAMP
	`
	_, err := db.ExecContext(ctx, query, u.ID, u.Provider, u.Source, u.Date, u.Model, u.InputTokens, u.OutputTokens, u.CostCents, u.RawData)
	if err != nil {
		return fmt.Errorf("upsert external usage: %w", err)
	}
	return nil
}

// GetExternalUsage returns external usage records since the given date,
// optionally filtered by provider. Pass an empty provider string to fetch all.
func (db *DB) GetExternalUsage(ctx context.Context, since string, provider string) ([]ExternalUsage, error) {
	var rows_ []ExternalUsage

	query := `SELECT id, provider, source, date, COALESCE(model,''), input_tokens, output_tokens, cost_cents, COALESCE(raw_data,''), synced_at
		FROM external_usage WHERE date >= ?`
	args := []any{since}

	if provider != "" {
		query += " AND provider = ?"
		args = append(args, provider)
	}
	query += " ORDER BY date DESC"

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query external usage: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var u ExternalUsage
		if err := rows.Scan(&u.ID, &u.Provider, &u.Source, &u.Date, &u.Model, &u.InputTokens, &u.OutputTokens, &u.CostCents, &u.RawData, &u.SyncedAt); err != nil {
			return nil, fmt.Errorf("scan external usage: %w", err)
		}
		rows_ = append(rows_, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate external usage: %w", err)
	}
	return rows_, nil
}

// GetSyncStatus returns the last synced_at timestamp for each provider that
// has external usage records.
func (db *DB) GetSyncStatus(ctx context.Context) (map[string]string, error) {
	query := `SELECT provider, MAX(synced_at) FROM external_usage GROUP BY provider`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query sync status: %w", err)
	}
	defer rows.Close()

	status := make(map[string]string)
	for rows.Next() {
		var provider, syncedAt string
		if err := rows.Scan(&provider, &syncedAt); err != nil {
			return nil, fmt.Errorf("scan sync status: %w", err)
		}
		status[provider] = syncedAt
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sync status: %w", err)
	}
	return status, nil
}

// GetReconciliation compares locally estimated costs (from daily_metrics) with
// externally reported costs (from external_usage) for each date and provider
// since the given date.
func (db *DB) GetReconciliation(ctx context.Context, since string) ([]ReconciliationRow, error) {
	query := `
		SELECT
			COALESCE(l.date, e.date) AS date,
			COALESCE(l.provider, e.provider) AS provider,
			COALESCE(l.local_cost, 0) AS local_cost_cents,
			COALESCE(e.ext_cost, 0) AS external_cost_cents
		FROM (
			SELECT date, provider, SUM(cost_cents) AS local_cost
			FROM daily_metrics
			WHERE date >= ?
			GROUP BY date, provider
		) l
		FULL OUTER JOIN (
			SELECT date, provider, SUM(cost_cents) AS ext_cost
			FROM external_usage
			WHERE date >= ?
			GROUP BY date, provider
		) e ON l.date = e.date AND l.provider = e.provider
		ORDER BY date DESC, provider
	`
	rows, err := db.QueryContext(ctx, query, since, since)
	if err != nil {
		// SQLite does not support FULL OUTER JOIN natively in all versions;
		// fall back to a UNION-based approach.
		return db.getReconciliationFallback(ctx, since)
	}
	defer rows.Close()

	var result []ReconciliationRow
	for rows.Next() {
		var r ReconciliationRow
		if err := rows.Scan(&r.Date, &r.Provider, &r.LocalCostCents, &r.ExternalCostCents); err != nil {
			return nil, fmt.Errorf("scan reconciliation: %w", err)
		}
		r.VariancePct = calcVariancePct(r.LocalCostCents, r.ExternalCostCents)
		result = append(result, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate reconciliation: %w", err)
	}
	return result, nil
}

// getReconciliationFallback uses LEFT JOIN + UNION for SQLite versions that
// lack FULL OUTER JOIN support.
func (db *DB) getReconciliationFallback(ctx context.Context, since string) ([]ReconciliationRow, error) {
	query := `
		SELECT date, provider, local_cost_cents, external_cost_cents FROM (
			SELECT
				COALESCE(l.date, e.date) AS date,
				COALESCE(l.provider, e.provider) AS provider,
				COALESCE(l.local_cost, 0) AS local_cost_cents,
				COALESCE(e.ext_cost, 0) AS external_cost_cents
			FROM (
				SELECT date, provider, SUM(cost_cents) AS local_cost
				FROM daily_metrics WHERE date >= ? GROUP BY date, provider
			) l
			LEFT JOIN (
				SELECT date, provider, SUM(cost_cents) AS ext_cost
				FROM external_usage WHERE date >= ? GROUP BY date, provider
			) e ON l.date = e.date AND l.provider = e.provider

			UNION ALL

			SELECT
				e2.date,
				e2.provider,
				0 AS local_cost_cents,
				e2.ext_cost AS external_cost_cents
			FROM (
				SELECT date, provider, SUM(cost_cents) AS ext_cost
				FROM external_usage WHERE date >= ? GROUP BY date, provider
			) e2
			LEFT JOIN (
				SELECT date, provider FROM daily_metrics WHERE date >= ? GROUP BY date, provider
			) l2 ON e2.date = l2.date AND e2.provider = l2.provider
			WHERE l2.date IS NULL
		)
		ORDER BY date DESC, provider
	`
	rows, err := db.QueryContext(ctx, query, since, since, since, since)
	if err != nil {
		return nil, fmt.Errorf("query reconciliation fallback: %w", err)
	}
	defer rows.Close()

	var result []ReconciliationRow
	for rows.Next() {
		var r ReconciliationRow
		if err := rows.Scan(&r.Date, &r.Provider, &r.LocalCostCents, &r.ExternalCostCents); err != nil {
			return nil, fmt.Errorf("scan reconciliation fallback: %w", err)
		}
		r.VariancePct = calcVariancePct(r.LocalCostCents, r.ExternalCostCents)
		result = append(result, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate reconciliation fallback: %w", err)
	}
	return result, nil
}

func calcVariancePct(local, external int64) float64 {
	if external == 0 {
		if local == 0 {
			return 0
		}
		return 100
	}
	return float64(local-external) / float64(external) * 100
}
