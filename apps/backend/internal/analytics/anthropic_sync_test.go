package analytics

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAnthropicSyncUsage(t *testing.T) {
	mockResp := anthropicUsageResponse{
		Data: []anthropicUsageBucket{
			{Date: "2026-03-20T00:00:00Z", Model: "claude-opus-4-6", InputTokens: 1000, OutputTokens: 500},
			{Date: "2026-03-21T00:00:00Z", Model: "claude-sonnet-4-6", InputTokens: 2000, OutputTokens: 800},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/organizations/usage_report/messages" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("x-api-key") != "test-key" {
			t.Errorf("missing or wrong x-api-key header")
		}
		if r.Header.Get("anthropic-version") != "2023-06-01" {
			t.Errorf("missing or wrong anthropic-version header")
		}
		if r.URL.Query().Get("bucket_width") != "1d" {
			t.Errorf("expected bucket_width=1d, got %s", r.URL.Query().Get("bucket_width"))
		}
		if r.URL.Query().Get("group_by[]") != "model" {
			t.Errorf("expected group_by[]=model, got %s", r.URL.Query().Get("group_by[]"))
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResp)
	}))
	defer srv.Close()

	syncer := NewAnthropicSyncer("test-key")
	syncer.baseURL = srv.URL

	since := time.Date(2026, 3, 20, 0, 0, 0, 0, time.UTC)
	until := time.Date(2026, 3, 22, 0, 0, 0, 0, time.UTC)

	results, err := syncer.SyncUsage(context.Background(), since, until)
	if err != nil {
		t.Fatalf("SyncUsage failed: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	r := results[0]
	if r.Provider != "anthropic" {
		t.Errorf("expected provider=anthropic, got %s", r.Provider)
	}
	if r.Source != "anthropic_admin" {
		t.Errorf("expected source=anthropic_admin, got %s", r.Source)
	}
	if r.Date != "2026-03-20" {
		t.Errorf("expected date=2026-03-20, got %s", r.Date)
	}
	if r.Model != "claude-opus-4-6" {
		t.Errorf("expected model=claude-opus-4-6, got %s", r.Model)
	}
	if r.InputTokens != 1000 {
		t.Errorf("expected input_tokens=1000, got %d", r.InputTokens)
	}
	if r.OutputTokens != 500 {
		t.Errorf("expected output_tokens=500, got %d", r.OutputTokens)
	}
}

func TestAnthropicSyncCost(t *testing.T) {
	mockResp := anthropicCostResponse{
		Data: []anthropicCostBucket{
			{Date: "2026-03-20T00:00:00Z", CostUSD: 12.50},
			{Date: "2026-03-21T00:00:00Z", CostUSD: 8.75},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/organizations/cost_report" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResp)
	}))
	defer srv.Close()

	syncer := NewAnthropicSyncer("test-key")
	syncer.baseURL = srv.URL

	since := time.Date(2026, 3, 20, 0, 0, 0, 0, time.UTC)
	until := time.Date(2026, 3, 22, 0, 0, 0, 0, time.UTC)

	results, err := syncer.SyncCost(context.Background(), since, until)
	if err != nil {
		t.Fatalf("SyncCost failed: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	if results[0].CostCents != 1250 {
		t.Errorf("expected cost_cents=1250, got %d", results[0].CostCents)
	}
	if results[0].Date != "2026-03-20" {
		t.Errorf("expected date=2026-03-20, got %s", results[0].Date)
	}
	if results[0].RawData == "" {
		t.Error("expected raw_data to be populated")
	}
	if results[1].CostCents != 875 {
		t.Errorf("expected cost_cents=875, got %d", results[1].CostCents)
	}
}

func TestAnthropicSyncUsageHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"error":"forbidden"}`))
	}))
	defer srv.Close()

	syncer := NewAnthropicSyncer("bad-key")
	syncer.baseURL = srv.URL

	_, err := syncer.SyncUsage(context.Background(), time.Now(), time.Now())
	if err == nil {
		t.Fatal("expected error for 403 response")
	}
}

func TestNormalizeDate(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"2026-03-20T00:00:00Z", "2026-03-20"},
		{"2026-03-20", "2026-03-20"},
		{"short", "short"},
	}
	for _, tt := range tests {
		got := normalizeDate(tt.input)
		if got != tt.want {
			t.Errorf("normalizeDate(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestMakeID(t *testing.T) {
	id1 := makeID("anthropic", "2026-03-20", "claude-opus-4-6")
	id2 := makeID("anthropic", "2026-03-20", "claude-opus-4-6")
	id3 := makeID("anthropic", "2026-03-20", "claude-sonnet-4-6")

	if id1 != id2 {
		t.Error("same inputs should produce same ID")
	}
	if id1 == id3 {
		t.Error("different inputs should produce different IDs")
	}
	if len(id1) != 32 {
		t.Errorf("expected 32-char hex ID, got %d chars", len(id1))
	}
}
