/** Connection credentials for the orchestrator backend API. */
export type BackendConfig = {
  /** Base URL of the orchestrator HTTP server (e.g. "http://127.0.0.1:4010"). */
  baseUrl: string
  /** Bearer token used to authenticate API requests. */
  apiToken: string
}

/** A named backend connection profile persisted by the desktop bridge. */
export type BackendProfile = {
  /** Unique identifier for this profile. */
  id: string
  /** Human-readable profile name. */
  name: string
  /** Base URL of the orchestrator HTTP server. */
  baseUrl: string
  /** Bearer token for authentication. */
  apiToken: string
}

/** Payload returned by the desktop bridge containing all saved backend profiles. */
export type BridgeProfilesPayload = {
  /** ID of the currently active profile. */
  activeProfileId: string
  /** All available backend profiles. */
  profiles: BackendProfile[]
}

/** Aggregate counts included in a runtime snapshot. */
export type SnapshotCounts = {
  /** Number of issues currently being executed by agents. */
  running: number
  /** Number of issues waiting for a retry attempt. */
  retrying: number
}

/** An issue that is actively being worked on by an agent. */
export type RunningEntry = {
  /** Internal UUID of the issue. */
  issue_id: string
  /** Human-readable issue identifier (e.g. "ORK-42"). */
  issue_identifier: string
  /** Current lifecycle state (typically "RUNNING"). */
  state: string
  /** Active agent session ID, if available. */
  session_id?: string
  /** Number of agent conversation turns completed so far. */
  turn_count?: number
  /** Kind of the most recent event (e.g. "tool_call"). */
  last_event?: string
  /** Text of the most recent agent message. */
  last_message?: string
  /** ISO-8601 timestamp of the most recent event. */
  last_event_at?: string
  /** ISO-8601 timestamp when the run started. */
  started_at?: string
  /** Provider executing this run. */
  provider?: string
  /** Issue title. */
  title?: string
  /** Issue description body. */
  description?: string
  /** ID of the assignee agent. */
  assignee_id?: string
  /** ID of the project this issue belongs to. */
  project_id?: string
  /** Filesystem path to the session log file. */
  session_log_path?: string
  /** Tool names disabled for this run. */
  disabled_tools?: string[]
  /** Token usage counters for this run. */
  tokens?: { input_tokens: number; output_tokens: number; total_tokens: number }
}

export type RetryEntry = {
  issue_id: string
  issue_identifier: string
  state: string
  attempt: number
  due_at: string
  error: string
  provider?: string
}

export type CodexTotals = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  seconds_running: number
}

export type SnapshotPayload = {
  generated_at: string
  counts: SnapshotCounts
  running: RunningEntry[]
  retrying: RetryEntry[]
  codex_totals: CodexTotals
  rate_limits: Record<string, unknown> | null
  mcp_servers?: Record<string, string>
}

export type EventEnvelope = {
  type: string
  timestamp: string
  data: Record<string, unknown>
}

export type APIErrorEnvelope = {
  error: {
    code: string
    message: string
  }
}

export type IssueDetailPayload = {
  issue_identifier: string
  issue_id: string
  status: string
  attempts: {
    restart_count: number
    current_retry_attempt: number
  }
  workspace: {
    path: string
  }
  running: RunningEntry | null
  retry: RetryEntry | null
  logs: { codex_session_logs: Array<{ label: string; path: string; url?: string }> }
  recent_events: Array<Record<string, unknown>>
  last_error: string | null
  tracked: Record<string, unknown>
}

export type Project = {
  id: string
  name: string
  root_path: string
  remote_url: string
  github_owner?: string
  github_repo?: string
  github_token?: string
  path_exists?: boolean
}

export type ProjectStats = {
  total_sessions: number
  total_input: number
  total_output: number
  success_count?: number
  failure_count?: number
  last_active: string
}

export type GlobalStats = {
  total_tokens: number
  total_input: number
  total_output: number
  provider_usage: Record<string, number>
  model_usage: Record<string, number>
  recent_sessions: SessionSummary[]
}

export type SessionSummary = {
  id: string
  source?: string
  provider?: string
  model?: string
  project_id?: string
  project_name?: string
  total_input: number
  total_output: number
  updated_at: string
  [key: string]: unknown
}

export type AgentConfig = {
  name: string
  content: string
  path: string
  category: 'CORE' | 'SKILL'
  scope: 'GLOBAL' | 'PROJECT'
}

export type DocItem = {
  name: string
  path: string
  category: string
  is_folder: boolean
  children?: DocItem[]
}

export type SessionEvent = {
  kind: string
  timestamp: string
  message: string
  input_tokens?: number
  output_tokens?: number
  raw_payload?: string
  [key: string]: unknown
}

export type SessionDetail = {
  id: string
  provider: string
  project_name?: string
  created_at: string
  total_input: number
  total_output: number
  events?: SessionEvent[]
  [key: string]: unknown
}

export type Blocker = {
  id: string
  identifier?: string
  state?: string
}

export type Issue = {
  id: string
  identifier: string
  title: string
  description?: string
  priority?: number
  state: string
  branch_name?: string
  url?: string
  project_id?: string
  assignee_id?: string
  assigned_to_worker: boolean
  labels?: string[]
  blocked_by?: Blocker[]
  provider?: string
  disabled_tools?: string[]
  created_at?: string
  updated_at?: string
}
