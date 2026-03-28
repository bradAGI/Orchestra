package db

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

// testDB creates a temporary SQLite database with schema and budget/daily_metrics tables.
func testBudgetDB(t *testing.T) *DB {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	d, err := Connect(dbPath)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { d.Close() })

	// Create budgets table (normally created by agent #90 in schema.go)
	_, err = d.ExecContext(context.Background(), `
		CREATE TABLE IF NOT EXISTS budgets (
			id          TEXT PRIMARY KEY,
			project_id  TEXT,
			provider    TEXT,
			period      TEXT NOT NULL,
			limit_cents INTEGER NOT NULL,
			alert_pct   INTEGER DEFAULT 80,
			created_at  TEXT DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		t.Fatalf("create budgets table: %v", err)
	}

	// Create daily_metrics table (normally created by agent #90)
	_, err = d.ExecContext(context.Background(), `
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
		)
	`)
	if err != nil {
		t.Fatalf("create daily_metrics table: %v", err)
	}

	return d
}

func TestCreateBudget(t *testing.T) {
	d := testBudgetDB(t)
	ctx := context.Background()

	b, err := d.CreateBudget(ctx, Budget{
		Period:     "monthly",
		LimitCents: 5000,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if b.ID == "" {
		t.Error("expected generated ID")
	}
	if b.AlertPct != 80 {
		t.Errorf("expected default alert_pct=80, got %d", b.AlertPct)
	}
}

func TestCreateBudget_Validation(t *testing.T) {
	d := testBudgetDB(t)
	ctx := context.Background()

	_, err := d.CreateBudget(ctx, Budget{LimitCents: 5000})
	if err == nil {
		t.Error("expected error for missing period")
	}

	_, err = d.CreateBudget(ctx, Budget{Period: "monthly", LimitCents: 0})
	if err == nil {
		t.Error("expected error for zero limit")
	}
}

func TestListBudgets(t *testing.T) {
	d := testBudgetDB(t)
	ctx := context.Background()

	_, _ = d.CreateBudget(ctx, Budget{Period: "daily", LimitCents: 100})
	_, _ = d.CreateBudget(ctx, Budget{Period: "monthly", LimitCents: 5000, ProjectID: "proj-1"})

	budgets, err := d.ListBudgets(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(budgets) != 2 {
		t.Fatalf("expected 2 budgets, got %d", len(budgets))
	}
}

func TestDeleteBudget(t *testing.T) {
	d := testBudgetDB(t)
	ctx := context.Background()

	b, _ := d.CreateBudget(ctx, Budget{Period: "daily", LimitCents: 100})

	err := d.DeleteBudget(ctx, b.ID)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}

	// Delete again should return ErrNoRows
	err = d.DeleteBudget(ctx, b.ID)
	if err != sql.ErrNoRows {
		t.Errorf("expected ErrNoRows, got %v", err)
	}
}

func TestDeleteBudget_EmptyID(t *testing.T) {
	d := testBudgetDB(t)
	err := d.DeleteBudget(context.Background(), "")
	if err == nil {
		t.Error("expected error for empty ID")
	}
}

func TestGetBudgetUtilization(t *testing.T) {
	d := testBudgetDB(t)
	ctx := context.Background()

	b, _ := d.CreateBudget(ctx, Budget{
		Provider:   "claude",
		Period:     "monthly",
		LimitCents: 10000,
	})

	// Insert daily_metrics for current month
	today := "2026-03-27"
	_, err := d.ExecContext(ctx,
		`INSERT INTO daily_metrics (date, project_id, provider, model, cost_cents) VALUES (?, '', 'claude', 'claude-opus-4-6', 1500)`,
		today,
	)
	if err != nil {
		t.Fatalf("insert daily_metrics: %v", err)
	}
	_, err = d.ExecContext(ctx,
		`INSERT INTO daily_metrics (date, project_id, provider, model, cost_cents) VALUES (?, '', 'claude', 'claude-sonnet-4-6', 800)`,
		today,
	)
	if err != nil {
		t.Fatalf("insert daily_metrics: %v", err)
	}

	spent, limit, err := d.GetBudgetUtilization(ctx, b.ID)
	if err != nil {
		t.Fatalf("utilization: %v", err)
	}
	if limit != 10000 {
		t.Errorf("limit: got %d, want 10000", limit)
	}
	if spent != 2300 {
		t.Errorf("spent: got %d, want 2300", spent)
	}
}

func TestGetBudgetUtilization_NotFound(t *testing.T) {
	d := testBudgetDB(t)
	_, _, err := d.GetBudgetUtilization(context.Background(), "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent budget")
	}
}

// Ensure testDB doesn't leak temp files
func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
