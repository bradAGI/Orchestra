// apps/backend/internal/studio/manager_test.go
package studio

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/observability"
	"github.com/orchestra/orchestra/apps/backend/internal/studio/templates"
	"github.com/orchestra/orchestra/apps/backend/internal/tracker"
	_ "modernc.org/sqlite"
)

// fakeTracker is an in-memory Tracker implementation for testing Push.
type fakeTracker struct {
	created []*tracker.Issue
	updates []map[string]any
	nextID  int
}

func (f *fakeTracker) CreateIssue(_ context.Context, title, description, state string, priority int, assigneeID, projectID, provider string, disabledTools []string) (*tracker.Issue, error) {
	f.nextID++
	iss := &tracker.Issue{
		ID:          fmt.Sprintf("uuid-%d", f.nextID),
		Identifier:  fmt.Sprintf("ISS-%d", f.nextID),
		Title:       title,
		Description: description,
		State:       state,
		ProjectID:   projectID,
		Provider:    provider,
	}
	f.created = append(f.created, iss)
	return iss, nil
}

func (f *fakeTracker) UpdateIssue(_ context.Context, identifier string, updates map[string]any) (*tracker.Issue, error) {
	f.updates = append(f.updates, updates)
	return &tracker.Issue{Identifier: identifier}, nil
}

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

func TestPushPersistsIssueAndEndsSession(t *testing.T) {
	m := newTestManager(t)
	tr := &fakeTracker{}
	m.SetTracker(tr)

	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	_ = m.SetTitle(sess.ID, "Refactor auth")
	_ = m.SetDescription(sess.ID, "Body")
	_ = m.AddAcceptanceCriterion(sess.ID, "tests pass")

	id, err := m.Push(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	if id == "" || len(tr.created) != 1 || len(tr.updates) != 1 {
		t.Fatalf("tracker not called correctly: created=%v updates=%v", tr.created, tr.updates)
	}
	if tr.created[0].Title != "Refactor auth" {
		t.Fatalf("title mismatch: %q", tr.created[0].Title)
	}
	if _, ok := tr.updates[0]["acceptance_criteria"]; !ok {
		t.Fatalf("update missing acceptance_criteria: %+v", tr.updates[0])
	}
	if _, err := m.GetDraft(sess.ID); err == nil {
		t.Fatalf("expected draft removed after push")
	}
}

func TestPushRejectsEmptyTitle(t *testing.T) {
	m := newTestManager(t)
	m.SetTracker(&fakeTracker{})
	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if _, err := m.Push(context.Background(), sess.ID); err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestPushRejectsEmptyDescription(t *testing.T) {
	m := newTestManager(t)
	m.SetTracker(&fakeTracker{})
	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	_ = m.SetTitle(sess.ID, "T")
	if _, err := m.Push(context.Background(), sess.ID); err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestPushIsIdempotent_ConcurrentCallsCreateOneIssue(t *testing.T) {
	m := newTestManager(t)
	tr := &fakeTracker{}
	m.SetTracker(tr)
	sess, err := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if err != nil {
		t.Fatalf("start session: %v", err)
	}
	if err := m.SetTitle(sess.ID, "T"); err != nil {
		t.Fatalf("set title: %v", err)
	}
	if err := m.SetDescription(sess.ID, "D"); err != nil {
		t.Fatalf("set description: %v", err)
	}

	const n = 5
	var wg sync.WaitGroup
	errs := make([]error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, errs[idx] = m.Push(context.Background(), sess.ID)
		}(i)
	}
	wg.Wait()

	successCount := 0
	for _, e := range errs {
		if e == nil {
			successCount++
		}
	}
	if successCount != 1 {
		t.Fatalf("expected exactly 1 successful push, got %d (errs=%v)", successCount, errs)
	}
	if len(tr.created) != 1 {
		t.Fatalf("expected exactly 1 tracker issue, got %d", len(tr.created))
	}
}

func writeTemplateForTest(t *testing.T, name, body string) *templates.Store {
	t.Helper()
	dir := t.TempDir()
	store := templates.NewStore(dir)
	if err := store.Write(name, []byte(body)); err != nil {
		t.Fatalf("write template: %v", err)
	}
	return store
}

func TestStartSessionWithTemplatePrefillsDraft(t *testing.T) {
	m := newTestManager(t)
	store := writeTemplateForTest(t, "add-tests", `---
name: add-tests
description: Add tests
variables:
  - name: file
    required: true
suggested_provider: claude-code
suggested_max_turns: 8
---
Add tests to {{file}}.
`)
	m.SetTemplateStore(store)

	sess, err := m.StartSession(context.Background(), StartSessionRequest{
		ProjectID:    "p",
		Runner:       "claude-code",
		Template:     "add-tests",
		TemplateVars: map[string]string{"file": "auth.go"},
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	snap, err := m.GetDraft(sess.ID)
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if snap.SuggestedProvider != "claude-code" {
		t.Fatalf("provider=%q", snap.SuggestedProvider)
	}
	if snap.MaxTurns == nil || *snap.MaxTurns != 8 {
		t.Fatalf("max_turns=%v", snap.MaxTurns)
	}
	if snap.TemplateName != "add-tests" {
		t.Fatalf("template_name=%q", snap.TemplateName)
	}
	if !strings.Contains(snap.Description, "auth.go") {
		t.Fatalf("description missing rendered body: %q", snap.Description)
	}
}

func TestApplyTemplateMidSession(t *testing.T) {
	m := newTestManager(t)
	store := writeTemplateForTest(t, "refactor", `---
name: refactor
variables:
  - name: target
    required: true
---
Refactor {{target}}.
`)
	m.SetTemplateStore(store)

	sess, _ := m.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if err := m.ApplyTemplate(sess.ID, "refactor", map[string]string{"target": "auth.go"}); err != nil {
		t.Fatalf("apply: %v", err)
	}
	snap, _ := m.GetDraft(sess.ID)
	if snap.TemplateName != "refactor" {
		t.Fatalf("template_name=%q", snap.TemplateName)
	}
	if !strings.Contains(snap.Description, "auth.go") {
		t.Fatalf("description missing rendered body: %q", snap.Description)
	}
}

func TestApplyTemplateMissingRequired(t *testing.T) {
	m := newTestManager(t)
	store := writeTemplateForTest(t, "needs-var", `---
name: needs-var
variables:
  - name: target
    required: true
---
{{target}}
`)
	m.SetTemplateStore(store)

	if _, err := m.StartSession(context.Background(), StartSessionRequest{
		ProjectID: "p", Runner: "claude-code",
		Template: "needs-var", TemplateVars: map[string]string{},
	}); err == nil {
		t.Fatalf("expected error for missing required var")
	}
}
