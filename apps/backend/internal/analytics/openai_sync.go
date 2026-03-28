package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/orchestra/orchestra/apps/backend/internal/db"
)

// OpenAISyncer fetches organization-level usage and cost data from the OpenAI
// Organization API.
type OpenAISyncer struct {
	adminKey string
	baseURL  string
	client   *http.Client
}

// NewOpenAISyncer creates an OpenAISyncer using the given admin API key.
func NewOpenAISyncer(adminKey string) *OpenAISyncer {
	return &OpenAISyncer{
		adminKey: adminKey,
		baseURL:  "https://api.openai.com",
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}

// openaiUsageResponse represents the JSON envelope returned by the OpenAI
// usage endpoint.
type openaiUsageResponse struct {
	Data []openaiUsageBucket `json:"data"`
}

type openaiUsageBucket struct {
	StartTime    int64  `json:"start_time"`
	EndTime      int64  `json:"end_time"`
	Model        string `json:"model"`
	InputTokens  int64  `json:"input_tokens"`
	OutputTokens int64  `json:"output_tokens"`
}

// openaiCostResponse represents the JSON envelope returned by the OpenAI
// cost endpoint.
type openaiCostResponse struct {
	Data []openaiCostBucket `json:"data"`
}

type openaiCostBucket struct {
	StartTime int64            `json:"start_time"`
	Results   []openaiCostLine `json:"results"`
}

type openaiCostLine struct {
	AmountValue float64 `json:"amount_value"`
	Currency    string  `json:"currency"`
}

// SyncUsage fetches token usage from the OpenAI Organization API for the given
// time range and returns ExternalUsage records grouped by date and model.
func (s *OpenAISyncer) SyncUsage(ctx context.Context, since, until time.Time) ([]db.ExternalUsage, error) {
	params := url.Values{}
	params.Set("start_time", strconv.FormatInt(since.Unix(), 10))
	params.Set("end_time", strconv.FormatInt(until.Unix(), 10))
	params.Set("bucket_width", "1d")
	params.Add("group_by[]", "model")

	endpoint := fmt.Sprintf("%s/v1/organization/usage/completions?%s", s.baseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build openai usage request: %w", err)
	}
	s.setHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai usage request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("openai usage API returned %d: %s", resp.StatusCode, string(body))
	}

	var parsed openaiUsageResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("decode openai usage response: %w", err)
	}

	var results []db.ExternalUsage
	for _, bucket := range parsed.Data {
		date := time.Unix(bucket.StartTime, 0).UTC().Format("2006-01-02")
		results = append(results, db.ExternalUsage{
			ID:           makeID("openai", date, bucket.Model),
			Provider:     "openai",
			Source:       "openai_admin",
			Date:         date,
			Model:        bucket.Model,
			InputTokens:  bucket.InputTokens,
			OutputTokens: bucket.OutputTokens,
		})
	}
	return results, nil
}

// SyncCost fetches cost data from the OpenAI Organization API for the given
// time range and returns ExternalUsage records with cost_cents populated.
func (s *OpenAISyncer) SyncCost(ctx context.Context, since, until time.Time) ([]db.ExternalUsage, error) {
	params := url.Values{}
	params.Set("start_time", strconv.FormatInt(since.Unix(), 10))
	params.Set("end_time", strconv.FormatInt(until.Unix(), 10))
	params.Set("bucket_width", "1d")

	endpoint := fmt.Sprintf("%s/v1/organization/costs?%s", s.baseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build openai cost request: %w", err)
	}
	s.setHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai cost request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("openai cost API returned %d: %s", resp.StatusCode, string(body))
	}

	var parsed openaiCostResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("decode openai cost response: %w", err)
	}

	var results []db.ExternalUsage
	for _, bucket := range parsed.Data {
		date := time.Unix(bucket.StartTime, 0).UTC().Format("2006-01-02")
		var totalCents int64
		for _, line := range bucket.Results {
			totalCents += int64(line.AmountValue * 100)
		}
		rawBytes, _ := json.Marshal(bucket)
		results = append(results, db.ExternalUsage{
			ID:        makeID("openai_cost", date, ""),
			Provider:  "openai",
			Source:    "openai_admin",
			Date:      date,
			CostCents: totalCents,
			RawData:   string(rawBytes),
		})
	}
	return results, nil
}

func (s *OpenAISyncer) setHeaders(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+s.adminKey)
	req.Header.Set("Accept", "application/json")
}
