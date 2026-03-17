// Package mcp provides a JSON-RPC client and registry for communicating with
// Model Context Protocol (MCP) servers over stdio.
package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// Client represents a connection to a single MCP server process, communicating
// via JSON-RPC over stdin/stdout.
type Client struct {
	name    string
	command string
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	logger  zerolog.Logger

	mu        sync.Mutex
	pending   map[string]chan json.RawMessage
	isStarted bool
}

// NewClient creates a new MCP Client with the given server name and shell command.
func NewClient(name, command string, logger zerolog.Logger) *Client {
	return &Client{
		name:    name,
		command: command,
		logger:  logger.With().Str("mcp_server", name).Logger(),
		pending: make(map[string]chan json.RawMessage),
	}
}

// Start launches the MCP server process, performs the initialize handshake,
// and begins listening for responses.
func (c *Client) Start(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.isStarted {
		return nil
	}

	c.cmd = exec.CommandContext(ctx, "sh", "-c", c.command)

	stdin, err := c.cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := c.cmd.StdoutPipe()
	if err != nil {
		return err
	}

	c.stdin = stdin
	c.stdout = stdout

	if err := c.cmd.Start(); err != nil {
		return err
	}

	c.isStarted = true
	go c.listen()

	// Initialize
	var result json.RawMessage
	err = c.Call(ctx, "initialize", map[string]any{
		"protocolVersion": "2024-11-05",
		"capabilities":    map[string]any{},
		"clientInfo": map[string]any{
			"name":    "orchestra",
			"version": "1.0.0",
		},
	}, &result)

	if err != nil {
		return fmt.Errorf("mcp initialize failed: %w", err)
	}

	// Send initialized notification
	_ = c.Notify("notifications/initialized", nil)

	return nil
}

// Call sends a JSON-RPC request to the MCP server and waits for the response.
// The result is unmarshalled into the provided target. Times out after 30 seconds.
func (c *Client) Call(ctx context.Context, method string, params any, result any) error {
	id := uuid.New().String()
	ch := make(chan json.RawMessage, 1)

	c.mu.Lock()
	c.pending[id] = ch
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
	}()

	req := map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  method,
		"params":  params,
	}

	bytes, _ := json.Marshal(req)
	if _, err := c.stdin.Write(append(bytes, '\n')); err != nil {
		return err
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case raw := <-ch:
		if result != nil {
			return json.Unmarshal(raw, result)
		}
		return nil
	case <-time.After(30 * time.Second):
		return fmt.Errorf("mcp call timeout: %s", method)
	}
}

// Notify sends a one-way JSON-RPC notification to the MCP server without expecting a response.
func (c *Client) Notify(method string, params any) error {
	req := map[string]any{
		"jsonrpc": "2.0",
		"method":  method,
		"params":  params,
	}
	bytes, _ := json.Marshal(req)
	_, err := c.stdin.Write(append(bytes, '\n'))
	return err
}

func (c *Client) listen() {
	scanner := bufio.NewScanner(c.stdout)
	for scanner.Scan() {
		line := scanner.Bytes()
		var resp struct {
			ID     string          `json:"id"`
			Result json.RawMessage `json:"result"`
			Error  *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}

		if err := json.Unmarshal(line, &resp); err != nil {
			continue
		}

		if resp.ID != "" {
			c.mu.Lock()
			ch, ok := c.pending[resp.ID]
			c.mu.Unlock()
			if ok {
				if resp.Error != nil {
					// Hack: pipe error as raw message for unmarshal to handle if needed
					// Better: handle error explicitly
				}
				ch <- resp.Result
			}
		}
	}
}

// Close shuts down the MCP server process by closing stdin/stdout and waiting for exit.
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.isStarted {
		return nil
	}
	_ = c.stdin.Close()
	_ = c.stdout.Close()
	return c.cmd.Wait()
}

// Registry manages a collection of named MCP server clients and provides
// aggregate operations across all servers.
type Registry struct {
	clients map[string]*Client
	logger  zerolog.Logger
}

// NewRegistry creates a new Registry from a map of server names to shell commands.
func NewRegistry(servers map[string]string, logger zerolog.Logger) *Registry {
	clients := make(map[string]*Client)
	for name, cmd := range servers {
		clients[name] = NewClient(name, cmd, logger)
	}
	return &Registry{clients: clients, logger: logger}
}

// StartAll launches all registered MCP server processes.
func (r *Registry) StartAll(ctx context.Context) {
	for name, client := range r.clients {
		if err := client.Start(ctx); err != nil {
			r.logger.Error().Err(err).Str("server", name).Msg("failed to start mcp server")
		}
	}
}

// ListTools aggregates tool listings from all registered MCP servers,
// prefixing each tool name with the server name to avoid collisions.
func (r *Registry) ListTools(ctx context.Context) ([]map[string]any, error) {
	var allTools []map[string]any
	for _, client := range r.clients {
		var result struct {
			Tools []map[string]any `json:"tools"`
		}
		if err := client.Call(ctx, "tools/list", nil, &result); err == nil {
			for _, t := range result.Tools {
				// Prefix tool name to avoid collisions
				t["name"] = client.name + "_" + t["name"].(string)
				allTools = append(allTools, t)
			}
		}
	}
	return allTools, nil
}

// ListResources aggregates resource listings from all registered MCP servers.
func (r *Registry) ListResources(ctx context.Context) ([]map[string]any, error) {
	var allResources []map[string]any
	for _, client := range r.clients {
		var result struct {
			Resources []map[string]any `json:"resources"`
		}
		if err := client.Call(ctx, "resources/list", nil, &result); err == nil {
			for _, res := range result.Resources {
				// Add server context
				res["server"] = client.name
				allResources = append(allResources, res)
			}
		}
	}
	return allResources, nil
}

// ReadResource reads a resource by URI from the specified MCP server.
func (r *Registry) ReadResource(ctx context.Context, serverName, uri string) (map[string]any, error) {
	client, ok := r.clients[serverName]
	if !ok {
		return nil, fmt.Errorf("mcp server not found: %s", serverName)
	}
	var result map[string]any
	err := client.Call(ctx, "resources/read", map[string]any{
		"uri": uri,
	}, &result)
	return result, err
}

// ExecuteTool invokes a tool by name on the specified MCP server with the given arguments.
func (r *Registry) ExecuteTool(ctx context.Context, serverName, toolName string, args map[string]any) (map[string]any, error) {
	client, ok := r.clients[serverName]
	if !ok {
		return nil, fmt.Errorf("mcp server not found: %s", serverName)
	}
	var result map[string]any
	err := client.Call(ctx, "tools/call", map[string]any{
		"name":      toolName,
		"arguments": args,
	}, &result)
	return result, err
}
