package studio

import (
	"context"

	"github.com/orchestra/orchestra/apps/backend/internal/tracker"
)

// orchestratorTracker is the subset of *orchestrator.Service the studio adapter needs.
// Declared as an interface so this package does not import the orchestrator package
// (which would create an import cycle once the orchestrator depends on studio types).
type orchestratorTracker interface {
	CreateIssue(ctx context.Context, title, description, state string, priority int, assigneeID, projectID, provider, runtimeTarget string, disabledTools []string) (*tracker.Issue, error)
	UpdateIssue(ctx context.Context, identifier string, updates map[string]any) (*tracker.Issue, error)
}

// OrchestratorTrackerAdapter wraps an orchestrator service so it satisfies studio.Tracker.
// The orchestrator's CreateIssue carries an extra runtimeTarget parameter that the studio
// Tracker interface does not expose; the adapter passes an empty string for it.
type OrchestratorTrackerAdapter struct {
	svc orchestratorTracker
}

// NewOrchestratorTrackerAdapter constructs an adapter for the given orchestrator service.
func NewOrchestratorTrackerAdapter(svc orchestratorTracker) *OrchestratorTrackerAdapter {
	return &OrchestratorTrackerAdapter{svc: svc}
}

// CreateIssue implements studio.Tracker by delegating to the orchestrator with an empty
// runtimeTarget (Phase 1 studio pushes never specify a runtime target).
func (a *OrchestratorTrackerAdapter) CreateIssue(ctx context.Context, title, description, state string, priority int, assigneeID, projectID, provider string, disabledTools []string) (*tracker.Issue, error) {
	return a.svc.CreateIssue(ctx, title, description, state, priority, assigneeID, projectID, provider, "", disabledTools)
}

// UpdateIssue implements studio.Tracker by delegating directly to the orchestrator.
func (a *OrchestratorTrackerAdapter) UpdateIssue(ctx context.Context, identifier string, updates map[string]any) (*tracker.Issue, error) {
	return a.svc.UpdateIssue(ctx, identifier, updates)
}
