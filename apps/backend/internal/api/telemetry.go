package api

import (
	"encoding/json"
	"net/http"

	"github.com/orchestra/orchestra/apps/backend/internal/telemetry"
)

func (s *Server) GetTelemetryHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(telemetry.Health())
}
