package telemetry

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/rs/zerolog"
	_ "modernc.org/sqlite"
)

func TestExtractTokens(t *testing.T) {
	tests := []struct {
		name           string
		json           string
		expectedInput  int
		expectedOutput int
	}{
		{
			name:           "New Claude Format (Usage in Message)",
			json:           `{"type":"assistant","message":{"usage":{"input_tokens":100,"output_tokens":50}},"timestamp":"2026-01-12T21:06:22.729Z"}`,
			expectedInput:  100,
			expectedOutput: 50,
		},
		{
			name:           "Codex Format (Last Token Usage)",
			json:           `{"type":"event_msg","payload":{"info":{"last_token_usage":{"input_tokens":3356,"output_tokens":33}}},"timestamp":"2025-11-30T06:11:05.391Z"}`,
			expectedInput:  3356,
			expectedOutput: 33,
		},
		{
			name:           "Old Format (Direct Tokens)",
			json:           `{"type":"assistant","tokens":{"input":10,"output":5},"timestamp":"2024-01-12T21:06:22.729Z"}`,
			expectedInput:  10,
			expectedOutput: 5,
		},
		{
			name:           "No Tokens",
			json:           `{"type":"user","message":"hello"}`,
			expectedInput:  0,
			expectedOutput: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var raw map[string]interface{}
			if err := json.Unmarshal([]byte(tt.json), &raw); err != nil {
				t.Fatalf("failed to unmarshal test JSON: %v", err)
			}
			input, output := extractTokens(raw)
			if input != tt.expectedInput || output != tt.expectedOutput {
				t.Errorf("extractTokens() = (%v, %v), want (%v, %v)", input, output, tt.expectedInput, tt.expectedOutput)
			}
		})
	}
}

func TestScanGeminiJSON_IdempotentRescan(t *testing.T) {
	ctx := context.Background()
	warehousePath := filepath.Join(t.TempDir(), "warehouse.db")
	warehouse, err := db.Connect(warehousePath)
	if err != nil {
		t.Fatalf("connect warehouse db: %v", err)
	}
	defer warehouse.Close()

	geminiHome := filepath.Join(t.TempDir(), ".gemini")
	if err := os.MkdirAll(filepath.Join(geminiHome, "tmp", "demo", "chats"), 0o755); err != nil {
		t.Fatalf("mkdir gemini chat dir: %v", err)
	}

	projects := `{"projects":{"/tmp/demo":"demo"}}`
	if err := os.WriteFile(filepath.Join(geminiHome, "projects.json"), []byte(projects), 0o644); err != nil {
		t.Fatalf("write projects.json: %v", err)
	}

	chat := `{
	  "sessionId": "gem-s-1",
	  "startTime": "2026-03-14T12:00:00Z",
	  "lastUpdated": "2026-03-14T12:01:00Z",
	  "messages": [
	    {"id":"m1","timestamp":"2026-03-14T12:00:10Z","type":"user","content":[{"text":"hello"}]},
	    {"id":"m2","timestamp":"2026-03-14T12:00:20Z","type":"gemini","content":"ok","tokens":{"input":10,"output":4}}
	  ]
	}`
	chatPath := filepath.Join(geminiHome, "tmp", "demo", "chats", "session-1.json")
	if err := os.WriteFile(chatPath, []byte(chat), 0o644); err != nil {
		t.Fatalf("write chat json: %v", err)
	}

	logs := `[{"sessionId":"gem-s-1","messageId":0,"type":"user","message":"tools load","timestamp":"2026-03-14T12:00:30Z"}]`
	logsPath := filepath.Join(geminiHome, "tmp", "demo", "logs.json")
	if err := os.WriteFile(logsPath, []byte(logs), 0o644); err != nil {
		t.Fatalf("write logs json: %v", err)
	}

	scanGeminiJSON(ctx, warehouse, nil, geminiHome, Options{}, zerolog.Nop())
	firstCount := countSessionEvents(t, warehouse, "gem-s-1")
	if firstCount != 3 {
		t.Fatalf("expected 3 events after first scan, got %d", firstCount)
	}

	scanGeminiJSON(ctx, warehouse, nil, geminiHome, Options{}, zerolog.Nop())
	secondCount := countSessionEvents(t, warehouse, "gem-s-1")
	if secondCount != firstCount {
		t.Fatalf("expected idempotent rescan count %d, got %d", firstCount, secondCount)
	}
}

func TestScanOpenCodeSQLite_IdempotentRescan(t *testing.T) {
	ctx := context.Background()
	warehousePath := filepath.Join(t.TempDir(), "warehouse.db")
	warehouse, err := db.Connect(warehousePath)
	if err != nil {
		t.Fatalf("connect warehouse db: %v", err)
	}
	defer warehouse.Close()

	externalDBPath := filepath.Join(t.TempDir(), "opencode.db")
	ext, err := sql.Open("sqlite", "file:"+externalDBPath)
	if err != nil {
		t.Fatalf("open external sqlite: %v", err)
	}
	defer ext.Close()

	stmts := []string{
		`CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT);`,
		`CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT);`,
		`CREATE TABLE part (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT);`,
		`INSERT INTO session (id, directory) VALUES ('oc-s-1', '/tmp/opencode-demo');`,
		`INSERT INTO message (id, session_id, time_created, data) VALUES ('msg-1', 'oc-s-1', 1000, '{"role":"assistant","summary":"done","tokens":{"input":7,"output":3}}');`,
		`INSERT INTO part (id, session_id, time_created, data) VALUES ('prt-1', 'oc-s-1', 1001, '{"type":"reasoning","text":"thinking"}');`,
	}
	for _, stmt := range stmts {
		if _, err := ext.ExecContext(ctx, stmt); err != nil {
			t.Fatalf("seed external sqlite: %v", err)
		}
	}

	scanOpenCodeSQLite(ctx, warehouse, nil, externalDBPath, Options{}, zerolog.Nop())
	firstCount := countSessionEvents(t, warehouse, "oc-s-1")
	if firstCount != 2 {
		t.Fatalf("expected 2 events after first scan, got %d", firstCount)
	}

	scanOpenCodeSQLite(ctx, warehouse, nil, externalDBPath, Options{}, zerolog.Nop())
	secondCount := countSessionEvents(t, warehouse, "oc-s-1")
	if secondCount != firstCount {
		t.Fatalf("expected idempotent rescan count %d, got %d", firstCount, secondCount)
	}
}

func countSessionEvents(t *testing.T, database *db.DB, sessionID string) int {
	t.Helper()
	var count int
	if err := database.QueryRow("SELECT COUNT(*) FROM events WHERE session_id = ?", sessionID).Scan(&count); err != nil {
		t.Fatalf("count events for session %s: %v", sessionID, err)
	}
	return count
}
