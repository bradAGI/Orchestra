package db

import (
	"context"
	"path/filepath"
	"testing"
)

// analyticsTestDDL creates tables and columns that agent #90 will add to
// schema.go and migrate.go. We apply them here so git_metrics tests can run
// independently before the #90 branch merges.
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

func newTestDB(t *testing.T) *DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	d, err := Connect(dbPath)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	t.Cleanup(func() { d.Close() })

	// Apply the session_git_metrics table (owned by #90, not yet merged)
	if _, err := d.Exec(analyticsTestDDL); err != nil {
		t.Fatalf("apply analytics DDL: %v", err)
	}
	// Add session columns that #90 adds via migration
	for _, ddl := range []string{
		"ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'unknown'",
		"ALTER TABLE sessions ADD COLUMN duration_seconds REAL NOT NULL DEFAULT 0",
		"ALTER TABLE sessions ADD COLUMN cost_cents INTEGER DEFAULT 0",
		"ALTER TABLE sessions ADD COLUMN turn_count INTEGER DEFAULT 0",
	} {
		d.Exec(ddl) // Ignore errors if columns already exist
	}
	return d
}

func TestInsertAndGetSessionGitMetrics(t *testing.T) {
	d := newTestDB(t)
	ctx := context.Background()

	m := SessionGitMetrics{
		SessionID:    "sess-1",
		LinesAdded:   100,
		LinesRemoved: 20,
		FilesChanged: 5,
		TestFiles:    2,
		Commits:      3,
		Hunks:        7,
		PRUrl:        "https://github.com/org/repo/pull/1",
		PRMerged:     true,
		CIPassed:     1,
		CreatedAt:    "2026-03-27T10:00:00Z",
	}

	if err := d.InsertSessionGitMetrics(ctx, m); err != nil {
		t.Fatalf("insert: %v", err)
	}

	results, err := d.GetSessionGitMetrics(ctx, "2026-03-01T00:00:00Z")
	if err != nil {
		t.Fatalf("get: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	got := results[0]
	if got.SessionID != "sess-1" {
		t.Errorf("SessionID: got %q, want %q", got.SessionID, "sess-1")
	}
	if got.LinesAdded != 100 {
		t.Errorf("LinesAdded: got %d, want 100", got.LinesAdded)
	}
	if got.LinesRemoved != 20 {
		t.Errorf("LinesRemoved: got %d, want 20", got.LinesRemoved)
	}
	if got.FilesChanged != 5 {
		t.Errorf("FilesChanged: got %d, want 5", got.FilesChanged)
	}
	if got.TestFiles != 2 {
		t.Errorf("TestFiles: got %d, want 2", got.TestFiles)
	}
	if got.Commits != 3 {
		t.Errorf("Commits: got %d, want 3", got.Commits)
	}
	if got.Hunks != 7 {
		t.Errorf("Hunks: got %d, want 7", got.Hunks)
	}
	if got.PRUrl != "https://github.com/org/repo/pull/1" {
		t.Errorf("PRUrl: got %q", got.PRUrl)
	}
	if !got.PRMerged {
		t.Error("PRMerged: got false, want true")
	}
	if got.CIPassed != 1 {
		t.Errorf("CIPassed: got %d, want 1", got.CIPassed)
	}
}

func TestGetSessionGitMetricsFiltersBySince(t *testing.T) {
	d := newTestDB(t)
	ctx := context.Background()

	old := SessionGitMetrics{
		SessionID: "sess-old",
		CreatedAt: "2026-01-01T00:00:00Z",
	}
	recent := SessionGitMetrics{
		SessionID:  "sess-recent",
		LinesAdded: 50,
		CreatedAt:  "2026-03-27T12:00:00Z",
	}

	for _, m := range []SessionGitMetrics{old, recent} {
		if err := d.InsertSessionGitMetrics(ctx, m); err != nil {
			t.Fatalf("insert: %v", err)
		}
	}

	results, err := d.GetSessionGitMetrics(ctx, "2026-03-01T00:00:00Z")
	if err != nil {
		t.Fatalf("get: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].SessionID != "sess-recent" {
		t.Errorf("expected sess-recent, got %q", results[0].SessionID)
	}
}

func TestInsertSessionGitMetricsUpsert(t *testing.T) {
	d := newTestDB(t)
	ctx := context.Background()

	m1 := SessionGitMetrics{
		SessionID:  "sess-1",
		LinesAdded: 10,
		CreatedAt:  "2026-03-27T10:00:00Z",
	}
	m2 := SessionGitMetrics{
		SessionID:  "sess-1",
		LinesAdded: 50,
		CreatedAt:  "2026-03-27T10:00:00Z",
	}

	if err := d.InsertSessionGitMetrics(ctx, m1); err != nil {
		t.Fatalf("insert 1: %v", err)
	}
	if err := d.InsertSessionGitMetrics(ctx, m2); err != nil {
		t.Fatalf("insert 2: %v", err)
	}

	results, err := d.GetSessionGitMetrics(ctx, "2026-03-01T00:00:00Z")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result after upsert, got %d", len(results))
	}
	if results[0].LinesAdded != 50 {
		t.Errorf("LinesAdded after upsert: got %d, want 50", results[0].LinesAdded)
	}
}

func TestGetProductivityMetrics(t *testing.T) {
	d := newTestDB(t)
	ctx := context.Background()

	// Need sessions in the sessions table for the JOIN
	_, err := d.ExecContext(ctx, `
		INSERT INTO sessions (id, session_uuid, provider, created_at)
		VALUES ('s1', 'uuid-1', 'CLAUDE', '2026-03-27T10:00:00Z'),
		       ('s2', 'uuid-2', 'CODEX', '2026-03-27T11:00:00Z')
	`)
	if err != nil {
		t.Fatalf("insert sessions: %v", err)
	}

	metrics := []SessionGitMetrics{
		{SessionID: "s1", LinesAdded: 100, LinesRemoved: 20, FilesChanged: 5, TestFiles: 2, Commits: 3, CreatedAt: "2026-03-27T10:00:00Z"},
		{SessionID: "s2", LinesAdded: 50, LinesRemoved: 10, FilesChanged: 3, TestFiles: 1, Commits: 1, CreatedAt: "2026-03-27T11:00:00Z"},
	}
	for _, m := range metrics {
		if err := d.InsertSessionGitMetrics(ctx, m); err != nil {
			t.Fatalf("insert metrics: %v", err)
		}
	}

	pm, err := d.GetProductivityMetrics(ctx, "2026-03-01T00:00:00Z", "")
	if err != nil {
		t.Fatalf("get productivity: %v", err)
	}

	if pm.TotalLinesAdded != 150 {
		t.Errorf("TotalLinesAdded: got %d, want 150", pm.TotalLinesAdded)
	}
	if pm.TotalLinesRemoved != 30 {
		t.Errorf("TotalLinesRemoved: got %d, want 30", pm.TotalLinesRemoved)
	}
	if pm.TotalFilesChanged != 8 {
		t.Errorf("TotalFilesChanged: got %d, want 8", pm.TotalFilesChanged)
	}
	if pm.TotalCommits != 4 {
		t.Errorf("TotalCommits: got %d, want 4", pm.TotalCommits)
	}
	if pm.TotalTestFiles != 3 {
		t.Errorf("TotalTestFiles: got %d, want 3", pm.TotalTestFiles)
	}

	if len(pm.AgentComparison) != 2 {
		t.Fatalf("AgentComparison: expected 2 providers, got %d", len(pm.AgentComparison))
	}
}

func TestGetProductivityMetricsFilterByProvider(t *testing.T) {
	d := newTestDB(t)
	ctx := context.Background()

	_, err := d.ExecContext(ctx, `
		INSERT INTO sessions (id, session_uuid, provider, created_at)
		VALUES ('s1', 'uuid-1', 'CLAUDE', '2026-03-27T10:00:00Z'),
		       ('s2', 'uuid-2', 'CODEX', '2026-03-27T11:00:00Z')
	`)
	if err != nil {
		t.Fatalf("insert sessions: %v", err)
	}

	for _, m := range []SessionGitMetrics{
		{SessionID: "s1", LinesAdded: 100, CreatedAt: "2026-03-27T10:00:00Z"},
		{SessionID: "s2", LinesAdded: 50, CreatedAt: "2026-03-27T11:00:00Z"},
	} {
		if err := d.InsertSessionGitMetrics(ctx, m); err != nil {
			t.Fatalf("insert metrics: %v", err)
		}
	}

	pm, err := d.GetProductivityMetrics(ctx, "2026-03-01T00:00:00Z", "CLAUDE")
	if err != nil {
		t.Fatalf("get productivity: %v", err)
	}

	if pm.TotalLinesAdded != 100 {
		t.Errorf("TotalLinesAdded: got %d, want 100", pm.TotalLinesAdded)
	}
	if len(pm.AgentComparison) != 1 {
		t.Fatalf("AgentComparison: expected 1 provider, got %d", len(pm.AgentComparison))
	}
	if pm.AgentComparison[0].Provider != "CLAUDE" {
		t.Errorf("Provider: got %q, want CLAUDE", pm.AgentComparison[0].Provider)
	}
}

func TestGetProductivityMetricsEmpty(t *testing.T) {
	d := newTestDB(t)
	ctx := context.Background()

	pm, err := d.GetProductivityMetrics(ctx, "2026-03-01T00:00:00Z", "")
	if err != nil {
		t.Fatalf("get productivity: %v", err)
	}

	if pm.TotalLinesAdded != 0 {
		t.Errorf("TotalLinesAdded: got %d, want 0", pm.TotalLinesAdded)
	}
	if pm.AvgLinesPerSession != 0 {
		t.Errorf("AvgLinesPerSession: got %f, want 0", pm.AvgLinesPerSession)
	}
}
