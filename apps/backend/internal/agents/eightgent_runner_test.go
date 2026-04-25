package agents

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// 8gent Code emits one JSON object per line on stdout. The integration relies on
// Orchestra's generic event-parsing path picking up its event shape correctly.
// The tests below assert the contract documented in docs/backend/agents-8gent.md.

func TestParseLineToEvent8gentSessionStartKind(t *testing.T) {
	line := `{"type":"session_start","session_id":"run-1735083240123-a1b2c3","started_at":"2026-04-23T10:54:00.123Z","provider":"8gent","model":"qwen3:32b","cwd":"/tmp/ws"}`
	event := parseLineToEvent(Provider8gent, "stdout", line)
	if event.Kind != "session_start" {
		t.Fatalf("expected session_start kind, got %q", event.Kind)
	}
	if event.Raw["session_id"] != "run-1735083240123-a1b2c3" {
		t.Fatalf("expected session_id preserved on Raw, got %v", event.Raw["session_id"])
	}
}

func TestParseLineToEvent8gentAssistantTextExtractsMessageAndUsage(t *testing.T) {
	line := `{"type":"assistant","subtype":"text","step":1,"finish_reason":"stop","text":"Hello.","usage":{"input_tokens":42,"output_tokens":3,"total_tokens":45}}`
	event := parseLineToEvent(Provider8gent, "stdout", line)
	if event.Kind != "assistant" {
		t.Fatalf("expected assistant kind, got %q", event.Kind)
	}
	if event.Message != "Hello." {
		t.Fatalf("expected text message extracted, got %q", event.Message)
	}
	if event.Usage.InputTokens != 42 || event.Usage.OutputTokens != 3 || event.Usage.TotalTokens != 45 {
		t.Fatalf("expected usage 42/3/45, got %+v", event.Usage)
	}
}

func TestParseLineToEvent8gentToolUseKindAndPayload(t *testing.T) {
	line := `{"type":"tool_use","subtype":"start","tool_call_id":"call-7","tool_name":"read_file","step":2,"input":{"path":"README.md"}}`
	event := parseLineToEvent(Provider8gent, "stdout", line)
	if event.Kind != "tool_use" {
		t.Fatalf("expected tool_use kind, got %q", event.Kind)
	}
	if event.Raw["tool_name"] != "read_file" {
		t.Fatalf("expected tool_name preserved on Raw, got %v", event.Raw["tool_name"])
	}
}

func TestParseLineToEvent8gentToolResultKind(t *testing.T) {
	line := `{"type":"tool_result","subtype":"ok","tool_call_id":"call-7","tool_name":"read_file","step":2,"success":true,"duration_ms":12,"result_preview":"# Orchestra"}`
	event := parseLineToEvent(Provider8gent, "stdout", line)
	if event.Kind != "tool_result" {
		t.Fatalf("expected tool_result kind, got %q", event.Kind)
	}
	if got, _ := event.Raw["success"].(bool); !got {
		t.Fatalf("expected success=true preserved on Raw, got %v", event.Raw["success"])
	}
}

func TestParseLineToEvent8gentResultKindTriggersCompletion(t *testing.T) {
	line := `{"type":"result","subtype":"ok","session_id":"run-1735083240123-a1b2c3","ended_at":"2026-04-23T10:54:01.456Z","final_text":"Hello."}`
	event := parseLineToEvent(Provider8gent, "stdout", line)
	if event.Kind != "result" {
		t.Fatalf("expected result kind to fire Orchestra completion detection, got %q", event.Kind)
	}
	if event.Raw["session_id"] != "run-1735083240123-a1b2c3" {
		t.Fatalf("expected session_id preserved on Raw for PTY-mode completion fallback, got %v", event.Raw["session_id"])
	}
}

func TestEightgentRunnerStreamsFullLifecycleAndUsage(t *testing.T) {
	stream := strings.Join([]string{
		`{"type":"session_start","session_id":"run-x","started_at":"2026-04-23T00:00:00Z","provider":"8gent","model":"qwen3:32b","cwd":"/tmp"}`,
		`{"type":"assistant","subtype":"text","step":1,"finish_reason":"stop","text":"Hello.","usage":{"input_tokens":42,"output_tokens":3,"total_tokens":45}}`,
		`{"type":"result","subtype":"ok","session_id":"run-x","ended_at":"2026-04-23T00:00:01Z","final_text":"Hello."}`,
	}, `\n`)
	runner := NewEightgentRunner("printf '" + stream + "\\n'")

	root := t.TempDir()
	workspacePath := filepath.Join(root, "ORC-8GENT-1")
	if err := os.MkdirAll(workspacePath, 0o755); err != nil {
		t.Fatalf("mkdir workspace: %v", err)
	}

	events := make([]Event, 0)
	result, err := runner.RunTurn(context.Background(), TurnRequest{
		Workspace:       workspacePath,
		WorkspaceRoot:   root,
		Prompt:          "say hello",
		IssueIdentifier: "ORC-8GENT-1",
		Timeout:         3 * time.Second,
	}, func(event Event) {
		events = append(events, event)
	})

	if err != nil {
		t.Fatalf("run turn: %v", err)
	}
	if result.Provider != Provider8gent {
		t.Fatalf("expected provider 8GENT, got %q", result.Provider)
	}
	if result.Usage.TotalTokens != 45 {
		t.Fatalf("expected merged usage total 45, got %d", result.Usage.TotalTokens)
	}

	var sawStart, sawAssistant, sawResult bool
	for _, ev := range events {
		switch ev.Kind {
		case "session_start":
			sawStart = true
		case "assistant":
			if ev.Message == "Hello." {
				sawAssistant = true
			}
		case "result":
			sawResult = true
		}
	}
	if !sawStart || !sawAssistant || !sawResult {
		t.Fatalf("expected session_start, assistant, and result events, got start=%v assistant=%v result=%v", sawStart, sawAssistant, sawResult)
	}
}

func TestRegistryRoutes8gentProviderToEightgentRunner(t *testing.T) {
	r := NewRegistry(map[string]string{
		"8gent": "8gent run --yes --output-format stream-json {{prompt}}",
	})
	if !r.HasProvider(Provider8gent) {
		t.Fatalf("expected 8GENT provider configured")
	}
	if _, ok := r.runners[Provider8gent].(*EightgentRunner); !ok {
		t.Fatalf("expected 8gent provider to use EightgentRunner")
	}
}
