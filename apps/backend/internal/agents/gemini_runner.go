package agents

import "strings"

// GeminiRunner wraps CommandRunner with Gemini-specific provider identification
// and a default command template that uses stream-json output.
type GeminiRunner struct {
	*CommandRunner
}

// NewGeminiRunner creates a Runner that executes turns using the Google Gemini
// CLI. If command is empty, it defaults to "gemini --output-format stream-json {{prompt}}".
func NewGeminiRunner(command string) *GeminiRunner {
	if strings.TrimSpace(command) == "" {
		command = "gemini --output-format stream-json {{prompt}}"
	}
	return &GeminiRunner{
		CommandRunner: NewCommandRunner(ProviderGemini, command),
	}
}
