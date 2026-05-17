package studio

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"net"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/observability"
	_ "modernc.org/sqlite"
)

// helper: stand up an in-memory manager and an active session.
func standUpListenerForTest(t *testing.T) (*Manager, string, string) {
	t.Helper()
	d, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	if _, err := d.Exec(db.Schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	bus := observability.NewPubSub()
	mgr := NewManager(d, bus, nil)

	sess, err := mgr.StartSession(context.Background(), StartSessionRequest{ProjectID: "p", Runner: "claude-code"})
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	sockDir := t.TempDir()
	sockPath := filepath.Join(sockDir, "studio.sock")
	ln, err := StartBridgeListener(context.Background(), sockPath, mgr)
	if err != nil {
		t.Fatalf("start listener: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	return mgr, sockPath, sess.ID
}

func TestListener_DispatchesToolCall(t *testing.T) {
	mgr, sockPath, sid := standUpListenerForTest(t)

	conn, err := net.Dial("unix", sockPath)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	if _, err := conn.Write([]byte("STUDIO-BRIDGE " + sid + "\n")); err != nil {
		t.Fatalf("handshake: %v", err)
	}
	req := `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"set_title","arguments":{"text":"From bridge"}}}` + "\n"
	if _, err := conn.Write([]byte(req)); err != nil {
		t.Fatalf("write: %v", err)
	}

	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 4096), 1<<20)
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if !scanner.Scan() {
		t.Fatalf("no response: %v", scanner.Err())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(scanner.Bytes(), &resp); err != nil {
		t.Fatalf("decode %q: %v", scanner.Text(), err)
	}
	if resp["error"] != nil {
		t.Fatalf("error: %v", resp["error"])
	}

	// Verify the draft was actually updated via Manager.
	snap, err := mgr.GetDraft(sid)
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if snap.Title != "From bridge" {
		t.Fatalf("title=%q", snap.Title)
	}
}

func TestListener_RejectsUnknownSession(t *testing.T) {
	_, sockPath, _ := standUpListenerForTest(t)

	conn, err := net.Dial("unix", sockPath)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()
	_, _ = conn.Write([]byte("STUDIO-BRIDGE no-such-session\n"))
	// Expect connection to close on us — try a read with deadline.
	_ = conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	buf := make([]byte, 64)
	n, _ := conn.Read(buf)
	if n != 0 {
		t.Fatalf("expected closed read, got %q", string(buf[:n]))
	}
}

func TestRunBridgeSubprocess_EndToEnd(t *testing.T) {
	mgr, sockPath, sid := standUpListenerForTest(t)

	// Simulate the subprocess: write a JSON-RPC request to its stdin, read from
	// its stdout. RunBridgeSubprocess will dial the listener, handshake, and pipe.
	inR, inW := net.Pipe()
	outR, outW := net.Pipe()
	done := make(chan error, 1)
	go func() {
		done <- RunBridgeSubprocess(sockPath, sid, inR, outW)
	}()

	go func() {
		_, _ = inW.Write([]byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"set_description","arguments":{"markdown":"Body"}}}` + "\n"))
	}()
	scanner := bufio.NewScanner(outR)
	scanner.Buffer(make([]byte, 4096), 1<<20)
	_ = outR.SetReadDeadline(time.Now().Add(2 * time.Second))
	if !scanner.Scan() {
		t.Fatalf("no response: %v", scanner.Err())
	}
	if strings.Contains(scanner.Text(), `"error":`) {
		t.Fatalf("rpc error: %s", scanner.Text())
	}
	snap, _ := mgr.GetDraft(sid)
	if snap.Description != "Body" {
		t.Fatalf("description=%q", snap.Description)
	}

	// Close pipes to let the subprocess exit cleanly.
	_ = inW.Close()
	_ = outW.Close()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("subprocess did not exit")
	}
}
