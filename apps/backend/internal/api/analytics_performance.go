package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"
)

// GetAnalyticsPerformance handles GET /api/v1/analytics/performance.
// Query params:
//
//	since    — RFC3339 timestamp or relative duration ("7d", "30d"). Default: 7d.
//	provider — optional provider filter (e.g. "CLAUDE", "CODEX").
func (s *Server) GetAnalyticsPerformance(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "warehouse database not available")
		return
	}

	since := parseSinceParam(r.URL.Query().Get("since"))
	provider := strings.TrimSpace(r.URL.Query().Get("provider"))

	metrics, err := s.db.GetPerformanceMetrics(r.Context(), since, provider)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get performance metrics")
		writeJSONError(w, http.StatusInternalServerError, "query_error", "failed to query performance metrics")
		return
	}

	writeJSON(w, http.StatusOK, metrics)
}

// GetRateLimits handles GET /api/v1/analytics/rate-limits.
func (s *Server) GetRateLimits(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "warehouse database not available")
		return
	}

	limits, err := s.db.GetRateLimitStatus(r.Context())
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get rate limit status")
		writeJSONError(w, http.StatusInternalServerError, "query_error", "failed to query rate limits")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"rate_limits": limits,
	})
}

// parseSinceParam converts a "since" query parameter to a unix timestamp.
// Accepts RFC3339 ("2026-03-20T00:00:00Z") or relative durations ("7d", "30d", "24h").
// Defaults to 7 days ago if the value is empty or unparseable.
func parseSinceParam(raw string) int64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Now().Add(-7 * 24 * time.Hour).Unix()
	}

	// Try RFC3339 first.
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.Unix()
	}

	// Try RFC3339 with milliseconds (e.g. "2026-03-20T00:00:00.000Z").
	if t, err := time.Parse("2006-01-02T15:04:05.000Z", raw); err == nil {
		return t.Unix()
	}

	// Try relative duration: number + unit suffix (d=days, h=hours, m=minutes).
	if len(raw) >= 2 {
		suffix := raw[len(raw)-1]
		numStr := raw[:len(raw)-1]
		if n, err := strconv.Atoi(numStr); err == nil && n > 0 {
			switch suffix {
			case 'd':
				return time.Now().Add(-time.Duration(n) * 24 * time.Hour).Unix()
			case 'h':
				return time.Now().Add(-time.Duration(n) * time.Hour).Unix()
			case 'm':
				return time.Now().Add(-time.Duration(n) * time.Minute).Unix()
			}
		}
	}

	// Fallback: 7 days.
	return time.Now().Add(-7 * 24 * time.Hour).Unix()
}
