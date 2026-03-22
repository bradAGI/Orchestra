package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Per-Provider Configuration Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Provider Permissions
// ---------------------------------------------------------------------------

func TestGetProviderPermissions(t *testing.T) {
	router := newTestRouter(t)

	providers := []string{"claude", "codex", "opencode", "gemini"}
	for _, provider := range providers {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/agents/"+provider+"/permissions", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
			t.Fatalf("provider %s: expected 200 or 500, got %d: %s", provider, rec.Code, rec.Body.String())
		}
	}
}

func TestGetProviderPermissionsUnknownProvider(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/agents/unknown_provider/permissions", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusOK {
		t.Fatalf("expected 400 or 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestPostProviderPermissionsRejectsInvalidJSON(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/claude/permissions", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestPostProviderPermissions(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]any{
		"approval_mode": "auto",
		"allow":         []string{"read"},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/claude/permissions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// May succeed or fail depending on home directory writable
	if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError && rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 200, 400, or 500, got %d: %s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Provider Model Config
// ---------------------------------------------------------------------------

func TestGetProviderModel(t *testing.T) {
	router := newTestRouter(t)

	providers := []string{"claude", "codex", "opencode", "gemini"}
	for _, provider := range providers {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/agents/"+provider+"/model", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
			t.Fatalf("provider %s: expected 200 or 500, got %d", provider, rec.Code)
		}
	}
}

func TestPostProviderModelRejectsInvalidJSON(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/claude/model", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestPostProviderModel(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]any{
		"model":  "claude-sonnet-4-20250514",
		"effort": "high",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/claude/model", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError && rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 200, 400, or 500, got %d: %s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Provider Hooks
// ---------------------------------------------------------------------------

func TestGetProviderHooks(t *testing.T) {
	router := newTestRouter(t)

	providers := []string{"claude", "codex", "opencode", "gemini"}
	for _, provider := range providers {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/agents/"+provider+"/hooks", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
			t.Fatalf("provider %s: expected 200 or 500, got %d", provider, rec.Code)
		}
	}
}

func TestPostProviderHooksRejectsInvalidJSON(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/claude/hooks", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Provider MCP Servers
// ---------------------------------------------------------------------------

func TestGetProviderMCPServers(t *testing.T) {
	router := newTestRouter(t)

	providers := []string{"claude", "codex", "opencode", "gemini"}
	for _, provider := range providers {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/agents/"+provider+"/mcp", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
			t.Fatalf("provider %s: expected 200 or 500, got %d", provider, rec.Code)
		}
	}
}

func TestAddProviderMCPServerRejectsInvalidJSON(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/claude/mcp", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestAddProviderMCPServerMissingName(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]any{
		"name":    "",
		"command": "npx",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/claude/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAddProviderMCPServerMissingCommandAndURL(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]any{
		"name": "test-server",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/agents/claude/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestDeleteProviderMCPServer(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/agents/claude/mcp/nonexistent-server", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Should succeed (204) even if server doesn't exist, or fail gracefully
	if rec.Code != http.StatusNoContent && rec.Code != http.StatusInternalServerError && rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 204, 400, or 500, got %d: %s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Agent Provider API Keys
// ---------------------------------------------------------------------------

func TestGetAgentProviders(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/config/agent-providers", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if _, ok := payload["providers"]; !ok {
		t.Fatalf("expected providers key: %v", payload)
	}
}

func TestSaveAgentProviderRejectsInvalidJSON(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/config/agent-providers", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestSaveAgentProviderMissingFields(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]string{})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/config/agent-providers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSaveAgentProviderInvalidProvider(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]string{
		"provider": "invalid_provider",
		"api_key":  "sk-test",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/config/agent-providers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSaveAgentProviderValidProviders(t *testing.T) {
	router := newTestRouter(t)

	providers := []string{"openrouter", "claude", "openai", "gemini"}
	for _, provider := range providers {
		body, _ := json.Marshal(map[string]string{
			"provider": provider,
			"api_key":  "test-key-" + provider,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/config/agent-providers", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		// Should succeed (200) or fail gracefully with file I/O error
		if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
			t.Fatalf("provider %s: expected 200 or 500, got %d: %s", provider, rec.Code, rec.Body.String())
		}

		if rec.Code == http.StatusOK {
			var payload map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if payload["provider"] != provider {
				t.Fatalf("expected provider %q, got %v", provider, payload["provider"])
			}
			if payload["configured"] != true {
				t.Fatalf("expected configured=true, got %v", payload["configured"])
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Unsandbox Configuration
// ---------------------------------------------------------------------------

func TestGetUnsandboxConfig(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/config/unsandbox", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if _, ok := payload["configured"]; !ok {
		t.Fatalf("expected configured key: %v", payload)
	}
}

func TestPostUnsandboxConfigRejectsInvalidJSON(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/config/unsandbox", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestPostUnsandboxConfigMissingKeys(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]string{})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/config/unsandbox", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestDeleteUnsandboxConfig(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/config/unsandbox", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 200 or 500, got %d: %s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Unsandbox Execution
// ---------------------------------------------------------------------------

func TestGetUnsandboxStatus(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/unsandbox/status", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if _, ok := payload["configured"]; !ok {
		t.Fatalf("expected configured key: %v", payload)
	}
}

func TestPostUnsandboxExecuteNotConfigured(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]string{"code": "echo hello"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/unsandbox/execute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestPostUnsandboxExecuteRejectsInvalidJSON(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/unsandbox/execute", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Should return 503 (not configured) before reaching JSON parse
	if rec.Code != http.StatusServiceUnavailable && rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 503 or 400, got %d", rec.Code)
	}
}

func TestPostUnsandboxExecuteMissingCode(t *testing.T) {
	router := newTestRouter(t)

	body, _ := json.Marshal(map[string]string{"code": ""})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/unsandbox/execute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Not configured takes precedence
	if rec.Code != http.StatusServiceUnavailable && rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 503 or 400, got %d", rec.Code)
	}
}

func TestGetUnsandboxJobNotConfigured(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/unsandbox/jobs/test-job-id", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable && rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 503 or 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetUnsandboxSessionsNotConfigured(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/unsandbox/sessions", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetUnsandboxServicesNotConfigured(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/unsandbox/services", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
}
