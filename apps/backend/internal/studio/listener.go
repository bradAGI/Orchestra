package studio

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"

	mcpstudio "github.com/orchestra/orchestra/apps/backend/internal/mcp/studio"
)

// StartBridgeListener starts a unix-socket listener that accepts mcp-bridge
// subprocess connections and routes them to the studio Manager's MCP server
// for the appropriate session. Returns the active net.Listener (caller can
// Close it to stop) or an error if the socket couldn't be bound.
//
// Connections from existing studio sessions speak JSON-RPC; non-conforming or
// unknown-session connections are dropped.
func StartBridgeListener(ctx context.Context, socketPath string, mgr *Manager) (net.Listener, error) {
	if mgr == nil {
		return nil, fmt.Errorf("studio: manager required")
	}
	if err := os.MkdirAll(filepath.Dir(socketPath), 0700); err != nil {
		return nil, fmt.Errorf("studio: mkdir %s: %w", filepath.Dir(socketPath), err)
	}
	_ = os.Remove(socketPath) // stale socket from previous daemon

	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		return nil, fmt.Errorf("studio: listen %s: %w", socketPath, err)
	}
	if err := os.Chmod(socketPath, 0600); err != nil {
		_ = ln.Close()
		return nil, fmt.Errorf("studio: chmod socket: %w", err)
	}

	go func() {
		<-ctx.Done()
		_ = ln.Close()
	}()
	go acceptLoop(ctx, ln, mgr)
	return ln, nil
}

func acceptLoop(ctx context.Context, ln net.Listener, mgr *Manager) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go handleBridgeConn(ctx, conn, mgr)
	}
}

func handleBridgeConn(ctx context.Context, conn net.Conn, mgr *Manager) {
	defer conn.Close()

	br := bufio.NewReader(conn)
	header, err := br.ReadString('\n')
	if err != nil {
		return
	}
	header = strings.TrimRight(header, "\r\n")
	const prefix = "STUDIO-BRIDGE "
	if !strings.HasPrefix(header, prefix) {
		return
	}
	sessionID := strings.TrimSpace(header[len(prefix):])
	if sessionID == "" {
		return
	}

	// Validate session exists. GetDraft returns an error if not.
	if _, err := mgr.GetDraft(sessionID); err != nil {
		return
	}

	srv := mcpstudio.New(mgr, sessionID)
	// br already has the rest of the bytes after the handshake; use it as the input.
	RunMCPBridge(ctx, srv, br, conn)
}
