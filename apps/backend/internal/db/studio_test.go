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

func TestCreateAndGetStudioSession(t *testing.T) {
	d := openTestDB(t)

	s := StudioSession{ID: "sess1", ProjectID: "proj1", Runner: "claude-code"}
	if err := CreateStudioSession(d, s); err != nil {
		t.Fatalf("create: %v", err)
	}
	got, err := GetStudioSession(d, "sess1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Runner != "claude-code" {
		t.Fatalf("runner = %q, want claude-code", got.Runner)
	}
}

func TestCreateDraftAndUpdate(t *testing.T) {
	d := openTestDB(t)
	_ = CreateStudioSession(d, StudioSession{ID: "sess1", ProjectID: "proj1", Runner: "claude-code"})

	if err := CreateDraft(d, "sess1"); err != nil {
		t.Fatalf("create draft: %v", err)
	}
	if err := UpdateDraftField(d, "sess1", "title", "Refactor auth"); err != nil {
		t.Fatalf("update title: %v", err)
	}
	d2, err := GetDraft(d, "sess1")
	if err != nil {
		t.Fatalf("get draft: %v", err)
	}
	if d2.Title != "Refactor auth" {
		t.Fatalf("title = %q", d2.Title)
	}
}

func TestUpdateDraftFieldRejectsUnknownColumn(t *testing.T) {
	d := openTestDB(t)
	_ = CreateStudioSession(d, StudioSession{ID: "sess1", ProjectID: "proj1", Runner: "claude-code"})
	_ = CreateDraft(d, "sess1")
	if err := UpdateDraftField(d, "sess1", "id; DROP TABLE issues;--", "x"); err == nil {
		t.Fatalf("expected rejection of unknown column")
	}
}
