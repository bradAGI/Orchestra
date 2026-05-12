package studio

import (
	"bufio"
	"fmt"
	"io"
	"net"
)

// RunBridgeSubprocess is the body of the `orchestrad mcp-bridge --session <id>`
// subcommand. It dials the daemon's unix socket, sends the session-id handshake,
// then bidirectionally copies between its stdin/stdout and the socket. Returns
// when either side closes.
func RunBridgeSubprocess(socketPath, sessionID string, in io.Reader, out io.Writer) error {
	if sessionID == "" {
		return fmt.Errorf("studio: session id required")
	}
	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		return fmt.Errorf("dial daemon: %w", err)
	}
	defer conn.Close()
	if _, err := conn.Write([]byte("STUDIO-BRIDGE " + sessionID + "\n")); err != nil {
		return fmt.Errorf("handshake: %w", err)
	}

	errCh := make(chan error, 2)
	go func() {
		_, err := io.Copy(conn, bufio.NewReader(in))
		errCh <- err
	}()
	go func() {
		_, err := io.Copy(out, conn)
		errCh <- err
	}()
	// Return on either pipe closing.
	return <-errCh
}
