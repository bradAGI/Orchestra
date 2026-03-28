package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orchestra/orchestra/apps/backend/internal/config"
	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/rs/zerolog"

	_ "modernc.org/sqlite"
)

func newTestDBForAnalytics(t *testing.T) *db.DB {
	t.Helper()
	sqlDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })

	_, err = sqlDB.Exec(`
		CREATE TABLE IF NOT EXISTS external_usage (
			id TEXT PRIMARY KEY, provider TEXT NOT NULL, source TEXT NOT NULL,
			date TEXT NOT NULL, model TEXT, input_tokens INTEGER, output_tokens INTEGER,
			cost_cents INTEGER, raw_data TEXT, synced_at TEXT DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		t.Fatal(err)
	}
	return &db.DB{DB: sqlDB}
}

func TestGetExternalStatusNoDB(t *testing.T) {
	srv := &Server{
		logger: zerolog.Nop(),
		config: &config.Config{},
		db:     nil,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/external/status", nil)
	w := httptest.NewRecorder()

	srv.GetExternalStatus(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestPostExternalSyncDisabled(t *testing.T) {
	testDB := newTestDBForAnalytics(t)
	srv := &Server{
		logger: zerolog.Nop(),
		config: &config.Config{
			AnalyticsExternalEnabled: false,
		},
		db: testDB,
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/external/sync", nil)
	w := httptest.NewRecorder()

	srv.PostExternalSync(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	errObj, ok := resp["error"].(map[string]any)
	if !ok {
		t.Fatal("expected error object in response")
	}
	if errObj["code"] != "disabled" {
		t.Errorf("expected error code=disabled, got %v", errObj["code"])
	}
}

func TestGetExternalReconcileNoDB(t *testing.T) {
	srv := &Server{
		logger: zerolog.Nop(),
		config: &config.Config{},
		db:     nil,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/external/reconcile", nil)
	w := httptest.NewRecorder()

	srv.GetExternalReconcile(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestGetExternalStatusWithDB(t *testing.T) {
	testDB := newTestDBForAnalytics(t)
	srv := &Server{
		logger: zerolog.Nop(),
		config: &config.Config{AnalyticsExternalEnabled: true},
		db:     testDB,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/external/status", nil)
	w := httptest.NewRecorder()

	srv.GetExternalStatus(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if _, ok := resp["providers"]; !ok {
		t.Error("expected 'providers' key in response")
	}
	if resp["enabled"] != true {
		t.Error("expected enabled=true")
	}
}
