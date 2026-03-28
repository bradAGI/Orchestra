package db

import (
	"context"
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

// setupTestDB creates an in-memory SQLite database with the external_usage and
// daily_metrics tables for testing.
func setupTestDB(t *testing.T) *DB {
	t.Helper()
	sqlDB, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })

	// Create the external_usage table (normally created by agent #90 via schema.go)
	_, err = sqlDB.Exec(`
		CREATE TABLE IF NOT EXISTS external_usage (
			id          TEXT PRIMARY KEY,
			provider    TEXT NOT NULL,
			source      TEXT NOT NULL,
			date        TEXT NOT NULL,
			model       TEXT,
			input_tokens  INTEGER,
			output_tokens INTEGER,
			cost_cents    INTEGER,
			raw_data      TEXT,
			synced_at     TEXT DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_external_usage_date ON external_usage(date, provider);
	`)
	if err != nil {
		t.Fatal(err)
	}

	// Create daily_metrics stub for reconciliation tests
	_, err = sqlDB.Exec(`
		CREATE TABLE IF NOT EXISTS daily_metrics (
			date         TEXT NOT NULL,
			project_id   TEXT NOT NULL DEFAULT '',
			provider     TEXT NOT NULL DEFAULT '',
			model        TEXT NOT NULL DEFAULT '',
			input_tokens   INTEGER DEFAULT 0,
			output_tokens  INTEGER DEFAULT 0,
			cache_read     INTEGER DEFAULT 0,
			cache_write    INTEGER DEFAULT 0,
			thinking       INTEGER DEFAULT 0,
			cost_cents     INTEGER DEFAULT 0,
			request_count  INTEGER DEFAULT 0,
			session_count  INTEGER DEFAULT 0,
			completed      INTEGER DEFAULT 0,
			failed         INTEGER DEFAULT 0,
			avg_duration   REAL DEFAULT 0,
			PRIMARY KEY (date, project_id, provider, model)
		) WITHOUT ROWID;
	`)
	if err != nil {
		t.Fatal(err)
	}

	return &DB{DB: sqlDB}
}

func TestUpsertAndGetExternalUsage(t *testing.T) {
	db := setupTestDB(t)
	ctx := context.Background()

	u := ExternalUsage{
		ID:           "test-id-1",
		Provider:     "anthropic",
		Source:       "anthropic_admin",
		Date:         "2026-03-20",
		Model:        "claude-opus-4-6",
		InputTokens:  1000,
		OutputTokens: 500,
		CostCents:    1250,
	}

	// Insert
	if err := db.UpsertExternalUsage(ctx, u); err != nil {
		t.Fatalf("UpsertExternalUsage: %v", err)
	}

	// Query
	results, err := db.GetExternalUsage(ctx, "2026-03-01", "")
	if err != nil {
		t.Fatalf("GetExternalUsage: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].ID != "test-id-1" {
		t.Errorf("expected id=test-id-1, got %s", results[0].ID)
	}
	if results[0].InputTokens != 1000 {
		t.Errorf("expected input_tokens=1000, got %d", results[0].InputTokens)
	}

	// Upsert (update)
	u.InputTokens = 2000
	if err := db.UpsertExternalUsage(ctx, u); err != nil {
		t.Fatalf("UpsertExternalUsage update: %v", err)
	}
	results, err = db.GetExternalUsage(ctx, "2026-03-01", "")
	if err != nil {
		t.Fatalf("GetExternalUsage after update: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result after upsert, got %d", len(results))
	}
	if results[0].InputTokens != 2000 {
		t.Errorf("expected updated input_tokens=2000, got %d", results[0].InputTokens)
	}
}

func TestGetExternalUsageFilterByProvider(t *testing.T) {
	db := setupTestDB(t)
	ctx := context.Background()

	records := []ExternalUsage{
		{ID: "a1", Provider: "anthropic", Source: "anthropic_admin", Date: "2026-03-20", InputTokens: 100},
		{ID: "o1", Provider: "openai", Source: "openai_admin", Date: "2026-03-20", InputTokens: 200},
	}
	for _, r := range records {
		if err := db.UpsertExternalUsage(ctx, r); err != nil {
			t.Fatal(err)
		}
	}

	results, err := db.GetExternalUsage(ctx, "2026-03-01", "anthropic")
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 anthropic result, got %d", len(results))
	}
	if results[0].Provider != "anthropic" {
		t.Errorf("expected provider=anthropic, got %s", results[0].Provider)
	}
}

func TestGetSyncStatus(t *testing.T) {
	db := setupTestDB(t)
	ctx := context.Background()

	records := []ExternalUsage{
		{ID: "a1", Provider: "anthropic", Source: "anthropic_admin", Date: "2026-03-20"},
		{ID: "o1", Provider: "openai", Source: "openai_admin", Date: "2026-03-20"},
	}
	for _, r := range records {
		if err := db.UpsertExternalUsage(ctx, r); err != nil {
			t.Fatal(err)
		}
	}

	status, err := db.GetSyncStatus(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(status) != 2 {
		t.Fatalf("expected 2 providers, got %d", len(status))
	}
	if _, ok := status["anthropic"]; !ok {
		t.Error("missing anthropic in sync status")
	}
	if _, ok := status["openai"]; !ok {
		t.Error("missing openai in sync status")
	}
}

func TestGetReconciliation(t *testing.T) {
	db := setupTestDB(t)
	ctx := context.Background()

	// Insert local daily_metrics
	_, err := db.Exec(`INSERT INTO daily_metrics (date, provider, cost_cents) VALUES ('2026-03-20', 'anthropic', 1000)`)
	if err != nil {
		t.Fatal(err)
	}

	// Insert external usage
	if err := db.UpsertExternalUsage(ctx, ExternalUsage{
		ID: "ext1", Provider: "anthropic", Source: "anthropic_admin", Date: "2026-03-20", CostCents: 1200,
	}); err != nil {
		t.Fatal(err)
	}

	rows, err := db.GetReconciliation(ctx, "2026-03-01")
	if err != nil {
		t.Fatalf("GetReconciliation: %v", err)
	}

	if len(rows) != 1 {
		t.Fatalf("expected 1 reconciliation row, got %d", len(rows))
	}

	r := rows[0]
	if r.Date != "2026-03-20" {
		t.Errorf("expected date=2026-03-20, got %s", r.Date)
	}
	if r.Provider != "anthropic" {
		t.Errorf("expected provider=anthropic, got %s", r.Provider)
	}
	if r.LocalCostCents != 1000 {
		t.Errorf("expected local_cost=1000, got %d", r.LocalCostCents)
	}
	if r.ExternalCostCents != 1200 {
		t.Errorf("expected external_cost=1200, got %d", r.ExternalCostCents)
	}
	// variance = (1000-1200)/1200 * 100 = -16.67%
	if r.VariancePct > -16.0 || r.VariancePct < -17.0 {
		t.Errorf("expected variance ~-16.67%%, got %.2f%%", r.VariancePct)
	}
}

func TestCalcVariancePct(t *testing.T) {
	tests := []struct {
		local, external int64
		want            float64
	}{
		{100, 100, 0},
		{100, 0, 100},
		{0, 0, 0},
		{150, 100, 50},
		{50, 100, -50},
	}
	for _, tt := range tests {
		got := calcVariancePct(tt.local, tt.external)
		if got != tt.want {
			t.Errorf("calcVariancePct(%d, %d) = %f, want %f", tt.local, tt.external, got, tt.want)
		}
	}
}
