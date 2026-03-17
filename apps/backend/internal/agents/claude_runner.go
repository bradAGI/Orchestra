package agents

// ClaudeRunner wraps CommandRunner with Claude-specific provider identification.
type ClaudeRunner struct {
	*CommandRunner
}

// NewClaudeRunner creates a Runner that executes turns using the Anthropic
// Claude CLI with the given command template.
func NewClaudeRunner(command string) *ClaudeRunner {
	return &ClaudeRunner{CommandRunner: NewCommandRunner(ProviderClaude, command)}
}
