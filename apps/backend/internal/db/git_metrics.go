package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// SessionGitMetrics holds git-related metrics for a single session.
type SessionGitMetrics struct {
	SessionID    string `json:"session_id"`
	LinesAdded   int    `json:"lines_added"`
	LinesRemoved int    `json:"lines_removed"`
	FilesChanged int    `json:"files_changed"`
	TestFiles    int    `json:"test_files"`
	Commits      int    `json:"commits"`
	Hunks        int    `json:"hunks"`
	PRUrl        string `json:"pr_url,omitempty"`
	PRMerged     bool   `json:"pr_merged"`
	CIPassed     int    `json:"ci_passed"` // -1=unknown, 0=failed, 1=passed
	CreatedAt    string `json:"created_at"`
}

// ProductivityMetrics holds aggregated git productivity data.
type ProductivityMetrics struct {
	TotalLinesAdded    int64               `json:"total_lines_added"`
	TotalLinesRemoved  int64               `json:"total_lines_removed"`
	TotalFilesChanged  int64               `json:"total_files_changed"`
	TotalCommits       int64               `json:"total_commits"`
	TotalTestFiles     int64               `json:"total_test_files"`
	AvgLinesPerSession float64             `json:"avg_lines_per_session"`
	AgentComparison    []AgentProductivity `json:"agent_comparison"`
}

// AgentProductivity holds per-provider productivity metrics for agent comparison.
type AgentProductivity struct {
	Provider        string  `json:"provider"`
	SessionCount    int64   `json:"session_count"`
	AvgLinesAdded   float64 `json:"avg_lines_added"`
	AvgFilesChanged float64 `json:"avg_files_changed"`
	AvgDuration     float64 `json:"avg_duration_seconds"`
	AvgCostCents    float64 `json:"avg_cost_cents"`
	CompletionRate  float64 `json:"completion_rate"`
	CostPerLine     float64 `json:"cost_per_line"`
}

// InsertSessionGitMetrics inserts or replaces git metrics for a session.
func (db *DB) InsertSessionGitMetrics(ctx context.Context, m SessionGitMetrics) error {
	if m.CreatedAt == "" {
		m.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	prMerged := 0
	if m.PRMerged {
		prMerged = 1
	}

	query := `
		INSERT OR REPLACE INTO session_git_metrics
			(session_id, lines_added, lines_removed, files_changed, test_files,
			 commits, hunks, pr_url, pr_merged, ci_passed, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := db.ExecContext(ctx, query,
		m.SessionID, m.LinesAdded, m.LinesRemoved, m.FilesChanged, m.TestFiles,
		m.Commits, m.Hunks, m.PRUrl, prMerged, m.CIPassed, m.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert session git metrics: %w", err)
	}
	return nil
}

// GetSessionGitMetrics returns all session git metrics created after `since`.
func (db *DB) GetSessionGitMetrics(ctx context.Context, since string) ([]SessionGitMetrics, error) {
	query := `
		SELECT session_id, lines_added, lines_removed, files_changed, test_files,
		       commits, hunks, COALESCE(pr_url, ''), pr_merged, ci_passed, created_at
		FROM session_git_metrics
		WHERE created_at > ?
		ORDER BY created_at DESC
	`
	rows, err := db.QueryContext(ctx, query, since)
	if err != nil {
		return nil, fmt.Errorf("query session git metrics: %w", err)
	}
	defer rows.Close()

	var results []SessionGitMetrics
	for rows.Next() {
		var m SessionGitMetrics
		var prMerged int
		if err := rows.Scan(&m.SessionID, &m.LinesAdded, &m.LinesRemoved,
			&m.FilesChanged, &m.TestFiles, &m.Commits, &m.Hunks,
			&m.PRUrl, &prMerged, &m.CIPassed, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan session git metrics: %w", err)
		}
		m.PRMerged = prMerged != 0
		results = append(results, m)
	}
	return results, rows.Err()
}

// GetProductivityMetrics returns aggregated productivity data since a given
// time, optionally filtered by provider. It includes per-agent comparison
// by joining with the sessions table.
func (db *DB) GetProductivityMetrics(ctx context.Context, since string, provider string) (*ProductivityMetrics, error) {
	// Aggregated totals from session_git_metrics
	totalsQuery := `
		SELECT COALESCE(SUM(lines_added), 0),
		       COALESCE(SUM(lines_removed), 0),
		       COALESCE(SUM(files_changed), 0),
		       COALESCE(SUM(commits), 0),
		       COALESCE(SUM(test_files), 0),
		       COUNT(*),
		       CASE WHEN COUNT(*) > 0
		            THEN CAST(SUM(lines_added) AS REAL) / COUNT(*)
		            ELSE 0 END
		FROM session_git_metrics g
		LEFT JOIN sessions s ON g.session_id = s.id
		WHERE g.created_at > ?
	`
	args := []any{since}
	if provider != "" {
		totalsQuery += " AND s.provider = ?"
		args = append(args, provider)
	}

	pm := &ProductivityMetrics{}
	var sessionCount int64
	err := db.QueryRowContext(ctx, totalsQuery, args...).Scan(
		&pm.TotalLinesAdded, &pm.TotalLinesRemoved, &pm.TotalFilesChanged,
		&pm.TotalCommits, &pm.TotalTestFiles, &sessionCount, &pm.AvgLinesPerSession,
	)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("query productivity totals: %w", err)
	}

	// Per-agent comparison
	compQuery := `
		SELECT
			s.provider,
			COUNT(DISTINCT s.id) as session_count,
			AVG(g.lines_added) as avg_lines_added,
			AVG(g.files_changed) as avg_files_changed,
			COALESCE(AVG(s.duration_seconds), 0) as avg_duration,
			COALESCE(AVG(s.cost_cents), 0) as avg_cost,
			CASE WHEN COUNT(*) > 0
			     THEN CAST(SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
			     ELSE 0 END as completion_rate,
			CASE WHEN SUM(g.lines_added) > 0
			     THEN CAST(COALESCE(SUM(s.cost_cents), 0) AS REAL) / SUM(g.lines_added)
			     ELSE 0 END as cost_per_line
		FROM sessions s
		LEFT JOIN session_git_metrics g ON s.id = g.session_id
		WHERE g.created_at > ?
		GROUP BY s.provider
	`
	compArgs := []any{since}
	if provider != "" {
		compQuery = `
			SELECT
				s.provider,
				COUNT(DISTINCT s.id) as session_count,
				AVG(g.lines_added) as avg_lines_added,
				AVG(g.files_changed) as avg_files_changed,
				COALESCE(AVG(s.duration_seconds), 0) as avg_duration,
				COALESCE(AVG(s.cost_cents), 0) as avg_cost,
				CASE WHEN COUNT(*) > 0
				     THEN CAST(SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
				     ELSE 0 END as completion_rate,
				CASE WHEN SUM(g.lines_added) > 0
				     THEN CAST(COALESCE(SUM(s.cost_cents), 0) AS REAL) / SUM(g.lines_added)
				     ELSE 0 END as cost_per_line
			FROM sessions s
			LEFT JOIN session_git_metrics g ON s.id = g.session_id
			WHERE g.created_at > ? AND s.provider = ?
			GROUP BY s.provider
		`
		compArgs = append(compArgs, provider)
	}

	rows, err := db.QueryContext(ctx, compQuery, compArgs...)
	if err != nil {
		return nil, fmt.Errorf("query agent comparison: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var ap AgentProductivity
		var avgLines, avgFiles, avgDuration, avgCost, completionRate, costPerLine sql.NullFloat64
		if err := rows.Scan(&ap.Provider, &ap.SessionCount,
			&avgLines, &avgFiles, &avgDuration, &avgCost,
			&completionRate, &costPerLine); err != nil {
			return nil, fmt.Errorf("scan agent comparison: %w", err)
		}
		ap.AvgLinesAdded = avgLines.Float64
		ap.AvgFilesChanged = avgFiles.Float64
		ap.AvgDuration = avgDuration.Float64
		ap.AvgCostCents = avgCost.Float64
		ap.CompletionRate = completionRate.Float64
		ap.CostPerLine = costPerLine.Float64
		pm.AgentComparison = append(pm.AgentComparison, ap)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate agent comparison rows: %w", err)
	}

	return pm, nil
}
