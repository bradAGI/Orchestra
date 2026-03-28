package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/orchestra/orchestra/apps/backend/internal/config"
	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/orchestrator"
	"github.com/rs/zerolog"
)

// newAnalyticsTestServer creates a Server and chi router with analytics cost
// routes registered, backed by a real SQLite database.
func newAnalyticsTestServer(t *testing.T) (*chi.Mux, *db.DB) {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	warehouseDB, err := db.Connect(dbPath)
	if err != nil {
		t.Fatalf("connect db: %v", err)
	}
	t.Cleanup(func() { warehouseDB.Close() })

	// Create tables that agent #90 owns
	ctx := context.Background()
	for _, ddl := range []string{
		`CREATE TABLE IF NOT EXISTS budgets (
			id TEXT PRIMARY KEY, project_id TEXT, provider TEXT,
			period TEXT NOT NULL, limit_cents INTEGER NOT NULL,
			alert_pct INTEGER DEFAULT 80, created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS daily_metrics (
			date TEXT NOT NULL, project_id TEXT NOT NULL DEFAULT '',
			provider TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
			input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
			cache_read INTEGER DEFAULT 0, cache_write INTEGER DEFAULT 0,
			thinking INTEGER DEFAULT 0, cost_cents INTEGER DEFAULT 0,
			request_count INTEGER DEFAULT 0, session_count INTEGER DEFAULT 0,
			completed INTEGER DEFAULT 0, failed INTEGER DEFAULT 0,
			avg_duration REAL DEFAULT 0,
			PRIMARY KEY (date, project_id, provider, model)
		)`,
	} {
		if _, err := warehouseDB.ExecContext(ctx, ddl); err != nil {
			t.Fatalf("create table: %v", err)
		}
	}

	server := &Server{
		logger:        zerolog.Nop(),
		orchestrator:  orchestrator.NewService(),
		workspaceRoot: dir,
		db:            warehouseDB,
		config: &config.Config{
			WorkspaceRoot: dir,
			Host:          "127.0.0.1",
		},
	}

	r := chi.NewRouter()
	r.Get("/api/v1/analytics/cost", server.GetAnalyticsCost)
	r.Get("/api/v1/analytics/cost/optimization", server.GetCostOptimization)
	r.Post("/api/v1/analytics/budgets", server.PostBudget)
	r.Get("/api/v1/analytics/budgets", server.GetBudgets)
	r.Delete("/api/v1/analytics/budgets/{id}", server.DeleteBudget)

	return r, warehouseDB
}

func TestGetAnalyticsCost_Empty(t *testing.T) {
	router, _ := newAnalyticsTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/cost", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["group_by"] != "provider" {
		t.Errorf("expected default group_by=provider, got %v", resp["group_by"])
	}
}

func TestGetAnalyticsCost_WithData(t *testing.T) {
	router, warehouseDB := newAnalyticsTestServer(t)
	ctx := context.Background()

	_, err := warehouseDB.ExecContext(ctx,
		`INSERT INTO daily_metrics (date, project_id, provider, model, input_tokens, output_tokens, cost_cents, session_count)
		 VALUES ('2026-03-25', '', 'claude', 'claude-opus-4-6', 100000, 50000, 750, 5)`)
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	_, err = warehouseDB.ExecContext(ctx,
		`INSERT INTO daily_metrics (date, project_id, provider, model, input_tokens, output_tokens, cost_cents, session_count)
		 VALUES ('2026-03-26', '', 'codex', 'gpt-5.1-codex', 200000, 100000, 500, 3)`)
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/cost?since=2026-03-01&group_by=provider", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}

	totalCost, ok := resp["total_cost_cents"].(float64)
	if !ok || totalCost != 1250 {
		t.Errorf("expected total_cost_cents=1250, got %v", resp["total_cost_cents"])
	}

	groups, ok := resp["groups"].([]any)
	if !ok || len(groups) != 2 {
		t.Errorf("expected 2 groups, got %v", resp["groups"])
	}
}

func TestGetAnalyticsCost_GroupByModel(t *testing.T) {
	router, warehouseDB := newAnalyticsTestServer(t)
	ctx := context.Background()

	_, _ = warehouseDB.ExecContext(ctx,
		`INSERT INTO daily_metrics (date, project_id, provider, model, cost_cents) VALUES ('2026-03-25', '', 'claude', 'claude-opus-4-6', 500)`)
	_, _ = warehouseDB.ExecContext(ctx,
		`INSERT INTO daily_metrics (date, project_id, provider, model, cost_cents) VALUES ('2026-03-25', '', 'claude', 'claude-sonnet-4-6', 300)`)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/cost?since=2026-03-01&group_by=model", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["group_by"] != "model" {
		t.Errorf("expected group_by=model, got %v", resp["group_by"])
	}
}

func TestGetAnalyticsCost_InvalidGroupBy(t *testing.T) {
	router, _ := newAnalyticsTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/cost?group_by=invalid", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestGetCostOptimization_Empty(t *testing.T) {
	router, _ := newAnalyticsTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/cost/optimization", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["total_spend_cents"].(float64) != 0 {
		t.Errorf("expected 0 total spend, got %v", resp["total_spend_cents"])
	}
}

func TestGetCostOptimization_WithData(t *testing.T) {
	router, warehouseDB := newAnalyticsTestServer(t)
	ctx := context.Background()

	_, _ = warehouseDB.ExecContext(ctx,
		`INSERT INTO daily_metrics (date, project_id, provider, model, input_tokens, output_tokens, cache_read, thinking, cost_cents)
		 VALUES ('2026-03-25', '', 'claude', 'claude-opus-4-6', 500000, 100000, 300000, 80000, 1500)`)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/cost/optimization?since=2026-03-01", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(rec.Body.Bytes(), &resp)

	if resp["total_spend_cents"].(float64) != 1500 {
		t.Errorf("expected total_spend_cents=1500, got %v", resp["total_spend_cents"])
	}

	cacheHitRate, ok := resp["cache_hit_rate"].(map[string]any)
	if !ok {
		t.Fatal("expected cache_hit_rate map")
	}
	if _, ok := cacheHitRate["claude"]; !ok {
		t.Error("expected cache_hit_rate entry for claude")
	}
}

func TestBudgetCRUD(t *testing.T) {
	router, _ := newAnalyticsTestServer(t)

	// Create budget
	body, _ := json.Marshal(map[string]any{
		"period":      "monthly",
		"limit_cents": 10000,
		"provider":    "claude",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/budgets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var created map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created: %v", err)
	}
	budgetID, ok := created["id"].(string)
	if !ok || budgetID == "" {
		t.Fatalf("expected budget id, got %v", created)
	}

	// List budgets
	req = httptest.NewRequest(http.MethodGet, "/api/v1/analytics/budgets", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", rec.Code)
	}

	var listResp map[string]any
	json.Unmarshal(rec.Body.Bytes(), &listResp)
	budgets, ok := listResp["budgets"].([]any)
	if !ok || len(budgets) != 1 {
		t.Fatalf("expected 1 budget, got %v", listResp["budgets"])
	}

	// Delete budget
	req = httptest.NewRequest(http.MethodDelete, "/api/v1/analytics/budgets/"+budgetID, nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("delete: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify deleted
	req = httptest.NewRequest(http.MethodGet, "/api/v1/analytics/budgets", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var afterDelete map[string]any
	json.Unmarshal(rec.Body.Bytes(), &afterDelete)
	if afterBudgets, ok := afterDelete["budgets"]; ok && afterBudgets != nil {
		if arr, ok := afterBudgets.([]any); ok && len(arr) > 0 {
			t.Errorf("expected 0 budgets after delete, got %d", len(arr))
		}
	}
}

func TestPostBudget_InvalidBody(t *testing.T) {
	router, _ := newAnalyticsTestServer(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/budgets", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestDeleteBudget_NotFound(t *testing.T) {
	router, _ := newAnalyticsTestServer(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/analytics/budgets/nonexistent", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}
