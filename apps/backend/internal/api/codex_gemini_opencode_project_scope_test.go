package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Tier 2 contract tests for the project-scope branch of /api/v1/agents/
// {codex,gemini,opencode}/*. Mirrors claude_project_scope_test.go.
//
// The handlers all run through the shared resolveProviderScope helper, so
// the most valuable coverage is one round-trip per resource that pins
// the on-disk layout — if a future refactor moves a path silently, the
// agent runners that read these files will break and these tests catch
// it before live runs do.

func postProviderFile(t *testing.T, router http.Handler, path, body string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST %s got %d, want 200; body=%s", path, rec.Code, rec.Body.String())
	}
}

func deleteProviderFile(t *testing.T, router http.Handler, path string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodDelete, path, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("DELETE %s got %d, want 200; body=%s", path, rec.Code, rec.Body.String())
	}
}

// --- Codex --------------------------------------------------------------

func TestCodexProjectConfigWritesUnderDotCodex(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/codex/config?scope=project&project_id="+projectID,
		`{"content":"model = \"gpt-5\"\n"}`)

	want := filepath.Join(root, ".codex", "config.toml")
	data, err := os.ReadFile(want)
	if err != nil {
		t.Fatalf("config.toml not at %s: %v", want, err)
	}
	if !strings.Contains(string(data), "gpt-5") {
		t.Errorf("content not persisted: %q", string(data))
	}
}

func TestCodexProjectInstructionsWriteAGENTSmd(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/codex/instructions?scope=project&project_id="+projectID,
		`{"content":"# Codex agent rules\n"}`)

	want := filepath.Join(root, "AGENTS.md")
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("AGENTS.md missing at %s: %v", want, err)
	}
}

func TestCodexProjectSubagentRoundTrip(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/codex/subagents?scope=project&project_id="+projectID,
		`{"name":"reviewer","content":"role = \"reviewer\"\n"}`)

	want := filepath.Join(root, ".codex", "agents", "reviewer.toml")
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("subagent file missing at %s: %v", want, err)
	}
	deleteProviderFile(t, router,
		"/api/v1/agents/codex/subagents/reviewer?scope=project&project_id="+projectID)
	if _, err := os.Stat(want); !os.IsNotExist(err) {
		t.Errorf("subagent still present after delete: %v", err)
	}
}

func TestCodexProjectRuleRoundTrip(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/codex/rules?scope=project&project_id="+projectID,
		`{"name":"never-mock","content":"Don't mock."}`)

	want := filepath.Join(root, ".codex", "rules", "never-mock.rules")
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("rule file missing at %s: %v", want, err)
	}
	deleteProviderFile(t, router,
		"/api/v1/agents/codex/rules/never-mock?scope=project&project_id="+projectID)
}

func TestCodexProjectSkillCreatesAndDeletes(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/codex/skills?scope=project&project_id="+projectID,
		`{"name":"refactor","content":"Refactor steps..."}`)

	dir := filepath.Join(root, ".agents", "skills")
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) == 0 {
		t.Fatalf("expected skill files under %s; readdir err=%v entries=%v", dir, err, entries)
	}
	deleteProviderFile(t, router,
		"/api/v1/agents/codex/skills/refactor?scope=project&project_id="+projectID)
}

// --- Gemini -------------------------------------------------------------

func TestGeminiProjectSettingsWriteUnderDotGemini(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/gemini/settings?scope=project&project_id="+projectID,
		`{"content":"{\"theme\":\"dark\"}\n"}`)

	want := filepath.Join(root, ".gemini", "settings.json")
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("settings.json missing at %s: %v", want, err)
	}
}

func TestGeminiProjectContextWritesGEMINImd(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/gemini/context?scope=project&project_id="+projectID,
		`{"content":"# Gemini context\n"}`)

	want := filepath.Join(root, "GEMINI.md")
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("GEMINI.md missing at %s: %v", want, err)
	}
}

func TestGeminiProjectCommandRoundTrip(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/gemini/commands?scope=project&project_id="+projectID,
		`{"name":"deploy","content":"steps = []\n"}`)

	dir := filepath.Join(root, ".gemini", "commands")
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) == 0 {
		t.Fatalf("expected command files under %s; err=%v entries=%v", dir, err, entries)
	}
	deleteProviderFile(t, router,
		"/api/v1/agents/gemini/commands/deploy?scope=project&project_id="+projectID)
}

// --- OpenCode -----------------------------------------------------------

func TestOpenCodeProjectConfigWritesOpencodeJSON(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/opencode/config?scope=project&project_id="+projectID,
		`{"content":"{\"theme\":\"dark\"}\n"}`)

	want := filepath.Join(root, ".opencode", "opencode.json")
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("opencode.json missing at %s: %v", want, err)
	}
}

func TestOpenCodeProjectAgentRoundTrip(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/opencode/agents?scope=project&project_id="+projectID,
		`{"name":"reviewer","content":"# Reviewer\n"}`)

	dir := filepath.Join(root, ".opencode", "agents")
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) == 0 {
		t.Fatalf("expected agent files under %s; err=%v entries=%v", dir, err, entries)
	}
	deleteProviderFile(t, router,
		"/api/v1/agents/opencode/agents/reviewer?scope=project&project_id="+projectID)
}

func TestOpenCodeProjectCommandRoundTrip(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/opencode/commands?scope=project&project_id="+projectID,
		`{"name":"deploy","content":"# Deploy\n"}`)

	dir := filepath.Join(root, ".opencode", "commands")
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) == 0 {
		t.Fatalf("expected command files under %s; err=%v entries=%v", dir, err, entries)
	}
	deleteProviderFile(t, router,
		"/api/v1/agents/opencode/commands/deploy?scope=project&project_id="+projectID)
}

func TestOpenCodeProjectSkillRoundTrip(t *testing.T) {
	router, projectID, root := seedProject(t)
	postProviderFile(t, router,
		"/api/v1/agents/opencode/skills?scope=project&project_id="+projectID,
		`{"name":"refactor","content":"steps"}`)

	// Skill layout matches the claude/codex pattern — assert that some
	// content was created under one of the expected skill roots, without
	// pinning the exact filename so a future packaging change doesn't
	// invalidate the test.
	candidates := []string{
		filepath.Join(root, ".opencode", "skills"),
		filepath.Join(root, ".agents", "skills"),
	}
	found := false
	for _, c := range candidates {
		if entries, err := os.ReadDir(c); err == nil && len(entries) > 0 {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected opencode skill content under one of %v", candidates)
	}
	deleteProviderFile(t, router,
		"/api/v1/agents/opencode/skills/refactor?scope=project&project_id="+projectID)
}

// --- Missing project_id guard ------------------------------------------

func TestOtherProvidersProjectScopeRequireProjectID(t *testing.T) {
	router, _ := newTestRouterWithDB(t)

	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/agents/codex/config?scope=project"},
		{http.MethodGet, "/api/v1/agents/codex/instructions?scope=project"},
		{http.MethodGet, "/api/v1/agents/codex/subagents?scope=project"},
		{http.MethodGet, "/api/v1/agents/codex/rules?scope=project"},
		{http.MethodGet, "/api/v1/agents/codex/skills?scope=project"},
		{http.MethodGet, "/api/v1/agents/gemini/settings?scope=project"},
		{http.MethodGet, "/api/v1/agents/gemini/context?scope=project"},
		{http.MethodGet, "/api/v1/agents/gemini/commands?scope=project"},
		{http.MethodGet, "/api/v1/agents/opencode/config?scope=project"},
		{http.MethodGet, "/api/v1/agents/opencode/agents?scope=project"},
		{http.MethodGet, "/api/v1/agents/opencode/commands?scope=project"},
		{http.MethodGet, "/api/v1/agents/opencode/skills?scope=project"},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}
