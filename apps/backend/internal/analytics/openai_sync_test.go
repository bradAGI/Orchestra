package analytics

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"
)

func TestOpenAISyncUsage(t *testing.T) {
	startTime := time.Date(2026, 3, 20, 0, 0, 0, 0, time.UTC).Unix()

	mockResp := openaiUsageResponse{
		Data: []openaiUsageBucket{
			{StartTime: startTime, Model: "gpt-5.4", InputTokens: 3000, OutputTokens: 1500},
			{StartTime: startTime + 86400, Model: "o3", InputTokens: 500, OutputTokens: 200},
		},
	}

	syncer := NewOpenAISyncer("test-key")
	syncer.baseURL = "https://openai.test"
	syncer.client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/v1/organization/usage/completions" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("missing or wrong Authorization header")
		}
		if r.URL.Query().Get("bucket_width") != "1d" {
			t.Errorf("expected bucket_width=1d, got %s", r.URL.Query().Get("bucket_width"))
		}
		if r.URL.Query().Get("group_by[]") != "model" {
			t.Errorf("expected group_by[]=model, got %s", r.URL.Query().Get("group_by[]"))
		}
		payload, err := json.Marshal(mockResp)
		if err != nil {
			t.Fatalf("marshal mock usage response: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewReader(payload)),
		}, nil
	})}

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
	if r.Provider != "openai" {
		t.Errorf("expected provider=openai, got %s", r.Provider)
	}
	if r.Source != "openai_admin" {
		t.Errorf("expected source=openai_admin, got %s", r.Source)
	}
	if r.Date != "2026-03-20" {
		t.Errorf("expected date=2026-03-20, got %s", r.Date)
	}
	if r.Model != "gpt-5.4" {
		t.Errorf("expected model=gpt-5.4, got %s", r.Model)
	}
	if r.InputTokens != 3000 {
		t.Errorf("expected input_tokens=3000, got %d", r.InputTokens)
	}
}

func TestOpenAISyncCost(t *testing.T) {
	startTime := time.Date(2026, 3, 20, 0, 0, 0, 0, time.UTC).Unix()

	mockResp := openaiCostResponse{
		Data: []openaiCostBucket{
			{
				StartTime: startTime,
				Results: []openaiCostLine{
					{AmountValue: 5.25, Currency: "usd"},
					{AmountValue: 3.10, Currency: "usd"},
				},
			},
		},
	}

	syncer := NewOpenAISyncer("test-key")
	syncer.baseURL = "https://openai.test"
	syncer.client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/v1/organization/costs" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		payload, err := json.Marshal(mockResp)
		if err != nil {
			t.Fatalf("marshal mock cost response: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewReader(payload)),
		}, nil
	})}

	since := time.Date(2026, 3, 20, 0, 0, 0, 0, time.UTC)
	until := time.Date(2026, 3, 22, 0, 0, 0, 0, time.UTC)

	results, err := syncer.SyncCost(context.Background(), since, until)
	if err != nil {
		t.Fatalf("SyncCost failed: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	// 5.25 + 3.10 = 8.35 USD = 835 cents
	if results[0].CostCents != 835 {
		t.Errorf("expected cost_cents=835, got %d", results[0].CostCents)
	}
	if results[0].Date != "2026-03-20" {
		t.Errorf("expected date=2026-03-20, got %s", results[0].Date)
	}
	if results[0].RawData == "" {
		t.Error("expected raw_data to be populated")
	}
}

func TestOpenAISyncUsageHTTPError(t *testing.T) {
	syncer := NewOpenAISyncer("bad-key")
	syncer.baseURL = "https://openai.test"
	syncer.client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusUnauthorized,
			Body:       io.NopCloser(bytes.NewReader([]byte(`{"error":"unauthorized"}`))),
		}, nil
	})}

	_, err := syncer.SyncUsage(context.Background(), time.Now(), time.Now())
	if err == nil {
		t.Fatal("expected error for 401 response")
	}
}
