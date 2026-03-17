/** Machine learning provider identifiers supported by the orchestration backend. */
export const Provider = {
  CODEX: 'CODEX',
  CLAUDE: 'CLAUDE',
  OPENCODE: 'OPENCODE',
  GEMINI: 'GEMINI',
  UNSANDBOX: 'UNSANDBOX',
} as const
/** Union type of all supported provider string literals. */
export type Provider = (typeof Provider)[keyof typeof Provider]

/** Lifecycle states an issue can occupy within the orchestrator. */
export const IssueStatus = {
  RUNNING: 'RUNNING',
  RETRYING: 'RETRYING',
  TRACKED: 'TRACKED',
  IDLE: 'IDLE',
} as const
/** Union type of all issue status string literals. */
export type IssueStatus = (typeof IssueStatus)[keyof typeof IssueStatus]

/** Scoping level for configuration values (global vs. per-project). */
export const ConfigScope = {
  GLOBAL: 'GLOBAL',
  PROJECT: 'PROJECT',
} as const
/** Union type of configuration scope string literals. */
export type ConfigScope = (typeof ConfigScope)[keyof typeof ConfigScope]

/** Classification of agent configuration files. */
export const AgentCategory = {
  CORE: 'CORE',
  SKILL: 'SKILL',
} as const
/** Union type of agent category string literals. */
export type AgentCategory = (typeof AgentCategory)[keyof typeof AgentCategory]

/** Server-Sent Event types emitted by the orchestrator event stream. */
export const SSEEventType = {
  RUN_EVENT: 'RUN_EVENT',
  RUN_STARTED: 'RUN_STARTED',
  RUN_FAILED: 'RUN_FAILED',
  RUN_CONTINUES: 'RUN_CONTINUES',
  RUN_SUCCEEDED: 'RUN_SUCCEEDED',
  RETRY_SCHEDULED: 'RETRY_SCHEDULED',
  HOOK_STARTED: 'HOOK_STARTED',
  HOOK_COMPLETED: 'HOOK_COMPLETED',
  HOOK_FAILED: 'HOOK_FAILED',
} as const
/** Union type of all SSE event type string literals. */
export type SSEEventType = (typeof SSEEventType)[keyof typeof SSEEventType]

/** Identifiers for top-level navigation sections in the desktop app. */
export const SectionID = {
  DASHBOARD: 'DASHBOARD',
  RUNNING: 'RUNNING',
  ISSUES: 'ISSUES',
  PROJECTS: 'PROJECTS',
  AGENTS: 'AGENTS',
  WAREHOUSE: 'WAREHOUSE',
  SANDBOX: 'SANDBOX',
  SETTINGS: 'SETTINGS',
  DOCS: 'DOCS',
  CONSOLE: 'CONSOLE',
} as const
/** Union type of all section ID string literals. */
export type SectionID = (typeof SectionID)[keyof typeof SectionID]
