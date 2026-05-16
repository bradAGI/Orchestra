package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/orchestra/orchestra/apps/backend/internal/studio/templates"
)

func spinUpStudioTemplatesAPI(t *testing.T) *httptest.Server {
	t.Helper()
	store := templates.NewStore(t.TempDir())
	srv := &Server{studioTpls: store}

	r := chi.NewRouter()
	r.Get("/api/v1/studio/templates", srv.ListStudioTemplates)
	r.Post("/api/v1/studio/templates", srv.CreateStudioTemplate)
	r.Get("/api/v1/studio/templates/{name}", srv.GetStudioTemplate)
	r.Put("/api/v1/studio/templates/{name}", srv.UpdateStudioTemplate)
	r.Delete("/api/v1/studio/templates/{name}", srv.DeleteStudioTemplate)

	ts := httptest.NewServer(r)
	t.Cleanup(ts.Close)
	return ts
}

func TestStudioTemplatesCRUD(t *testing.T) {
	ts := spinUpStudioTemplatesAPI(t)

	// Create
	body := `{"name":"add-tests","content":"---\nname: add-tests\ndescription: D\n---\nbody"}`
	resp, err := http.Post(ts.URL+"/api/v1/studio/templates", "application/json", bytes.NewBufferString(body))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status=%d", resp.StatusCode)
	}

	// List
	resp2, err := http.Get(ts.URL + "/api/v1/studio/templates")
	if err != nil {
		t.Fatalf("get list: %v", err)
	}
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("list status=%d", resp2.StatusCode)
	}
	var listed []map[string]any
	if err := json.NewDecoder(resp2.Body).Decode(&listed); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected 1, got %d", len(listed))
	}

	// Get
	resp3, _ := http.Get(ts.URL + "/api/v1/studio/templates/add-tests")
	if resp3.StatusCode != http.StatusOK {
		t.Fatalf("get status=%d", resp3.StatusCode)
	}

	// Update
	upd := `{"content":"---\nname: add-tests\ndescription: D2\n---\nbody2"}`
	req, _ := http.NewRequest(http.MethodPut, ts.URL+"/api/v1/studio/templates/add-tests", bytes.NewBufferString(upd))
	req.Header.Set("Content-Type", "application/json")
	resp4, _ := http.DefaultClient.Do(req)
	if resp4.StatusCode != http.StatusNoContent {
		t.Fatalf("update status=%d", resp4.StatusCode)
	}

	// Delete
	req2, _ := http.NewRequest(http.MethodDelete, ts.URL+"/api/v1/studio/templates/add-tests", nil)
	resp5, _ := http.DefaultClient.Do(req2)
	if resp5.StatusCode != http.StatusNoContent {
		t.Fatalf("delete status=%d", resp5.StatusCode)
	}

	// Get-after-delete
	resp6, _ := http.Get(ts.URL + "/api/v1/studio/templates/add-tests")
	if resp6.StatusCode != http.StatusNotFound {
		t.Fatalf("get-after-delete status=%d", resp6.StatusCode)
	}
}

func TestStudioTemplatesRejectsBadName(t *testing.T) {
	ts := spinUpStudioTemplatesAPI(t)
	body := `{"name":"../escape","content":"---\nname: x\n---\n"}`
	resp, _ := http.Post(ts.URL+"/api/v1/studio/templates", "application/json", bytes.NewBufferString(body))
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestStudioTemplatesUnavailable(t *testing.T) {
	srv := &Server{}
	r := chi.NewRouter()
	r.Get("/api/v1/studio/templates", srv.ListStudioTemplates)
	ts := httptest.NewServer(r)
	t.Cleanup(ts.Close)

	resp, _ := http.Get(ts.URL + "/api/v1/studio/templates")
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.StatusCode)
	}
}
