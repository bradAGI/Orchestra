// apps/backend/internal/studio/manager_test.go
package studio

import (
	"context"
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/observability"
)

func newTestManager(t *testing.T) *Manager {
	t.Helper()
	d, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	if _, err := d.Exec(db.Schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	bus := observability.NewPubSub()
	return NewManager(d, bus, nil)
}

func TestStartSession_CreatesDraft(t *testing.T) {
	m := newTestManager(t)
	sess, err := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	snap, err := m.GetDraft(sess.ID)
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if snap.Title != "" || snap.SessionID != sess.ID {
		t.Fatalf("unexpected draft: %+v", snap)
	}
}

func TestDiscardSession_RemovesDraft(t *testing.T) {
	m := newTestManager(t)
	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if err := m.Discard(sess.ID); err != nil {
		t.Fatalf("discard: %v", err)
	}
	if _, err := m.GetDraft(sess.ID); err == nil {
		t.Fatalf("expected draft removed")
	}
}
