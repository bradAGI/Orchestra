package db

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if _, err := d.Exec(Schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	if err := runMigrations(d); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	return d
}

func TestStudioTablesExist(t *testing.T) {
	d := openTestDB(t)

	for _, table := range []string{"issue_drafts", "studio_sessions"} {
		var name string
		row := d.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table)
		if err := row.Scan(&name); err != nil {
			t.Fatalf("table %s missing: %v", table, err)
		}
	}
}

func TestIssuesStudioColumnsExist(t *testing.T) {
	d := openTestDB(t)

	wanted := []string{"acceptance_criteria", "attachments", "agent_guidance", "source_template", "authoring_session_id"}
	for _, col := range wanted {
		ok, err := columnExists(d, "issues", col)
		if err != nil {
			t.Fatalf("columnExists(%s): %v", col, err)
		}
		if !ok {
			t.Fatalf("issues.%s missing", col)
		}
	}
}
