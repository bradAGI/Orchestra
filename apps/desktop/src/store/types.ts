/**
 * Zustand store slice type definitions.
 *
 * Each slice owns a vertical domain of application state.
 * Implementations live in ./slices/<name>.ts (created in Tasks 2-5).
 */

import type { SectionID } from '@app/routes/sections'
import type {
  SnapshotPayload,
  GlobalStats,
  Project,
  ProjectStats,
  BackendConfig,
  BridgeProfilesPayload,
} from '@/lib/orchestra-types'
import type { TimelineItem } from '@/components/app-shell/types'
import type { IssueListItem } from '@/lib/orchestra-client'
import type { TerminalNode } from '@/components/terminal/TerminalMultiplexer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type TreeNode = {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  depth: number
}

export type DirCache = {
  children: TreeNode[]
  loading: boolean
}

export type ToolSummary = {
  name: string
  description?: string
}

export type AgentConfig = {
  commands: Record<string, string>
  agent_provider: string
  max_turns: number
}

export type SettingsTab = 'agents' | 'backend' | 'integrations' | 'shortcuts' | 'notifications'

export type SearchMatch = { line: number; text: string }
export type SearchResultGroup = { file: string; relativePath: string; matches: SearchMatch[] }

// ---------------------------------------------------------------------------
// UI Slice
// ---------------------------------------------------------------------------

export interface UISlice {
  // State
  activeSection: SectionID
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  activePeriod: 'Today' | 'Week' | 'Month'
  paletteOpen: boolean
  inspectDialogOpen: boolean
  sessionInspectDialogOpen: boolean
  createTaskDialogOpen: boolean
  createTaskInitialState: Record<string, unknown> | null
  createProjectDialogOpen: boolean
  settingsInitialTab: SettingsTab | undefined

  // Actions
  setActiveSection: (section: SectionID) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
  setActivePeriod: (period: 'Today' | 'Week' | 'Month') => void
  setPaletteOpen: (open: boolean) => void
  togglePalette: () => void
  setInspectDialogOpen: (open: boolean) => void
  setSessionInspectDialogOpen: (open: boolean) => void
  openCreateTaskDialog: (initialState?: Record<string, unknown>) => void
  closeCreateTaskDialog: () => void
  setCreateProjectDialogOpen: (open: boolean) => void
  setSettingsInitialTab: (tab: SettingsTab | undefined) => void
}

// ---------------------------------------------------------------------------
// Runtime Slice
// ---------------------------------------------------------------------------

export interface RuntimeSlice {
  // State
  snapshot: SnapshotPayload | null
  timeline: TimelineItem[]
  loadingState: boolean
  statusMessage: string
  usePolling: boolean
  refreshPending: boolean

  // Actions
  setSnapshot: (snapshot: SnapshotPayload | null) => void
  updateSnapshot: (partial: Partial<SnapshotPayload>) => void
  addTimelineEvent: (event: TimelineItem) => void
  setLoadingState: (loading: boolean) => void
  setStatusMessage: (message: string) => void
  setUsePolling: (polling: boolean) => void
  togglePolling: () => void
  setRefreshPending: (pending: boolean) => void
}

// ---------------------------------------------------------------------------
// Issues Slice
// ---------------------------------------------------------------------------

export interface IssuesSlice {
  // State
  boardIssues: IssueListItem[]
  githubBacklogIssues: IssueListItem[]
  allBoardIssues: IssueListItem[]

  // Actions
  setBoardIssues: (issues: IssueListItem[]) => void
  setGithubBacklogIssues: (issues: IssueListItem[]) => void
}

// ---------------------------------------------------------------------------
// Projects Slice
// ---------------------------------------------------------------------------

export interface ProjectsSlice {
  // State
  projects: Project[]
  projectStats: Record<string, ProjectStats>
  warehouseStats: GlobalStats | null
  selectedProjectID: string | null
  dataLoading: boolean

  // Actions
  setProjects: (projects: Project[]) => void
  setProjectStats: (stats: Record<string, ProjectStats>) => void
  setWarehouseStats: (stats: GlobalStats | null) => void
  setSelectedProjectID: (id: string | null) => void
  setDataLoading: (loading: boolean) => void
}

// ---------------------------------------------------------------------------
// Agents Slice
// ---------------------------------------------------------------------------

export interface AgentsSlice {
  // State
  agentConfig: AgentConfig | null
  availableAgents: string[]
  allTools: ToolSummary[]

  // Actions
  setAgentConfig: (config: AgentConfig | null) => void
  setAvailableAgents: (agents: string[]) => void
  setAllTools: (tools: ToolSummary[]) => void
}

// ---------------------------------------------------------------------------
// Settings Slice
// ---------------------------------------------------------------------------

export interface SettingsSlice {
  // State
  config: BackendConfig | null
  loadingConfig: boolean
  backendProfiles: BridgeProfilesPayload | null
  activeProfileId: string | null

  // Actions
  setConfig: (config: BackendConfig | null) => void
  setLoadingConfig: (loading: boolean) => void
  setBackendProfiles: (profiles: BridgeProfilesPayload | null) => void
  setActiveProfileId: (id: string | null) => void
}

// ---------------------------------------------------------------------------
// Terminals Slice
// ---------------------------------------------------------------------------

export interface TerminalsSlice {
  // State
  openTerminals: TerminalNode[]

  // Actions
  setOpenTerminals: (terminals: TerminalNode[]) => void
}

// ---------------------------------------------------------------------------
// Workspace Slice
// ---------------------------------------------------------------------------

export interface WorkspaceSlice {
  // State
  explorerRoot: string | null
  activeLeftPanel: 'explorer' | 'search'
  leftSidebarOpen: boolean
  leftSidebarWidth: number
  rightSidebarWidth: number
  rightSidebarOpen: boolean
  expandedDirs: Set<string>
  dirCache: Record<string, DirCache>
  gitStatusMap: Record<string, string>
  searchQuery: string
  searchResults: SearchResultGroup[]
  searchLoading: boolean

  // Actions
  setExplorerRoot: (root: string | null) => void
  setActiveLeftPanel: (panel: 'explorer' | 'search') => void
  setLeftSidebarOpen: (open: boolean) => void
  toggleLeftSidebar: () => void
  setLeftSidebarWidth: (width: number) => void
  setRightSidebarWidth: (width: number) => void
  setRightSidebarOpen: (open: boolean) => void
  toggleRightSidebar: () => void
  toggleDir: (dirPath: string) => void
  setDirChildren: (dirPath: string, children: TreeNode[]) => void
  setDirLoading: (dirPath: string, loading: boolean) => void
  setGitStatusMap: (statusMap: Record<string, string>) => void
  clearExplorerCache: () => void
  setSearchQuery: (query: string) => void
  setSearchResults: (results: SearchResultGroup[]) => void
  setSearchLoading: (loading: boolean) => void
}

// ---------------------------------------------------------------------------
// Editor Slice
// ---------------------------------------------------------------------------

export type OpenFile = {
  id: string
  filePath: string
  relativePath: string
  language: string
  isDirty: boolean
  content: string | null // null = not yet loaded
}

export interface EditorSlice {
  openFiles: OpenFile[]
  activeFileId: string | null
  openFile: (filePath: string, relativePath: string) => void
  closeFile: (fileId: string) => void
  setActiveFile: (fileId: string) => void
  setFileDirty: (fileId: string, isDirty: boolean) => void
  setFileContent: (fileId: string, content: string) => void
}

// ---------------------------------------------------------------------------
// Browser Slice
// ---------------------------------------------------------------------------

export type BrowserTab = {
  id: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface BrowserSlice {
  browserTabs: BrowserTab[]
  activeBrowserTabId: string | null
  openBrowserTab: (url?: string) => void
  closeBrowserTab: (tabId: string) => void
  setActiveBrowserTab: (tabId: string) => void
  updateBrowserTab: (tabId: string, updates: Partial<BrowserTab>) => void
}

// ---------------------------------------------------------------------------
// Composite App State
// ---------------------------------------------------------------------------

export type AppState = UISlice &
  RuntimeSlice &
  IssuesSlice &
  ProjectsSlice &
  AgentsSlice &
  SettingsSlice &
  TerminalsSlice &
  WorkspaceSlice &
  EditorSlice &
  BrowserSlice
