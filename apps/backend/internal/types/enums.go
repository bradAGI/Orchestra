package types

import "strings"

// IssueStatus represents the computed runtime status of an issue.
type IssueStatus string

const (
	IssueStatusRunning  IssueStatus = "RUNNING"
	IssueStatusRetrying IssueStatus = "RETRYING"
	IssueStatusTracked  IssueStatus = "TRACKED"
	IssueStatusIdle     IssueStatus = "IDLE"
)

// AgentCategory represents the type of agent configuration.
type AgentCategory string

const (
	CategoryCore  AgentCategory = "CORE"
	CategorySkill AgentCategory = "SKILL"
)

// SSEEventType represents server-sent event types.
type SSEEventType string

const (
	SSERunEvent       SSEEventType = "RUN_EVENT"
	SSERunStarted     SSEEventType = "RUN_STARTED"
	SSERunFailed      SSEEventType = "RUN_FAILED"
	SSERunContinues   SSEEventType = "RUN_CONTINUES"
	SSERunSucceeded   SSEEventType = "RUN_SUCCEEDED"
	SSERetryScheduled SSEEventType = "RETRY_SCHEDULED"
	SSEHookStarted    SSEEventType = "HOOK_STARTED"
	SSEHookCompleted  SSEEventType = "HOOK_COMPLETED"
	SSEHookFailed     SSEEventType = "HOOK_FAILED"
)

// NormalizeSSEEventType normalizes an SSE event type string to UPPERCASE
// for backward compatibility with clients sending lowercase values.
func NormalizeSSEEventType(s string) SSEEventType {
	return SSEEventType(strings.ToUpper(s))
}
