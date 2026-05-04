package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Tier 2 contract tests for /api/v1/mcp/{tools,servers}.
//
// PostMCPServer / DeleteMCPServer trigger a synchronous hot-reload of
// the MCP registry: mcp.NewRegistry(...).StartAll(...) spawns the
// configured command and runs an initialize handshake. With any command
// that doesn't speak MCP-over-stdio, the listener goroutine never
// terminates cleanly and the test process hangs. Until that lifecycle
// is hardened, we only cover the validation + missing-dependency guards
// here. The DB persistence side is covered by db.MCPServer tests.

func TestGetMCPServersWithoutDBReturnsEmpty(t *testing.T) {
	// no-DB harness — handler returns 200 with empty list, never 5xx.
	router := newAuthMatrixRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/mcp/servers", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Servers []map[string]any `json:"servers"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &payload)
	if len(payload.Servers) != 0 {
		t.Errorf("expected empty servers list, got %v", payload.Servers)
	}
}

func TestGetMCPToolsWithoutRegistryReturnsEmpty(t *testing.T) {
	router := newAuthMatrixRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/mcp/tools", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Tools []any `json:"tools"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &payload)
	if len(payload.Tools) != 0 {
		t.Errorf("expected empty tools list, got %v", payload.Tools)
	}
}

func TestPostMCPServerRequiresDB(t *testing.T) {
	// Without a wired DB the handler must 503, not panic.
	router := newAuthMatrixRouter(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/mcp/servers", strings.NewReader(`{"name":"x","command":"/bin/true"}`))
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d, want 503; body=%s", rec.Code, rec.Body.String())
	}
}

func TestDeleteMCPServerRequiresDB(t *testing.T) {
	router := newAuthMatrixRouter(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/mcp/servers/abc", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d, want 503; body=%s", rec.Code, rec.Body.String())
	}
}

func TestPostMCPServerRejectsInvalidJSON(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/mcp/servers", strings.NewReader(`{not json}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

// NOTE: round-trip Post/Delete tests are intentionally omitted — see the
// file-level comment. They would hang the test runner because the MCP
// client's listener goroutine doesn't shut down cleanly when a non-MCP
// child process exits.
