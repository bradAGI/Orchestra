package api

import (
	"net/http"
	"time"

	"github.com/orchestra/orchestra/apps/backend/internal/analytics"
)

// PostExternalSync handles POST /api/v1/analytics/external/sync by triggering
// an immediate sync of external usage data from configured provider admin APIs.
func (s *Server) PostExternalSync(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_db", "warehouse database not available")
		return
	}

	cfg := s.config
	if !cfg.AnalyticsExternalEnabled {
		writeJSONError(w, http.StatusBadRequest, "disabled", "external analytics sync is not enabled")
		return
	}

	syncCfg := analytics.SyncConfig{
		AnthropicAdminKey: cfg.AnthropicAdminKey,
		OpenAIAdminKey:    cfg.OpenAIAdminKey,
		Enabled:           cfg.AnalyticsExternalEnabled,
	}

	now := time.Now().UTC()
	since := now.AddDate(0, 0, -7)

	var synced int
	var errors []string

	if syncCfg.AnthropicAdminKey != "" {
		syncer := analytics.NewAnthropicSyncer(syncCfg.AnthropicAdminKey)
		usage, err := syncer.SyncUsage(r.Context(), since, now)
		if err != nil {
			errors = append(errors, "anthropic_usage: "+err.Error())
		} else {
			for _, u := range usage {
				if err := s.db.UpsertExternalUsage(r.Context(), u); err != nil {
					s.logger.Error().Err(err).Msg("upsert anthropic usage")
				} else {
					synced++
				}
			}
		}
		costs, err := syncer.SyncCost(r.Context(), since, now)
		if err != nil {
			errors = append(errors, "anthropic_cost: "+err.Error())
		} else {
			for _, c := range costs {
				if err := s.db.UpsertExternalUsage(r.Context(), c); err != nil {
					s.logger.Error().Err(err).Msg("upsert anthropic cost")
				} else {
					synced++
				}
			}
		}
	}

	if syncCfg.OpenAIAdminKey != "" {
		syncer := analytics.NewOpenAISyncer(syncCfg.OpenAIAdminKey)
		usage, err := syncer.SyncUsage(r.Context(), since, now)
		if err != nil {
			errors = append(errors, "openai_usage: "+err.Error())
		} else {
			for _, u := range usage {
				if err := s.db.UpsertExternalUsage(r.Context(), u); err != nil {
					s.logger.Error().Err(err).Msg("upsert openai usage")
				} else {
					synced++
				}
			}
		}
		costs, err := syncer.SyncCost(r.Context(), since, now)
		if err != nil {
			errors = append(errors, "openai_cost: "+err.Error())
		} else {
			for _, c := range costs {
				if err := s.db.UpsertExternalUsage(r.Context(), c); err != nil {
					s.logger.Error().Err(err).Msg("upsert openai cost")
				} else {
					synced++
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"synced_records": synced,
		"errors":         errors,
	})
}

// GetExternalStatus handles GET /api/v1/analytics/external/status by returning
// the last sync time for each configured provider.
func (s *Server) GetExternalStatus(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_db", "warehouse database not available")
		return
	}

	status, err := s.db.GetSyncStatus(r.Context())
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "query_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"providers": status,
		"enabled":   s.config.AnalyticsExternalEnabled,
	})
}

// GetExternalReconcile handles GET /api/v1/analytics/external/reconcile by
// comparing locally estimated costs against externally reported costs.
// Accepts an optional ?since= query parameter (default: 30 days ago).
func (s *Server) GetExternalReconcile(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "no_db", "warehouse database not available")
		return
	}

	since := r.URL.Query().Get("since")
	if since == "" {
		since = time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02")
	}

	rows, err := s.db.GetReconciliation(r.Context(), since)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "query_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"since":          since,
		"reconciliation": rows,
	})
}
