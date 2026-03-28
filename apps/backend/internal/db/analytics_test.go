package db

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

// setupAnalyticsTestDB creates a temporary SQLite database with the full schema and
// migrations applied. The database is automatically cleaned up when the test ends.
func setupAnalyticsTestDB(t *testing.T) *DB {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")
	database, err := Connect(dbPath)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return database
}

// seedProject inserts a test project so FK constraints are satisfied.
func seedProject(t *testing.T, database *DB, id string) {
	t.Helper()
	_, err := database.Exec(`INSERT OR IGNORE INTO projects (id, name, root_path, remote_url) VALUES (?, ?, ?, '')`,
		id, "test-"+id, "/tmp/test-"+id)
	if err != nil {
		t.Fatalf("seed project %s: %v", id, err)
	}
}

func TestSchemaNewTables(t *testing.T) {
	db := setupAnalyticsTestDB(t)

	// Verify daily_metrics table exists and accepts inserts
	_, err := db.Exec(`INSERT INTO daily_metrics (date, project_id, provider, model, input_tokens, output_tokens)
		VALUES ('2026-03-27', 'p1', 'claude', 'sonnet-4', 100, 200)`)
	if err != nil {
		t.Fatalf("insert into daily_metrics: %v", err)
	}

	// Verify api_requests table exists
	_, err = db.Exec(`INSERT INTO api_requests (id, session_id, provider, model, created_at)
		VALUES ('r1', 's1', 'claude', 'sonnet-4', 1711500000)`)
	if err != nil {
		t.Fatalf("insert into api_requests: %v", err)
	}

	// Verify session_git_metrics table exists
	_, err = db.Exec(`INSERT INTO session_git_metrics (session_id, lines_added, lines_removed)
		VALUES ('s1', 50, 10)`)
	if err != nil {
		t.Fatalf("insert into session_git_metrics: %v", err)
	}

	// Verify external_usage table exists
	_, err = db.Exec(`INSERT INTO external_usage (id, provider, source, date)
		VALUES ('eu1', 'claude', 'api', '2026-03-27')`)
	if err != nil {
		t.Fatalf("insert into external_usage: %v", err)
	}

	// Verify budgets table exists
	_, err = db.Exec(`INSERT INTO budgets (id, period, limit_cents)
		VALUES ('b1', 'monthly', 10000)`)
	if err != nil {
		t.Fatalf("insert into budgets: %v", err)
	}
}

func TestSessionStatusAndDuration(t *testing.T) {
	db := setupAnalyticsTestDB(t)
	seedProject(t, db, "p1")

	_, err := db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, model, status, duration_seconds, created_at)
		VALUES ('s1', 'p1', 'uuid1', 'claude', 'claude-sonnet-4-6', 'completed', 120.5, datetime('now'))`)
	if err != nil {
		t.Fatalf("failed to insert session with status: %v", err)
	}

	var status string
	var duration float64
	err = db.QueryRow(`SELECT status, duration_seconds FROM sessions WHERE id = 's1'`).Scan(&status, &duration)
	if err != nil {
		t.Fatalf("failed to query session status: %v", err)
	}
	if status != "completed" {
		t.Errorf("expected status 'completed', got '%s'", status)
	}
	if duration != 120.5 {
		t.Errorf("expected duration 120.5, got %f", duration)
	}
}

func TestEventExtendedTokenColumns(t *testing.T) {
	db := setupAnalyticsTestDB(t)
	seedProject(t, db, "p1")

	_, err := db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, created_at)
		VALUES ('s1', 'p1', 'uuid1', 'claude', datetime('now'))`)
	if err != nil {
		t.Fatalf("insert session: %v", err)
	}

	_, err = db.Exec(`INSERT INTO events (id, session_id, kind, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, thinking_tokens, tool_tokens)
		VALUES ('e1', 's1', 'message', 100, 200, 50, 25, 75, 10)`)
	if err != nil {
		t.Fatalf("insert event with extended tokens: %v", err)
	}

	var cacheRead, cacheWrite, thinking, tool int
	err = db.QueryRow(`SELECT cache_read_tokens, cache_write_tokens, thinking_tokens, tool_tokens FROM events WHERE id = 'e1'`).
		Scan(&cacheRead, &cacheWrite, &thinking, &tool)
	if err != nil {
		t.Fatalf("query extended tokens: %v", err)
	}
	if cacheRead != 50 || cacheWrite != 25 || thinking != 75 || tool != 10 {
		t.Errorf("unexpected token values: cache_read=%d cache_write=%d thinking=%d tool=%d", cacheRead, cacheWrite, thinking, tool)
	}
}

func TestGlobalStatsExtendedTokens(t *testing.T) {
	db := setupAnalyticsTestDB(t)
	seedProject(t, db, "p1")

	_, _ = db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, model, status, duration_seconds, created_at)
		VALUES ('s1', 'p1', 'uuid1', 'claude', 'sonnet', 'completed', 60, datetime('now'))`)
	_, _ = db.Exec(`INSERT INTO events (id, session_id, kind, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, thinking_tokens, timestamp)
		VALUES ('e1', 's1', 'message', 100, 200, 50, 25, 75, datetime('now'))`)

	stats, err := db.GetGlobalStats(context.Background())
	if err != nil {
		t.Fatalf("GetGlobalStats: %v", err)
	}

	if stats.TotalInput != 100 {
		t.Errorf("expected total_input=100, got %d", stats.TotalInput)
	}
	if stats.TotalOutput != 200 {
		t.Errorf("expected total_output=200, got %d", stats.TotalOutput)
	}
	if stats.TotalCacheRead != 50 {
		t.Errorf("expected total_cache_read=50, got %d", stats.TotalCacheRead)
	}
	if stats.TotalCacheWrite != 25 {
		t.Errorf("expected total_cache_write=25, got %d", stats.TotalCacheWrite)
	}
	if stats.TotalThinking != 75 {
		t.Errorf("expected total_thinking=75, got %d", stats.TotalThinking)
	}

	// Check provider tokens include cache/thinking
	pt, ok := stats.ProviderTokens["claude"]
	if !ok {
		t.Fatal("expected provider tokens for claude")
	}
	if pt.CacheRead != 50 {
		t.Errorf("expected provider cache_read=50, got %d", pt.CacheRead)
	}
	if pt.Thinking != 75 {
		t.Errorf("expected provider thinking=75, got %d", pt.Thinking)
	}
}

func TestGlobalStatsProviderSessions(t *testing.T) {
	db := setupAnalyticsTestDB(t)
	seedProject(t, db, "p1")

	for _, s := range []struct{ id, provider, status string }{
		{"s1", "claude", "completed"},
		{"s2", "claude", "failed"},
		{"s3", "codex", "completed"},
		{"s4", "gemini", "completed"},
	} {
		_, err := db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, status, duration_seconds, created_at)
			VALUES (?, 'p1', 'uuid', ?, ?, 60, datetime('now'))`, s.id, s.provider, s.status)
		if err != nil {
			t.Fatalf("insert %s: %v", s.id, err)
		}
	}

	stats, err := db.GetGlobalStats(context.Background())
	if err != nil {
		t.Fatalf("GetGlobalStats: %v", err)
	}

	if stats.ProviderSessions == nil {
		t.Fatal("expected ProviderSessions to be populated")
	}
	if stats.ProviderSessions["claude"].Total != 2 {
		t.Errorf("expected claude total=2, got %d", stats.ProviderSessions["claude"].Total)
	}
	if stats.ProviderSessions["claude"].Completed != 1 {
		t.Errorf("expected claude completed=1, got %d", stats.ProviderSessions["claude"].Completed)
	}
	if stats.ProviderSessions["claude"].Failed != 1 {
		t.Errorf("expected claude failed=1, got %d", stats.ProviderSessions["claude"].Failed)
	}
}

func TestGlobalStatsWithTimeRange(t *testing.T) {
	db := setupAnalyticsTestDB(t)
	seedProject(t, db, "p1")

	_, _ = db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, created_at)
		VALUES ('old', 'p1', 'uuid-old', 'codex', datetime('now', '-30 days'))`)
	_, _ = db.Exec(`INSERT INTO events (id, session_id, kind, input_tokens, output_tokens, timestamp)
		VALUES ('e-old', 'old', 'msg', 1000, 2000, datetime('now', '-30 days'))`)

	_, _ = db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, created_at)
		VALUES ('recent', 'p1', 'uuid-recent', 'claude', datetime('now', '-1 day'))`)
	_, _ = db.Exec(`INSERT INTO events (id, session_id, kind, input_tokens, output_tokens, timestamp)
		VALUES ('e-recent', 'recent', 'msg', 500, 1000, datetime('now', '-1 day'))`)

	// Query with 7-day range - should only include 'recent'
	since := time.Now().AddDate(0, 0, -7)
	stats, err := db.GetGlobalStats(context.Background(), WithSince(since))
	if err != nil {
		t.Fatalf("GetGlobalStats with since: %v", err)
	}

	if stats.TotalTokens != 1500 {
		t.Errorf("expected 1500 tokens (recent only), got %d", stats.TotalTokens)
	}
}

func TestGlobalStatsWithProviderFilter(t *testing.T) {
	db := setupAnalyticsTestDB(t)
	seedProject(t, db, "p1")

	_, _ = db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, created_at)
		VALUES ('s1', 'p1', 'uuid1', 'claude', datetime('now'))`)
	_, _ = db.Exec(`INSERT INTO events (id, session_id, kind, input_tokens, output_tokens, timestamp)
		VALUES ('e1', 's1', 'msg', 100, 200, datetime('now'))`)

	_, _ = db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, created_at)
		VALUES ('s2', 'p1', 'uuid2', 'codex', datetime('now'))`)
	_, _ = db.Exec(`INSERT INTO events (id, session_id, kind, input_tokens, output_tokens, timestamp)
		VALUES ('e2', 's2', 'msg', 500, 600, datetime('now'))`)

	stats, err := db.GetGlobalStats(context.Background(), WithProvider("claude"))
	if err != nil {
		t.Fatalf("GetGlobalStats with provider: %v", err)
	}

	if stats.TotalInput != 100 {
		t.Errorf("expected total_input=100 for claude only, got %d", stats.TotalInput)
	}
}

func TestUpdateSessionStatus(t *testing.T) {
	db := setupAnalyticsTestDB(t)
	seedProject(t, db, "p1")

	_, err := db.Exec(`INSERT INTO sessions (id, project_id, session_uuid, provider, created_at)
		VALUES ('s1', 'p1', 'uuid1', 'claude', datetime('now'))`)
	if err != nil {
		t.Fatalf("insert session: %v", err)
	}

	err = db.UpdateSessionStatus(context.Background(), "s1", "completed", 120.5)
	if err != nil {
		t.Fatalf("UpdateSessionStatus: %v", err)
	}

	var status string
	var duration float64
	err = db.QueryRow(`SELECT status, duration_seconds FROM sessions WHERE id = 's1'`).Scan(&status, &duration)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if status != "completed" {
		t.Errorf("expected 'completed', got '%s'", status)
	}
	if duration != 120.5 {
		t.Errorf("expected 120.5, got %f", duration)
	}
}
