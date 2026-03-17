export const Provider = {
  CODEX: 'CODEX',
  CLAUDE: 'CLAUDE',
  OPENCODE: 'OPENCODE',
  GEMINI: 'GEMINI',
  UNSANDBOX: 'UNSANDBOX',
} as const
export type Provider = (typeof Provider)[keyof typeof Provider]

export const IssueStatus = {
  RUNNING: 'RUNNING',
  RETRYING: 'RETRYING',
  TRACKED: 'TRACKED',
  IDLE: 'IDLE',
} as const
export type IssueStatus = (typeof IssueStatus)[keyof typeof IssueStatus]

export const ConfigScope = {
  GLOBAL: 'GLOBAL',
  PROJECT: 'PROJECT',
} as const
export type ConfigScope = (typeof ConfigScope)[keyof typeof ConfigScope]

export const AgentCategory = {
  CORE: 'CORE',
  SKILL: 'SKILL',
} as const
export type AgentCategory = (typeof AgentCategory)[keyof typeof AgentCategory]

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
export type SSEEventType = (typeof SSEEventType)[keyof typeof SSEEventType]

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
export type SectionID = (typeof SectionID)[keyof typeof SectionID]
