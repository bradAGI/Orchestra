package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Tier 2 contract tests for /api/v1/tracker/configs CRUD.
//
// These cover the wire shape, basic validation, and the security-critical
// invariant that tokens never round-trip back to the client (HasToken
// boolean only, plaintext stripped). Adapter-driven endpoints (test,
// projects, states, issues) are covered separately because they require
// a fully-wired tracker.Registry.

func decodeDTO(t *testing.T, body []byte) trackerConfigDTO {
	t.Helper()
	var dto trackerConfigDTO
	if err := json.Unmarshal(body, &dto); err != nil {
		t.Fatalf("decode trackerConfigDTO: %v\nbody: %s", err, body)
	}
	return dto
}

func TestGetTrackerConfigsEmpty(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tracker/configs", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	// Must be a JSON array (not null) so frontend code that does .map() works.
	body := strings.TrimSpace(rec.Body.String())
	if body != "[]" {
		t.Fatalf("expected empty JSON array, got %q", body)
	}
}

func TestPostTrackerConfigRejectsMissingFields(t *testing.T) {
	router, _ := newTestRouterWithDB(t)

	cases := []struct {
		name string
		body string
	}{
		{"missing_type", `{"display_name":"Linear"}`},
		{"missing_display_name", `{"type":"linear"}`},
		{"both_blank", `{"type":"  ","display_name":"  "}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/tracker/configs", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestPostTrackerConfigRejectsInvalidJSON(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tracker/configs", strings.NewReader(`{not json}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

func TestPostTrackerConfigCreatesAndRedactsToken(t *testing.T) {
	router, _ := newTestRouterWithDB(t)

	body := `{
		"type":"linear",
		"display_name":"My Linear",
		"endpoint":"https://api.linear.app/graphql",
		"auth_method":"apikey",
		"token":"super-secret-token",
		"extra":{"team":"ENG"}
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tracker/configs", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("got %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	dto := decodeDTO(t, rec.Body.Bytes())

	if dto.ID == "" {
		t.Error("expected generated ID")
	}
	if dto.Type != "linear" {
		t.Errorf("type: got %q, want %q", dto.Type, "linear")
	}
	if dto.DisplayName != "My Linear" {
		t.Errorf("display_name: got %q", dto.DisplayName)
	}
	if dto.Endpoint != "https://api.linear.app/graphql" {
		t.Errorf("endpoint: got %q", dto.Endpoint)
	}
	if !dto.HasToken {
		t.Error("HasToken must be true after Post with non-empty token")
	}
	// Token must NEVER appear in the response — only HasToken.
	if bytes.Contains(rec.Body.Bytes(), []byte("super-secret-token")) {
		t.Fatalf("plaintext token leaked in response: %s", rec.Body.String())
	}
	if !strings.Contains(dto.Extra, "ENG") {
		t.Errorf("extra: got %q, want it to contain ENG", dto.Extra)
	}
	if dto.CreatedAt == 0 || dto.UpdatedAt == 0 {
		t.Error("expected non-zero CreatedAt/UpdatedAt")
	}
}

func TestPostTrackerConfigDefaultsAuthMethodToApikey(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tracker/configs", strings.NewReader(`{
		"type":"jira",
		"display_name":"Jira"
	}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("got %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	dto := decodeDTO(t, rec.Body.Bytes())
	if dto.AuthMethod != "apikey" {
		t.Errorf("auth_method default: got %q, want %q", dto.AuthMethod, "apikey")
	}
	if dto.HasToken {
		t.Error("HasToken should be false when token is omitted")
	}
}

func TestGetTrackerConfigsReturnsCreatedConfig(t *testing.T) {
	router, _ := newTestRouterWithDB(t)

	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/tracker/configs", strings.NewReader(`{
		"type":"github","display_name":"GH"
	}`))
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("setup failed, create returned %d", createRec.Code)
	}
	created := decodeDTO(t, createRec.Body.Bytes())

	req := httptest.NewRequest(http.MethodGet, "/api/v1/tracker/configs", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("list got %d", rec.Code)
	}
	var list []trackerConfigDTO
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Fatalf("list missing created config: %+v", list)
	}
}

func TestPatchTrackerConfigNotFound(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/tracker/configs/does-not-exist", strings.NewReader(`{"display_name":"Renamed"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("got %d, want 404; body=%s", rec.Code, rec.Body.String())
	}
}

func TestPatchTrackerConfigUpdatesFields(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/tracker/configs", strings.NewReader(`{
		"type":"linear","display_name":"Original","endpoint":"https://orig.example"
	}`))
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	created := decodeDTO(t, createRec.Body.Bytes())

	patchReq := httptest.NewRequest(http.MethodPatch, "/api/v1/tracker/configs/"+created.ID, strings.NewReader(`{
		"display_name":"Renamed","token":"new-token"
	}`))
	patchReq.Header.Set("Content-Type", "application/json")
	patchRec := httptest.NewRecorder()
	router.ServeHTTP(patchRec, patchReq)

	if patchRec.Code != http.StatusOK {
		t.Fatalf("patch got %d, want 200; body=%s", patchRec.Code, patchRec.Body.String())
	}
	updated := decodeDTO(t, patchRec.Body.Bytes())
	if updated.DisplayName != "Renamed" {
		t.Errorf("display_name not updated: got %q", updated.DisplayName)
	}
	if updated.Endpoint != "https://orig.example" {
		t.Errorf("endpoint should be preserved when omitted: got %q", updated.Endpoint)
	}
	if !updated.HasToken {
		t.Error("HasToken should be true after token update")
	}
	if bytes.Contains(patchRec.Body.Bytes(), []byte("new-token")) {
		t.Fatalf("plaintext token leaked in patch response")
	}
}

func TestDeleteTrackerConfigNotFound(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/tracker/configs/does-not-exist", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("got %d, want 404; body=%s", rec.Code, rec.Body.String())
	}
}

func TestDeleteTrackerConfigRemovesRow(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/tracker/configs", strings.NewReader(`{
		"type":"jira","display_name":"To delete"
	}`))
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	created := decodeDTO(t, createRec.Body.Bytes())

	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/tracker/configs/"+created.ID, nil)
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusOK {
		t.Fatalf("delete got %d, want 200; body=%s", delRec.Code, delRec.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/tracker/configs", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if strings.TrimSpace(listRec.Body.String()) != "[]" {
		t.Fatalf("expected empty list after delete, got %s", listRec.Body.String())
	}
}

func TestPostTrackerConfigTestNoRegistry(t *testing.T) {
	// newTestRouterWithDB wires no Registry, so the test endpoint must
	// fail-fast with a clear 500 rather than panicking.
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tracker/configs/any/test", nil)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("got %d, want 500; body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetTrackerConfigEndpointsRequireDB(t *testing.T) {
	// When no DB is wired, list/create/patch/delete must all fail with 500
	// "no_db" instead of panicking. The auth-matrix harness doesn't wire a
	// DB, so we can reuse that builder.
	router := newAuthMatrixRouter(t)

	cases := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/api/v1/tracker/configs", ""},
		{http.MethodPost, "/api/v1/tracker/configs", `{"type":"linear","display_name":"x"}`},
		{http.MethodPatch, "/api/v1/tracker/configs/x", `{"display_name":"y"}`},
		{http.MethodDelete, "/api/v1/tracker/configs/x", ""},
	}

	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			var body *strings.Reader
			if tc.body != "" {
				body = strings.NewReader(tc.body)
			}
			var req *http.Request
			if body == nil {
				req = httptest.NewRequest(tc.method, tc.path, nil)
			} else {
				req = httptest.NewRequest(tc.method, tc.path, body)
				req.Header.Set("Content-Type", "application/json")
			}
			req.Header.Set("Authorization", "Bearer test-token")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusInternalServerError {
				t.Fatalf("got %d, want 500 no_db; body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}
