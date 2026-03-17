package api

import (
	"net/http"
)

func Healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "app": "orchestra"})
}
