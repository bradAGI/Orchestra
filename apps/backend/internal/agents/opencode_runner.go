package agents

// OpenCodeRunner wraps CommandRunner with OpenCode-specific provider identification.
type OpenCodeRunner struct {
	*CommandRunner
}

// NewOpenCodeRunner creates a Runner that executes turns using the OpenCode
// CLI with the given command template.
func NewOpenCodeRunner(command string) *OpenCodeRunner {
	return &OpenCodeRunner{CommandRunner: NewCommandRunner(ProviderOpenCode, command)}
}
