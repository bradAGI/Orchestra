package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	toml "github.com/pelletier/go-toml/v2"
)

/* ================================================================== */
/*  Shared types                                                       */
/* ================================================================== */

// ProviderPermissions is the normalized permission config returned to the frontend.
type ProviderPermissions struct {
	ApprovalMode   string   `json:"approval_mode"`
	Allow          []string `json:"allow"`
	Deny           []string `json:"deny"`
	Ask            []string `json:"ask"`
	AllowedTools   []string `json:"allowed_tools,omitempty"`
	EnabledPlugins []string `json:"enabled_plugins,omitempty"`
	Sandbox        string   `json:"sandbox,omitempty"`
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
	Matcher string `json:"matcher,omitempty"`
	Type    string `json:"type"`
	Command string `json:"command"`
	Timeout int    `json:"timeout,omitempty"`
}

/* ================================================================== */
/*  Permissions handlers                                               */
/* ================================================================== */

func (s *Server) GetProviderPermissions(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
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

	// Enrich Claude permissions with project-scoped allowedTools and enabledPlugins
	if provider == "claude" {
		// Read enabledPlugins from settings.json
		settingsCfg, settingsErr := readClaudeSettings(homeDir)
		if settingsErr == nil {
			if plugins, ok := settingsCfg["enabledPlugins"].(map[string]any); ok {
				for name, enabled := range plugins {
					if enabled == true {
						perms.EnabledPlugins = append(perms.EnabledPlugins, name)
					}
				}
			}
		}

		// Read per-project allowedTools from ~/.claude.json
		projectID := r.URL.Query().Get("project_id")
		if projectID != "" && s.db != nil {
			project, dbErr := s.db.GetProjectByID(r.Context(), projectID)
			if dbErr == nil && project.RootPath != "" {
				claudeJsonData, readErr := os.ReadFile(filepath.Join(homeDir, ".claude.json"))
				if readErr == nil {
					var claudeJson map[string]any
					if json.Unmarshal(claudeJsonData, &claudeJson) == nil {
						if projects, ok := claudeJson["projects"].(map[string]any); ok {
							if projCfg, ok := projects[project.RootPath].(map[string]any); ok {
								perms.AllowedTools = toStringSlice(projCfg["allowedTools"])
							}
						}
					}
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, perms)
}

func (s *Server) PostProviderPermissions(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
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

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

/* ================================================================== */
/*  Model handlers                                                     */
/* ================================================================== */

func (s *Server) GetProviderModel(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
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

	writeJSON(w, http.StatusOK, model)
}

func (s *Server) PostProviderModel(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
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

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

/* ================================================================== */
/*  Hooks handlers                                                     */
/* ================================================================== */

func (s *Server) GetProviderHooks(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
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

	writeJSON(w, http.StatusOK, hooks)
}

func (s *Server) PostProviderHooks(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
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

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
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

// Permissions: settings.json → permissions { allow: [], deny: [], ask: [] }, permissionMode
func readClaudePermissions(home string) ProviderPermissions {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return ProviderPermissions{ApprovalMode: "default", Allow: []string{}, Deny: []string{}, Ask: []string{}}
	}
	perms, _ := cfg["permissions"].(map[string]any)
	allow := toStringSlice(perms["allow"])
	deny := toStringSlice(perms["deny"])
	ask := toStringSlice(perms["ask"])

	mode := "default"
	if m, ok := cfg["permissionMode"].(string); ok {
		mode = m
	}

	return ProviderPermissions{ApprovalMode: mode, Allow: allow, Deny: deny, Ask: ask}
}

func writeClaudePermissions(home string, perms ProviderPermissions) error {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return err
	}
	permObj := map[string]any{
		"allow": perms.Allow,
		"deny":  perms.Deny,
		"ask":   perms.Ask,
	}
	cfg["permissions"] = permObj
	if perms.ApprovalMode != "" {
		cfg["permissionMode"] = perms.ApprovalMode
	}
	// Clean up old field name if present
	delete(cfg, "approvalMode")
	return writeClaudeSettings(home, cfg)
}

// Model: settings.json → model (effortLevel and temperatureOverride are read if present but not written if empty)
func readClaudeModel(home string) ProviderModelConfig {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return ProviderModelConfig{}
	}
	model, _ := cfg["model"].(string)
	return ProviderModelConfig{Model: model}
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
	return writeClaudeSettings(home, cfg)
}

// Hooks: settings.json → hooks { <event>: [ { matcher: "...", hooks: [ { type, command, timeout } ] } ] }
// The real Claude hooks format nests hooks inside matcher groups.
// We flatten into our ProviderHook array on read, and rebuild the nested structure on write.
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
		matcherGroups, ok := val.([]any)
		if !ok {
			continue
		}
		for _, mg := range matcherGroups {
			group, ok := mg.(map[string]any)
			if !ok {
				continue
			}
			matcher, _ := group["matcher"].(string)
			innerHooks, ok := group["hooks"].([]any)
			if !ok {
				continue
			}
			for _, ih := range innerHooks {
				hookEntry, ok := ih.(map[string]any)
				if !ok {
					continue
				}
				cmd, _ := hookEntry["command"].(string)
				typ, _ := hookEntry["type"].(string)
				timeout := 0
				if t, ok := hookEntry["timeout"].(float64); ok {
					timeout = int(t)
				}
				hooks = append(hooks, ProviderHook{
					Event:   event,
					Matcher: matcher,
					Type:    typ,
					Command: cmd,
					Timeout: timeout,
				})
			}
		}
	}
	return hooks
}

func writeClaudeHooks(home string, hooks []ProviderHook) error {
	cfg, err := readClaudeSettings(home)
	if err != nil {
		return err
	}

	// Group hooks by event, then by matcher to rebuild the nested structure.
	// event → matcher → []hookEntry
	type hookEntry struct {
		Type    string
		Command string
		Timeout int
	}
	type matcherGroup struct {
		Matcher string
		Hooks   []hookEntry
	}

	eventGroups := map[string][]matcherGroup{}
	for _, h := range hooks {
		event := h.Event
		matcher := h.Matcher
		entry := hookEntry{Type: h.Type, Command: h.Command, Timeout: h.Timeout}
		if entry.Type == "" {
			entry.Type = "command"
		}

		groups := eventGroups[event]
		found := false
		for i, g := range groups {
			if g.Matcher == matcher {
				groups[i].Hooks = append(groups[i].Hooks, entry)
				found = true
				break
			}
		}
		if !found {
			groups = append(groups, matcherGroup{Matcher: matcher, Hooks: []hookEntry{entry}})
		}
		eventGroups[event] = groups
	}

	hooksObj := map[string]any{}
	for event, groups := range eventGroups {
		var arr []any
		for _, g := range groups {
			groupObj := map[string]any{}
			if g.Matcher != "" {
				groupObj["matcher"] = g.Matcher
			}
			var innerArr []any
			for _, he := range g.Hooks {
				innerObj := map[string]any{
					"type":    he.Type,
					"command": he.Command,
				}
				if he.Timeout > 0 {
					innerObj["timeout"] = he.Timeout
				}
				innerArr = append(innerArr, innerObj)
			}
			groupObj["hooks"] = innerArr
			arr = append(arr, groupObj)
		}
		hooksObj[event] = arr
	}
	cfg["hooks"] = hooksObj
	return writeClaudeSettings(home, cfg)
}

/* ================================================================== */
/*  Codex: ~/.codex/config.toml                                        */
/* ================================================================== */

func readCodexConfig(home string) (map[string]any, error) {
	data, err := os.ReadFile(codexConfigPath(home))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]any{}, nil
		}
		return nil, err
	}
	var cfg map[string]any
	if err := toml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func writeCodexConfig(home string, cfg map[string]any) error {
	path := codexConfigPath(home)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := toml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// Permissions: config.toml → approval_policy, sandbox_mode
func readCodexPermissions(home string) ProviderPermissions {
	cfg, err := readCodexConfig(home)
	if err != nil {
		return ProviderPermissions{ApprovalMode: "on-request", Allow: []string{}, Deny: []string{}, Ask: []string{}}
	}

	mode, _ := cfg["approval_policy"].(string)
	if mode == "" {
		mode = "on-request"
	}
	sandbox, _ := cfg["sandbox_mode"].(string)

	return ProviderPermissions{ApprovalMode: mode, Allow: []string{}, Deny: []string{}, Ask: []string{}, Sandbox: sandbox}
}

func writeCodexPermissions(home string, perms ProviderPermissions) error {
	cfg, err := readCodexConfig(home)
	if err != nil {
		cfg = map[string]any{}
	}
	cfg["approval_policy"] = perms.ApprovalMode
	if perms.Sandbox != "" {
		cfg["sandbox_mode"] = perms.Sandbox
	}
	return writeCodexConfig(home, cfg)
}

// Model: config.toml → model, model_reasoning_effort
func readCodexModel(home string) ProviderModelConfig {
	cfg, err := readCodexConfig(home)
	if err != nil {
		return ProviderModelConfig{}
	}
	model, _ := cfg["model"].(string)
	effort, _ := cfg["model_reasoning_effort"].(string)
	return ProviderModelConfig{Model: model, Effort: effort}
}

func writeCodexModel(home string, model ProviderModelConfig) error {
	cfg, err := readCodexConfig(home)
	if err != nil {
		cfg = map[string]any{}
	}
	if model.Model != "" {
		cfg["model"] = model.Model
	}
	if model.Effort != "" {
		cfg["model_reasoning_effort"] = model.Effort
	}
	return writeCodexConfig(home, cfg)
}

// Hooks: config.toml → notify (array of strings)
func readCodexHooks(home string) []ProviderHook {
	cfg, err := readCodexConfig(home)
	if err != nil {
		return nil
	}
	// notify is an array like ["command", "arg1", "arg2"]
	if notify, ok := cfg["notify"].([]any); ok {
		var parts []string
		for _, n := range notify {
			if s, ok := n.(string); ok {
				parts = append(parts, s)
			}
		}
		if len(parts) > 0 {
			return []ProviderHook{{Event: "notify", Command: strings.Join(parts, " ")}}
		}
	}
	// Also handle legacy string value
	if notify, ok := cfg["notify"].(string); ok && notify != "" {
		return []ProviderHook{{Event: "notify", Command: notify}}
	}
	return nil
}

func writeCodexHooks(home string, hooks []ProviderHook) error {
	cfg, err := readCodexConfig(home)
	if err != nil {
		cfg = map[string]any{}
	}
	for _, h := range hooks {
		if h.Event == "notify" {
			// Store as array of strings
			parts := strings.Fields(h.Command)
			cfg["notify"] = parts
		}
	}
	return writeCodexConfig(home, cfg)
}

/* ================================================================== */
/*  Gemini: ~/.gemini/settings.json                                    */
/* ================================================================== */

// Permissions: settings.json → tools.allowed
// Gemini manages approvals via tools.allowed and the --yolo flag, not a config setting.
func readGeminiPermissions(home string) ProviderPermissions {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return ProviderPermissions{ApprovalMode: "interactive", Allow: []string{}, Deny: []string{}, Ask: []string{}}
	}

	var allow []string
	if tools, ok := cfg["tools"].(map[string]any); ok {
		allow = toStringSlice(tools["allowed"])
	}

	return ProviderPermissions{ApprovalMode: "interactive", Allow: allow, Deny: []string{}, Ask: []string{}}
}

func writeGeminiPermissions(home string, perms ProviderPermissions) error {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return err
	}

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

// Hooks: settings.json → hooks { <event>: [ { matcher: "...", hooks: [ { type, command, timeout } ] } ] }
// Gemini hooks use the same nested matcher-group structure as Claude.
func readGeminiHooks(home string) []ProviderHook {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return nil
	}
	hooksObj, ok := cfg["hooks"].(map[string]any)
	if !ok {
		return nil
	}
	var hooks []ProviderHook
	for event, val := range hooksObj {
		matcherGroups, ok := val.([]any)
		if !ok {
			continue
		}
		for _, mg := range matcherGroups {
			group, ok := mg.(map[string]any)
			if !ok {
				continue
			}
			matcher, _ := group["matcher"].(string)
			innerHooks, ok := group["hooks"].([]any)
			if !ok {
				continue
			}
			for _, ih := range innerHooks {
				hookEntry, ok := ih.(map[string]any)
				if !ok {
					continue
				}
				cmd, _ := hookEntry["command"].(string)
				typ, _ := hookEntry["type"].(string)
				timeout := 0
				if t, ok := hookEntry["timeout"].(float64); ok {
					timeout = int(t)
				}
				hooks = append(hooks, ProviderHook{
					Event:   event,
					Matcher: matcher,
					Type:    typ,
					Command: cmd,
					Timeout: timeout,
				})
			}
		}
	}
	return hooks
}

func writeGeminiHooks(home string, hooks []ProviderHook) error {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return err
	}

	// Group hooks by event, then by matcher to rebuild the nested structure.
	type hookEntry struct {
		Type    string
		Command string
		Timeout int
	}
	type matcherGroup struct {
		Matcher string
		Hooks   []hookEntry
	}

	eventGroups := map[string][]matcherGroup{}
	for _, h := range hooks {
		event := h.Event
		matcher := h.Matcher
		entry := hookEntry{Type: h.Type, Command: h.Command, Timeout: h.Timeout}
		if entry.Type == "" {
			entry.Type = "command"
		}

		groups := eventGroups[event]
		found := false
		for i, g := range groups {
			if g.Matcher == matcher {
				groups[i].Hooks = append(groups[i].Hooks, entry)
				found = true
				break
			}
		}
		if !found {
			groups = append(groups, matcherGroup{Matcher: matcher, Hooks: []hookEntry{entry}})
		}
		eventGroups[event] = groups
	}

	hooksObj := map[string]any{}
	for event, groups := range eventGroups {
		var arr []any
		for _, g := range groups {
			groupObj := map[string]any{}
			if g.Matcher != "" {
				groupObj["matcher"] = g.Matcher
			}
			var innerArr []any
			for _, he := range g.Hooks {
				innerObj := map[string]any{
					"type":    he.Type,
					"command": he.Command,
				}
				if he.Timeout > 0 {
					innerObj["timeout"] = he.Timeout
				}
				innerArr = append(innerArr, innerObj)
			}
			groupObj["hooks"] = innerArr
			arr = append(arr, groupObj)
		}
		hooksObj[event] = arr
	}
	cfg["hooks"] = hooksObj
	return writeGeminiConfig(home, cfg)
}

/* ================================================================== */
/*  OpenCode: ~/.config/opencode/opencode.json                         */
/* ================================================================== */

// Permissions: opencode.json → permission { "bash": "allow", "edit": "deny", ... }
// Can also be a flat string like "allow", or nested like { "bash": { "git *": "allow" } }
func readOpenCodePermissions(home string) ProviderPermissions {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return ProviderPermissions{ApprovalMode: "interactive", Allow: []string{}, Deny: []string{}, Ask: []string{}}
	}

	permRaw := cfg["permission"]
	if permRaw == nil {
		return ProviderPermissions{ApprovalMode: "interactive", Allow: []string{}, Deny: []string{}, Ask: []string{}}
	}

	// Flat string: "allow" or "deny"
	if modeStr, ok := permRaw.(string); ok {
		return ProviderPermissions{ApprovalMode: modeStr, Allow: []string{}, Deny: []string{}, Ask: []string{}}
	}

	permObj, ok := permRaw.(map[string]any)
	if !ok {
		return ProviderPermissions{ApprovalMode: "interactive", Allow: []string{}, Deny: []string{}, Ask: []string{}}
	}

	var allow, deny, ask []string
	for toolName, val := range permObj {
		switch v := val.(type) {
		case string:
			switch v {
			case "allow":
				allow = append(allow, toolName)
			case "deny":
				deny = append(deny, toolName)
			case "ask":
				ask = append(ask, toolName)
			}
		case map[string]any:
			// Nested patterns: { "git *": "allow", "rm *": "deny" }
			for pattern, action := range v {
				actionStr, ok := action.(string)
				if !ok {
					continue
				}
				entry := fmt.Sprintf("%s(%s)", toolName, pattern)
				switch actionStr {
				case "allow":
					allow = append(allow, entry)
				case "deny":
					deny = append(deny, entry)
				case "ask":
					ask = append(ask, entry)
				}
			}
		}
	}

	return ProviderPermissions{ApprovalMode: "interactive", Allow: allow, Deny: deny, Ask: ask}
}

func writeOpenCodePermissions(home string, perms ProviderPermissions) error {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return err
	}

	permObj := map[string]any{}

	// Helper to parse "tool(pattern)" format
	parseRule := func(rule string) (tool, pattern string) {
		if idx := strings.Index(rule, "("); idx > 0 && strings.HasSuffix(rule, ")") {
			return rule[:idx], rule[idx+1 : len(rule)-1]
		}
		return rule, ""
	}

	// Track nested patterns per tool: tool → { pattern → action }
	nested := map[string]map[string]string{}

	for _, rule := range perms.Allow {
		tool, pattern := parseRule(rule)
		if pattern == "" {
			permObj[tool] = "allow"
		} else {
			if nested[tool] == nil {
				nested[tool] = map[string]string{}
			}
			nested[tool][pattern] = "allow"
		}
	}
	for _, rule := range perms.Deny {
		tool, pattern := parseRule(rule)
		if pattern == "" {
			permObj[tool] = "deny"
		} else {
			if nested[tool] == nil {
				nested[tool] = map[string]string{}
			}
			nested[tool][pattern] = "deny"
		}
	}
	for _, rule := range perms.Ask {
		tool, pattern := parseRule(rule)
		if pattern == "" {
			permObj[tool] = "ask"
		} else {
			if nested[tool] == nil {
				nested[tool] = map[string]string{}
			}
			nested[tool][pattern] = "ask"
		}
	}

	// Merge nested patterns (these override flat entries for the same tool)
	for tool, patterns := range nested {
		inner := map[string]any{}
		for p, a := range patterns {
			inner[p] = a
		}
		permObj[tool] = inner
	}

	cfg["permission"] = permObj
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
/*  Claude-specific config endpoints                                   */
/* ================================================================== */

// resolveProjectRoot looks up the project root path from the DB given a project_id query param.
func (s *Server) resolveProjectRoot(r *http.Request) (string, error) {
	projectID := r.URL.Query().Get("project_id")
	if projectID == "" || s.db == nil {
		return "", fmt.Errorf("project_id required")
	}
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		return "", fmt.Errorf("project not found: %w", err)
	}
	if project.RootPath == "" {
		return "", fmt.Errorf("project has no root path")
	}
	return project.RootPath, nil
}

// GetClaudeSettings returns the full ~/.claude/settings.json (global) or
// {projectRoot}/.claude/settings.json (project).
func (s *Server) GetClaudeSettings(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var settingsPath string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		settingsPath = filepath.Join(root, ".claude", "settings.json")
	default:
		settingsPath = claudeSettingsPath(home)
	}

	data, err := os.ReadFile(settingsPath)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, map[string]any{"settings": map[string]any{}, "path": settingsPath, "exists": false})
			return
		}
		writeJSONError(w, http.StatusInternalServerError, "read_failed", err.Error())
		return
	}

	var cfg map[string]any
	if err := json.Unmarshal(data, &cfg); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "parse_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"settings": cfg, "path": settingsPath, "exists": true})
}

// PostClaudeSettings writes the full settings.json for the given scope.
func (s *Server) PostClaudeSettings(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var body struct {
		Settings map[string]any `json:"settings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	var settingsPath string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		settingsPath = filepath.Join(root, ".claude", "settings.json")
	default:
		settingsPath = claudeSettingsPath(home)
	}

	if err := os.MkdirAll(filepath.Dir(settingsPath), 0755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}

	// Merge with existing settings instead of replacing
	existing := make(map[string]any)
	if raw, err := os.ReadFile(settingsPath); err == nil {
		_ = json.Unmarshal(raw, &existing)
	}
	for k, v := range body.Settings {
		existing[k] = v
	}

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "marshal_failed", err.Error())
		return
	}
	if err := os.WriteFile(settingsPath, data, 0644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GetClaudeInstructions returns the CLAUDE.md for the given scope.
func (s *Server) GetClaudeInstructions(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var candidates []string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		candidates = []string{
			filepath.Join(root, "CLAUDE.md"),
			filepath.Join(root, ".claude", "CLAUDE.md"),
		}
	default:
		candidates = []string{
			filepath.Join(home, ".claude", "CLAUDE.md"),
		}
	}

	for _, path := range candidates {
		data, err := os.ReadFile(path)
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"content": string(data), "path": path, "exists": true})
			return
		}
	}

	// Not found — return empty with the preferred path for creation
	writeJSON(w, http.StatusOK, map[string]any{"content": "", "path": candidates[0], "exists": false})
}

// PostClaudeInstructions writes the CLAUDE.md for the given scope.
func (s *Server) PostClaudeInstructions(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var body struct {
		Content string `json:"content"`
		Path    string `json:"path,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	var target string
	if body.Path != "" {
		target = body.Path
	} else {
		switch scope {
		case "project":
			root, err := s.resolveProjectRoot(r)
			if err != nil {
				writeJSONError(w, http.StatusBadRequest, "project", err.Error())
				return
			}
			target = filepath.Join(root, "CLAUDE.md")
		default:
			target = filepath.Join(home, ".claude", "CLAUDE.md")
		}
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}
	if err := os.WriteFile(target, []byte(body.Content), 0644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DeleteClaudeInstructions removes the CLAUDE.md for the given scope.
func (s *Server) DeleteClaudeInstructions(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var candidates []string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		candidates = []string{
			filepath.Join(root, "CLAUDE.md"),
			filepath.Join(root, ".claude", "CLAUDE.md"),
		}
	default:
		candidates = []string{
			filepath.Join(home, ".claude", "CLAUDE.md"),
		}
	}

	for _, path := range candidates {
		if err := os.Remove(path); err == nil {
			writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
			return
		}
	}

	writeJSONError(w, http.StatusNotFound, "not_found", "CLAUDE.md not found")
}

// claudeFileEntry is a single discovered file for rules/skills/subagents.
type claudeFileEntry struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	Path    string `json:"path"`
}

// listClaudeDir lists all .md files in a directory, returning their name, content, and path.
// It follows symlinks to resolve directories and files correctly.
func listClaudeDir(dir string) []claudeFileEntry {
	entries := make([]claudeFileEntry, 0)
	dirEntries, err := os.ReadDir(dir)
	if err != nil {
		return entries
	}
	for _, de := range dirEntries {
		fullPath := filepath.Join(dir, de.Name())

		// Resolve symlinks to determine real type
		isDir := de.IsDir()
		if de.Type()&os.ModeSymlink != 0 {
			if resolved, err := os.Stat(fullPath); err == nil {
				isDir = resolved.IsDir()
			} else {
				continue // broken symlink
			}
		}

		if isDir {
			// Check for AGENT.md inside the directory
			agentPath := filepath.Join(fullPath, "AGENT.md")
			if data, err := os.ReadFile(agentPath); err == nil {
				entries = append(entries, claudeFileEntry{Name: de.Name(), Content: string(data), Path: agentPath})
				continue
			}
			// Fallback: first .md file inside the directory
			subEntries, _ := os.ReadDir(fullPath)
			for _, sub := range subEntries {
				subPath := filepath.Join(fullPath, sub.Name())
				// Resolve symlinks for sub-entries too
				subIsDir := sub.IsDir()
				if sub.Type()&os.ModeSymlink != 0 {
					if resolved, err := os.Stat(subPath); err == nil {
						subIsDir = resolved.IsDir()
					}
				}
				if !subIsDir && strings.HasSuffix(strings.ToLower(sub.Name()), ".md") {
					if data, err := os.ReadFile(subPath); err == nil {
						entries = append(entries, claudeFileEntry{Name: de.Name(), Content: string(data), Path: subPath})
						break
					}
				}
			}
			continue
		}
		if !strings.HasSuffix(strings.ToLower(de.Name()), ".md") {
			continue
		}
		data, err := os.ReadFile(fullPath)
		if err != nil {
			continue
		}
		name := strings.TrimSuffix(de.Name(), filepath.Ext(de.Name()))
		entries = append(entries, claudeFileEntry{Name: name, Content: string(data), Path: fullPath})
	}
	return entries
}

// listClaudeAgentsDir lists only agent definitions — directories containing AGENT.md
// or a .md file. Skips loose .md files at the top level (like README.md, CLAUDE.md)
// which are not agent definitions.
func listClaudeAgentsDir(dir string) []claudeFileEntry {
	entries := make([]claudeFileEntry, 0)
	dirEntries, err := os.ReadDir(dir)
	if err != nil {
		return entries
	}
	for _, de := range dirEntries {
		fullPath := filepath.Join(dir, de.Name())

		isDir := de.IsDir()
		if de.Type()&os.ModeSymlink != 0 {
			if resolved, err := os.Stat(fullPath); err == nil {
				isDir = resolved.IsDir()
			} else {
				continue
			}
		}

		if !isDir {
			continue // skip loose files — only directories are agents
		}

		// Check for AGENT.md inside the directory
		agentPath := filepath.Join(fullPath, "AGENT.md")
		if data, err := os.ReadFile(agentPath); err == nil {
			entries = append(entries, claudeFileEntry{Name: de.Name(), Content: string(data), Path: agentPath})
			continue
		}
		// Fallback: first .md file inside the directory
		subEntries, _ := os.ReadDir(fullPath)
		for _, sub := range subEntries {
			subPath := filepath.Join(fullPath, sub.Name())
			subIsDir := sub.IsDir()
			if sub.Type()&os.ModeSymlink != 0 {
				if resolved, err := os.Stat(subPath); err == nil {
					subIsDir = resolved.IsDir()
				}
			}
			if !subIsDir && strings.HasSuffix(strings.ToLower(sub.Name()), ".md") {
				if data, err := os.ReadFile(subPath); err == nil {
					entries = append(entries, claudeFileEntry{Name: de.Name(), Content: string(data), Path: subPath})
					break
				}
			}
		}
	}
	return entries
}

// GetClaudeRules lists .md files in .claude/rules/.
func (s *Server) GetClaudeRules(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "rules")
	default:
		dir = filepath.Join(home, ".claude", "rules")
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": listClaudeDir(dir), "dir": dir})
}

// PostClaudeRule creates or updates a rule .md file.
func (s *Server) PostClaudeRule(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()

	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "rules")
	default:
		dir = filepath.Join(home, ".claude", "rules")
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}
	name := body.Name
	if !strings.HasSuffix(name, ".md") {
		name += ".md"
	}
	path := filepath.Join(dir, filepath.Base(name))
	if err := os.WriteFile(path, []byte(body.Content), 0644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "path": path})
}

// DeleteClaudeRule deletes a rule .md file.
func (s *Server) DeleteClaudeRule(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()
	name := chi.URLParam(r, "name")

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "rules")
	default:
		dir = filepath.Join(home, ".claude", "rules")
	}

	if !strings.HasSuffix(name, ".md") {
		name += ".md"
	}
	path := filepath.Join(dir, filepath.Base(name))
	if err := os.Remove(path); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GetClaudeSkills lists .md files in .claude/skills/.
func (s *Server) GetClaudeSkills(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "skills")
	default:
		dir = filepath.Join(home, ".claude", "skills")
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": listClaudeDir(dir), "dir": dir})
}

// PostClaudeSkill creates or updates a skill .md file.
func (s *Server) PostClaudeSkill(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()

	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "skills")
	default:
		dir = filepath.Join(home, ".claude", "skills")
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}
	name := body.Name
	if !strings.HasSuffix(name, ".md") {
		name += ".md"
	}
	path := filepath.Join(dir, filepath.Base(name))
	if err := os.WriteFile(path, []byte(body.Content), 0644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "path": path})
}

// DeleteClaudeSkill deletes a skill .md file or directory.
func (s *Server) DeleteClaudeSkill(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()
	name := chi.URLParam(r, "name")

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "skills")
	default:
		dir = filepath.Join(home, ".claude", "skills")
	}

	// First try as directory (for skills stored in directory format)
	dirPath := filepath.Join(dir, filepath.Base(name))
	if info, err := os.Stat(dirPath); err == nil && info.IsDir() {
		if err := os.RemoveAll(dirPath); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "delete_failed", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}

	// Fallback to .md file format
	if !strings.HasSuffix(name, ".md") {
		name += ".md"
	}
	filePath := filepath.Join(dir, filepath.Base(name))
	if err := os.Remove(filePath); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GetClaudeSubAgents lists agent definitions in .claude/agents/.
func (s *Server) GetClaudeSubAgents(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "agents")
	default:
		dir = filepath.Join(home, ".claude", "agents")
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": listClaudeAgentsDir(dir), "dir": dir})
}

// PostClaudeSubAgent creates or updates a sub-agent .md file.
func (s *Server) PostClaudeSubAgent(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()

	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "agents")
	default:
		dir = filepath.Join(home, ".claude", "agents")
	}

	// Create as a directory with AGENT.md inside
	agentDir := filepath.Join(dir, filepath.Base(body.Name))
	if err := os.MkdirAll(agentDir, 0755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}
	path := filepath.Join(agentDir, "AGENT.md")
	if err := os.WriteFile(path, []byte(body.Content), 0644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "path": path})
}

// DeleteClaudeSubAgent deletes a sub-agent directory or file.
func (s *Server) DeleteClaudeSubAgent(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	home, _ := os.UserHomeDir()
	name := chi.URLParam(r, "name")

	var dir string
	switch scope {
	case "project":
		root, err := s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
		dir = filepath.Join(root, ".claude", "agents")
	default:
		dir = filepath.Join(home, ".claude", "agents")
	}

	target := filepath.Join(dir, filepath.Base(name))
	info, err := os.Stat(target)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "not_found", "agent not found")
		return
	}
	if info.IsDir() {
		err = os.RemoveAll(target)
	} else {
		err = os.Remove(target)
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
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
