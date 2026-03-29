// Package tracker defines the interface and types for issue tracking backends.
package tracker

import "context"

// Issue represents a tracked work item with metadata such as state, priority,
// assignee, and blocking relationships.
type Issue struct {
	ID               string    `json:"id"`
	Identifier       string    `json:"identifier"`
	Title            string    `json:"title"`
	Description      string    `json:"description,omitempty"`
	Priority         int       `json:"priority,omitempty"`
	State            string    `json:"state"`
	BranchName       string    `json:"branch_name,omitempty"`
	URL              string    `json:"url,omitempty"`
	ProjectID        string    `json:"project_id,omitempty"`
	AssigneeID       string    `json:"assignee_id,omitempty"`
	AssignedToWorker bool      `json:"assigned_to_worker"`
	Labels           []string  `json:"labels,omitempty"`
	BlockedBy        []Blocker `json:"blocked_by,omitempty"`
	CreatedAt        string    `json:"created_at,omitempty"`
	UpdatedAt        string    `json:"updated_at,omitempty"`
	Provider         string    `json:"provider,omitempty"`
	DisabledTools    []string  `json:"disabled_tools,omitempty"`
	BaseSHA          string    `json:"base_sha,omitempty"`
	Feedback         string    `json:"feedback,omitempty"`
	PRURL            string    `json:"pr_url,omitempty"`
	Plan             string    `json:"plan,omitempty"`
}

// Blocker represents an issue that blocks another issue from progressing.
type Blocker struct {
	ID         string `json:"id"`
	Identifier string `json:"identifier,omitempty"`
	State      string `json:"state,omitempty"`
}

// IssueFilter specifies criteria for filtering issues by state, project, or assignee.
type IssueFilter struct {
	States     []string
	ProjectID  string
	AssigneeID string
}

// Client defines the interface for issue tracker operations including
// fetching, creating, updating, and deleting issues.
type Client interface {
	// FetchCandidateIssues returns issues whose state matches one of the given active states.
	FetchCandidateIssues(ctx context.Context, activeStates []string) ([]Issue, error)
	// FetchIssuesByIDs returns issues matching the given IDs.
	FetchIssuesByIDs(ctx context.Context, issueIDs []string) ([]Issue, error)
	// FetchIssuesByStates returns issues filtered by the given states.
	FetchIssuesByStates(ctx context.Context, states []string) ([]Issue, error)
	// FetchIssueStatesByIDs returns a map of issue ID to current state for the given IDs.
	FetchIssueStatesByIDs(ctx context.Context, issueIDs []string) (map[string]string, error)
	// FetchIssues returns issues matching the given filter criteria.
	FetchIssues(ctx context.Context, filter IssueFilter) ([]Issue, error)
	// SearchIssues performs a text search across issues and returns matches.
	SearchIssues(ctx context.Context, query string) ([]Issue, error)
	// FetchIssueByIdentifier returns a single issue by its identifier or ID.
	FetchIssueByIdentifier(ctx context.Context, identifier string) (*Issue, error)
	// CreateIssue creates a new issue with the given attributes and returns it.
	CreateIssue(ctx context.Context, title, description, state string, priority int, assigneeID, projectID string, provider string, disabledTools []string) (*Issue, error)
	// UpdateIssue applies the given field updates to the issue identified by its identifier.
	UpdateIssue(ctx context.Context, identifier string, updates map[string]any) (*Issue, error)
	// DeleteIssue removes the issue identified by the given identifier.
	DeleteIssue(ctx context.Context, identifier string) error
}
