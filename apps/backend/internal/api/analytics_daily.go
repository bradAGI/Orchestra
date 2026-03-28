package api

import (
	"net/http"
	"time"

	"github.com/orchestra/orchestra/apps/backend/internal/pricing"
)

// GetAnalyticsDaily handles GET /api/v1/analytics/daily and returns daily
// aggregated metrics (sessions, tokens, cost) from the daily_metrics table.
// Query params: since, until (both YYYY-MM-DD format, default last 30 days).
func (s *Server) GetAnalyticsDaily(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "warehouse database not available")
		return
	}

	since := r.URL.Query().Get("since")
	until := r.URL.Query().Get("until")

	if since == "" {
		since = time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if until == "" {
		until = time.Now().UTC().Format("2006-01-02")
	}

	query := `SELECT date,
		COALESCE(SUM(session_count), 0),
		COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0),
		COALESCE(SUM(input_tokens), 0),
		COALESCE(SUM(output_tokens), 0),
		COALESCE(SUM(cost_cents), 0)
		FROM daily_metrics
		WHERE date >= ? AND date <= ?
		GROUP BY date
		ORDER BY date ASC`

	rows, err := s.db.QueryContext(r.Context(), query, since, until)
	if err != nil {
		s.logger.Error().Err(err).Msg("query analytics daily")
		writeJSONError(w, http.StatusInternalServerError, "query_error", "failed to query daily metrics")
		return
	}
	defer rows.Close()

	type DailyRow struct {
		Date         string  `json:"date"`
		Sessions     int64   `json:"sessions"`
		Tokens       int64   `json:"tokens"`
		InputTokens  int64   `json:"input_tokens"`
		OutputTokens int64   `json:"output_tokens"`
		CostCents    int64   `json:"cost_cents"`
		Cost         float64 `json:"cost"`
	}

	var result []DailyRow
	for rows.Next() {
		var d DailyRow
		if err := rows.Scan(&d.Date, &d.Sessions, &d.Tokens, &d.InputTokens, &d.OutputTokens, &d.CostCents); err != nil {
			s.logger.Error().Err(err).Msg("scan analytics daily row")
			continue
		}
		if d.CostCents > 0 {
			d.Cost = float64(d.CostCents) / 100.0
		} else if d.InputTokens > 0 || d.OutputTokens > 0 {
			// CostCents is 0 but we have tokens — estimate using default pricing.
			p := pricing.GetModelPricing("")
			d.Cost = float64(d.InputTokens)*p.InputPerMTok/1_000_000.0 +
				float64(d.OutputTokens)*p.OutputPerMTok/1_000_000.0
		}
		result = append(result, d)
	}

	if result == nil {
		result = []DailyRow{}
	}

	writeJSON(w, http.StatusOK, result)
}
