// apps/backend/internal/studio/manager_test.go
package studio

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
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

func TestSetTitle(t *testing.T) {
	m := newTestManager(t)
	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if err := m.SetTitle(sess.ID, "Refactor auth"); err != nil {
		t.Fatalf("set: %v", err)
	}
	snap, _ := m.GetDraft(sess.ID)
	if snap.Title != "Refactor auth" {
		t.Fatalf("title=%q", snap.Title)
	}
}

func TestAddAcceptanceCriterion(t *testing.T) {
	m := newTestManager(t)
	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if err := m.AddAcceptanceCriterion(sess.ID, "tests pass"); err != nil {
		t.Fatalf("add ac: %v", err)
	}
	if err := m.AddAcceptanceCriterion(sess.ID, "no regressions"); err != nil {
		t.Fatalf("add ac 2: %v", err)
	}
	snap, _ := m.GetDraft(sess.ID)
	if len(snap.AcceptanceCriteria) != 2 || snap.AcceptanceCriteria[0] != "tests pass" {
		t.Fatalf("ac=%v", snap.AcceptanceCriteria)
	}
}

func TestAttachFile(t *testing.T) {
	m := newTestManager(t)
	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if err := m.AttachFile(sess.ID, "auth/middleware.go"); err != nil {
		t.Fatalf("attach: %v", err)
	}
	snap, _ := m.GetDraft(sess.ID)
	if len(snap.Attachments) != 1 || snap.Attachments[0].Path != "auth/middleware.go" {
		t.Fatalf("attachments=%v", snap.Attachments)
	}
}

func TestConcurrentDraftWrites(t *testing.T) {
	m := newTestManager(t)
	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			_ = m.AddAcceptanceCriterion(sess.ID, fmt.Sprintf("ac-%d", n))
		}(i)
	}
	wg.Wait()
	snap, _ := m.GetDraft(sess.ID)
	if len(snap.AcceptanceCriteria) == 0 {
		t.Fatalf("expected some ACs added")
	}
}
