package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Tier 2 contract tests for /api/v1/agents/{provider}/{permissions,model,hooks}.
// Focused on codex/gemini/opencode project scope so tests don't touch HOME.
// claude permissions/model/hooks read from ~/.claude — those are covered
// in the existing agent_config_e2e_test.go via t.Setenv("HOME", ...).

func getJSON[T any](t *testing.T, router http.Handler, path string) T {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s got %d, want 200; body=%s", path, rec.Code, rec.Body.String())
	}
	var out T
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode %s: %v\nbody=%s", path, err, rec.Body.String())
	}
	return out
}

func postJSONOK(t *testing.T, router http.Handler, path, body string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST %s got %d, want 200; body=%s", path, rec.Code, rec.Body.String())
	}
}

// --- Permissions ---------------------------------------------------------

func TestProviderPermissionsCodexProjectRoundTrip(t *testing.T) {
	// Codex stores approval_policy + sandbox_mode; Allow/Deny/Ask are not
	// representable in its config.toml schema and intentionally come back
	// empty. The contract this test pins: ApprovalMode + Sandbox round-trip.
	router, projectID, _ := seedProject(t)

	postJSONOK(t, router,
		"/api/v1/agents/codex/permissions?scope=project&project_id="+projectID,
		`{"approval_mode":"on-failure","sandbox":"workspace-write"}`)

	got := getJSON[ProviderPermissions](t, router,
		"/api/v1/agents/codex/permissions?scope=project&project_id="+projectID)

	if got.ApprovalMode != "on-failure" {
		t.Errorf("approval_mode: got %q, want %q", got.ApprovalMode, "on-failure")
	}
	if got.Sandbox != "workspace-write" {
		t.Errorf("sandbox: got %q, want %q", got.Sandbox, "workspace-write")
	}
}

func TestProviderPermissionsGeminiHardcodesInteractive(t *testing.T) {
	// Gemini's schema has no concept of approval mode — readGeminiPermissions
	// hardcodes "interactive". This test pins that: the handler accepts the
	// POST without erroring and GET reports the canonical mode regardless of
	// what was sent.
	router, projectID, _ := seedProject(t)

	postJSONOK(t, router,
		"/api/v1/agents/gemini/permissions?scope=project&project_id="+projectID,
		`{"approval_mode":"strict","allow":["fs"]}`)

	got := getJSON[ProviderPermissions](t, router,
		"/api/v1/agents/gemini/permissions?scope=project&project_id="+projectID)

	if got.ApprovalMode != "interactive" {
		t.Errorf("approval_mode: got %q, want hardcoded %q", got.ApprovalMode, "interactive")
	}
}

func TestProviderPermissionsOpenCodeAcceptsAndReturnsValidShape(t *testing.T) {
	// OpenCode's permission schema is complex (nested per-tool patterns
	// derived from Allow/Deny rules — see writeOpenCodePermissions). A bare
	// approval_mode write doesn't persist anything traceable, so we pin the
	// minimal contract: handler accepts the POST, GET returns a valid
	// shape with default "interactive" mode.
	router, projectID, _ := seedProject(t)

	postJSONOK(t, router,
		"/api/v1/agents/opencode/permissions?scope=project&project_id="+projectID,
		`{"approval_mode":"interactive","allow":["bash(npm:*)"],"deny":["bash(rm:*)"]}`)

	got := getJSON[ProviderPermissions](t, router,
		"/api/v1/agents/opencode/permissions?scope=project&project_id="+projectID)

	if got.ApprovalMode == "" {
		t.Error("approval_mode should be set on read, got empty")
	}
}

func TestProviderPermissionsUnknownProvider(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/agents/banana/permissions", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

// --- Model ---------------------------------------------------------------

func TestProviderModelCodexProjectRoundTrip(t *testing.T) {
	// Codex persists model + model_reasoning_effort. Temperature is
	// intentionally not stored — the agent runner doesn't consume it.
	router, projectID, _ := seedProject(t)

	postJSONOK(t, router,
		"/api/v1/agents/codex/model?scope=project&project_id="+projectID,
		`{"model":"gpt-5","effort":"high","temperature":0.2}`)

	got := getJSON[ProviderModelConfig](t, router,
		"/api/v1/agents/codex/model?scope=project&project_id="+projectID)

	if got.Model != "gpt-5" {
		t.Errorf("model: got %q", got.Model)
	}
	if got.Effort != "high" {
		t.Errorf("effort: got %q", got.Effort)
	}
}

func TestProviderModelGeminiProjectRoundTrip(t *testing.T) {
	router, projectID, _ := seedProject(t)

	postJSONOK(t, router,
		"/api/v1/agents/gemini/model?scope=project&project_id="+projectID,
		`{"model":"gemini-2.5-pro","effort":"medium","temperature":null}`)

	got := getJSON[ProviderModelConfig](t, router,
		"/api/v1/agents/gemini/model?scope=project&project_id="+projectID)

	if got.Model != "gemini-2.5-pro" {
		t.Errorf("model: got %q", got.Model)
	}
}

func TestProviderModelUnknownProvider(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/banana/model", strings.NewReader(`{"model":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

// --- Hooks ---------------------------------------------------------------

func TestProviderHooksCodexProjectRoundTrip(t *testing.T) {
	router, projectID, _ := seedProject(t)

	postJSONOK(t, router,
		"/api/v1/agents/codex/hooks?scope=project&project_id="+projectID,
		`[{"event":"pre_run","type":"command","command":"./check.sh","timeout":30}]`)

	got := getJSON[[]ProviderHook](t, router,
		"/api/v1/agents/codex/hooks?scope=project&project_id="+projectID)

	if len(got) != 1 {
		t.Fatalf("hooks: got %d, want 1", len(got))
	}
	if got[0].Event != "pre_run" || got[0].Command != "./check.sh" {
		t.Errorf("hook fields: %+v", got[0])
	}
}

func TestProviderHooksOpenCodeIsAlwaysEmpty(t *testing.T) {
	// OpenCode is plugin-based and intentionally returns an empty list.
	router, _ := newTestRouterWithDB(t)
	got := getJSON[[]ProviderHook](t, router, "/api/v1/agents/opencode/hooks")
	if len(got) != 0 {
		t.Errorf("opencode hooks should always be empty, got %v", got)
	}
}

func TestProviderHooksUnknownProvider(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/agents/banana/hooks", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

// --- Bad request bodies --------------------------------------------------

func TestProviderPermissionsRejectsInvalidJSON(t *testing.T) {
	router, projectID, _ := seedProject(t)
	req := httptest.NewRequest(http.MethodPost,
		"/api/v1/agents/codex/permissions?scope=project&project_id="+projectID,
		strings.NewReader(`{not json}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}
