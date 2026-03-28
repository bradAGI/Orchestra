package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/orchestra/orchestra/apps/backend/internal/config"
	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/orchestrator"
	"github.com/rs/zerolog"
)

// analyticsTestDDL creates the session_git_metrics table and session columns
// that agent #90 will add to schema.go/migrate.go. Applied here so these
// tests can run independently before the #90 branch merges.
const analyticsTestDDL = `
CREATE TABLE IF NOT EXISTS session_git_metrics (
	session_id      TEXT PRIMARY KEY,
	lines_added     INTEGER DEFAULT 0,
	lines_removed   INTEGER DEFAULT 0,
	files_changed   INTEGER DEFAULT 0,
	test_files      INTEGER DEFAULT 0,
	commits         INTEGER DEFAULT 0,
	hunks           INTEGER DEFAULT 0,
	pr_url          TEXT,
	pr_merged       INTEGER DEFAULT 0,
	ci_passed       INTEGER DEFAULT -1,
	created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);
`

func newProductivityTestServer(t *testing.T) *Server {
	t.Helper()

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, ".orchestra", "warehouse.db")

	warehouseDB, err := db.Connect(dbPath)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	t.Cleanup(func() { warehouseDB.Close() })

	// Apply analytics schema not yet in this worktree
	if _, err := warehouseDB.Exec(analyticsTestDDL); err != nil {
		t.Fatalf("apply analytics DDL: %v", err)
	}
	for _, ddl := range []string{
		"ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'unknown'",
		"ALTER TABLE sessions ADD COLUMN duration_seconds REAL NOT NULL DEFAULT 0",
		"ALTER TABLE sessions ADD COLUMN cost_cents INTEGER DEFAULT 0",
		"ALTER TABLE sessions ADD COLUMN turn_count INTEGER DEFAULT 0",
	} {
		warehouseDB.Exec(ddl) // Ignore errors if columns already exist
	}

	cfg := &config.Config{
		WorkspaceRoot: tmpDir,
		Host:          "127.0.0.1",
		APIToken:      "",
		ProjectRoots:  []string{tmpDir},
	}

	return &Server{
		logger:        zerolog.Nop(),
		orchestrator:  orchestrator.NewService(),
		workspaceRoot: cfg.WorkspaceRoot,
		db:            warehouseDB,
		config:        cfg,
	}
}

func TestGetAnalyticsProductivityEmpty(t *testing.T) {
	s := newProductivityTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/productivity", nil)
	rec := httptest.NewRecorder()
	s.GetAnalyticsProductivity(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload db.ProductivityMetrics
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if payload.TotalLinesAdded != 0 {
		t.Errorf("TotalLinesAdded: got %d, want 0", payload.TotalLinesAdded)
	}
	if payload.AvgLinesPerSession != 0 {
		t.Errorf("AvgLinesPerSession: got %f, want 0", payload.AvgLinesPerSession)
	}
}

func TestGetProductivitySessionsEmpty(t *testing.T) {
	s := newProductivityTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/productivity/sessions", nil)
	rec := httptest.NewRecorder()
	s.GetProductivitySessions(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	sessions, ok := payload["sessions"]
	if !ok {
		t.Fatal("expected sessions key in response")
	}

	arr, ok := sessions.([]any)
	if !ok {
		t.Fatalf("sessions is not an array: %T", sessions)
	}
	if len(arr) != 0 {
		t.Errorf("expected 0 sessions, got %d", len(arr))
	}
}

func TestGetAnalyticsProductivityWithSince(t *testing.T) {
	s := newProductivityTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/productivity?since=2026-01-01T00:00:00Z", nil)
	rec := httptest.NewRecorder()
	s.GetAnalyticsProductivity(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetAnalyticsProductivityWithProvider(t *testing.T) {
	s := newProductivityTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/productivity?provider=CLAUDE", nil)
	rec := httptest.NewRecorder()
	s.GetAnalyticsProductivity(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetAnalyticsProductivityNoDB(t *testing.T) {
	s := &Server{
		logger: zerolog.Nop(),
		db:     nil,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/productivity", nil)
	rec := httptest.NewRecorder()
	s.GetAnalyticsProductivity(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rec.Code)
	}
}

func TestGetProductivitySessionsNoDB(t *testing.T) {
	s := &Server{
		logger: zerolog.Nop(),
		db:     nil,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/productivity/sessions", nil)
	rec := httptest.NewRecorder()
	s.GetProductivitySessions(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rec.Code)
	}
}
