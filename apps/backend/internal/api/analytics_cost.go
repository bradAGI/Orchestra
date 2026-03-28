package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/pricing"
)

// GetAnalyticsCost handles GET /api/v1/analytics/cost and returns cost data
// grouped by the requested dimension (project, model, or provider).
func (s *Server) GetAnalyticsCost(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "warehouse database not available")
		return
	}

	since := r.URL.Query().Get("since")
	until := r.URL.Query().Get("until")
	groupBy := r.URL.Query().Get("group_by")

	if since == "" {
		since = time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if until == "" {
		until = time.Now().UTC().Format("2006-01-02")
	}
	if groupBy == "" {
		groupBy = "provider"
	}

	// Validate group_by
	var groupCol string
	switch groupBy {
	case "project":
		groupCol = "project_id"
	case "model":
		groupCol = "model"
	case "provider":
		groupCol = "provider"
	default:
		writeJSONError(w, http.StatusBadRequest, "invalid_group_by", "group_by must be project, model, or provider")
		return
	}

	// Query daily_metrics grouped by the requested dimension
	query := `SELECT ` + groupCol + `,
		COALESCE(SUM(input_tokens), 0),
		COALESCE(SUM(output_tokens), 0),
		COALESCE(SUM(cache_read), 0),
		COALESCE(SUM(cache_write), 0),
		COALESCE(SUM(thinking), 0),
		COALESCE(SUM(cost_cents), 0),
		COALESCE(SUM(session_count), 0)
		FROM daily_metrics
		WHERE date >= ? AND date <= ?
		GROUP BY ` + groupCol + `
		ORDER BY SUM(cost_cents) DESC`

	rows, err := s.db.QueryContext(r.Context(), query, since, until)
	if err != nil {
		s.logger.Error().Err(err).Msg("query analytics cost")
		writeJSONError(w, http.StatusInternalServerError, "query_error", "failed to query cost data")
		return
	}
	defer rows.Close()

	type CostGroup struct {
		Key          string `json:"key"`
		InputTokens  int64  `json:"input_tokens"`
		OutputTokens int64  `json:"output_tokens"`
		CacheRead    int64  `json:"cache_read"`
		CacheWrite   int64  `json:"cache_write"`
		Thinking     int64  `json:"thinking"`
		CostCents    int64  `json:"cost_cents"`
		SessionCount int64  `json:"session_count"`
	}

	var groups []CostGroup
	var totalCents int64
	for rows.Next() {
		var g CostGroup
		if err := rows.Scan(&g.Key, &g.InputTokens, &g.OutputTokens, &g.CacheRead, &g.CacheWrite, &g.Thinking, &g.CostCents, &g.SessionCount); err != nil {
			s.logger.Error().Err(err).Msg("scan analytics cost row")
			continue
		}
		totalCents += g.CostCents
		groups = append(groups, g)
	}

	// Also fetch daily time series for charting
	timeQuery := `SELECT date, COALESCE(SUM(cost_cents), 0)
		FROM daily_metrics
		WHERE date >= ? AND date <= ?
		GROUP BY date
		ORDER BY date ASC`

	timeRows, err := s.db.QueryContext(r.Context(), timeQuery, since, until)
	if err != nil {
		s.logger.Error().Err(err).Msg("query analytics cost time series")
		// Non-fatal: return groups without time series
		writeJSON(w, http.StatusOK, map[string]any{
			"group_by":         groupBy,
			"groups":           groups,
			"total_cost_cents": totalCents,
			"since":            since,
			"until":            until,
		})
		return
	}
	defer timeRows.Close()

	type DailyPoint struct {
		Date      string `json:"date"`
		CostCents int64  `json:"cost_cents"`
	}
	var timeSeries []DailyPoint
	for timeRows.Next() {
		var dp DailyPoint
		if err := timeRows.Scan(&dp.Date, &dp.CostCents); err != nil {
			continue
		}
		timeSeries = append(timeSeries, dp)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"group_by":         groupBy,
		"groups":           groups,
		"total_cost_cents": totalCents,
		"daily":            timeSeries,
		"since":            since,
		"until":            until,
	})
}

// GetCostOptimization handles GET /api/v1/analytics/cost/optimization and returns
// cache hit rates, thinking ratios, effective token prices, and spend projections.
func (s *Server) GetCostOptimization(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "warehouse database not available")
		return
	}

	since := r.URL.Query().Get("since")
	if since == "" {
		since = time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02")
	}

	query := `SELECT provider, model,
		COALESCE(SUM(input_tokens), 0),
		COALESCE(SUM(output_tokens), 0),
		COALESCE(SUM(cache_read), 0),
		COALESCE(SUM(cache_write), 0),
		COALESCE(SUM(thinking), 0),
		COALESCE(SUM(cost_cents), 0),
		COUNT(DISTINCT date)
		FROM daily_metrics
		WHERE date >= ?
		GROUP BY provider, model`

	rows, err := s.db.QueryContext(r.Context(), query, since)
	if err != nil {
		s.logger.Error().Err(err).Msg("query cost optimization")
		writeJSONError(w, http.StatusInternalServerError, "query_error", "failed to query optimization data")
		return
	}
	defer rows.Close()

	var metricsRows []pricing.MetricsRow
	maxDays := 0
	for rows.Next() {
		var mr pricing.MetricsRow
		var dayCount int
		if err := rows.Scan(&mr.Provider, &mr.Model, &mr.InputTokens, &mr.OutputTokens, &mr.CacheRead, &mr.CacheWrite, &mr.Thinking, &mr.CostCents, &dayCount); err != nil {
			s.logger.Error().Err(err).Msg("scan optimization row")
			continue
		}
		if dayCount > maxDays {
			maxDays = dayCount
		}
		metricsRows = append(metricsRows, mr)
	}

	opt := pricing.CalculateCostOptimization(metricsRows, maxDays)
	writeJSON(w, http.StatusOK, opt)
}

// PostBudget handles POST /api/v1/analytics/budgets to create a new budget.
func (s *Server) PostBudget(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "warehouse database not available")
		return
	}

	var b db.Budget
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "failed to decode request body")
		return
	}

	created, err := s.db.CreateBudget(r.Context(), b)
	if err != nil {
		s.logger.Error().Err(err).Msg("create budget")
		writeJSONError(w, http.StatusBadRequest, "create_error", err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// GetBudgets handles GET /api/v1/analytics/budgets and returns all budgets
// with their current utilization.
func (s *Server) GetBudgets(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "warehouse database not available")
		return
	}

	budgets, err := s.db.ListBudgets(r.Context())
	if err != nil {
		s.logger.Error().Err(err).Msg("list budgets")
		writeJSONError(w, http.StatusInternalServerError, "query_error", "failed to list budgets")
		return
	}

	type BudgetWithUtilization struct {
		db.Budget
		SpentCents  int64   `json:"spent_cents"`
		Utilization float64 `json:"utilization"`
	}

	var result []BudgetWithUtilization
	for _, b := range budgets {
		bwu := BudgetWithUtilization{Budget: b}
		spent, limit, err := s.db.GetBudgetUtilization(r.Context(), b.ID)
		if err == nil && limit > 0 {
			bwu.SpentCents = spent
			bwu.Utilization = float64(spent) / float64(limit)
		}
		result = append(result, bwu)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"budgets": result,
	})
}

// DeleteBudget handles DELETE /api/v1/analytics/budgets/{id}.
func (s *Server) DeleteBudget(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "warehouse database not available")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "missing_id", "budget id is required")
		return
	}

	err := s.db.DeleteBudget(r.Context(), id)
	if err != nil {
		s.logger.Error().Err(err).Msg("delete budget")
		writeJSONError(w, http.StatusNotFound, "not_found", "budget not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
