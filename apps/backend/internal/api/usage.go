package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/orchestra/orchestra/apps/backend/internal/usage"
)

// UsageHandlers translates the IPC contract Orca exposes to its renderer
// into REST endpoints under /api/v1/usage/{provider}/...
type UsageHandlers struct {
	svc *usage.Service
}

func NewUsageHandlers(svc *usage.Service) *UsageHandlers {
	return &UsageHandlers{svc: svc}
}

func (h *UsageHandlers) Register(r chi.Router) {
	r.Route("/api/v1/usage", func(r chi.Router) {
		r.Get("/rate-limits", h.getRateLimits)
		r.Post("/rate-limits/refresh", h.refreshRateLimits)

		r.Route("/{provider}", func(r chi.Router) {
			r.Get("/scan-state", h.getScanState)
			r.Post("/enabled", h.setEnabled)
			r.Post("/refresh", h.refresh)
			r.Get("/summary", h.getSummary)
			r.Get("/daily", h.getDaily)
			r.Get("/breakdown", h.getBreakdown)
			r.Get("/sessions", h.getSessions)
		})
	})
}

func (h *UsageHandlers) parseProvider(w http.ResponseWriter, r *http.Request) (usage.Provider, bool) {
	p := usage.Provider(chi.URLParam(r, "provider"))
	if !p.Valid() {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid provider"})
		return "", false
	}
	return p, true
}

func (h *UsageHandlers) parseScopeAndRange(r *http.Request) (usage.Scope, usage.Range, bool) {
	scope := usage.Scope(r.URL.Query().Get("scope"))
	if scope == "" {
		scope = usage.ScopeAll
	}
	if !scope.Valid() {
		return "", "", false
	}
	rng := usage.Range(r.URL.Query().Get("range"))
	if rng == "" {
		rng = usage.Range30d
	}
	if !rng.Valid() {
		return "", "", false
	}
	return scope, rng, true
}

func (h *UsageHandlers) getScanState(w http.ResponseWriter, r *http.Request) {
	p, ok := h.parseProvider(w, r)
	if !ok {
		return
	}
	state, err := h.svc.ScanState(p)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (h *UsageHandlers) setEnabled(w http.ResponseWriter, r *http.Request) {
	p, ok := h.parseProvider(w, r)
	if !ok {
		return
	}
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	state, err := h.svc.SetEnabled(r.Context(), p, body.Enabled)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (h *UsageHandlers) refresh(w http.ResponseWriter, r *http.Request) {
	p, ok := h.parseProvider(w, r)
	if !ok {
		return
	}
	var body struct {
		Force bool `json:"force"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	state, err := h.svc.Refresh(r.Context(), p, body.Force)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error(), "state": state})
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (h *UsageHandlers) getSummary(w http.ResponseWriter, r *http.Request) {
	p, ok := h.parseProvider(w, r)
	if !ok {
		return
	}
	scope, rng, ok2 := h.parseScopeAndRange(r)
	if !ok2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid scope or range"})
		return
	}
	summary, err := h.svc.Summary(p, scope, rng)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (h *UsageHandlers) getDaily(w http.ResponseWriter, r *http.Request) {
	p, ok := h.parseProvider(w, r)
	if !ok {
		return
	}
	scope, rng, ok2 := h.parseScopeAndRange(r)
	if !ok2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid scope or range"})
		return
	}
	points, err := h.svc.Daily(p, scope, rng)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, points)
}

func (h *UsageHandlers) getBreakdown(w http.ResponseWriter, r *http.Request) {
	p, ok := h.parseProvider(w, r)
	if !ok {
		return
	}
	scope, rng, ok2 := h.parseScopeAndRange(r)
	if !ok2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid scope or range"})
		return
	}
	kind := usage.BreakdownKind(r.URL.Query().Get("kind"))
	if kind == "" {
		kind = usage.BreakdownByModel
	}
	if !kind.Valid() {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid kind"})
		return
	}
	rows, err := h.svc.Breakdown(p, scope, rng, kind)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (h *UsageHandlers) getSessions(w http.ResponseWriter, r *http.Request) {
	p, ok := h.parseProvider(w, r)
	if !ok {
		return
	}
	scope, rng, ok2 := h.parseScopeAndRange(r)
	if !ok2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid scope or range"})
		return
	}
	limit := 25
	if v := r.URL.Query().Get("limit"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			limit = parsed
		}
	}
	rows, err := h.svc.Sessions(p, scope, rng, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (h *UsageHandlers) getRateLimits(w http.ResponseWriter, r *http.Request) {
	state := h.svc.RateLimits(r.Context(), false)
	writeJSON(w, http.StatusOK, state)
}

func (h *UsageHandlers) refreshRateLimits(w http.ResponseWriter, r *http.Request) {
	state := h.svc.RateLimits(r.Context(), true)
	writeJSON(w, http.StatusOK, state)
}

// helper used elsewhere in this package; redeclared here for completeness if
// not exported. We rely on the existing util — check api/util.go.
var _ = context.Background
