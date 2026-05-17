package studio

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"testing"

	mcpstudio "github.com/orchestra/orchestra/apps/backend/internal/mcp/studio"
)

type recordingMgrForBridge struct {
	titles []string
}

func (r *recordingMgrForBridge) SetTitle(_, t string) error {
	r.titles = append(r.titles, t)
	return nil
}
func (r *recordingMgrForBridge) SetDescription(_, _ string) error                { return nil }
func (r *recordingMgrForBridge) AddAcceptanceCriterion(_, _ string) error        { return nil }
func (r *recordingMgrForBridge) RemoveAcceptanceCriterion(_ string, _ int) error { return nil }
func (r *recordingMgrForBridge) AttachFile(_, _ string) error                    { return nil }
func (r *recordingMgrForBridge) AttachLink(_, _, _ string) error                 { return nil }
func (r *recordingMgrForBridge) SetProvider(_, _ string) error                   { return nil }
func (r *recordingMgrForBridge) SetModel(_, _ string) error                      { return nil }
func (r *recordingMgrForBridge) SetMaxTurns(_ string, _ int) error               { return nil }
func (r *recordingMgrForBridge) Push(context.Context, string) (string, error)    { return "ISS-1", nil }
func (r *recordingMgrForBridge) ApplyTemplate(_, _ string, _ map[string]string) error {
	return nil
}

func TestBridgeDispatchesToolCall(t *testing.T) {
	rm := &recordingMgrForBridge{}
	srv := mcpstudio.New(rm, "sess1")

	agentToBridgeR, agentToBridgeW := io.Pipe()
	bridgeToAgentR, bridgeToAgentW := io.Pipe()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go RunMCPBridge(ctx, srv, agentToBridgeR, bridgeToAgentW)

	req := `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"set_title","arguments":{"text":"Hello"}}}` + "\n"
	go func() {
		_, _ = agentToBridgeW.Write([]byte(req))
	}()

	scanner := bufio.NewScanner(bridgeToAgentR)
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
	if len(rm.titles) != 1 || rm.titles[0] != "Hello" {
		t.Fatalf("titles=%v", rm.titles)
	}
}

func TestBridgeUnknownMethod(t *testing.T) {
	rm := &recordingMgrForBridge{}
	srv := mcpstudio.New(rm, "sess1")

	in, inW := io.Pipe()
	outR, out := io.Pipe()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go RunMCPBridge(ctx, srv, in, out)

	go func() {
		_, _ = inW.Write([]byte(`{"jsonrpc":"2.0","id":1,"method":"foo","params":{}}` + "\n"))
	}()
	scanner := bufio.NewScanner(outR)
	if !scanner.Scan() {
		t.Fatalf("no response: %v", scanner.Err())
	}
	var resp map[string]interface{}
	_ = json.Unmarshal(scanner.Bytes(), &resp)
	if resp["error"] == nil {
		t.Fatalf("expected error response: %s", scanner.Text())
	}
}
