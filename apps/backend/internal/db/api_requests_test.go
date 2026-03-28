package db

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

// testDB creates an in-memory SQLite database with the api_requests table and
// required indexes, returning a *DB ready for testing.
func testDB(t *testing.T) *DB {
	t.Helper()
	raw, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(0)")
	if err != nil {
		t.Fatalf("open in-memory db: %v", err)
	}
	t.Cleanup(func() { raw.Close() })

	// Apply the core schema so that issues/sessions tables exist for funnel queries.
	if _, err := raw.Exec(Schema); err != nil {
		t.Fatalf("apply schema: %v", err)
	}

	// Create api_requests table (owned by agent #90 in production).
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

	return &DB{DB: raw}
}

func TestInsertAPIRequest(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()

	req := APIRequest{
		ID:                       "req-1",
		SessionID:                "sess-1",
		Provider:                 "CLAUDE",
		Model:                    "opus-4",
		InputTokens:              1000,
		OutputTokens:             500,
		LatencyMs:                250,
		StatusCode:               200,
		RateLimitRemainingReqs:   100,
		RateLimitRemainingTokens: 50000,
		CreatedAt:                time.Now().Unix(),
	}

	if err := db.InsertAPIRequest(ctx, req); err != nil {
		t.Fatalf("InsertAPIRequest: %v", err)
	}

	// Verify row exists.
	var id string
	if err := db.QueryRowContext(ctx, "SELECT id FROM api_requests WHERE id = ?", "req-1").Scan(&id); err != nil {
		t.Fatalf("select inserted row: %v", err)
	}
	if id != "req-1" {
		t.Fatalf("expected id req-1, got %s", id)
	}
}

func TestInsertAPIRequestWithError(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()

	req := APIRequest{
		ID:         "req-err-1",
		SessionID:  "sess-1",
		Provider:   "CODEX",
		Model:      "gpt-5",
		LatencyMs:  5000,
		StatusCode: 429,
		ErrorType:  "rate_limit",
		CreatedAt:  time.Now().Unix(),
	}

	if err := db.InsertAPIRequest(ctx, req); err != nil {
		t.Fatalf("InsertAPIRequest with error: %v", err)
	}

	var errType sql.NullString
	if err := db.QueryRowContext(ctx, "SELECT error_type FROM api_requests WHERE id = ?", "req-err-1").Scan(&errType); err != nil {
		t.Fatalf("select error_type: %v", err)
	}
	if !errType.Valid || errType.String != "rate_limit" {
		t.Fatalf("expected error_type 'rate_limit', got %v", errType)
	}
}

func TestGetPerformanceMetrics_Empty(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()

	since := time.Now().Add(-24 * time.Hour).Unix()
	m, err := db.GetPerformanceMetrics(ctx, since, "")
	if err != nil {
		t.Fatalf("GetPerformanceMetrics empty: %v", err)
	}
	if m.TotalRequests != 0 {
		t.Fatalf("expected 0 total requests, got %d", m.TotalRequests)
	}
	if m.ErrorRate != 0 {
		t.Fatalf("expected 0 error rate, got %f", m.ErrorRate)
	}
}

func TestGetPerformanceMetrics_Aggregates(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	now := time.Now().Unix()

	// Insert requests with varying latencies.
	for i := 0; i < 100; i++ {
		latency := int64((i + 1) * 10) // 10, 20, ..., 1000
		errType := ""
		statusCode := 200
		if i >= 95 { // 5% error rate
			errType = "api_error"
			statusCode = 500
		}
		req := APIRequest{
			ID:         fmt.Sprintf("perf-%d", i),
			SessionID:  "sess-perf",
			Provider:   "CLAUDE",
			Model:      "opus-4",
			LatencyMs:  latency,
			StatusCode: statusCode,
			ErrorType:  errType,
			CreatedAt:  now - int64(100-i), // spread across time
		}
		if err := db.InsertAPIRequest(ctx, req); err != nil {
			t.Fatalf("insert perf request %d: %v", i, err)
		}
	}

	since := now - 200
	m, err := db.GetPerformanceMetrics(ctx, since, "")
	if err != nil {
		t.Fatalf("GetPerformanceMetrics: %v", err)
	}

	if m.TotalRequests != 100 {
		t.Fatalf("expected 100 requests, got %d", m.TotalRequests)
	}
	if m.ErrorCount != 5 {
		t.Fatalf("expected 5 errors, got %d", m.ErrorCount)
	}
	if m.ErrorRate < 0.04 || m.ErrorRate > 0.06 {
		t.Fatalf("expected ~0.05 error rate, got %f", m.ErrorRate)
	}

	// Percentiles should be roughly correct (p50 ≈ 500ms, p95 ≈ 950ms).
	if m.P50LatencyMs < 400 || m.P50LatencyMs > 600 {
		t.Errorf("P50 out of range: %d (expected ~500)", m.P50LatencyMs)
	}
	if m.P95LatencyMs < 900 || m.P95LatencyMs > 1000 {
		t.Errorf("P95 out of range: %d (expected ~950)", m.P95LatencyMs)
	}

	// Error breakdown should have api_error.
	if m.ErrorBreakdown["api_error"] != 5 {
		t.Errorf("expected 5 api_error, got %d", m.ErrorBreakdown["api_error"])
	}

	// Provider health should have one entry.
	if len(m.ProviderHealth) != 1 {
		t.Fatalf("expected 1 provider health entry, got %d", len(m.ProviderHealth))
	}
	ph := m.ProviderHealth[0]
	if ph.Provider != "CLAUDE" {
		t.Errorf("expected provider CLAUDE, got %s", ph.Provider)
	}
	if ph.RequestCount != 100 {
		t.Errorf("expected 100 requests for provider, got %d", ph.RequestCount)
	}

	// Throughput should be positive.
	if m.ThroughputRPM <= 0 {
		t.Errorf("expected positive throughput, got %f", m.ThroughputRPM)
	}
}

func TestGetPerformanceMetrics_ProviderFilter(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	now := time.Now().Unix()

	providers := []string{"CLAUDE", "CODEX"}
	for _, p := range providers {
		for i := 0; i < 10; i++ {
			req := APIRequest{
				ID:         fmt.Sprintf("%s-%d", p, i),
				SessionID:  fmt.Sprintf("sess-%s", p),
				Provider:   p,
				Model:      "model-x",
				LatencyMs:  100,
				StatusCode: 200,
				CreatedAt:  now - 10,
			}
			if err := db.InsertAPIRequest(ctx, req); err != nil {
				t.Fatalf("insert: %v", err)
			}
		}
	}

	since := now - 100
	m, err := db.GetPerformanceMetrics(ctx, since, "CLAUDE")
	if err != nil {
		t.Fatalf("GetPerformanceMetrics with filter: %v", err)
	}
	if m.TotalRequests != 10 {
		t.Fatalf("expected 10 filtered requests, got %d", m.TotalRequests)
	}
	if len(m.ProviderHealth) != 1 || m.ProviderHealth[0].Provider != "CLAUDE" {
		t.Fatalf("expected single CLAUDE provider health, got %v", m.ProviderHealth)
	}
}

func TestGetRateLimitStatus(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	now := time.Now().Unix()

	// Insert two requests per provider, only the latest should appear.
	for _, p := range []struct {
		provider  string
		reqs      int
		tokens    int
		createdAt int64
	}{
		{"CLAUDE", 50, 10000, now - 60},
		{"CLAUDE", 30, 8000, now},
		{"CODEX", 100, 50000, now - 30},
		{"CODEX", 80, 40000, now},
	} {
		req := APIRequest{
			ID:                       fmt.Sprintf("rl-%s-%d", p.provider, p.createdAt),
			SessionID:                "sess-rl",
			Provider:                 p.provider,
			Model:                    "model",
			StatusCode:               200,
			RateLimitRemainingReqs:   p.reqs,
			RateLimitRemainingTokens: p.tokens,
			CreatedAt:                p.createdAt,
		}
		if err := db.InsertAPIRequest(ctx, req); err != nil {
			t.Fatalf("insert rate limit row: %v", err)
		}
	}

	limits, err := db.GetRateLimitStatus(ctx)
	if err != nil {
		t.Fatalf("GetRateLimitStatus: %v", err)
	}
	if len(limits) != 2 {
		t.Fatalf("expected 2 providers, got %d", len(limits))
	}

	for _, rl := range limits {
		switch rl.Provider {
		case "CLAUDE":
			if rl.RemainingRequests != 30 {
				t.Errorf("CLAUDE: expected 30 remaining reqs, got %d", rl.RemainingRequests)
			}
		case "CODEX":
			if rl.RemainingRequests != 80 {
				t.Errorf("CODEX: expected 80 remaining reqs, got %d", rl.RemainingRequests)
			}
		default:
			t.Errorf("unexpected provider: %s", rl.Provider)
		}
	}
}

func TestProviderHealthStatus(t *testing.T) {
	now := time.Now().Unix()

	tests := []struct {
		name      string
		errorRate float64
		lastSeen  int64
		want      string
	}{
		{"healthy low error rate", 0.01, now - 60, "healthy"},
		{"healthy zero errors", 0.0, now, "healthy"},
		{"degraded 5pct", 0.05, now - 30, "degraded"},
		{"degraded 15pct", 0.15, now - 30, "degraded"},
		{"down high error rate", 0.20, now - 30, "down"},
		{"down very high error rate", 0.50, now, "down"},
		{"down no recent requests", 0.0, now - 700, "down"},
		{"down stale and errors", 0.10, now - 700, "down"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := classifyProviderStatus(tt.errorRate, tt.lastSeen, now)
			if got != tt.want {
				t.Errorf("classifyProviderStatus(%f, %d, %d) = %q, want %q",
					tt.errorRate, tt.lastSeen, now, got, tt.want)
			}
		})
	}
}

func TestReliabilityFunnel(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	now := time.Now().Unix()
	since := now - 3600

	// Insert some issues.
	for i := 0; i < 5; i++ {
		_, err := db.ExecContext(ctx,
			"INSERT INTO issues (id, identifier, title, state, created_at) VALUES (?, ?, ?, ?, datetime(?, 'unixepoch'))",
			fmt.Sprintf("issue-%d", i), fmt.Sprintf("ISS-%d", i), fmt.Sprintf("Issue %d", i), "Done", now-1800,
		)
		if err != nil {
			t.Fatalf("insert issue %d: %v", i, err)
		}
	}

	// Insert sessions for some issues.
	for i := 0; i < 3; i++ {
		_, err := db.ExecContext(ctx,
			"INSERT INTO sessions (id, session_uuid, provider, issue_id) VALUES (?, ?, ?, ?)",
			fmt.Sprintf("sess-%d", i), fmt.Sprintf("uuid-%d", i), "CLAUDE", fmt.Sprintf("issue-%d", i),
		)
		if err != nil {
			t.Fatalf("insert session %d: %v", i, err)
		}
	}

	funnel, err := db.getReliabilityFunnel(ctx, since)
	if err != nil {
		t.Fatalf("getReliabilityFunnel: %v", err)
	}

	if funnel.Dispatched != 5 {
		t.Errorf("expected 5 dispatched, got %d", funnel.Dispatched)
	}
	if funnel.Started != 3 {
		t.Errorf("expected 3 started, got %d", funnel.Started)
	}
	// No completed sessions (no status column in base schema; funnel handles this gracefully).
}
