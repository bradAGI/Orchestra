package studio

import (
	"os"
	"path/filepath"
)

// SocketPath returns the path to the unix socket used by mcp-bridge subprocesses
// to connect back to the running daemon.
func SocketPath(workspaceRoot string) string {
	if workspaceRoot == "" {
		workspaceRoot = os.TempDir()
	}
	return filepath.Join(workspaceRoot, ".orchestra", "studio.sock")
}
