package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Budget represents a spend limit scoped by project, provider, and time period.
type Budget struct {
	ID         string `json:"id"`
	ProjectID  string `json:"project_id,omitempty"`
	Provider   string `json:"provider,omitempty"`
	Period     string `json:"period"` // daily, weekly, monthly
	LimitCents int64  `json:"limit_cents"`
	AlertPct   int    `json:"alert_pct"`
	CreatedAt  string `json:"created_at"`
}

// CreateBudget inserts a new budget record. If ID is empty, a UUID is generated.
func (db *DB) CreateBudget(ctx context.Context, b Budget) (Budget, error) {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	if b.Period == "" {
		return Budget{}, fmt.Errorf("period is required")
	}
	if b.LimitCents <= 0 {
		return Budget{}, fmt.Errorf("limit_cents must be positive")
	}
	if b.AlertPct <= 0 {
		b.AlertPct = 80
	}
	if b.CreatedAt == "" {
		b.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	query := `INSERT INTO budgets (id, project_id, provider, period, limit_cents, alert_pct, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := db.ExecContext(ctx, query, b.ID, nilIfEmpty(b.ProjectID), nilIfEmpty(b.Provider), b.Period, b.LimitCents, b.AlertPct, b.CreatedAt)
	if err != nil {
		return Budget{}, fmt.Errorf("create budget: %w", err)
	}
	return b, nil
}

// ListBudgets returns all budgets ordered by creation time descending.
func (db *DB) ListBudgets(ctx context.Context) ([]Budget, error) {
	query := `SELECT id, COALESCE(project_id, ''), COALESCE(provider, ''), period, limit_cents, alert_pct, created_at
		FROM budgets ORDER BY created_at DESC`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list budgets: %w", err)
	}
	defer rows.Close()

	var budgets []Budget
	for rows.Next() {
		var b Budget
		if err := rows.Scan(&b.ID, &b.ProjectID, &b.Provider, &b.Period, &b.LimitCents, &b.AlertPct, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan budget: %w", err)
		}
		budgets = append(budgets, b)
	}
	return budgets, rows.Err()
}

// DeleteBudget removes a budget by ID. Returns sql.ErrNoRows if not found.
func (db *DB) DeleteBudget(ctx context.Context, id string) error {
	if id == "" {
		return fmt.Errorf("budget id is required")
	}
	result, err := db.ExecContext(ctx, "DELETE FROM budgets WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete budget: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetBudgetUtilization calculates the amount spent in the current period for a
// budget by querying the daily_metrics table. Returns spent cents, limit cents, and error.
func (db *DB) GetBudgetUtilization(ctx context.Context, budgetID string) (spent int64, limit int64, err error) {
	var b Budget
	err = db.QueryRowContext(ctx,
		`SELECT id, COALESCE(project_id, ''), COALESCE(provider, ''), period, limit_cents, alert_pct, created_at FROM budgets WHERE id = ?`,
		budgetID,
	).Scan(&b.ID, &b.ProjectID, &b.Provider, &b.Period, &b.LimitCents, &b.AlertPct, &b.CreatedAt)
	if err != nil {
		return 0, 0, fmt.Errorf("get budget: %w", err)
	}

	limit = b.LimitCents

	// Calculate period start date
	now := time.Now().UTC()
	var since string
	switch b.Period {
	case "daily":
		since = now.Format("2006-01-02")
	case "weekly":
		// Start of current week (Monday)
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7 // Sunday = 7
		}
		monday := now.AddDate(0, 0, -(weekday - 1))
		since = monday.Format("2006-01-02")
	case "monthly":
		since = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	default:
		since = now.AddDate(0, -1, 0).Format("2006-01-02")
	}

	// Query daily_metrics for the current period
	query := `SELECT COALESCE(SUM(cost_cents), 0) FROM daily_metrics WHERE date >= ?`
	args := []any{since}

	if b.ProjectID != "" {
		query += " AND project_id = ?"
		args = append(args, b.ProjectID)
	}
	if b.Provider != "" {
		query += " AND provider = ?"
		args = append(args, b.Provider)
	}

	err = db.QueryRowContext(ctx, query, args...).Scan(&spent)
	if err != nil {
		return 0, limit, fmt.Errorf("query budget utilization: %w", err)
	}

	return spent, limit, nil
}

// nilIfEmpty returns nil for empty strings, or a pointer to the string otherwise.
func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
