package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Tier 2 contract tests for /api/v1/config/runtimes, /config/tailscale,
// /config/kubernetes — newly shipped runtime-target wiring with zero
// direct test coverage. Round-trips through the on-disk
// runtime-targets.json so persistence is exercised end-to-end.

func TestGetAvailableRuntimesDefaults(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/config/runtimes", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Runtimes []struct {
			Target     string `json:"target"`
			Configured bool   `json:"configured"`
		} `json:"runtimes"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode: %v\nbody=%s", err, rec.Body.String())
	}

	want := map[string]bool{"LOCAL": true, "TAILSCALE": false, "KUBERNETES": false}
	if len(payload.Runtimes) != len(want) {
		t.Fatalf("expected %d runtimes, got %d", len(want), len(payload.Runtimes))
	}
	for _, rt := range payload.Runtimes {
		w, ok := want[rt.Target]
		if !ok {
			t.Errorf("unexpected runtime target %q", rt.Target)
			continue
		}
		if rt.Configured != w {
			t.Errorf("%s configured: got %v, want %v", rt.Target, rt.Configured, w)
		}
	}
}

func TestGetTailscaleConfigDefaultsBeforeSave(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/config/tailscale", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var ts tailscaleConfig
	if err := json.Unmarshal(rec.Body.Bytes(), &ts); err != nil {
		t.Fatalf("decode: %v\nbody=%s", err, rec.Body.String())
	}
	if ts.SSHUser != "root" {
		t.Errorf("default ssh_user: got %q, want %q", ts.SSHUser, "root")
	}
	if ts.SSHPort != 22 {
		t.Errorf("default ssh_port: got %d, want 22", ts.SSHPort)
	}
	if ts.WorktreeRoot == "" {
		t.Error("default worktree_root should be non-empty")
	}
	if ts.Configured {
		t.Error("Configured should be false before any save")
	}
}

func TestSaveTailscaleConfigPersistsAndMarksConfigured(t *testing.T) {
	router, _ := newTestRouterWithDB(t)

	saveBody := `{"ssh_host":"host.example","ssh_user":"orchestra","ssh_port":2222,"worktree_root":"/tmp/wt"}`
	saveReq := httptest.NewRequest(http.MethodPost, "/api/v1/config/tailscale", strings.NewReader(saveBody))
	saveReq.Header.Set("Content-Type", "application/json")
	saveRec := httptest.NewRecorder()
	router.ServeHTTP(saveRec, saveReq)

	if saveRec.Code != http.StatusOK {
		t.Fatalf("save got %d, want 200; body=%s", saveRec.Code, saveRec.Body.String())
	}
	var saved tailscaleConfig
	if err := json.Unmarshal(saveRec.Body.Bytes(), &saved); err != nil {
		t.Fatalf("decode save response: %v", err)
	}
	if !saved.Configured {
		t.Error("Configured must be true on save response")
	}
	if saved.SSHHost != "host.example" {
		t.Errorf("ssh_host: got %q", saved.SSHHost)
	}
	if saved.SSHPort != 2222 {
		t.Errorf("ssh_port: got %d", saved.SSHPort)
	}

	// Round-trip via GET to confirm persistence (file under workspace_root/.orchestra).
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/config/tailscale", nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	var fetched tailscaleConfig
	if err := json.Unmarshal(getRec.Body.Bytes(), &fetched); err != nil {
		t.Fatalf("decode fetched: %v", err)
	}
	if fetched.SSHHost != "host.example" || fetched.SSHPort != 2222 || !fetched.Configured {
		t.Fatalf("persisted config didn't round-trip: %+v", fetched)
	}

	// /runtimes should now report TAILSCALE as configured.
	rtReq := httptest.NewRequest(http.MethodGet, "/api/v1/config/runtimes", nil)
	rtRec := httptest.NewRecorder()
	router.ServeHTTP(rtRec, rtReq)
	if !strings.Contains(rtRec.Body.String(), `"target":"TAILSCALE","configured":true`) {
		t.Fatalf("expected TAILSCALE configured=true in /runtimes; body=%s", rtRec.Body.String())
	}
}

func TestSaveTailscaleConfigRejectsInvalidJSON(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/config/tailscale", strings.NewReader(`{not json}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

func TestDeleteTailscaleConfigClearsState(t *testing.T) {
	router, _ := newTestRouterWithDB(t)

	saveReq := httptest.NewRequest(http.MethodPost, "/api/v1/config/tailscale", strings.NewReader(`{"ssh_host":"x"}`))
	saveReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), saveReq)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/config/tailscale", nil)
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete got %d, want 204; body=%s", delRec.Code, delRec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/config/tailscale", nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	var ts tailscaleConfig
	_ = json.Unmarshal(getRec.Body.Bytes(), &ts)
	if ts.Configured || ts.SSHHost != "" {
		t.Fatalf("expected zeroed tailscale config after delete, got %+v", ts)
	}
}

func TestTestTailscaleConfigUnreachableWhenHostUnset(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/config/tailscale/test", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Reachable bool   `json:"reachable"`
		Error     string `json:"error"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &payload)
	if payload.Reachable {
		t.Error("reachable must be false when ssh_host is unset")
	}
	if !strings.Contains(payload.Error, "ssh_host") {
		t.Errorf("error should mention ssh_host; got %q", payload.Error)
	}
}

func TestGetKubernetesConfigDefaultsBeforeSave(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/config/kubernetes", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d", rec.Code)
	}
	var k8s kubernetesConfig
	_ = json.Unmarshal(rec.Body.Bytes(), &k8s)
	if k8s.Namespace == "" {
		t.Error("default namespace should be set")
	}
	if k8s.Image == "" {
		t.Error("default image should be set")
	}
	if k8s.Configured {
		t.Error("Configured should be false before any save")
	}
}

func TestSaveKubernetesConfigPersistsAndMarksConfigured(t *testing.T) {
	router, _ := newTestRouterWithDB(t)

	saveBody := `{"kubeconfig_path":"/tmp/kubeconfig","namespace":"agents","image":"orchestra/runner:1"}`
	saveReq := httptest.NewRequest(http.MethodPost, "/api/v1/config/kubernetes", strings.NewReader(saveBody))
	saveReq.Header.Set("Content-Type", "application/json")
	saveRec := httptest.NewRecorder()
	router.ServeHTTP(saveRec, saveReq)

	if saveRec.Code != http.StatusOK {
		t.Fatalf("save got %d, want 200; body=%s", saveRec.Code, saveRec.Body.String())
	}
	var saved kubernetesConfig
	_ = json.Unmarshal(saveRec.Body.Bytes(), &saved)
	if !saved.Configured || saved.KubeconfigPath != "/tmp/kubeconfig" {
		t.Fatalf("save didn't persist correctly: %+v", saved)
	}

	rtReq := httptest.NewRequest(http.MethodGet, "/api/v1/config/runtimes", nil)
	rtRec := httptest.NewRecorder()
	router.ServeHTTP(rtRec, rtReq)
	if !strings.Contains(rtRec.Body.String(), `"target":"KUBERNETES","configured":true`) {
		t.Fatalf("expected KUBERNETES configured=true in /runtimes; body=%s", rtRec.Body.String())
	}
}

func TestDeleteKubernetesConfigClearsState(t *testing.T) {
	router, _ := newTestRouterWithDB(t)

	saveReq := httptest.NewRequest(http.MethodPost, "/api/v1/config/kubernetes", strings.NewReader(`{"kubeconfig_path":"/tmp/kc"}`))
	saveReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), saveReq)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/config/kubernetes", nil)
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete got %d, want 204; body=%s", delRec.Code, delRec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/config/kubernetes", nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	var k8s kubernetesConfig
	_ = json.Unmarshal(getRec.Body.Bytes(), &k8s)
	if k8s.Configured || k8s.KubeconfigPath != "" {
		t.Fatalf("expected zeroed kubernetes config after delete, got %+v", k8s)
	}
}

func TestTestKubernetesConfigUnreachableWhenKubeconfigUnset(t *testing.T) {
	router, _ := newTestRouterWithDB(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/config/kubernetes/test", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d", rec.Code)
	}
	var payload struct {
		Reachable bool   `json:"reachable"`
		Error     string `json:"error"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &payload)
	if payload.Reachable {
		t.Error("reachable must be false when kubeconfig_path is unset")
	}
	if !strings.Contains(payload.Error, "kubeconfig_path") {
		t.Errorf("error should mention kubeconfig_path; got %q", payload.Error)
	}
}
