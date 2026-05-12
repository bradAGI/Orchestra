package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/orchestra/orchestra/apps/backend/internal/app"
	"github.com/orchestra/orchestra/apps/backend/internal/logging"
	"github.com/orchestra/orchestra/apps/backend/internal/studio"
)

func main() {
	if len(os.Args) >= 2 && os.Args[1] == "mcp-bridge" {
		fs := flag.NewFlagSet("mcp-bridge", flag.ExitOnError)
		sid := fs.String("session", "", "studio session id (required)")
		socket := fs.String("socket", "", "daemon unix socket path (default: $ORCHESTRA_WORKSPACE_ROOT/.orchestra/studio.sock)")
		if err := fs.Parse(os.Args[2:]); err != nil {
			os.Exit(2)
		}
		path := *socket
		if path == "" {
			path = studio.SocketPath(os.Getenv("ORCHESTRA_WORKSPACE_ROOT"))
		}
		if err := studio.RunBridgeSubprocess(path, *sid, os.Stdin, os.Stdout); err != nil {
			fmt.Fprintln(os.Stderr, "mcp-bridge:", err)
			os.Exit(1)
		}
		return
	}

	logger := logging.New()
	if err := app.Run(logger); err != nil {
		log.Fatalf("orchestrad failed: %v", err)
	}
}
