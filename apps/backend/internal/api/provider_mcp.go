package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

// ProviderMCPServer represents an MCP server entry in a provider's config.
type ProviderMCPServer struct {
	Name    string            `json:"name"`
	Command string            `json:"command"`
	Args    []string          `json:"args,omitempty"`
	URL     string            `json:"url,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
	Type    string            `json:"type,omitempty"`
	Enabled bool              `json:"enabled"`
}

// GetProviderMCPServers reads MCP servers from a provider's native config file.
func (s *Server) GetProviderMCPServers(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var servers []ProviderMCPServer

	switch provider {
	case "claude":
		servers = readClaudeMCP(homeDir)
	case "codex":
		servers = readCodexMCP(homeDir)
	case "opencode":
		servers = readOpenCodeMCP(homeDir)
	case "gemini":
		servers = readGeminiMCP(homeDir)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	if servers == nil {
		servers = []ProviderMCPServer{}
	}

	// Merge project-scoped MCP servers for Claude
	projectID := r.URL.Query().Get("project_id")
	if projectID != "" && provider == "claude" && s.db != nil {
		project, err := s.db.GetProjectByID(r.Context(), projectID)
		if err == nil && project.RootPath != "" {
			cfg, cfgErr := readClaudeConfig(homeDir)
			if cfgErr == nil {
				// Track disabled .mcp.json servers for this project
				disabledMcpjson := map[string]bool{}

				// Read project MCP from ~/.claude.json -> projects.<path>.mcpServers
				if projects, ok := cfg["projects"].(map[string]any); ok {
					if projCfg, ok := projects[project.RootPath].(map[string]any); ok {
						if projMcp, ok := projCfg["mcpServers"].(map[string]any); ok {
							servers = mergeClaudeMCPServers(servers, projMcp)
						}
						// Read disabledMcpjsonServers
						if disabled, ok := projCfg["disabledMcpjsonServers"].([]any); ok {
							for _, d := range disabled {
								if name, ok := d.(string); ok {
									disabledMcpjson[name] = true
								}
							}
						}
					}
				}

				// Also read .mcp.json from project root
				mcpJsonPath := filepath.Join(project.RootPath, ".mcp.json")
				if mcpData, readErr := os.ReadFile(mcpJsonPath); readErr == nil {
					var mcpJson map[string]any
					if json.Unmarshal(mcpData, &mcpJson) == nil {
						if mcpServers, ok := mcpJson["mcpServers"].(map[string]any); ok {
							// Mark disabled servers before merging
							for name := range disabledMcpjson {
								if srv, ok := mcpServers[name].(map[string]any); ok {
									srv["_disabled"] = true
									mcpServers[name] = srv
								}
							}
							servers = mergeClaudeMCPServers(servers, mcpServers)
						}
					}
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, servers)
}

// AddProviderMCPServer adds an MCP server to a provider's native config file.
func (s *Server) AddProviderMCPServer(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var req struct {
		Name    string            `json:"name"`
		Command string            `json:"command"`
		Args    []string          `json:"args,omitempty"`
		URL     string            `json:"url,omitempty"`
		Env     map[string]string `json:"env,omitempty"`
		Type    string            `json:"type,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	if req.Name == "" || (req.Command == "" && req.URL == "") {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "name and command (or url) are required")
		return
	}

	switch provider {
	case "claude":
		err = addClaudeMCPFull(homeDir, req.Name, req.Command, req.Args, req.URL, req.Env, req.Type)
	case "codex":
		err = addCodexMCP(homeDir, req.Name, req.Command, req.Args, req.URL, req.Env)
	case "opencode":
		err = addOpenCodeMCP(homeDir, req.Name, req.Command, req.Args, req.URL, req.Type)
	case "gemini":
		err = addGeminiMCP(homeDir, req.Name, req.Command, req.Args, req.URL, req.Env)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	if err != nil {
		s.logger.Error().Err(err).Str("provider", provider).Str("name", req.Name).Msg("failed to add MCP server")
		writeJSONError(w, http.StatusInternalServerError, "write_failed", fmt.Sprintf("failed to write config: %v", err))
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
}

// DeleteProviderMCPServer removes an MCP server from a provider's native config file.
func (s *Server) DeleteProviderMCPServer(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	provider = strings.ToLower(provider)
	name := chi.URLParam(r, "name")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	switch provider {
	case "claude":
		err = deleteClaudeMCP(homeDir, name)
	case "codex":
		err = deleteCodexMCP(homeDir, name)
	case "opencode":
		err = deleteOpenCodeMCP(homeDir, name)
	case "gemini":
		err = deleteGeminiMCP(homeDir, name)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	if err != nil {
		s.logger.Error().Err(err).Str("provider", provider).Str("name", name).Msg("failed to delete MCP server")
		writeJSONError(w, http.StatusInternalServerError, "write_failed", fmt.Sprintf("failed to write config: %v", err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

/* ------------------------------------------------------------------ */
/*  Claude: ~/.claude.json → mcpServers                                */
/* ------------------------------------------------------------------ */

func claudeConfigPath(home string) string {
	return filepath.Join(home, ".claude.json")
}

func readClaudeConfig(home string) (map[string]any, error) {
	data, err := os.ReadFile(claudeConfigPath(home))
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

func writeClaudeConfig(home string, cfg map[string]any) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(claudeConfigPath(home), data, 0644)
}

// mergeClaudeMCPServers merges additional MCP server entries into an existing list.
// If a server with the same name already exists, the new entry overrides it.
func mergeClaudeMCPServers(existing []ProviderMCPServer, additional map[string]any) []ProviderMCPServer {
	nameIndex := map[string]int{}
	for i, s := range existing {
		nameIndex[s.Name] = i
	}
	for name, val := range additional {
		server, ok := val.(map[string]any)
		if !ok {
			continue
		}
		cmd, _ := server["command"].(string)
		url, _ := server["url"].(string)
		typ, _ := server["type"].(string)
		var args []string
		if argsRaw, ok := server["args"].([]any); ok {
			for _, a := range argsRaw {
				args = append(args, fmt.Sprintf("%v", a))
			}
		}
		var env map[string]string
		if envRaw, ok := server["env"].(map[string]any); ok {
			env = make(map[string]string, len(envRaw))
			for k, v := range envRaw {
				env[k] = fmt.Sprintf("%v", v)
			}
		}
		enabled := true
		if _, disabled := server["_disabled"]; disabled {
			enabled = false
		}
		entry := ProviderMCPServer{Name: name, Command: cmd, Args: args, URL: url, Env: env, Type: typ, Enabled: enabled}
		if idx, exists := nameIndex[name]; exists {
			existing[idx] = entry
		} else {
			nameIndex[name] = len(existing)
			existing = append(existing, entry)
		}
	}
	return existing
}

func readClaudeMCP(home string) []ProviderMCPServer {
	cfg, err := readClaudeConfig(home)
	if err != nil {
		return nil
	}
	mcpServers, ok := cfg["mcpServers"].(map[string]any)
	if !ok {
		return nil
	}
	var servers []ProviderMCPServer
	for name, val := range mcpServers {
		server, ok := val.(map[string]any)
		if !ok {
			continue
		}
		cmd, _ := server["command"].(string)
		url, _ := server["url"].(string)
		typ, _ := server["type"].(string)
		var args []string
		if argsRaw, ok := server["args"].([]any); ok {
			for _, a := range argsRaw {
				args = append(args, fmt.Sprintf("%v", a))
			}
		}
		var env map[string]string
		if envRaw, ok := server["env"].(map[string]any); ok {
			env = make(map[string]string, len(envRaw))
			for k, v := range envRaw {
				env[k] = fmt.Sprintf("%v", v)
			}
		}
		servers = append(servers, ProviderMCPServer{Name: name, Command: cmd, Args: args, URL: url, Env: env, Type: typ, Enabled: true})
	}
	return servers
}

func addClaudeMCP(home, name, command string, args []string) error {
	cfg, err := readClaudeConfig(home)
	if err != nil {
		return err
	}
	mcpServers, ok := cfg["mcpServers"].(map[string]any)
	if !ok {
		mcpServers = map[string]any{}
	}
	entry := map[string]any{"command": command}
	if len(args) > 0 {
		entry["args"] = args
	}
	// Default type based on whether command or url is set
	if command != "" {
		entry["type"] = "stdio"
	}
	mcpServers[name] = entry
	cfg["mcpServers"] = mcpServers
	return writeClaudeConfig(home, cfg)
}

func addClaudeMCPFull(home, name, command string, args []string, url string, env map[string]string, typ string) error {
	cfg, err := readClaudeConfig(home)
	if err != nil {
		return err
	}
	mcpServers, ok := cfg["mcpServers"].(map[string]any)
	if !ok {
		mcpServers = map[string]any{}
	}
	entry := map[string]any{}
	if command != "" {
		entry["command"] = command
	}
	if len(args) > 0 {
		entry["args"] = args
	}
	if url != "" {
		entry["url"] = url
	}
	if len(env) > 0 {
		entry["env"] = env
	}
	if typ != "" {
		entry["type"] = typ
	} else if command != "" {
		entry["type"] = "stdio"
	} else if url != "" {
		entry["type"] = "http"
	}
	mcpServers[name] = entry
	cfg["mcpServers"] = mcpServers
	return writeClaudeConfig(home, cfg)
}

func deleteClaudeMCP(home, name string) error {
	cfg, err := readClaudeConfig(home)
	if err != nil {
		return err
	}
	mcpServers, ok := cfg["mcpServers"].(map[string]any)
	if !ok {
		return nil
	}
	delete(mcpServers, name)
	cfg["mcpServers"] = mcpServers
	return writeClaudeConfig(home, cfg)
}

/* ------------------------------------------------------------------ */
/*  Codex: ~/.codex/config.toml → [mcp_servers.*]                      */
/* ------------------------------------------------------------------ */

func codexConfigPath(home string) string {
	return filepath.Join(home, ".codex", "config.toml")
}

func readCodexMCP(home string) []ProviderMCPServer {
	cfg, err := readCodexConfig(home)
	if err != nil {
		return nil
	}

	mcpServers, ok := cfg["mcp_servers"].(map[string]any)
	if !ok {
		return nil
	}

	var servers []ProviderMCPServer
	for name, val := range mcpServers {
		server, ok := val.(map[string]any)
		if !ok {
			continue
		}
		s := ProviderMCPServer{Name: name, Enabled: true}

		if cmd, ok := server["command"].(string); ok {
			s.Command = cmd
		}
		if url, ok := server["url"].(string); ok {
			s.URL = url
		}
		if args, ok := server["args"].([]any); ok {
			for _, a := range args {
				s.Args = append(s.Args, fmt.Sprintf("%v", a))
			}
		}
		if env, ok := server["env"].(map[string]any); ok {
			s.Env = make(map[string]string)
			for k, v := range env {
				s.Env[k] = fmt.Sprintf("%v", v)
			}
		}
		if enabled, ok := server["enabled"].(bool); ok {
			s.Enabled = enabled
		}
		s.Type = "stdio"
		if s.URL != "" {
			s.Type = "http"
		}
		servers = append(servers, s)
	}
	return servers
}

func addCodexMCP(home, name, command string, args []string, url string, env map[string]string) error {
	cfg, err := readCodexConfig(home)
	if err != nil {
		cfg = map[string]any{}
	}

	mcpServers, ok := cfg["mcp_servers"].(map[string]any)
	if !ok {
		mcpServers = map[string]any{}
	}

	server := map[string]any{}
	if command != "" {
		server["command"] = command
	}
	if len(args) > 0 {
		server["args"] = args
	}
	if url != "" {
		server["url"] = url
	}
	if len(env) > 0 {
		server["env"] = env
	}

	mcpServers[name] = server
	cfg["mcp_servers"] = mcpServers

	return writeCodexConfig(home, cfg)
}

func deleteCodexMCP(home, name string) error {
	cfg, err := readCodexConfig(home)
	if err != nil {
		return err
	}

	mcpServers, ok := cfg["mcp_servers"].(map[string]any)
	if !ok {
		return nil
	}

	delete(mcpServers, name)
	cfg["mcp_servers"] = mcpServers

	return writeCodexConfig(home, cfg)
}

/* ------------------------------------------------------------------ */
/*  OpenCode: ~/.config/opencode/opencode.json → mcp                   */
/* ------------------------------------------------------------------ */

func openCodeConfigPath(home string) string {
	return filepath.Join(home, ".config", "opencode", "opencode.json")
}

func readOpenCodeConfig(home string) (map[string]any, error) {
	data, err := os.ReadFile(openCodeConfigPath(home))
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

func writeOpenCodeConfig(home string, cfg map[string]any) error {
	if err := os.MkdirAll(filepath.Dir(openCodeConfigPath(home)), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(openCodeConfigPath(home), data, 0644)
}

func readOpenCodeMCP(home string) []ProviderMCPServer {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return nil
	}
	mcp, ok := cfg["mcp"].(map[string]any)
	if !ok {
		return nil
	}
	var servers []ProviderMCPServer
	for name, val := range mcp {
		server, ok := val.(map[string]any)
		if !ok {
			continue
		}
		var cmd string
		if cmdArr, ok := server["command"].([]any); ok {
			parts := make([]string, len(cmdArr))
			for i, c := range cmdArr {
				parts[i] = fmt.Sprintf("%v", c)
			}
			cmd = strings.Join(parts, " ")
		}
		url, _ := server["url"].(string)
		enabled := true
		if e, ok := server["enabled"].(bool); ok {
			enabled = e
		}
		typ := "local"
		if t, ok := server["type"].(string); ok {
			typ = t
		} else if url != "" {
			typ = "remote"
		}
		servers = append(servers, ProviderMCPServer{Name: name, Command: cmd, URL: url, Type: typ, Enabled: enabled})
	}
	return servers
}

func addOpenCodeMCP(home, name, command string, args []string, url string, typ string) error {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return err
	}
	mcp, ok := cfg["mcp"].(map[string]any)
	if !ok {
		mcp = map[string]any{}
	}
	entry := map[string]any{
		"enabled": true,
	}
	if command != "" {
		// OpenCode uses command as an array
		cmdParts := []string{command}
		if len(args) > 0 {
			cmdParts = append(cmdParts, args...)
		}
		entry["command"] = cmdParts
	}
	if url != "" {
		entry["url"] = url
	}
	if typ != "" {
		entry["type"] = typ
	} else if command != "" {
		entry["type"] = "local"
	} else if url != "" {
		entry["type"] = "remote"
	}
	mcp[name] = entry
	cfg["mcp"] = mcp
	return writeOpenCodeConfig(home, cfg)
}

func deleteOpenCodeMCP(home, name string) error {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return err
	}
	mcp, ok := cfg["mcp"].(map[string]any)
	if !ok {
		return nil
	}
	delete(mcp, name)
	cfg["mcp"] = mcp
	return writeOpenCodeConfig(home, cfg)
}

/* ------------------------------------------------------------------ */
/*  Gemini: ~/.gemini/settings.json → mcpServers                       */
/* ------------------------------------------------------------------ */

func geminiConfigPath(home string) string {
	return filepath.Join(home, ".gemini", "settings.json")
}

func readGeminiConfig(home string) (map[string]any, error) {
	data, err := os.ReadFile(geminiConfigPath(home))
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

func writeGeminiConfig(home string, cfg map[string]any) error {
	if err := os.MkdirAll(filepath.Dir(geminiConfigPath(home)), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(geminiConfigPath(home), data, 0644)
}

func readGeminiMCP(home string) []ProviderMCPServer {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return nil
	}
	mcpServers, ok := cfg["mcpServers"].(map[string]any)
	if !ok {
		return nil
	}
	var servers []ProviderMCPServer
	for name, val := range mcpServers {
		server, ok := val.(map[string]any)
		if !ok {
			continue
		}
		cmd, _ := server["command"].(string)
		url, _ := server["url"].(string)
		var args []string
		if argsRaw, ok := server["args"].([]any); ok {
			for _, a := range argsRaw {
				args = append(args, fmt.Sprintf("%v", a))
			}
		}
		var env map[string]string
		if envRaw, ok := server["env"].(map[string]any); ok {
			env = make(map[string]string)
			for k, v := range envRaw {
				env[k] = fmt.Sprintf("%v", v)
			}
		}
		typ, _ := server["type"].(string)
		servers = append(servers, ProviderMCPServer{Name: name, Command: cmd, Args: args, URL: url, Env: env, Type: typ, Enabled: true})
	}
	return servers
}

func addGeminiMCP(home, name, command string, args []string, url string, env map[string]string) error {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return err
	}
	mcpServers, ok := cfg["mcpServers"].(map[string]any)
	if !ok {
		mcpServers = map[string]any{}
	}
	entry := map[string]any{}
	if command != "" {
		entry["command"] = command
	}
	if len(args) > 0 {
		entry["args"] = args
	}
	if url != "" {
		entry["url"] = url
	}
	if len(env) > 0 {
		entry["env"] = env
	}
	mcpServers[name] = entry
	cfg["mcpServers"] = mcpServers
	return writeGeminiConfig(home, cfg)
}

func deleteGeminiMCP(home, name string) error {
	cfg, err := readGeminiConfig(home)
	if err != nil {
		return err
	}
	mcpServers, ok := cfg["mcpServers"].(map[string]any)
	if !ok {
		return nil
	}
	delete(mcpServers, name)
	cfg["mcpServers"] = mcpServers
	return writeGeminiConfig(home, cfg)
}
