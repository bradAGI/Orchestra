package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

type providerFileEntry struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	Path    string `json:"path"`
}

type providerFileListResponse struct {
	Items []providerFileEntry `json:"items"`
	Dir   string              `json:"dir"`
}

type codexBundleResponse struct {
	Config       []providerFileEntry `json:"config"`
	Instructions []providerFileEntry `json:"instructions"`
	Subagents    []providerFileEntry `json:"subagents"`
	Skills       []providerFileEntry `json:"skills"`
	Rules        []providerFileEntry `json:"rules"`
}

type geminiBundleResponse struct {
	Settings []providerFileEntry `json:"settings"`
	Context  []providerFileEntry `json:"context"`
	Commands []providerFileEntry `json:"commands"`
}

type opencodeBundleResponse struct {
	Config   []providerFileEntry `json:"config"`
	Agents   []providerFileEntry `json:"agents"`
	Commands []providerFileEntry `json:"commands"`
	Skills   []providerFileEntry `json:"skills"`
}

func (s *Server) GetCodexBundle(w http.ResponseWriter, r *http.Request) {
	scope := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	projectRoot := ""
	if scope == "project" {
		projectRoot, err = s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
	}

	payload := codexBundleResponse{
		Config:       collectFiles(codexConfigPaths(home, projectRoot, scope)),
		Instructions: collectFiles(codexInstructionPaths(home, projectRoot, scope)),
		Subagents:    listCodexSubagents(home, projectRoot, scope),
		Skills:       listSkillDirectories(codexSkillRoots(home, projectRoot, scope)),
		Rules:        listFilesWithExtensions([]string{codexRulesDir(home, projectRoot, scope)}, ".rules"),
	}
	writeJSON(w, http.StatusOK, payload)
}

func (s *Server) GetCodexConfig(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	items := collectFiles(codexConfigPaths(home, projectRoot, scope))
	dir := filepath.Join(home, ".codex")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".codex")
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: items, Dir: dir})
}

func (s *Server) PostCodexConfig(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	targets := codexConfigPaths(home, projectRoot, scope)
	preferred := targets[0]
	if scope == "project" && projectRoot != "" {
		preferred = filepath.Join(projectRoot, ".codex", "config.toml")
	}
	s.writeProviderContent(w, r, preferred)
}

func (s *Server) GetCodexInstructions(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := home
	if scope == "global" {
		dir = filepath.Join(home, ".codex")
	} else if projectRoot != "" {
		dir = projectRoot
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: collectFiles(codexInstructionPaths(home, projectRoot, scope)), Dir: dir})
}

func (s *Server) PostCodexInstructions(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	targets := codexInstructionPaths(home, projectRoot, scope)
	preferred := targets[0]
	if scope == "project" && projectRoot != "" {
		preferred = filepath.Join(projectRoot, "AGENTS.md")
	}
	s.writeProviderContent(w, r, preferred)
}

func (s *Server) GetCodexSubagents(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	roots := []string{filepath.Join(home, ".codex", "agents")}
	if scope == "project" && projectRoot != "" {
		roots = append(roots, filepath.Join(projectRoot, ".codex", "agents"))
	}
	dir := roots[0]
	if scope == "project" && projectRoot != "" {
		dir = roots[len(roots)-1]
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: listFilesWithExtensions(roots, ".toml"), Dir: dir})
}

func (s *Server) PostCodexSubagent(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".codex", "agents")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".codex", "agents")
	}
	s.writeNamedProviderFile(w, r, dir, ".toml")
}

func (s *Server) DeleteCodexSubagent(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".codex", "agents")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".codex", "agents")
	}
	s.deleteNamedProviderFile(w, chi.URLParam(r, "name"), dir, ".toml")
}

func (s *Server) GetCodexRules(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := codexRulesDir(home, projectRoot, scope)
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: listFilesWithExtensions([]string{dir}, ".rules"), Dir: dir})
}

func (s *Server) PostCodexRule(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	s.writeNamedProviderFile(w, r, codexRulesDir(home, projectRoot, scope), ".rules")
}

func (s *Server) DeleteCodexRule(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	s.deleteNamedProviderFile(w, chi.URLParam(r, "name"), codexRulesDir(home, projectRoot, scope), ".rules")
}

func (s *Server) GetCodexSkills(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	roots := codexSkillRoots(home, projectRoot, scope)
	dir := roots[0]
	if scope == "project" && projectRoot != "" {
		dir = roots[len(roots)-1]
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: listSkillDirectories(roots), Dir: dir})
}

func (s *Server) PostCodexSkill(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".agents", "skills")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".agents", "skills")
	}
	s.writeNamedSkill(w, r, dir)
}

func (s *Server) DeleteCodexSkill(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".agents", "skills")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".agents", "skills")
	}
	s.deleteNamedSkill(w, chi.URLParam(r, "name"), dir)
}

func (s *Server) GetGeminiBundle(w http.ResponseWriter, r *http.Request) {
	scope := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	projectRoot := ""
	if scope == "project" {
		projectRoot, err = s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
	}

	payload := geminiBundleResponse{
		Settings: collectFiles(geminiSettingsPaths(home, projectRoot, scope)),
		Context:  collectFiles(geminiContextPaths(home, projectRoot, scope)),
		Commands: listFilesWithExtensions(geminiCommandRoots(home, projectRoot, scope), ".md", ".toml"),
	}
	writeJSON(w, http.StatusOK, payload)
}

func (s *Server) GetGeminiSettings(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".gemini")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".gemini")
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: collectFiles(geminiSettingsPaths(home, projectRoot, scope)), Dir: dir})
}

func (s *Server) PostGeminiSettings(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	targets := geminiSettingsPaths(home, projectRoot, scope)
	preferred := targets[0]
	if scope == "project" && projectRoot != "" {
		preferred = filepath.Join(projectRoot, ".gemini", "settings.json")
	}
	s.writeProviderContent(w, r, preferred)
}

func (s *Server) GetGeminiContext(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".gemini")
	if scope == "project" && projectRoot != "" {
		dir = projectRoot
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: collectFiles(geminiContextPaths(home, projectRoot, scope)), Dir: dir})
}

func (s *Server) PostGeminiContext(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	targets := geminiContextPaths(home, projectRoot, scope)
	preferred := targets[0]
	if scope == "project" && projectRoot != "" {
		preferred = filepath.Join(projectRoot, "GEMINI.md")
	}
	s.writeProviderContent(w, r, preferred)
}

func (s *Server) GetGeminiCommands(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	roots := geminiCommandRoots(home, projectRoot, scope)
	dir := roots[0]
	if scope == "project" && projectRoot != "" {
		dir = roots[len(roots)-1]
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: listFilesWithExtensions(roots, ".md", ".toml"), Dir: dir})
}

func (s *Server) PostGeminiCommand(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".gemini", "commands")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".gemini", "commands")
	}
	s.writeNamedProviderFile(w, r, dir, ".toml")
}

func (s *Server) DeleteGeminiCommand(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".gemini", "commands")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".gemini", "commands")
	}
	name := chi.URLParam(r, "name")
	target := filepath.Base(strings.TrimSpace(name))
	if target == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_name", "name is required")
		return
	}
	candidates := []string{
		filepath.Join(dir, target),
		filepath.Join(dir, target+".toml"),
		filepath.Join(dir, target+".md"),
	}
	for _, candidate := range candidates {
		if err := os.Remove(candidate); err == nil {
			writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "path": candidate})
			return
		} else if !os.IsNotExist(err) {
			writeJSONError(w, http.StatusInternalServerError, "delete_failed", err.Error())
			return
		}
	}
	writeJSONError(w, http.StatusNotFound, "not_found", "resource not found")
}

func (s *Server) GetOpenCodeBundle(w http.ResponseWriter, r *http.Request) {
	scope := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "home_dir", "cannot determine home directory")
		return
	}

	projectRoot := ""
	if scope == "project" {
		projectRoot, err = s.resolveProjectRoot(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "project", err.Error())
			return
		}
	}

	payload := opencodeBundleResponse{
		Config:   collectFiles(openCodeConfigPaths(home, projectRoot, scope)),
		Agents:   collectOpenCodeAgents(home, projectRoot, scope),
		Commands: listFilesWithExtensions(openCodeCommandRoots(home, projectRoot, scope), ".md", ".json", ".jsonc"),
		Skills:   listSkillDirectories(openCodeSkillRoots(home, projectRoot, scope)),
	}
	writeJSON(w, http.StatusOK, payload)
}

func (s *Server) GetOpenCodeConfig(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".config", "opencode")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".opencode")
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: collectFiles(openCodeConfigPaths(home, projectRoot, scope)), Dir: dir})
}

func (s *Server) PostOpenCodeConfig(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	targets := openCodeConfigPaths(home, projectRoot, scope)
	preferred := targets[0]
	if scope == "project" && projectRoot != "" {
		preferred = filepath.Join(projectRoot, ".opencode", "opencode.json")
	}
	s.writeProviderContent(w, r, preferred)
}

func (s *Server) GetOpenCodeAgents(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	roots := []string{filepath.Join(home, ".config", "opencode", "agents")}
	if scope == "project" && projectRoot != "" {
		roots = append(roots, filepath.Join(projectRoot, ".opencode", "agents"))
	}
	dir := roots[0]
	if scope == "project" && projectRoot != "" {
		dir = roots[len(roots)-1]
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: listFilesWithExtensions(roots, ".md", ".json", ".jsonc"), Dir: dir})
}

func (s *Server) PostOpenCodeAgent(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".config", "opencode", "agents")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".opencode", "agents")
	}
	s.writeNamedProviderFile(w, r, dir, ".md")
}

func (s *Server) DeleteOpenCodeAgent(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".config", "opencode", "agents")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".opencode", "agents")
	}
	s.deleteNamedProviderFile(w, chi.URLParam(r, "name"), dir, ".md")
}

func (s *Server) GetOpenCodeCommands(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	roots := openCodeCommandRoots(home, projectRoot, scope)
	dir := roots[0]
	if scope == "project" && projectRoot != "" {
		dir = roots[len(roots)-1]
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: listFilesWithExtensions(roots, ".md", ".json", ".jsonc"), Dir: dir})
}

func (s *Server) PostOpenCodeCommand(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".config", "opencode", "commands")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".opencode", "commands")
	}
	s.writeNamedProviderFile(w, r, dir, ".md")
}

func (s *Server) DeleteOpenCodeCommand(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".config", "opencode", "commands")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".opencode", "commands")
	}
	s.deleteNamedProviderFile(w, chi.URLParam(r, "name"), dir, ".md")
}

func (s *Server) GetOpenCodeSkills(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	roots := openCodeSkillRoots(home, projectRoot, scope)
	dir := roots[0]
	if scope == "project" && projectRoot != "" {
		dir = roots[len(roots)-1]
	}
	writeJSON(w, http.StatusOK, providerFileListResponse{Items: listSkillDirectories(roots), Dir: dir})
}

func (s *Server) PostOpenCodeSkill(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".config", "opencode", "skills")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".opencode", "skills")
	}
	s.writeNamedSkill(w, r, dir)
}

func (s *Server) DeleteOpenCodeSkill(w http.ResponseWriter, r *http.Request) {
	scope, home, projectRoot, err := s.resolveProviderScope(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "project", err.Error())
		return
	}
	dir := filepath.Join(home, ".config", "opencode", "skills")
	if scope == "project" && projectRoot != "" {
		dir = filepath.Join(projectRoot, ".opencode", "skills")
	}
	s.deleteNamedSkill(w, chi.URLParam(r, "name"), dir)
}

func codexConfigPaths(home, projectRoot, scope string) []string {
	paths := []string{filepath.Join(home, ".codex", "config.toml")}
	if scope == "project" && projectRoot != "" {
		paths = append(paths, filepath.Join(projectRoot, ".codex", "config.toml"))
	}
	return paths
}

func codexInstructionPaths(home, projectRoot, scope string) []string {
	paths := []string{
		filepath.Join(home, ".codex", "AGENTS.md"),
		filepath.Join(home, ".codex", "AGENTS.override.md"),
	}
	if scope == "project" && projectRoot != "" {
		paths = append(paths,
			filepath.Join(projectRoot, "AGENTS.md"),
			filepath.Join(projectRoot, "AGENTS.override.md"),
		)
	}
	return paths
}

func codexSkillRoots(home, projectRoot, scope string) []string {
	roots := []string{filepath.Join(home, ".agents", "skills")}
	if scope == "project" && projectRoot != "" {
		roots = append(roots, filepath.Join(projectRoot, ".agents", "skills"))
	}
	return roots
}

func codexRulesDir(home, projectRoot, scope string) string {
	if scope == "project" && projectRoot != "" {
		return filepath.Join(projectRoot, ".codex", "rules")
	}
	return filepath.Join(home, ".codex", "rules")
}

func geminiSettingsPaths(home, projectRoot, scope string) []string {
	paths := []string{filepath.Join(home, ".gemini", "settings.json")}
	if scope == "project" && projectRoot != "" {
		paths = append(paths, filepath.Join(projectRoot, ".gemini", "settings.json"))
	}
	return paths
}

func geminiContextPaths(home, projectRoot, scope string) []string {
	paths := []string{filepath.Join(home, ".gemini", "GEMINI.md")}
	if scope == "project" && projectRoot != "" {
		paths = append(paths, filepath.Join(projectRoot, "GEMINI.md"))
	}
	return paths
}

func geminiCommandRoots(home, projectRoot, scope string) []string {
	roots := []string{filepath.Join(home, ".gemini", "commands")}
	if scope == "project" && projectRoot != "" {
		roots = append(roots, filepath.Join(projectRoot, ".gemini", "commands"))
	}
	return roots
}

func openCodeConfigPaths(home, projectRoot, scope string) []string {
	paths := []string{
		filepath.Join(home, ".config", "opencode", "opencode.json"),
		filepath.Join(home, ".config", "opencode", "opencode.jsonc"),
	}
	if scope == "project" && projectRoot != "" {
		paths = append(paths,
			filepath.Join(projectRoot, ".opencode", "opencode.json"),
			filepath.Join(projectRoot, ".opencode", "opencode.jsonc"),
			filepath.Join(projectRoot, "opencode.json"),
			filepath.Join(projectRoot, "opencode.jsonc"),
		)
	}
	return paths
}

func openCodeCommandRoots(home, projectRoot, scope string) []string {
	roots := []string{filepath.Join(home, ".config", "opencode", "commands")}
	if scope == "project" && projectRoot != "" {
		roots = append(roots, filepath.Join(projectRoot, ".opencode", "commands"))
	}
	return roots
}

func openCodeSkillRoots(home, projectRoot, scope string) []string {
	roots := []string{
		filepath.Join(home, ".config", "opencode", "skills"),
		filepath.Join(home, ".agents", "skills"),
		filepath.Join(home, ".claude", "skills"),
	}
	if scope == "project" && projectRoot != "" {
		roots = append(roots,
			filepath.Join(projectRoot, ".opencode", "skills"),
			filepath.Join(projectRoot, ".agents", "skills"),
			filepath.Join(projectRoot, ".claude", "skills"),
		)
	}
	return roots
}

func collectOpenCodeAgents(home, projectRoot, scope string) []providerFileEntry {
	entries := make([]providerFileEntry, 0)
	paths := []string{
		filepath.Join(home, ".config", "opencode", "agents"),
	}
	if scope == "project" && projectRoot != "" {
		paths = append(paths, filepath.Join(projectRoot, ".opencode", "agents"))
	}
	for _, root := range paths {
		entries = append(entries, listFilesWithExtensions([]string{root}, ".md", ".json", ".jsonc")...)
	}
	return dedupeFileEntries(entries)
}

func (s *Server) resolveProviderScope(r *http.Request) (scope string, home string, projectRoot string, err error) {
	scope = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
	if scope == "" {
		scope = "global"
	}
	home, err = os.UserHomeDir()
	if err != nil {
		return "", "", "", err
	}
	if scope == "project" {
		projectRoot, err = s.resolveProjectRoot(r)
		if err != nil {
			return "", "", "", err
		}
	}
	return scope, home, projectRoot, nil
}

func (s *Server) writeProviderContent(w http.ResponseWriter, r *http.Request, defaultPath string) {
	var body struct {
		Content string `json:"content"`
		Path    string `json:"path,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	target := defaultPath
	if strings.TrimSpace(body.Path) != "" {
		target = filepath.Clean(body.Path)
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}
	if err := os.WriteFile(target, []byte(body.Content), 0o644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "path": target})
}

func (s *Server) writeNamedProviderFile(w http.ResponseWriter, r *http.Request, dir string, defaultExt string) {
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
		Path    string `json:"path,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	target := strings.TrimSpace(body.Path)
	if target == "" {
		name := strings.TrimSpace(body.Name)
		if name == "" {
			writeJSONError(w, http.StatusBadRequest, "invalid_name", "name is required")
			return
		}
		if filepath.Ext(name) == "" {
			name += defaultExt
		}
		target = filepath.Join(dir, filepath.Base(name))
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}
	if err := os.WriteFile(target, []byte(body.Content), 0o644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "path": target})
}

func (s *Server) writeNamedSkill(w http.ResponseWriter, r *http.Request, dir string) {
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
		Path    string `json:"path,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	target := strings.TrimSpace(body.Path)
	if target == "" {
		name := strings.TrimSpace(body.Name)
		if name == "" {
			writeJSONError(w, http.StatusBadRequest, "invalid_name", "name is required")
			return
		}
		target = filepath.Join(dir, filepath.Base(name), "SKILL.md")
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}
	if err := os.WriteFile(target, []byte(body.Content), 0o644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "path": target})
}

func (s *Server) deleteNamedProviderFile(w http.ResponseWriter, name string, dir string, defaultExt string) {
	target := filepath.Base(strings.TrimSpace(name))
	if target == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_name", "name is required")
		return
	}
	if filepath.Ext(target) == "" {
		target += defaultExt
	}
	fullPath := filepath.Join(dir, target)
	if err := os.Remove(fullPath); err != nil {
		if os.IsNotExist(err) {
			writeJSONError(w, http.StatusNotFound, "not_found", "resource not found")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) deleteNamedSkill(w http.ResponseWriter, name string, dir string) {
	target := filepath.Base(strings.TrimSpace(name))
	if target == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_name", "name is required")
		return
	}
	fullPath := filepath.Join(dir, target)
	if err := os.RemoveAll(fullPath); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func listCodexSubagents(home, projectRoot, scope string) []providerFileEntry {
	paths := []string{filepath.Join(home, ".codex", "agents")}
	if scope == "project" && projectRoot != "" {
		paths = append(paths, filepath.Join(projectRoot, ".codex", "agents"))
	}
	return listFilesWithExtensions(paths, ".toml")
}

func collectFiles(paths []string) []providerFileEntry {
	entries := make([]providerFileEntry, 0, len(paths))
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		entries = append(entries, providerFileEntry{
			Name:    filepath.Base(path),
			Content: string(data),
			Path:    path,
		})
	}
	return dedupeFileEntries(entries)
}

func listFilesWithExtensions(roots []string, exts ...string) []providerFileEntry {
	entries := make([]providerFileEntry, 0)
	allowed := make(map[string]bool, len(exts))
	for _, ext := range exts {
		allowed[strings.ToLower(ext)] = true
	}
	for _, root := range roots {
		dirEntries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, de := range dirEntries {
			if de.IsDir() {
				continue
			}
			ext := strings.ToLower(filepath.Ext(de.Name()))
			if !allowed[ext] {
				continue
			}
			path := filepath.Join(root, de.Name())
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}
			entries = append(entries, providerFileEntry{
				Name:    de.Name(),
				Content: string(data),
				Path:    path,
			})
		}
	}
	return dedupeFileEntries(entries)
}

func listSkillDirectories(roots []string) []providerFileEntry {
	entries := make([]providerFileEntry, 0)
	for _, root := range roots {
		dirEntries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, de := range dirEntries {
			if !de.IsDir() {
				continue
			}
			path := filepath.Join(root, de.Name(), "SKILL.md")
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}
			entries = append(entries, providerFileEntry{
				Name:    de.Name(),
				Content: string(data),
				Path:    path,
			})
		}
	}
	return dedupeFileEntries(entries)
}

func dedupeFileEntries(entries []providerFileEntry) []providerFileEntry {
	seen := make(map[string]bool, len(entries))
	out := make([]providerFileEntry, 0, len(entries))
	for _, entry := range entries {
		if seen[entry.Path] {
			continue
		}
		seen[entry.Path] = true
		out = append(out, entry)
	}
	return out
}

func (s *Server) PostProviderBundleFile(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	if strings.TrimSpace(body.Path) == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_path", "path is required")
		return
	}
	if err := os.MkdirAll(filepath.Dir(body.Path), 0o755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}
	if err := os.WriteFile(body.Path, []byte(body.Content), 0o644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
