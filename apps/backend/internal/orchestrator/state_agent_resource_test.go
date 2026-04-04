package orchestrator

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildAgentResourceProviderSpecificPaths(t *testing.T) {
	rootDir := "/tmp/provider-root"

	tests := []struct {
		name         string
		provider     string
		resourceType string
		resourceName string
		scope        string
		wantPath     string
		wantContains []string
	}{
		{
			name:         "codex global config",
			provider:     "codex",
			resourceType: "config",
			resourceName: "config",
			scope:        "global",
			wantPath:     filepath.Join(rootDir, ".codex", "config.toml"),
			wantContains: []string{"# Codex configuration"},
		},
		{
			name:         "codex project instructions",
			provider:     "codex",
			resourceType: "instructions",
			resourceName: "Team Playbook",
			scope:        "project",
			wantPath:     filepath.Join(rootDir, "AGENTS.md"),
			wantContains: []string{"# Project Instructions"},
		},
		{
			name:         "codex subagent",
			provider:     "codex",
			resourceType: "agents",
			resourceName: "Code Reviewer",
			scope:        "project",
			wantPath:     filepath.Join(rootDir, ".codex", "agents", "code-reviewer.md"),
			wantContains: []string{"name: code-reviewer", "model: gpt-5.3-codex"},
		},
		{
			name:         "codex skill",
			provider:     "codex",
			resourceType: "skills",
			resourceName: "Release Captain",
			scope:        "project",
			wantPath:     filepath.Join(rootDir, ".agents", "skills", "release-captain", "SKILL.md"),
			wantContains: []string{"name: release-captain", "# Release Captain"},
		},
		{
			name:         "gemini global settings",
			provider:     "gemini",
			resourceType: "settings",
			resourceName: "settings",
			scope:        "global",
			wantPath:     filepath.Join(rootDir, ".gemini", "settings.json"),
			wantContains: []string{"\"mcpServers\": {}"},
		},
		{
			name:         "gemini project context",
			provider:     "gemini",
			resourceType: "context",
			resourceName: "Workspace Context",
			scope:        "project",
			wantPath:     filepath.Join(rootDir, "GEMINI.md"),
			wantContains: []string{"# Project Context"},
		},
		{
			name:         "gemini command",
			provider:     "gemini",
			resourceType: "commands",
			resourceName: "Daily Summary",
			scope:        "project",
			wantPath:     filepath.Join(rootDir, ".gemini", "commands", "daily-summary.md"),
			wantContains: []string{"description: Daily Summary", "Describe the task this command should run."},
		},
		{
			name:         "opencode global config",
			provider:     "opencode",
			resourceType: "config",
			resourceName: "config",
			scope:        "global",
			wantPath:     filepath.Join(rootDir, ".config", "opencode", "opencode.json"),
			wantContains: []string{"https://opencode.ai/config.json"},
		},
		{
			name:         "opencode project agent",
			provider:     "opencode",
			resourceType: "agents",
			resourceName: "Planner Agent",
			scope:        "project",
			wantPath:     filepath.Join(rootDir, ".opencode", "agents", "planner-agent.md"),
			wantContains: []string{"mode: subagent", "You are Planner Agent."},
		},
		{
			name:         "opencode global command",
			provider:     "opencode",
			resourceType: "commands",
			resourceName: "Ship It",
			scope:        "global",
			wantPath:     filepath.Join(rootDir, ".config", "opencode", "commands", "ship-it.md"),
			wantContains: []string{"agent: build", "Run Ship It."},
		},
		{
			name:         "opencode project skill",
			provider:     "opencode",
			resourceType: "skills",
			resourceName: "Release Notes",
			scope:        "project",
			wantPath:     filepath.Join(rootDir, ".opencode", "skills", "release-notes", "SKILL.md"),
			wantContains: []string{"# Release Notes"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPath, gotContent, err := buildAgentResource(rootDir, tt.provider, tt.resourceType, tt.resourceName, tt.scope)
			if err != nil {
				t.Fatalf("buildAgentResource: %v", err)
			}
			if gotPath != tt.wantPath {
				t.Fatalf("expected path %q, got %q", tt.wantPath, gotPath)
			}
			for _, snippet := range tt.wantContains {
				if !strings.Contains(gotContent, snippet) {
					t.Fatalf("expected content to contain %q, got %q", snippet, gotContent)
				}
			}
		})
	}
}

func TestBuildAgentResourceRejectsUnsupportedType(t *testing.T) {
	_, _, err := buildAgentResource("/tmp/provider-root", "gemini", "agents", "reviewer", "project")
	if err == nil {
		t.Fatalf("expected unsupported resource type error")
	}
	if !strings.Contains(err.Error(), "unsupported Gemini resource type") {
		t.Fatalf("unexpected error: %v", err)
	}
}
