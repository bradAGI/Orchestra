import type { APIErrorEnvelope, EventEnvelope, GlobalStats, IssueDetailPayload, Project, ProjectStats, SnapshotPayload, AgentConfig, DocItem, Issue, SessionDetail, SessionSummary } from '@/lib/orchestra-types'

export type BackendConfig = {
  baseUrl: string
  apiToken: string
  mcpServers?: Record<string, string>
}

export type MCPTool = {
  name: string
  [key: string]: unknown
}

export type MCPServer = {
  id?: string
  name: string
  command: string
  [key: string]: unknown
}

export type IssueListItem = Partial<Issue> & {
  id?: string
  issue_id?: string
  identifier?: string
  issue_identifier?: string
  state: string
  title?: string
  assigned_to_worker?: boolean
  due_at?: string
  error?: string
  last_message?: string
  session_id?: string
  [key: string]: unknown
}

export type IssueHistoryEntry = {
  id?: string
  kind: string
  message?: string
  timestamp: string
  provider?: string
  input_tokens?: number
  output_tokens?: number
  [key: string]: unknown
}

export type ProjectTreeNode = {
  name: string
  path: string
  is_dir: boolean
  children?: ProjectTreeNode[]
  [key: string]: unknown
}

export type GitCommit = {
  hash?: string
  message: string
  author?: string
  date: string
  [key: string]: unknown
}

export type GitStatusEntry = {
  path: string
  status: string
  [key: string]: unknown
}

export type WorkspaceMigrationResult = Record<string, unknown>

export type RefreshResult = Record<string, unknown>

export type IssueUpdatePayload = {
  state?: string
  assignee_id?: string
  provider?: string
  title?: string
  description?: string
  project_id?: string
  disabled_tools?: string[]
  [key: string]: unknown
}

export type IssueCreatePayload = {
  title: string
  description: string
  state: string
  assignee_id: string
  project_id: string
  provider?: string
  disabled_tools?: string[]
}

export type GitHubPRResult = {
  url: string
  number: number
  [key: string]: unknown
}

export type STTHealth = {
  ready: boolean
  binary?: string
  model?: string
  language?: string
  reason?: string
}

export type STTTranscriptionResult = {
  text: string
  elapsed_ms?: number
  language?: string
}

class APIError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof APIError) {
    return error.code === 'unauthorized'
  }
  if (error instanceof Error) {
    return /^unauthorized:/.test(error.message.trim().toLowerCase())
  }
  if (typeof error === 'string') {
    return /^unauthorized:/.test(error.trim().toLowerCase())
  }
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeSnapshotPayload(value: unknown): SnapshotPayload {
  const root = isRecord(value) ? value : {}
  const counts = isRecord(root.counts) ? root.counts : {}
  const totals = isRecord(root.codex_totals) ? root.codex_totals : {}
  const rateLimits = isRecord(root.rate_limits) ? root.rate_limits : null

  const running = Array.isArray(root.running)
    ? root.running
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({
        issue_id: asString(entry.issue_id),
        issue_identifier: asString(entry.issue_identifier),
        state: asString(entry.state),
        session_id: asString(entry.session_id, ''),
        turn_count: asNumber(entry.turn_count, 0),
        last_event: asString(entry.last_event, ''),
        last_message: asString(entry.last_message, ''),
        last_event_at: asString(entry.last_event_at, ''),
        started_at: asString(entry.started_at, ''),
      }))
    : []

  const retrying = Array.isArray(root.retrying)
    ? root.retrying
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({
        issue_id: asString(entry.issue_id),
        issue_identifier: asString(entry.issue_identifier),
        state: asString(entry.state),
        attempt: asNumber(entry.attempt, 0),
        due_at: asString(entry.due_at),
        error: asString(entry.error),
      }))
    : []

  return {
    generated_at: asString(root.generated_at, new Date().toISOString()),
    counts: {
      running: asNumber(counts.running, 0),
      retrying: asNumber(counts.retrying, 0),
    },
    running,
    retrying,
    codex_totals: {
      input_tokens: asNumber(totals.input_tokens, 0),
      output_tokens: asNumber(totals.output_tokens, 0),
      total_tokens: asNumber(totals.total_tokens, 0),
      seconds_run: asNumber(totals.seconds_run, 0),
    },
    rate_limits: rateLimits,
    mcp_servers: isRecord(root.mcp_servers) ? (root.mcp_servers as Record<string, string>) : undefined,
  }
}

export function normalizeEventEnvelope(value: unknown, fallbackType = 'event'): EventEnvelope {
  const root = isRecord(value) ? value : {}
  return {
    type: asString(root.type, fallbackType),
    timestamp: asString(root.timestamp, new Date().toISOString()),
    data: isRecord(root.data) ? root.data : {},
  }
}

function buildHeaders(config: BackendConfig): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (config.apiToken.trim() !== '') {
    headers.Authorization = `Bearer ${config.apiToken.trim()}`
  }
  return headers
}

async function requestJSON<T>(config: BackendConfig, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(new URL(path, config.baseUrl).toString(), {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        ...buildHeaders(config),
        ...(init?.headers ?? {}),
      },
    })

    if (!response.ok) {
      let parsed: APIErrorEnvelope | null = null
      try {
        parsed = (await response.json()) as APIErrorEnvelope
      } catch {
        parsed = null
      }
      if (parsed?.error?.code && parsed?.error?.message) {
        throw new APIError(parsed.error.code, parsed.error.message)
      }
      throw new APIError('request_failed', `${response.status} ${response.statusText}`)
    }

    // Handle cases where response might be empty (204 No Content) or other non-JSON but successful responses
    if (response.status === 204) {
      return {} as T
    }

    const text = await response.text()
    if (!text) {
      return {} as T
    }

    return JSON.parse(text) as T
  } finally {
    clearTimeout(timeout)
  }
}

export async function updateIssue(
  config: BackendConfig,
  issueIdentifier: string,
  updates: IssueUpdatePayload,
): Promise<IssueListItem> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  return requestJSON<IssueListItem>(config, `/api/v1/issues/${encodeURIComponent(normalized)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })
}

export async function deleteIssue(config: BackendConfig, issueIdentifier: string): Promise<void> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  await requestJSON<void>(config, `/api/v1/issues/${encodeURIComponent(normalized)}`, {
    method: 'DELETE',
  })
}

export async function stopIssueSession(config: BackendConfig, issueIdentifier: string, provider?: string): Promise<void> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  let path = `/api/v1/issues/${encodeURIComponent(normalized)}/session`
  if (provider) {
    path += `?provider=${encodeURIComponent(provider)}`
  }
  await requestJSON<void>(config, path, {
    method: 'DELETE',
  })
}

export async function fetchState(config: BackendConfig): Promise<SnapshotPayload> {
  const payload = await requestJSON<unknown>(config, '/api/v1/state')
  return normalizeSnapshotPayload(payload)
}

export async function fetchIssues(config: BackendConfig, states?: string[], projectID?: string, assigneeID?: string): Promise<IssueListItem[]> {
  const params = new URLSearchParams()
  if (states && states.length > 0) params.set('states', states.join(','))
  if (projectID) params.set('project_id', projectID)
  if (assigneeID) params.set('assignee_id', assigneeID)
  const payload = await requestJSON<{ issues: IssueListItem[] }>(config, `/api/v1/issues?${params.toString()}`)
  return payload.issues || []
}

export async function createIssue(
  config: BackendConfig,
  payload: IssueCreatePayload,
): Promise<IssueListItem> {
  return requestJSON<IssueListItem>(config, '/api/v1/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function searchIssues(config: BackendConfig, query: string): Promise<IssueListItem[]> {
  const params = new URLSearchParams({ q: query })
  const payload = await requestJSON<{ issues: IssueListItem[] }>(config, `/api/v1/search?${params.toString()}`)
  return payload.issues || []
}

export async function fetchAgents(config: BackendConfig): Promise<string[]> {
  const payload = await requestJSON<{ agents: string[] }>(config, '/api/v1/agents')
  return payload.agents || []
}

export async function fetchAgentConfig(config: BackendConfig): Promise<{ commands: Record<string, string>; agent_provider: string }> {
  return requestJSON<{ commands: Record<string, string>; agent_provider: string }>(config, '/api/v1/config/agents')
}

export async function postRefresh(config: BackendConfig): Promise<RefreshResult> {
  return requestJSON<RefreshResult>(config, '/api/v1/refresh', {
    method: 'POST',
  })
}

export async function fetchWorkspaceMigrationPlan(
  config: BackendConfig,
  from: string,
  to: string,
): Promise<WorkspaceMigrationResult> {
  const query = new URLSearchParams()
  if (from.trim() !== '') query.set('from', from.trim())
  if (to.trim() !== '') query.set('to', to.trim())
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return requestJSON<WorkspaceMigrationResult>(config, `/api/v1/workspace/migration/plan${suffix}`)
}

export async function applyWorkspaceMigration(
  config: BackendConfig,
  from: string,
  to: string,
): Promise<WorkspaceMigrationResult> {
  return requestJSON<WorkspaceMigrationResult>(config, '/api/v1/workspace/migrate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from.trim(),
      to: to.trim(),
      dry_run: false,
    }),
  })
}

export async function fetchProjects(config: BackendConfig): Promise<Project[]> {
  const data = await requestJSON<Project[]>(config, '/api/v1/projects')
  return data || []
}

export async function fetchProjectStats(config: BackendConfig, projectID: string): Promise<ProjectStats> {
  return requestJSON<ProjectStats>(config, `/api/v1/projects/${encodeURIComponent(projectID)}`)
}

export async function fetchWarehouseStats(config: BackendConfig): Promise<GlobalStats> {
  return requestJSON<GlobalStats>(config, '/api/v1/warehouse/stats')
}

export async function createProject(config: BackendConfig, rootPath: string): Promise<Project> {
  return requestJSON<Project>(config, '/api/v1/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root_path: rootPath }),
  })
}

export async function fetchIssueDetail(config: BackendConfig, issueIdentifier: string): Promise<IssueListItem> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  return requestJSON<IssueListItem>(config, `/api/v1/issues/${encodeURIComponent(normalized)}`)
}

export async function fetchIssueLogs(config: BackendConfig, issueIdentifier: string, provider?: string): Promise<string> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  const url = new URL(`/api/v1/issues/${encodeURIComponent(normalized)}/logs`, config.baseUrl)
  if (provider) url.searchParams.set('provider', provider)
  
  const response = await fetch(url.toString(), {
    headers: buildHeaders(config),
  })

  if (!response.ok) {
    throw new APIError('logs_not_found', 'failed to fetch issue logs')
  }

  return response.text()
}

export async function fetchIssueHistory(config: BackendConfig, issueIdentifier: string): Promise<IssueHistoryEntry[]> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  const data = await requestJSON<{ history: IssueHistoryEntry[] }>(config, `/api/v1/issues/${encodeURIComponent(normalized)}/history`)
  return data.history || []
}

export async function fetchIssueDiff(config: BackendConfig, issueIdentifier: string, provider?: string): Promise<string> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  const url = new URL(`/api/v1/issues/${encodeURIComponent(normalized)}/diff`, config.baseUrl)
  if (provider) url.searchParams.set('provider', provider)

  const response = await fetch(url.toString(), {
    headers: buildHeaders(config),
  })

  if (!response.ok) {
    throw new APIError('diff_failed', 'failed to fetch workspace diff')
  }

  return response.text()
}

export async function fetchArtifacts(config: BackendConfig, issueIdentifier: string, provider?: string): Promise<string[]> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  const url = new URL(`/api/v1/issues/${encodeURIComponent(normalized)}/artifacts`, config.baseUrl)
  if (provider) url.searchParams.set('provider', provider)

  const payload = await requestJSON<{ artifacts: string[] }>(config, url.pathname + url.search)
  return payload.artifacts || []
}

export async function fetchArtifactContent(config: BackendConfig, issueIdentifier: string, relPath: string, provider?: string): Promise<string> {
  const normalized = issueIdentifier.trim()
  if (normalized === '') {
    throw new APIError('invalid_request', 'issue identifier is required')
  }
  const url = new URL(`/api/v1/issues/${encodeURIComponent(normalized)}/artifacts/${relPath}`, config.baseUrl)
  if (provider) url.searchParams.set('provider', provider)

  const response = await fetch(url.toString(), {
    headers: buildHeaders(config),
  })

  if (!response.ok) {
    throw new APIError('fetch_failed', 'failed to fetch artifact content')
  }

  return response.text()
}

export function toDisplayError(error: unknown): string {
  if (error instanceof APIError) {
    return `${error.code}: ${error.message}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'unexpected error'
}

export async function fetchSessions(config: BackendConfig, projectId?: string): Promise<SessionSummary[]> {
  const url = projectId ? `/api/v1/sessions?project_id=${projectId}` : '/api/v1/sessions'
  const data = await requestJSON<SessionSummary[]>(config, url)
  return data || []
}

export async function deleteProject(config: BackendConfig, projectId: string): Promise<void> {
  return requestJSON<void>(config, `/api/v1/projects/${projectId}`, {
    method: 'DELETE',
  })
}

export async function refreshProject(config: BackendConfig, projectId: string): Promise<void> {
  return requestJSON<void>(config, `/api/v1/projects/${projectId}/refresh`, {
    method: 'POST',
  })
}

export async function fetchProjectTree(config: BackendConfig, projectId: string, path?: string): Promise<ProjectTreeNode[]> {
  const query = path ? `?path=${encodeURIComponent(path)}` : ''
  const data = await requestJSON<ProjectTreeNode[]>(config, `/api/v1/projects/${projectId}/tree${query}`)
  return data || []
}

export async function fetchProjectFileContent(config: BackendConfig, projectId: string, path: string): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/v1/projects/${projectId}/file?path=${encodeURIComponent(path)}`, {
    headers: buildHeaders(config),
  })
  if (!response.ok) {
    throw new Error(`failed to fetch project file content (${response.status} ${response.statusText})`)
  }
  return response.text()
}

export async function fetchProjectGitHistory(config: BackendConfig, projectId: string): Promise<GitCommit[]> {
  const data = await requestJSON<GitCommit[]>(config, `/api/v1/projects/${projectId}/git`)
  return data || []
}

export async function fetchProjectGitStatus(config: BackendConfig, projectId: string): Promise<GitStatusEntry[]> {
  const data = await requestJSON<GitStatusEntry[]>(config, `/api/v1/projects/${projectId}/git/status`)
  return data || []
}

export async function fetchProjectGitDiff(config: BackendConfig, projectId: string, hash?: string): Promise<string> {
  const query = hash ? `?hash=${encodeURIComponent(hash)}` : ''
  const response = await fetch(`${config.baseUrl}/api/v1/projects/${projectId}/git/diff${query}`, {
    headers: buildHeaders(config),
  })

  if (!response.ok) {
    throw new APIError('diff_failed', 'failed to fetch project git diff')
  }

  return response.text()
}

export async function fetchSessionDetail(config: BackendConfig, sessionId: string): Promise<SessionDetail> {
  return requestJSON<SessionDetail>(config, `/api/v1/sessions/${sessionId}`)
}

export async function gitCommit(config: BackendConfig, projectId: string, message: string): Promise<void> {
  await requestJSON<void>(config, `/api/v1/projects/${projectId}/git/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

export async function gitPush(config: BackendConfig, projectId: string, remote = 'origin', branch = 'main'): Promise<void> {
  await requestJSON<void>(config, `/api/v1/projects/${projectId}/git/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remote, branch }),
  })
}

export async function gitPull(config: BackendConfig, projectId: string, remote = 'origin', branch = 'main'): Promise<void> {
  await requestJSON<void>(config, `/api/v1/projects/${projectId}/git/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remote, branch }),
  })
}

export async function createGitHubPR(
  config: BackendConfig,
  issueIdentifier: string,
  payload: { title: string; body: string; head: string; base: string; owner?: string; repo?: string; token?: string }
): Promise<GitHubPRResult> {
  return requestJSON<GitHubPRResult>(config, `/api/v1/issues/${encodeURIComponent(issueIdentifier)}/pr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateAgentConfig(config: BackendConfig, payload: { commands: Record<string, string>, agent_provider: string }): Promise<void> {
  await requestJSON<void>(config, '/api/v1/config/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
export async function fetchAgentConfigs(config: BackendConfig, projectID?: string): Promise<AgentConfig[]> {
  const url = projectID ? `/api/v1/config/agents/items?project_id=${encodeURIComponent(projectID)}` : '/api/v1/config/agents/items'
  const data = await requestJSON<{ configs: AgentConfig[] }>(config, url)
  return data.configs || []
}

export async function updateAgentConfigByPath(config: BackendConfig, path: string, content: string): Promise<void> {
  await requestJSON<void>(config, '/api/v1/config/agents/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
}

export async function createAgentResource(config: BackendConfig, payload: { provider: string, type: string, name: string, scope: string, project_id?: string }): Promise<{ path: string }> {
  return requestJSON<{ path: string }>(config, '/api/v1/config/agents/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function fetchDocs(config: BackendConfig): Promise<DocItem[]> {
  const data = await requestJSON<{ docs: DocItem[] }>(config, '/api/v1/docs')
  return data.docs || []
}

export async function fetchDocContent(config: BackendConfig, path: string): Promise<string> {
  const response = await fetch(new URL(`/api/v1/docs/${path}`, config.baseUrl).toString(), {
    headers: buildHeaders(config),
  })
  if (!response.ok) {
    throw new Error(`failed to fetch doc content: ${response.statusText}`)
  }
  return response.text()
}

export async function fetchMCPTools(config: BackendConfig): Promise<MCPTool[]> {
  const data = await requestJSON<{ tools: MCPTool[] }>(config, '/api/v1/mcp/tools')
  return data.tools || []
}

export async function fetchMCPServers(config: BackendConfig): Promise<MCPServer[]> {
  const data = await requestJSON<{ servers: MCPServer[] }>(config, '/api/v1/mcp/servers')
  return data.servers || []
}

export async function createMCPServer(config: BackendConfig, name: string, command: string): Promise<MCPServer> {
  return requestJSON<MCPServer>(config, '/api/v1/mcp/servers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, command }),
  })
}

export async function deleteMCPServer(config: BackendConfig, id: string): Promise<void> {
  await requestJSON<void>(config, `/api/v1/mcp/servers/${id}`, {
    method: 'DELETE',
  })
}

export type GitHubIssue = {
  number: number
  title: string
  body: string
  state: string
  html_url: string
  labels: { name: string }[]
  created_at?: string
  updated_at?: string
  user?: { login: string; avatar_url: string }
}

export type GitHubPR = {
  number: number
  title: string
  body: string
  state: string
  html_url: string
  diff_url: string
  head: { ref: string; label: string }
  base: { ref: string; label: string }
  user: { login: string; avatar_url: string }
  created_at: string
  merged_at: string | null
}

export type GitBranches = {
  current: string
  branches: string[]
}

export async function fetchProjectGitHubIssues(config: BackendConfig, projectId: string, state: string = 'open'): Promise<GitHubIssue[]> {
  return requestJSON<GitHubIssue[]>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/issues?state=${state}`)
}

export async function fetchProjectGitBranches(config: BackendConfig, projectId: string): Promise<GitBranches> {
  return requestJSON<GitBranches>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/branches`)
}

export async function fetchProjectGitHubPulls(config: BackendConfig, projectId: string): Promise<GitHubPR[]> {
  return requestJSON<GitHubPR[]>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls`)
}

export async function fetchProjectGitHubPullDiff(config: BackendConfig, projectId: string, number: number): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${number}/diff`, {
    headers: buildHeaders(config),
  })
  return response.text()
}

export async function createProjectGitHubIssue(config: BackendConfig, projectId: string, payload: { title: string; body: string; labels?: string[] }): Promise<GitHubIssue> {
  return requestJSON<GitHubIssue>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateProjectGitHubIssue(config: BackendConfig, projectId: string, number: number, payload: { title?: string; body?: string; state?: string }): Promise<GitHubIssue> {
  return requestJSON<GitHubIssue>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/issues/${number}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function createProjectGitHubPull(config: BackendConfig, projectId: string, payload: { title: string; body: string; head: string; base: string }): Promise<{ html_url: string; number: number }> {
  return requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function disconnectProjectGitHub(config: BackendConfig, projectId: string): Promise<void> {
  await requestJSON<void>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/disconnect`, {
    method: 'POST',
  })
}

export type ProviderMCPServer = {
    name: string
    command: string
    args?: string[]
    url?: string
    env?: Record<string, string>
    type?: string  // "stdio" | "http"
    enabled: boolean
}

export async function fetchProviderMCPServers(config: BackendConfig, provider: string, projectId?: string): Promise<ProviderMCPServer[]> {
    const params = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
    return requestJSON<ProviderMCPServer[]>(config, `/api/v1/agents/${encodeURIComponent(provider)}/mcp${params}`)
}

export async function addProviderMCPServer(config: BackendConfig, provider: string, server: { name: string; command: string; args?: string[] }): Promise<void> {
    await requestJSON(config, `/api/v1/agents/${encodeURIComponent(provider)}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
    })
}

export async function deleteProviderMCPServer(config: BackendConfig, provider: string, name: string): Promise<void> {
    await requestJSON(config, `/api/v1/agents/${encodeURIComponent(provider)}/mcp/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export type ProviderPermissions = {
    approval_mode: string
    allow: string[]
    deny: string[]
    ask: string[]
    allowed_tools?: string[]
    enabled_plugins?: string[]
    sandbox?: string
}

export type ProviderModelConfig = {
    model: string
    effort: string
    temperature: number | null
}

export type ProviderHook = {
    event: string
    matcher?: string
    type: string
    command: string
    timeout?: number
}

export async function fetchProviderPermissions(config: BackendConfig, provider: string, projectId?: string): Promise<ProviderPermissions> {
    const params = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
    return requestJSON<ProviderPermissions>(config, `/api/v1/agents/${encodeURIComponent(provider)}/permissions${params}`)
}

export async function updateProviderPermissions(config: BackendConfig, provider: string, perms: ProviderPermissions): Promise<void> {
    await requestJSON(config, `/api/v1/agents/${encodeURIComponent(provider)}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perms),
    })
}

export async function fetchProviderModel(config: BackendConfig, provider: string): Promise<ProviderModelConfig> {
    return requestJSON<ProviderModelConfig>(config, `/api/v1/agents/${encodeURIComponent(provider)}/model`)
}

export async function updateProviderModel(config: BackendConfig, provider: string, model: ProviderModelConfig): Promise<void> {
    await requestJSON(config, `/api/v1/agents/${encodeURIComponent(provider)}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model),
    })
}

export async function fetchProviderHooks(config: BackendConfig, provider: string): Promise<ProviderHook[]> {
    return requestJSON<ProviderHook[]>(config, `/api/v1/agents/${encodeURIComponent(provider)}/hooks`)
}

export async function updateProviderHooks(config: BackendConfig, provider: string, hooks: ProviderHook[]): Promise<void> {
    await requestJSON(config, `/api/v1/agents/${encodeURIComponent(provider)}/hooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hooks),
    })
}

export async function fetchSTTHealth(config: BackendConfig): Promise<STTHealth> {
  return requestJSON<STTHealth>(config, '/api/v1/stt/health')
}

export async function transcribeAudio(config: BackendConfig, audio: Blob, language?: string): Promise<STTTranscriptionResult> {
  const form = new FormData()
  form.append('audio', audio, 'recording.webm')
  if (language && language.trim() !== '') {
    form.append('language', language.trim())
  }

  return requestJSON<STTTranscriptionResult>(config, '/api/v1/stt/transcribe', {
    method: 'POST',
    body: form,
  })
}

export async function gitCheckout(config: BackendConfig, projectId: string, branch: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch }) })
}

export async function gitCreateBranch(config: BackendConfig, projectId: string, name: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/branches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
}

export async function gitDeleteBranch(config: BackendConfig, projectId: string, branch: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/branches/${encodeURIComponent(branch)}`, { method: 'DELETE' })
}

export async function gitStage(config: BackendConfig, projectId: string, files: string[]): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) })
}

export async function gitUnstage(config: BackendConfig, projectId: string, files: string[]): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/unstage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) })
}

export async function gitStash(config: BackendConfig, projectId: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stash`, { method: 'POST' })
}

export async function gitStashPop(config: BackendConfig, projectId: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/stash/pop`, { method: 'POST' })
}

export async function fetchPRReviews(config: BackendConfig, projectId: string, prNumber: number): Promise<unknown[]> {
  return requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${prNumber}/reviews`)
}

export async function submitPRReview(config: BackendConfig, projectId: string, prNumber: number, body: string, event: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${prNumber}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, event }) })
}

export async function mergePR(config: BackendConfig, projectId: string, prNumber: number, method: string): Promise<void> {
  await requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${prNumber}/merge`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method }) })
}

export async function fetchPRComments(config: BackendConfig, projectId: string, prNumber: number): Promise<unknown[]> {
  return requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls/${prNumber}/comments`)
}
