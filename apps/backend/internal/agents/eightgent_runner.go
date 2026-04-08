package agents

// EightgentRunner wraps CommandRunner with 8gent Code-specific provider identification.
// 8gent Code is an open-source autonomous coding agent (8gent.dev) that is
// invoked as a CLI command (e.g. "8gent") and emits streaming output.
type EightgentRunner struct {
	*CommandRunner
}

// NewEightgentRunner creates a Runner that executes turns using the 8gent Code
// CLI with the given command template.
func NewEightgentRunner(command string) *EightgentRunner {
	return &EightgentRunner{CommandRunner: NewCommandRunner(Provider8gent, command)}
}
