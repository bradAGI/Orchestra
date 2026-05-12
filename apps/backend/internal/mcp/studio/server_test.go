package studio

import (
	"context"
	"encoding/json"
	"testing"
)

type recordingManager struct {
	titles       []string
	descriptions []string
	acs          []string
	files        []string
	links        [][2]string
	providers    []string
	models       []string
	maxTurns     []int
}

func (r *recordingManager) SetTitle(_, title string) error {
	r.titles = append(r.titles, title)
	return nil
}
func (r *recordingManager) SetDescription(_, desc string) error {
	r.descriptions = append(r.descriptions, desc)
	return nil
}
func (r *recordingManager) AddAcceptanceCriterion(_, ac string) error {
	r.acs = append(r.acs, ac)
	return nil
}
func (r *recordingManager) RemoveAcceptanceCriterion(string, int) error { return nil }
func (r *recordingManager) AttachFile(_, path string) error {
	r.files = append(r.files, path)
	return nil
}
func (r *recordingManager) AttachLink(_, url, label string) error {
	r.links = append(r.links, [2]string{url, label})
	return nil
}
func (r *recordingManager) SetProvider(_, p string) error {
	r.providers = append(r.providers, p)
	return nil
}
func (r *recordingManager) SetModel(_, m string) error {
	r.models = append(r.models, m)
	return nil
}
func (r *recordingManager) SetMaxTurns(_ string, n int) error {
	r.maxTurns = append(r.maxTurns, n)
	return nil
}
func (r *recordingManager) Push(context.Context, string) (string, error) { return "ISS-1", nil }

func TestSetTitleTool(t *testing.T) {
	rm := &recordingManager{}
	srv := New(rm, "sess1")
	resp, err := srv.Dispatch(context.Background(), "set_title", json.RawMessage(`{"text":"Refactor auth"}`))
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if len(rm.titles) != 1 || rm.titles[0] != "Refactor auth" {
		t.Fatalf("titles=%v", rm.titles)
	}
	if string(resp) == "" {
		t.Fatalf("empty response")
	}
}

func TestUnknownTool(t *testing.T) {
	srv := New(&recordingManager{}, "sess1")
	if _, err := srv.Dispatch(context.Background(), "no_such_tool", json.RawMessage(`{}`)); err == nil {
		t.Fatalf("expected error for unknown tool")
	}
}

func TestAddACToolValidates(t *testing.T) {
	srv := New(&recordingManager{}, "sess1")
	if _, err := srv.Dispatch(context.Background(), "add_acceptance_criterion", json.RawMessage(`{"text":""}`)); err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestAttachFileToolValidates(t *testing.T) {
	srv := New(&recordingManager{}, "sess1")
	if _, err := srv.Dispatch(context.Background(), "attach_file", json.RawMessage(`{"path":""}`)); err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestPushToolReturnsID(t *testing.T) {
	srv := New(&recordingManager{}, "sess1")
	resp, err := srv.Dispatch(context.Background(), "push_to_backlog", json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	var out struct {
		IssueID string `json:"issue_id"`
	}
	_ = json.Unmarshal(resp, &out)
	if out.IssueID != "ISS-1" {
		t.Fatalf("issue_id=%q", out.IssueID)
	}
}
