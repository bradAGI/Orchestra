package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/orchestra/orchestra/apps/backend/internal/config"
	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/orchestrator"
	"github.com/rs/zerolog"

	_ "modernc.org/sqlite"
)

// newPerfTestServer creates a Server with an in-memory warehouse DB and
// a chi router that only registers the analytics routes. This avoids modifying
// router.go (owned by another agent).
func newPerfTestServer(t *testing.T) (*chi.Mux, *db.DB) {
	t.Helper()

	raw, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(0)")
	if err != nil {
		t.Fatalf("open in-memory db: %v", err)
	}
	t.Cleanup(func() { raw.Close() })

	if _, err := raw.Exec(db.Schema); err != nil {
		t.Fatalf("apply schema: %v", err)
	}

	ddl := `
		CREATE TABLE IF NOT EXISTS api_requests (
			id             TEXT PRIMARY KEY,
			session_id     TEXT NOT NULL,
			provider       TEXT NOT NULL,
			model          TEXT NOT NULL,
			input_tokens   INTEGER DEFAULT 0,
			output_tokens  INTEGER DEFAULT 0,
			latency_ms     INTEGER DEFAULT 0,
			status_code    INTEGER DEFAULT 200,
			error_type     TEXT,
			rate_limit_remaining_requests INTEGER,
			rate_limit_remaining_tokens   INTEGER,
			created_at     INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_api_requests_session ON api_requests(session_id);
		CREATE INDEX IF NOT EXISTS idx_api_requests_time ON api_requests(created_at);
	`
	if _, err := raw.Exec(ddl); err != nil {
		t.Fatalf("create api_requests table: %v", err)
	}

	warehouseDB := &db.DB{DB: raw}

	s := &Server{
		logger:       zerolog.Nop(),
		orchestrator: orchestrator.NewService(),
		db:           warehouseDB,
		config: &config.Config{
			WorkspaceRoot: t.TempDir(),
			Host:          "127.0.0.1",
		},
	}

	r := chi.NewRouter()
	r.Get("/api/v1/analytics/performance", s.GetAnalyticsPerformance)
	r.Get("/api/v1/analytics/rate-limits", s.GetRateLimits)

	return r, warehouseDB
}

// newPerfTestServerNoDB creates a Server without a warehouse DB.
func newPerfTestServerNoDB(t *testing.T) *chi.Mux {
	t.Helper()

	s := &Server{
		logger:       zerolog.Nop(),
		orchestrator: orchestrator.NewService(),
		db:           nil,
		config: &config.Config{
			WorkspaceRoot: t.TempDir(),
			Host:          "127.0.0.1",
		},
	}

	r := chi.NewRouter()
	r.Get("/api/v1/analytics/performance", s.GetAnalyticsPerformance)
	r.Get("/api/v1/analytics/rate-limits", s.GetRateLimits)

	return r
}

func TestGetAnalyticsPerformance_NoDatabase(t *testing.T) {
	router := newPerfTestServerNoDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/performance", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetAnalyticsPerformance_Empty(t *testing.T) {
	router, _ := newPerfTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/performance", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var m db.PerformanceMetrics
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if m.TotalRequests != 0 {
		t.Fatalf("expected 0 requests, got %d", m.TotalRequests)
	}
}

func TestGetAnalyticsPerformance_WithData(t *testing.T) {
	router, warehouseDB := newPerfTestServer(t)
	ctx := context.Background()
	now := time.Now().Unix()

	for i := 0; i < 20; i++ {
		r := db.APIRequest{
			ID:         fmt.Sprintf("api-perf-%d", i),
			SessionID:  "sess-1",
			Provider:   "CLAUDE",
			Model:      "opus-4",
			LatencyMs:  int64((i + 1) * 50),
			StatusCode: 200,
			CreatedAt:  now - int64(20-i),
		}
		if i == 19 {
			r.ErrorType = "timeout"
			r.StatusCode = 504
		}
		if err := warehouseDB.InsertAPIRequest(ctx, r); err != nil {
			t.Fatalf("seed request %d: %v", i, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/performance?since=1d", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var m db.PerformanceMetrics
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if m.TotalRequests != 20 {
		t.Errorf("expected 20 requests, got %d", m.TotalRequests)
	}
	if m.ErrorCount != 1 {
		t.Errorf("expected 1 error, got %d", m.ErrorCount)
	}
	if m.P50LatencyMs == 0 {
		t.Error("P50 should not be 0 with 20 data points")
	}
}

func TestGetAnalyticsPerformance_ProviderFilter(t *testing.T) {
	router, warehouseDB := newPerfTestServer(t)
	ctx := context.Background()
	now := time.Now().Unix()

	for _, p := range []string{"CLAUDE", "CODEX"} {
		for i := 0; i < 5; i++ {
			r := db.APIRequest{
				ID:         fmt.Sprintf("filt-%s-%d", p, i),
				SessionID:  "sess-filt",
				Provider:   p,
				Model:      "model",
				LatencyMs:  100,
				StatusCode: 200,
				CreatedAt:  now - 10,
			}
			if err := warehouseDB.InsertAPIRequest(ctx, r); err != nil {
				t.Fatalf("seed: %v", err)
			}
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/performance?since=1d&provider=CODEX", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var m db.PerformanceMetrics
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if m.TotalRequests != 5 {
		t.Errorf("expected 5 requests (CODEX only), got %d", m.TotalRequests)
	}
}

func TestGetRateLimits_NoDatabase(t *testing.T) {
	router := newPerfTestServerNoDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/rate-limits", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetRateLimits_WithData(t *testing.T) {
	router, warehouseDB := newPerfTestServer(t)
	ctx := context.Background()
	now := time.Now().Unix()

	r := db.APIRequest{
		ID:                       "rl-test-1",
		SessionID:                "sess-rl",
		Provider:                 "CLAUDE",
		Model:                    "opus-4",
		StatusCode:               200,
		RateLimitRemainingReqs:   42,
		RateLimitRemainingTokens: 99999,
		CreatedAt:                now,
	}
	if err := warehouseDB.InsertAPIRequest(ctx, r); err != nil {
		t.Fatalf("seed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/rate-limits", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		RateLimits []db.ProviderRateLimit `json:"rate_limits"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(payload.RateLimits) != 1 {
		t.Fatalf("expected 1 rate limit entry, got %d", len(payload.RateLimits))
	}
	if payload.RateLimits[0].RemainingRequests != 42 {
		t.Errorf("expected 42 remaining requests, got %d", payload.RateLimits[0].RemainingRequests)
	}
}

func TestParseSinceParam(t *testing.T) {
	now := time.Now()

	tests := []struct {
		input    string
		minDelta time.Duration
		maxDelta time.Duration
	}{
		{"", 6*24*time.Hour + 23*time.Hour, 7*24*time.Hour + time.Hour},
		{"7d", 6*24*time.Hour + 23*time.Hour, 7*24*time.Hour + time.Hour},
		{"30d", 29*24*time.Hour + 23*time.Hour, 30*24*time.Hour + time.Hour},
		{"24h", 23 * time.Hour, 25 * time.Hour},
		{"garbage", 6*24*time.Hour + 23*time.Hour, 7*24*time.Hour + time.Hour},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("input=%q", tt.input), func(t *testing.T) {
			result := parseSinceParam(tt.input)
			resultTime := time.Unix(result, 0)
			delta := now.Sub(resultTime)
			if delta < tt.minDelta || delta > tt.maxDelta {
				t.Errorf("parseSinceParam(%q) = %v ago, expected between %v and %v ago",
					tt.input, delta, tt.minDelta, tt.maxDelta)
			}
		})
	}

	t.Run("RFC3339", func(t *testing.T) {
		input := "2026-03-20T00:00:00Z"
		result := parseSinceParam(input)
		expected, _ := time.Parse(time.RFC3339, input)
		if result != expected.Unix() {
			t.Errorf("parseSinceParam(%q) = %d, want %d", input, result, expected.Unix())
		}
	})
}
