package api

import (
	"net/http"

	"github.com/orchestra/orchestra/apps/backend/internal/telemetry"
)

func (s *Server) GetTelemetryHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, telemetry.Health())
}
