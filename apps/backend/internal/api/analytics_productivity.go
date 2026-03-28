package api

import (
	"net/http"
	"time"

	"github.com/orchestra/orchestra/apps/backend/internal/db"
)

// GetAnalyticsProductivity handles GET /api/v1/analytics/productivity by
// returning aggregated git productivity metrics, optionally filtered by
// provider and time range via the "since" and "provider" query parameters.
func (s *Server) GetAnalyticsProductivity(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "database not available")
		return
	}

	since := r.URL.Query().Get("since")
	if since == "" {
		since = time.Now().AddDate(0, 0, -30).UTC().Format(time.RFC3339)
	}
	provider := r.URL.Query().Get("provider")

	metrics, err := s.db.GetProductivityMetrics(r.Context(), since, provider)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get productivity metrics")
		writeJSONError(w, http.StatusInternalServerError, "query_error", "failed to query productivity metrics")
		return
	}

	writeJSON(w, http.StatusOK, metrics)
}

// GetProductivitySessions handles GET /api/v1/analytics/productivity/sessions
// by returning per-session git metrics, filtered by "since" query parameter.
func (s *Server) GetProductivitySessions(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_database", "database not available")
		return
	}

	since := r.URL.Query().Get("since")
	if since == "" {
		since = time.Now().AddDate(0, 0, -30).UTC().Format(time.RFC3339)
	}

	sessions, err := s.db.GetSessionGitMetrics(r.Context(), since)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get session git metrics")
		writeJSONError(w, http.StatusInternalServerError, "query_error", "failed to query session git metrics")
		return
	}

	if sessions == nil {
		sessions = []db.SessionGitMetrics{}
	}

	writeJSON(w, http.StatusOK, map[string]any{"sessions": sessions})
}
