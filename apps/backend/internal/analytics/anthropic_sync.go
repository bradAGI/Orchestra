// Package analytics provides background sync workers and API clients for
// fetching usage and cost data from external provider admin APIs (Anthropic,
// OpenAI) and reconciling them against local estimates.
package analytics

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/orchestra/orchestra/apps/backend/internal/db"
)

// AnthropicSyncer fetches organization-level usage and cost data from the
// Anthropic Admin API.
type AnthropicSyncer struct {
	adminKey string
	baseURL  string
	client   *http.Client
}

// NewAnthropicSyncer creates an AnthropicSyncer using the given admin API key.
func NewAnthropicSyncer(adminKey string) *AnthropicSyncer {
	return &AnthropicSyncer{
		adminKey: adminKey,
		baseURL:  "https://api.anthropic.com",
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}

// anthropicUsageResponse represents the JSON envelope returned by the Anthropic
// usage report endpoint.
type anthropicUsageResponse struct {
	Data []anthropicUsageBucket `json:"data"`
}

type anthropicUsageBucket struct {
	Date         string `json:"date"`
	Model        string `json:"model"`
	InputTokens  int64  `json:"input_tokens"`
	OutputTokens int64  `json:"output_tokens"`
}

// anthropicCostResponse represents the JSON envelope returned by the Anthropic
// cost report endpoint.
type anthropicCostResponse struct {
	Data []anthropicCostBucket `json:"data"`
}

type anthropicCostBucket struct {
	Date    string  `json:"date"`
	CostUSD float64 `json:"cost_usd"`
}

// SyncUsage fetches token usage from the Anthropic Admin API for the given time
// range and returns ExternalUsage records grouped by date and model.
func (s *AnthropicSyncer) SyncUsage(ctx context.Context, since, until time.Time) ([]db.ExternalUsage, error) {
	params := url.Values{}
	params.Set("starting_at", since.UTC().Format(time.RFC3339))
	params.Set("ending_at", until.UTC().Format(time.RFC3339))
	params.Set("bucket_width", "1d")
	params.Add("group_by[]", "model")

	endpoint := fmt.Sprintf("%s/v1/organizations/usage_report/messages?%s", s.baseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build anthropic usage request: %w", err)
	}
	s.setHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic usage request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("anthropic usage API returned %d: %s", resp.StatusCode, string(body))
	}

	var parsed anthropicUsageResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("decode anthropic usage response: %w", err)
	}

	var results []db.ExternalUsage
	for _, bucket := range parsed.Data {
		date := normalizeDate(bucket.Date)
		results = append(results, db.ExternalUsage{
			ID:           makeID("anthropic", date, bucket.Model),
			Provider:     "anthropic",
			Source:       "anthropic_admin",
			Date:         date,
			Model:        bucket.Model,
			InputTokens:  bucket.InputTokens,
			OutputTokens: bucket.OutputTokens,
		})
	}
	return results, nil
}

// SyncCost fetches cost data from the Anthropic Admin API for the given time
// range and returns ExternalUsage records with cost_cents populated.
func (s *AnthropicSyncer) SyncCost(ctx context.Context, since, until time.Time) ([]db.ExternalUsage, error) {
	params := url.Values{}
	params.Set("starting_at", since.UTC().Format(time.RFC3339))
	params.Set("ending_at", until.UTC().Format(time.RFC3339))
	params.Set("bucket_width", "1d")

	endpoint := fmt.Sprintf("%s/v1/organizations/cost_report?%s", s.baseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build anthropic cost request: %w", err)
	}
	s.setHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic cost request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("anthropic cost API returned %d: %s", resp.StatusCode, string(body))
	}

	var parsed anthropicCostResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("decode anthropic cost response: %w", err)
	}

	var results []db.ExternalUsage
	for _, bucket := range parsed.Data {
		date := normalizeDate(bucket.Date)
		costCents := int64(bucket.CostUSD * 100)
		rawBytes, _ := json.Marshal(bucket)
		results = append(results, db.ExternalUsage{
			ID:        makeID("anthropic_cost", date, ""),
			Provider:  "anthropic",
			Source:    "anthropic_admin",
			Date:      date,
			CostCents: costCents,
			RawData:   string(rawBytes),
		})
	}
	return results, nil
}

func (s *AnthropicSyncer) setHeaders(req *http.Request) {
	req.Header.Set("x-api-key", s.adminKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Accept", "application/json")
}

// makeID produces a deterministic ID from provider, date, and model strings.
func makeID(provider, date, model string) string {
	h := sha256.Sum256([]byte(provider + "|" + date + "|" + model))
	return hex.EncodeToString(h[:16])
}

// normalizeDate extracts the YYYY-MM-DD portion from a timestamp string.
func normalizeDate(raw string) string {
	if len(raw) >= 10 {
		return raw[:10]
	}
	return raw
}
