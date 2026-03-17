package agents

import (
	"context"
	"strings"
	"time"
)

type Provider string

const (
	ProviderCodex    Provider = "CODEX"
	ProviderClaude   Provider = "CLAUDE"
	ProviderOpenCode Provider = "OPENCODE"
	ProviderGemini   Provider = "GEMINI"
)

// NormalizeProvider normalizes a provider string to UPPERCASE for backward compatibility.
func NormalizeProvider(s string) Provider {
	return Provider(strings.ToUpper(strings.TrimSpace(s)))
}

type TurnRequest struct {
	SessionID       string
	Workspace       string
	WorkspaceRoot   string
	Prompt          string
	IssueIdentifier string
	Attempt         int
	Timeout         time.Duration
	CommandOverride string
	AutoApprove     bool
	ToolExecutor    ToolExecutor
	ToolSpecs       []map[string]any
	ResourceSpecs   []map[string]any
}

type TokenUsage struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	TotalTokens  int64 `json:"total_tokens"`
}

type Event struct {
	Provider  Provider       `json:"provider"`
	SessionID string         `json:"session_id,omitempty"`
	Kind      string         `json:"kind"`
	Message   string         `json:"message,omitempty"`
	RawLine   string         `json:"raw_line,omitempty"`
	Raw       map[string]any `json:"raw,omitempty"`
	Usage     TokenUsage     `json:"usage,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
}

type TurnResult struct {
	Provider  Provider   `json:"provider"`
	SessionID string     `json:"session_id"`
	ExitCode  int        `json:"exit_code"`
	Output    string     `json:"output"`
	Usage     TokenUsage `json:"usage"`
}

type EventHandler func(Event)

type ToolExecutor func(tool string, arguments map[string]any) map[string]any

type Runner interface {
	RunTurn(ctx context.Context, request TurnRequest, onEvent EventHandler) (TurnResult, error)
}
