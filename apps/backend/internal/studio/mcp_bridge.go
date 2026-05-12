package studio

import (
	"bufio"
	"context"
	"encoding/json"
	"io"

	mcpstudio "github.com/orchestra/orchestra/apps/backend/internal/mcp/studio"
)

type jsonrpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	} `json:"params"`
}

type jsonrpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *jsonrpcError   `json:"error,omitempty"`
}

type jsonrpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// RunMCPBridge reads newline-delimited JSON-RPC requests from `in`, dispatches
// tool calls to `srv`, and writes responses to `out`. Exits when `in` is closed
// or `ctx` is cancelled.
func RunMCPBridge(ctx context.Context, srv *mcpstudio.Server, in io.Reader, out io.Writer) {
	scanner := bufio.NewScanner(in)
	scanner.Buffer(make([]byte, 64*1024), 8*1024*1024)
	enc := json.NewEncoder(out)

	for scanner.Scan() {
		if ctx.Err() != nil {
			return
		}
		var req jsonrpcRequest
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			_ = enc.Encode(jsonrpcResponse{JSONRPC: "2.0", Error: &jsonrpcError{Code: -32700, Message: err.Error()}})
			continue
		}
		if req.Method != "tools/call" {
			_ = enc.Encode(jsonrpcResponse{JSONRPC: "2.0", ID: req.ID, Error: &jsonrpcError{Code: -32601, Message: "method not found"}})
			continue
		}
		result, err := srv.Dispatch(ctx, req.Params.Name, req.Params.Arguments)
		if err != nil {
			_ = enc.Encode(jsonrpcResponse{JSONRPC: "2.0", ID: req.ID, Error: &jsonrpcError{Code: -32000, Message: err.Error()}})
			continue
		}
		_ = enc.Encode(jsonrpcResponse{JSONRPC: "2.0", ID: req.ID, Result: result})
	}
}
