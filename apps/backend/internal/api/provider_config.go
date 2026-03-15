package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
)

/* ================================================================== */
/*  Shared types                                                       */
/* ================================================================== */

// ProviderPermissions is the normalized permission config returned to the frontend.
type ProviderPermissions struct {
	ApprovalMode string   `json:"approval_mode"`
	Allow        []string `json:"allow"`
	Deny         []string `json:"deny"`
	Sandbox      string   `json:"sandbox,omitempty"`
}

// ProviderModelConfig is the normalized model config returned to the frontend.
type ProviderModelConfig struct {
	Model       string   `json:"model"`
	Effort      string   `json:"effort"`
	Temperature *float64 `json:"temperature"`
}

// ProviderHook is a single hook entry.
type ProviderHook struct {
	Event   string `json:"event"`
	Command string `json:"command"`
	Matcher string `json:"matcher,omitempty"`
}

/* ================================================================== */
/*  Permissions handlers                                               */
/* ================================================================== */

func (s *Server) GetProviderPermissions(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var perms ProviderPermissions

	switch provider {
	case "claude":
		perms = readClaudePermissions(homeDir)
	case "codex":
		perms = readCodexPermissions(homeDir)
	case "gemini":
		perms = readGeminiPermissions(homeDir)
	case "opencode":
		perms = readOpenCodePermissions(homeDir)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(perms)
}

func (s *Server) PostProviderPermissions(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var perms ProviderPermissions
	if err := json.NewDecoder(r.Body).Decode(&perms); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	switch provider {
	case "claude":
		err = writeClaudePermissions(homeDir, perms)
	case "codex":
		err = writeCodexPermissions(homeDir, perms)
	case "gemini":
		err = writeGeminiPermissions(homeDir, perms)
	case "opencode":
		err = writeOpenCodePermissions(homeDir, perms)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	if err != nil {
		s.logger.Error().Err(err).Str("provider", provider).Msg("failed to write permissions")
		writeJSONError(w, http.StatusInternalServerError, "write_failed", fmt.Sprintf("failed to write config: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

/* ================================================================== */
/*  Model handlers                                                     */
/* ================================================================== */

func (s *Server) GetProviderModel(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var model ProviderModelConfig

	switch provider {
	case "claude":
		model = readClaudeModel(homeDir)
	case "codex":
		model = readCodexModel(homeDir)
	case "gemini":
		model = readGeminiModel(homeDir)
	case "opencode":
		model = readOpenCodeModel(homeDir)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(model)
}

func (s *Server) PostProviderModel(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var model ProviderModelConfig
	if err := json.NewDecoder(r.Body).Decode(&model); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	switch provider {
	case "claude":
		err = writeClaudeModel(homeDir, model)
	case "codex":
		err = writeCodexModel(homeDir, model)
	case "gemini":
		err = writeGeminiModel(homeDir, model)
	case "opencode":
		err = writeOpenCodeModel(homeDir, model)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	if err != nil {
		s.logger.Error().Err(err).Str("provider", provider).Msg("failed to write model config")
		writeJSONError(w, http.StatusInternalServerError, "write_failed", fmt.Sprintf("failed to write config: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

/* ================================================================== */
/*  Hooks handlers                                                     */
/* ================================================================== */

func (s *Server) GetProviderHooks(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var hooks []ProviderHook

	switch provider {
	case "claude":
		hooks = readClaudeHooks(homeDir)
	case "codex":
		hooks = readCodexHooks(homeDir)
	case "gemini":
		hooks = readGeminiHooks(homeDir)
	case "opencode":
		hooks = []ProviderHook{} // plugin-based, no hooks
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	if hooks == nil {
		hooks = []ProviderHook{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hooks)
}

func (s *Server) PostProviderHooks(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var hooks []ProviderHook
	if err := json.NewDecoder(r.Body).Decode(&hooks); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	switch provider {
	case "claude":
		err = writeClaudeHooks(homeDir, hooks)
	case "codex":
		err = writeCodexHooks(homeDir, hooks)
	case "gemini":
		err = writeGeminiHooks(homeDir, hooks)
	case "opencode":
		// No-op for opencode (plugin-based)
		err = nil
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	if err != nil {
		s.logger.Error().Err(err).Str("provider", provider).Msg("failed to write hooks")
		writeJSONError(w, http.StatusInternalServerError, "write_failed", fmt.Sprintf("failed to write config: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

/* ================================================================== */
/*  Claude: ~/.claude/settings.json                                    */
/* ================================================================== */

func claudeSettingsPath(home string) string {
	return filepath.Join(home, ".claude", "settings.json")
}

func readClaudeSettings(home string) (map[string]any, error) {
	data, err := os.ReadFile(claudeSettingsPath(home))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]any{}, nil
		}
		return nil, err
	}
	var cfg map[string]any
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func writeClaudeSettings(home string, cfg map[string]any) error {
	if err := os.MkdirAll(filepath.Dir(claudeSettingsPath(home)), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(claudeSettingsPath(home), data, 0644)
}

// Permissions: settings.json → permissions { allow: [], deny: [] }
func readClaudePermissions(home string) ProviderPermissions {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return ProviderPermissions{ApprovalMode: "interactive", Allow: []string{}, Deny: []string{}}
	}
	perms, _ := cfg["permissions"].(map[string]any)
	allow := toStringSlice(perms["allow"])
	deny := toStringSlice(perms["deny"])

	mode := "interactive"
	if m, ok := cfg["approvalMode"].(string); ok {
		mode = m
	}

	return ProviderPermissions{ApprovalMode: mode, Allow: allow, Deny: deny}
}

func writeClaudePermissions(home string, perms ProviderPermissions) error {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return err
	}
	permObj := map[string]any{
		"allow": perms.Allow,
		"deny":  perms.Deny,
	}
	cfg["permissions"] = permObj
	if perms.ApprovalMode != "" {
		cfg["approvalMode"] = perms.ApprovalMode
	}
	return writeClaudeSettings(home, cfg)
}

// Model: settings.json → model, effortLevel, temperatureOverride
func readClaudeModel(home string) ProviderModelConfig {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return ProviderModelConfig{}
	}
	model, _ := cfg["model"].(string)
	effort, _ := cfg["effortLevel"].(string)
	var temp *float64
	if t, ok := cfg["temperatureOverride"].(float64); ok {
		temp = &t
	}
	return ProviderModelConfig{Model: model, Effort: effort, Temperature: temp}
}

func writeClaudeModel(home string, model ProviderModelConfig) error {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return err
	}
	if model.Model != "" {
		cfg["model"] = model.Model
	} else {
		delete(cfg, "model")
	}
	if model.Effort != "" {
		cfg["effortLevel"] = model.Effort
	} else {
		delete(cfg, "effortLevel")
	}
	if model.Temperature != nil {
		cfg["temperatureOverride"] = *model.Temperature
	} else {
		delete(cfg, "temperatureOverride")
	}
	return writeClaudeSettings(home, cfg)
}

// Hooks: settings.json → hooks { <event>: [ { command: ..., matcher: ... } ] }
func readClaudeHooks(home string) []ProviderHook {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return nil
	}
	hooksObj, ok := cfg["hooks"].(map[string]any)
	if !ok {
		return nil
	}
	var hooks []ProviderHook
	for event, val := range hooksObj {
		entries, ok := val.([]any)
		if !ok {
			continue
		}
		for _, e := range entries {
			entry, ok := e.(map[string]any)
			if !ok {
				continue
			}
			cmd, _ := entry["command"].(string)
			matcher, _ := entry["matcher"].(string)
			hooks = append(hooks, ProviderHook{Event: event, Command: cmd, Matcher: matcher})
		}
	}
	return hooks
}

func writeClaudeHooks(home string, hooks []ProviderHook) error {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return err
	}
	hooksObj := map[string]any{}
	for _, h := range hooks {
		entry := map[string]any{"command": h.Command}
		if h.Matcher != "" {
			entry["matcher"] = h.Matcher
		}
		arr, _ := hooksObj[h.Event].([]any)
		arr = append(arr, entry)
		hooksObj[h.Event] = arr
	}
	cfg["hooks"] = hooksObj
	return writeClaudeSettings(home, cfg)
}

/* ================================================================== */
/*  Codex: ~/.codex/config.toml                                        */
/* ================================================================== */

// Permissions: config.toml → approval_policy, sandbox_policy
func readCodexPermissions(home string) ProviderPermissions {
	data, err := os.ReadFile(codexConfigPath(home))
	if err != nil {
		return ProviderPermissions{ApprovalMode: "suggest", Allow: []string{}, Deny: []string{}}
	}
	content := string(data)

	mode := extractTOMLString(content, "approval_policy")
	if mode == "" {
		mode = "suggest"
	}
	sandbox := extractTOMLString(content, "sandbox_policy")

	return ProviderPermissions{ApprovalMode: mode, Allow: []string{}, Deny: []string{}, Sandbox: sandbox}
}

func writeCodexPermissions(home string, perms ProviderPermissions) error {
	path := codexConfigPath(home)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	content := string(data)
	content = setTOMLString(content, "approval_policy", perms.ApprovalMode)
	if perms.Sandbox != "" {
		content = setTOMLString(content, "sandbox_policy", perms.Sandbox)
	}
	return os.WriteFile(path, []byte(content), 0644)
}

// Model: config.toml → model, model_reasoning_effort
func readCodexModel(home string) ProviderModelConfig {
	data, err := os.ReadFile(codexConfigPath(home))
	if err != nil {
		return ProviderModelConfig{}
	}
	content := string(data)
	model := extractTOMLString(content, "model")
	effort := extractTOMLString(content, "model_reasoning_effort")
	return ProviderModelConfig{Model: model, Effort: effort}
}

func writeCodexModel(home string, model ProviderModelConfig) error {
	path := codexConfigPath(home)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	content := string(data)
	if model.Model != "" {
		content = setTOMLString(content, "model", model.Model)
	}
	if model.Effort != "" {
		content = setTOMLString(content, "model_reasoning_effort", model.Effort)
	}
	return os.WriteFile(path, []byte(content), 0644)
}

// Hooks: config.toml → notify (simple boolean/string)
func readCodexHooks(home string) []ProviderHook {
	data, err := os.ReadFile(codexConfigPath(home))
	if err != nil {
		return nil
	}
	content := string(data)
	notify := extractTOMLString(content, "notify")
	if notify == "" {
		return nil
	}
	return []ProviderHook{{Event: "notify", Command: notify}}
}

func writeCodexHooks(home string, hooks []ProviderHook) error {
	path := codexConfigPath(home)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	content := string(data)
	for _, h := range hooks {
		if h.Event == "notify" {
			content = setTOMLString(content, "notify", h.Command)
		}
	}
	return os.WriteFile(path, []byte(content), 0644)
}

/* ================================================================== */
/*  Gemini: ~/.gemini/settings.json                                    */
/* ================================================================== */

// Permissions: settings.json → tools.allowed, general.defaultApprovalMode
func readGeminiPermissions(home string) ProviderPermissions {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return ProviderPermissions{ApprovalMode: "interactive", Allow: []string{}, Deny: []string{}}
	}

	mode := "interactive"
	if general, ok := cfg["general"].(map[string]any); ok {
		if m, ok := general["defaultApprovalMode"].(string); ok {
			mode = m
		}
	}

	var allow []string
	if tools, ok := cfg["tools"].(map[string]any); ok {
		allow = toStringSlice(tools["allowed"])
	}

	return ProviderPermissions{ApprovalMode: mode, Allow: allow, Deny: []string{}}
}

func writeGeminiPermissions(home string, perms ProviderPermissions) error {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return err
	}

	general, _ := cfg["general"].(map[string]any)
	if general == nil {
		general = map[string]any{}
	}
	general["defaultApprovalMode"] = perms.ApprovalMode
	cfg["general"] = general

	tools, _ := cfg["tools"].(map[string]any)
	if tools == nil {
		tools = map[string]any{}
	}
	tools["allowed"] = perms.Allow
	cfg["tools"] = tools

	return writeGeminiConfig(home, cfg)
}

// Model: settings.json → model.name, model.inlineThinkingMode
func readGeminiModel(home string) ProviderModelConfig {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return ProviderModelConfig{}
	}
	modelObj, _ := cfg["model"].(map[string]any)
	if modelObj == nil {
		return ProviderModelConfig{}
	}
	name, _ := modelObj["name"].(string)
	thinking, _ := modelObj["inlineThinkingMode"].(string)
	return ProviderModelConfig{Model: name, Effort: thinking}
}

func writeGeminiModel(home string, model ProviderModelConfig) error {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return err
	}
	modelObj, _ := cfg["model"].(map[string]any)
	if modelObj == nil {
		modelObj = map[string]any{}
	}
	if model.Model != "" {
		modelObj["name"] = model.Model
	} else {
		delete(modelObj, "name")
	}
	if model.Effort != "" {
		modelObj["inlineThinkingMode"] = model.Effort
	} else {
		delete(modelObj, "inlineThinkingMode")
	}
	cfg["model"] = modelObj
	return writeGeminiConfig(home, cfg)
}

// Hooks: settings.json → hooksConfig { <event>: [ { command: ... } ] }
func readGeminiHooks(home string) []ProviderHook {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return nil
	}
	hooksObj, ok := cfg["hooksConfig"].(map[string]any)
	if !ok {
		return nil
	}
	var hooks []ProviderHook
	for event, val := range hooksObj {
		entries, ok := val.([]any)
		if !ok {
			continue
		}
		for _, e := range entries {
			entry, ok := e.(map[string]any)
			if !ok {
				continue
			}
			cmd, _ := entry["command"].(string)
			hooks = append(hooks, ProviderHook{Event: event, Command: cmd})
		}
	}
	return hooks
}

func writeGeminiHooks(home string, hooks []ProviderHook) error {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return err
	}
	hooksObj := map[string]any{}
	for _, h := range hooks {
		entry := map[string]any{"command": h.Command}
		arr, _ := hooksObj[h.Event].([]any)
		arr = append(arr, entry)
		hooksObj[h.Event] = arr
	}
	cfg["hooksConfig"] = hooksObj
	return writeGeminiConfig(home, cfg)
}

/* ================================================================== */
/*  OpenCode: ~/.config/opencode/opencode.json                         */
/* ================================================================== */

// Permissions: opencode.json → permission { ... }
func readOpenCodePermissions(home string) ProviderPermissions {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return ProviderPermissions{ApprovalMode: "interactive", Allow: []string{}, Deny: []string{}}
	}
	permObj, _ := cfg["permission"].(map[string]any)
	if permObj == nil {
		return ProviderPermissions{ApprovalMode: "interactive", Allow: []string{}, Deny: []string{}}
	}
	mode, _ := permObj["mode"].(string)
	if mode == "" {
		mode = "interactive"
	}
	allow := toStringSlice(permObj["allow"])
	deny := toStringSlice(permObj["deny"])
	return ProviderPermissions{ApprovalMode: mode, Allow: allow, Deny: deny}
}

func writeOpenCodePermissions(home string, perms ProviderPermissions) error {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return err
	}
	cfg["permission"] = map[string]any{
		"mode":  perms.ApprovalMode,
		"allow": perms.Allow,
		"deny":  perms.Deny,
	}
	return writeOpenCodeConfig(home, cfg)
}

// Model: opencode.json → model, small_model
func readOpenCodeModel(home string) ProviderModelConfig {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return ProviderModelConfig{}
	}
	model, _ := cfg["model"].(string)
	// small_model stored in effort for simplicity
	smallModel, _ := cfg["small_model"].(string)
	return ProviderModelConfig{Model: model, Effort: smallModel}
}

func writeOpenCodeModel(home string, model ProviderModelConfig) error {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return err
	}
	if model.Model != "" {
		cfg["model"] = model.Model
	} else {
		delete(cfg, "model")
	}
	if model.Effort != "" {
		cfg["small_model"] = model.Effort
	} else {
		delete(cfg, "small_model")
	}
	return writeOpenCodeConfig(home, cfg)
}

/* ================================================================== */
/*  TOML helpers (simple key = "value" at top level)                   */
/* ================================================================== */

func extractTOMLString(content, key string) string {
	re := regexp.MustCompile(`(?m)^\s*` + regexp.QuoteMeta(key) + `\s*=\s*"([^"]*)"`)
	match := re.FindStringSubmatch(content)
	if len(match) >= 2 {
		return match[1]
	}
	return ""
}

func setTOMLString(content, key, value string) string {
	re := regexp.MustCompile(`(?m)^\s*` + regexp.QuoteMeta(key) + `\s*=\s*"[^"]*"`)
	replacement := fmt.Sprintf(`%s = "%s"`, key, value)
	if re.MatchString(content) {
		return re.ReplaceAllString(content, replacement)
	}
	// Insert before any [section] header, or at end
	content = strings.TrimRight(content, "\n") + "\n" + replacement + "\n"
	return content
}

/* ================================================================== */
/*  Generic helpers                                                    */
/* ================================================================== */

func toStringSlice(v any) []string {
	if v == nil {
		return []string{}
	}
	arr, ok := v.([]any)
	if !ok {
		return []string{}
	}
	result := make([]string, 0, len(arr))
	for _, item := range arr {
		if s, ok := item.(string); ok {
			result = append(result, s)
		}
	}
	return result
}
