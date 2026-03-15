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

// ProviderMCPServer represents an MCP server entry in a provider's config.
type ProviderMCPServer struct {
	Name    string   `json:"name"`
	Command string   `json:"command"`
	Args    []string `json:"args,omitempty"`
	URL     string   `json:"url,omitempty"`
	Enabled bool     `json:"enabled"`
}

// GetProviderMCPServers reads MCP servers from a provider's native config file.
func (s *Server) GetProviderMCPServers(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(servers)
}

// AddProviderMCPServer adds an MCP server to a provider's native config file.
func (s *Server) AddProviderMCPServer(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	var req struct {
		Name    string   `json:"name"`
		Command string   `json:"command"`
		Args    []string `json:"args,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	if req.Name == "" || req.Command == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "name and command are required")
		return
	}

	switch provider {
	case "claude":
		err = addClaudeMCP(homeDir, req.Name, req.Command, req.Args)
	case "codex":
		err = addCodexMCP(homeDir, req.Name, req.Command)
	case "opencode":
		err = addOpenCodeMCP(homeDir, req.Name, req.Command, req.Args)
	case "gemini":
		err = addGeminiMCP(homeDir, req.Name, req.Command, req.Args)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown_provider", fmt.Sprintf("unknown provider: %s", provider))
		return
	}

	if err != nil {
		s.logger.Error().Err(err).Str("provider", provider).Str("name", req.Name).Msg("failed to add MCP server")
		writeJSONError(w, http.StatusInternalServerError, "write_failed", fmt.Sprintf("failed to write config: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// DeleteProviderMCPServer removes an MCP server from a provider's native config file.
func (s *Server) DeleteProviderMCPServer(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
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
		var args []string
		if argsRaw, ok := server["args"].([]any); ok {
			for _, a := range argsRaw {
				args = append(args, fmt.Sprintf("%v", a))
			}
		}
		servers = append(servers, ProviderMCPServer{Name: name, Command: cmd, Args: args, URL: url, Enabled: true})
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
	data, err := os.ReadFile(codexConfigPath(home))
	if err != nil {
		return nil
	}
	content := string(data)
	re := regexp.MustCompile(`\[mcp_servers\.(\w+)\]\s*\n\s*command\s*=\s*"([^"]*)"`)
	matches := re.FindAllStringSubmatch(content, -1)
	var servers []ProviderMCPServer
	for _, match := range matches {
		servers = append(servers, ProviderMCPServer{Name: match[1], Command: match[2], Enabled: true})
	}
	return servers
}

func addCodexMCP(home, name, command string) error {
	path := codexConfigPath(home)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	content := string(data)
	block := fmt.Sprintf("\n[mcp_servers.%s]\ncommand = \"%s\"\n", name, command)
	content += block
	return os.WriteFile(path, []byte(content), 0644)
}

func deleteCodexMCP(home, name string) error {
	path := codexConfigPath(home)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	content := string(data)
	// Remove the [mcp_servers.<name>] block including command line
	re := regexp.MustCompile(`(?m)\n?\[mcp_servers\.` + regexp.QuoteMeta(name) + `\]\s*\n\s*command\s*=\s*"[^"]*"\s*\n?`)
	content = re.ReplaceAllString(content, "\n")
	return os.WriteFile(path, []byte(strings.TrimSpace(content)+"\n"), 0644)
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
		servers = append(servers, ProviderMCPServer{Name: name, Command: cmd, URL: url, Enabled: enabled})
	}
	return servers
}

func addOpenCodeMCP(home, name, command string, args []string) error {
	cfg, err := readOpenCodeConfig(home)
	if err != nil {
		return err
	}
	mcp, ok := cfg["mcp"].(map[string]any)
	if !ok {
		mcp = map[string]any{}
	}
	// OpenCode uses command as an array
	cmdParts := []string{command}
	if len(args) > 0 {
		cmdParts = append(cmdParts, args...)
	}
	mcp[name] = map[string]any{
		"command": cmdParts,
		"enabled": true,
	}
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
		servers = append(servers, ProviderMCPServer{Name: name, Command: cmd, Args: args, URL: url, Enabled: true})
	}
	return servers
}

func addGeminiMCP(home, name, command string, args []string) error {
	cfg, err := readGeminiConfig(home)
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
