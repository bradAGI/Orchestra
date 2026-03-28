package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// APIRequest represents a single LLM API call with timing and error metadata.
type APIRequest struct {
	ID                       string `json:"id"`
	SessionID                string `json:"session_id"`
	Provider                 string `json:"provider"`
	Model                    string `json:"model"`
	InputTokens              int64  `json:"input_tokens"`
	OutputTokens             int64  `json:"output_tokens"`
	LatencyMs                int64  `json:"latency_ms"`
	StatusCode               int    `json:"status_code"`
	ErrorType                string `json:"error_type,omitempty"`
	RateLimitRemainingReqs   int    `json:"rate_limit_remaining_requests"`
	RateLimitRemainingTokens int    `json:"rate_limit_remaining_tokens"`
	CreatedAt                int64  `json:"created_at"`
}

// PerformanceMetrics contains aggregated latency, error, and throughput data.
type PerformanceMetrics struct {
	AvgLatencyMs   int64              `json:"avg_latency_ms"`
	P50LatencyMs   int64              `json:"p50_latency_ms"`
	P95LatencyMs   int64              `json:"p95_latency_ms"`
	P99LatencyMs   int64              `json:"p99_latency_ms"`
	TotalRequests  int64              `json:"total_requests"`
	ErrorCount     int64              `json:"error_count"`
	ErrorRate      float64            `json:"error_rate"`
	ErrorBreakdown map[string]int64   `json:"error_breakdown"`
	ProviderHealth []ProviderHealth   `json:"provider_health"`
	ThroughputRPM  float64            `json:"throughput_rpm"`
	Funnel         *ReliabilityFunnel `json:"reliability_funnel,omitempty"`
}

// ProviderHealth summarises the operational status of a single provider.
type ProviderHealth struct {
	Provider     string  `json:"provider"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	ErrorRate    float64 `json:"error_rate"`
	RequestCount int64   `json:"request_count"`
	SessionCount int64   `json:"session_count"`
	Status       string  `json:"status"` // "healthy", "degraded", "down"
}

// ProviderRateLimit holds the most recent rate-limit snapshot for a provider.
type ProviderRateLimit struct {
	Provider          string `json:"provider"`
	RemainingRequests int    `json:"remaining_requests"`
	RemainingTokens   int    `json:"remaining_tokens"`
	LastUpdated       int64  `json:"last_updated"`
}

// ReliabilityFunnel tracks issue lifecycle progression.
type ReliabilityFunnel struct {
	Dispatched int64 `json:"dispatched"`
	Started    int64 `json:"started"`
	Completed  int64 `json:"completed"`
	PRCreated  int64 `json:"pr_created"`
	PRMerged   int64 `json:"pr_merged"`
}

// InsertAPIRequest inserts a single API request record.
func (db *DB) InsertAPIRequest(ctx context.Context, req APIRequest) error {
	query := `
		INSERT INTO api_requests (id, session_id, provider, model, input_tokens, output_tokens,
			latency_ms, status_code, error_type, rate_limit_remaining_requests,
			rate_limit_remaining_tokens, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := db.ExecContext(ctx, query,
		req.ID, req.SessionID, req.Provider, req.Model,
		req.InputTokens, req.OutputTokens, req.LatencyMs, req.StatusCode,
		nullableString(req.ErrorType),
		req.RateLimitRemainingReqs, req.RateLimitRemainingTokens, req.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert api_request: %w", err)
	}
	return nil
}

// GetPerformanceMetrics computes aggregated performance metrics from api_requests
// since the given unix timestamp, optionally filtered by provider.
func (db *DB) GetPerformanceMetrics(ctx context.Context, since int64, provider string) (*PerformanceMetrics, error) {
	m := &PerformanceMetrics{
		ErrorBreakdown: make(map[string]int64),
	}

	// --- aggregates ---
	aggQuery := `
		SELECT
			COALESCE(AVG(latency_ms), 0),
			COUNT(*),
			COUNT(CASE WHEN error_type IS NOT NULL AND error_type != '' THEN 1 END)
		FROM api_requests
		WHERE created_at > ? AND provider = COALESCE(NULLIF(?, ''), provider)
	`
	if err := db.QueryRowContext(ctx, aggQuery, since, provider).Scan(
		&m.AvgLatencyMs, &m.TotalRequests, &m.ErrorCount,
	); err != nil {
		return nil, fmt.Errorf("query aggregates: %w", err)
	}

	if m.TotalRequests > 0 {
		m.ErrorRate = float64(m.ErrorCount) / float64(m.TotalRequests)
	}

	// throughput: requests per minute over the observation window
	windowMinutes := float64(time.Now().Unix()-since) / 60.0
	if windowMinutes > 0 && m.TotalRequests > 0 {
		m.ThroughputRPM = float64(m.TotalRequests) / windowMinutes
	}

	// --- percentiles via ntile ---
	for _, pct := range []struct {
		n   int
		dst *int64
	}{
		{50, &m.P50LatencyMs},
		{95, &m.P95LatencyMs},
		{99, &m.P99LatencyMs},
	} {
		val, err := db.queryPercentile(ctx, since, provider, pct.n)
		if err != nil {
			return nil, err
		}
		*pct.dst = val
	}

	// --- error breakdown ---
	breakdownQuery := `
		SELECT error_type, COUNT(*)
		FROM api_requests
		WHERE created_at > ? AND provider = COALESCE(NULLIF(?, ''), provider)
			AND error_type IS NOT NULL AND error_type != ''
		GROUP BY error_type
	`
	rows, err := db.QueryContext(ctx, breakdownQuery, since, provider)
	if err != nil {
		return nil, fmt.Errorf("query error breakdown: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var errType string
		var cnt int64
		if err := rows.Scan(&errType, &cnt); err != nil {
			return nil, fmt.Errorf("scan error breakdown: %w", err)
		}
		m.ErrorBreakdown[errType] = cnt
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate error breakdown: %w", err)
	}

	// --- provider health ---
	healthQuery := `
		SELECT
			provider,
			COALESCE(AVG(latency_ms), 0),
			COUNT(*),
			COUNT(CASE WHEN error_type IS NOT NULL AND error_type != '' THEN 1 END),
			COUNT(DISTINCT session_id),
			COALESCE(MAX(created_at), 0)
		FROM api_requests
		WHERE created_at > ? AND provider = COALESCE(NULLIF(?, ''), provider)
		GROUP BY provider
	`
	hrows, err := db.QueryContext(ctx, healthQuery, since, provider)
	if err != nil {
		return nil, fmt.Errorf("query provider health: %w", err)
	}
	defer hrows.Close()

	now := time.Now().Unix()
	for hrows.Next() {
		var ph ProviderHealth
		var errCount, lastSeen int64
		if err := hrows.Scan(&ph.Provider, &ph.AvgLatencyMs, &ph.RequestCount, &errCount, &ph.SessionCount, &lastSeen); err != nil {
			return nil, fmt.Errorf("scan provider health: %w", err)
		}
		if ph.RequestCount > 0 {
			ph.ErrorRate = float64(errCount) / float64(ph.RequestCount)
		}
		ph.Status = classifyProviderStatus(ph.ErrorRate, lastSeen, now)
		m.ProviderHealth = append(m.ProviderHealth, ph)
	}
	if err := hrows.Err(); err != nil {
		return nil, fmt.Errorf("iterate provider health: %w", err)
	}

	// --- reliability funnel ---
	funnel, err := db.getReliabilityFunnel(ctx, since)
	if err != nil {
		// Non-fatal: funnel tables may not exist yet (owned by other agents).
		// Leave funnel nil.
		_ = err
	} else {
		m.Funnel = funnel
	}

	return m, nil
}

// GetRateLimitStatus returns the most recent rate-limit snapshot per provider.
func (db *DB) GetRateLimitStatus(ctx context.Context) ([]ProviderRateLimit, error) {
	query := `
		SELECT provider, rate_limit_remaining_requests, rate_limit_remaining_tokens, created_at
		FROM api_requests
		WHERE (provider, created_at) IN (
			SELECT provider, MAX(created_at) FROM api_requests GROUP BY provider
		)
		ORDER BY provider
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query rate limits: %w", err)
	}
	defer rows.Close()

	var out []ProviderRateLimit
	for rows.Next() {
		var rl ProviderRateLimit
		if err := rows.Scan(&rl.Provider, &rl.RemainingRequests, &rl.RemainingTokens, &rl.LastUpdated); err != nil {
			return nil, fmt.Errorf("scan rate limit: %w", err)
		}
		out = append(out, rl)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate rate limits: %w", err)
	}
	return out, nil
}

// queryPercentile returns the Nth percentile latency using LIMIT/OFFSET.
// This avoids ntile issues when the row count is less than 100.
func (db *DB) queryPercentile(ctx context.Context, since int64, provider string, pct int) (int64, error) {
	// First get the count.
	countQuery := `
		SELECT COUNT(*) FROM api_requests
		WHERE created_at > ? AND provider = COALESCE(NULLIF(?, ''), provider)
	`
	var count int64
	if err := db.QueryRowContext(ctx, countQuery, since, provider).Scan(&count); err != nil {
		return 0, fmt.Errorf("count for p%d: %w", pct, err)
	}
	if count == 0 {
		return 0, nil
	}

	// Calculate the offset for the desired percentile.
	offset := (count * int64(pct) / 100)
	if offset >= count {
		offset = count - 1
	}

	query := `
		SELECT latency_ms FROM api_requests
		WHERE created_at > ? AND provider = COALESCE(NULLIF(?, ''), provider)
		ORDER BY latency_ms
		LIMIT 1 OFFSET ?
	`
	var val int64
	err := db.QueryRowContext(ctx, query, since, provider, offset).Scan(&val)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("query p%d latency: %w", pct, err)
	}
	return val, nil
}

// getReliabilityFunnel queries the issues, sessions, and session_git_metrics
// tables to build a dispatch-to-merge funnel. Returns nil if the required
// tables do not exist.
func (db *DB) getReliabilityFunnel(ctx context.Context, since int64) (*ReliabilityFunnel, error) {
	f := &ReliabilityFunnel{}

	// The core schema stores created_at as DATETIME text; convert for comparison.
	// The status column on sessions is added by agent #90 migration and may not
	// exist yet — use a safe fallback that counts all sessions as started but
	// only counts completed if the column is present.
	hasStatus, _ := columnExists(db.DB, "sessions", "status")

	var funnelQuery string
	if hasStatus {
		funnelQuery = `
			SELECT
				COUNT(*) as dispatched,
				COUNT(CASE WHEN EXISTS(SELECT 1 FROM sessions s WHERE s.issue_id = i.id) THEN 1 END) as started,
				COUNT(CASE WHEN EXISTS(SELECT 1 FROM sessions s WHERE s.issue_id = i.id AND s.status = 'completed') THEN 1 END) as completed
			FROM issues i
			WHERE CAST(strftime('%s', i.created_at) AS INTEGER) > ?
		`
	} else {
		funnelQuery = `
			SELECT
				COUNT(*) as dispatched,
				COUNT(CASE WHEN EXISTS(SELECT 1 FROM sessions s WHERE s.issue_id = i.id) THEN 1 END) as started,
				0 as completed
			FROM issues i
			WHERE CAST(strftime('%s', i.created_at) AS INTEGER) > ?
		`
	}
	err := db.QueryRowContext(ctx, funnelQuery, since).Scan(&f.Dispatched, &f.Started, &f.Completed)
	if err != nil {
		return nil, fmt.Errorf("query reliability funnel: %w", err)
	}

	// PR metrics from session_git_metrics (may not exist yet).
	prQuery := `
		SELECT
			COUNT(CASE WHEN sgm.pr_url IS NOT NULL AND sgm.pr_url != '' THEN 1 END),
			COUNT(CASE WHEN sgm.pr_merged = 1 THEN 1 END)
		FROM session_git_metrics sgm
		JOIN sessions s ON s.id = sgm.session_id
		JOIN issues i ON i.id = s.issue_id
		WHERE CAST(strftime('%s', i.created_at) AS INTEGER) > ?
	`
	err = db.QueryRowContext(ctx, prQuery, since).Scan(&f.PRCreated, &f.PRMerged)
	if err != nil {
		// session_git_metrics might not exist yet — that's OK.
		f.PRCreated = 0
		f.PRMerged = 0
	}

	return f, nil
}

// classifyProviderStatus determines health status based on error rate and recency.
func classifyProviderStatus(errorRate float64, lastSeenUnix, nowUnix int64) string {
	tenMinutes := int64(600)
	if nowUnix-lastSeenUnix > tenMinutes {
		return "down"
	}
	if errorRate >= 0.20 {
		return "down"
	}
	if errorRate >= 0.05 {
		return "degraded"
	}
	return "healthy"
}

// nullableString converts an empty string to a sql.NullString with Valid=false.
func nullableString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}
