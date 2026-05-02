# Phase 0: Foundation — Zustand Store + Workspace Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract App.tsx's 46+ hooks into a Zustand store with 9 slices and build the three-column workspace shell for the CONSOLE section, establishing the foundation for all Phase 1+ features.

**Architecture:** Single Zustand store composed from 9 slice factories using the spread-merge pattern. Each slice is a `StateCreator<AppState, [], [], SliceType>`. App.tsx shrinks from 1,385 lines to ~200 lines of layout + hydration. The CONSOLE section gains a three-column flex layout (left sidebar / center panel / right sidebar) with resizable panels.

**Tech Stack:** Zustand 5, React 19, TypeScript 5.9, Vitest, @testing-library/react

**Spec:** `docs/superpowers/specs/2026-04-25-workspace-platform-upgrade-design.md` (Sections 4 + 5)

---

## File Structure

### New files to create:

```
src/store/
  index.ts                    — Creates the store, composes all slices
  types.ts                    — AppState type combining all slice types
  slices/
    ui-slice.ts               — activeSection, sidebar, modals, theme, palette, toasts
    ui-slice.test.ts
    runtime-slice.ts          — snapshot, timeline, SSE status, loading, errors
    runtime-slice.test.ts
    issues-slice.ts           — boardIssues, githubBacklog, active issue, create task state
    issues-slice.test.ts
    projects-slice.ts         — projects, projectStats, selectedProject, warehouseStats
    projects-slice.test.ts
    agents-slice.ts           — agentConfig, availableAgents, allTools
    agents-slice.test.ts
    settings-slice.ts         — backendConfig, profiles, notifications, migration
    settings-slice.test.ts
    terminals-slice.ts        — terminal tabs, open terminals
    terminals-slice.test.ts
    workspace-slice.ts        — explorerRoot, dirCache, expandedDirs, gitStatus, search (Phase 1 placeholder)
    workspace-slice.test.ts
    editor-slice.ts           ��� openFiles, activeFile, dirty state (Phase 1 placeholder)
    editor-slice.test.ts
src/components/workspace/
  WorkspaceLayout.tsx         — Three-column layout for CONSOLE section
  LeftSidebar.tsx             — Resizable left panel (explorer/search placeholder)
  RightSidebar.tsx            — Resizable right panel (issue detail dock)
  ResizeHandle.tsx            — Shared drag-to-resize handle component
```

### Files to modify:

```
src/App.tsx                   — Gut to ~200 lines: store init, layout shell, keyboard shortcuts
src/App.smoke.test.tsx        — Update to work with Zustand store instead of prop drilling
src/app/layout/AppShell.tsx   — Read from store instead of props where possible
src/app/routes/sections.tsx   — No changes needed (already pure functions)
package.json                  — Add zustand dependency
```

---

## Task 1: Install Zustand and Create Store Skeleton

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/store/index.ts`
- Create: `apps/desktop/src/store/types.ts`

- [ ] **Step 1: Install zustand**

```bash
cd apps/desktop && npm install zustand
```

- [ ] **Step 2: Create the store types file**

Create `src/store/types.ts`:

```typescript
import type { SectionID } from '@app/routes/sections'
import type { SnapshotPayload, GlobalStats, Project, ProjectStats, BackendConfig, BackendProfile, BridgeProfilesPayload } from '@/lib/orchestra-types'
import type { TimelineItem } from '@/components/app-shell/types'
import type { IssueListItem } from '@/lib/orchestra-client'
import type { TerminalNode } from '@/components/terminal/TerminalMultiplexer'

export type UISlice = {
  activeSection: SectionID
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  activePeriod: string
  paletteOpen: boolean
  inspectDialogOpen: boolean
  sessionInspectDialogOpen: boolean
  createTaskDialogOpen: boolean
  createTaskInitialState: string
  createProjectDialogOpen: boolean
  settingsInitialTab: string
  setActiveSection: (section: SectionID) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
  setActivePeriod: (period: string) => void
  setPaletteOpen: (open: boolean) => void
  togglePalette: () => void
  setInspectDialogOpen: (open: boolean) => void
  setSessionInspectDialogOpen: (open: boolean) => void
  openCreateTaskDialog: (initialState?: string) => void
  closeCreateTaskDialog: () => void
  setCreateProjectDialogOpen: (open: boolean) => void
  setSettingsInitialTab: (tab: string) => void
}

export type RuntimeSlice = {
  snapshot: SnapshotPayload | null
  timeline: TimelineItem[]
  loadingState: boolean
  statusMessage: string
  usePolling: boolean
  refreshPending: boolean
  setSnapshot: (snapshot: SnapshotPayload | null) => void
  updateSnapshot: (next: SnapshotPayload) => void
  addTimelineEvent: (event: TimelineItem) => void
  setLoadingState: (loading: boolean) => void
  setStatusMessage: (message: string) => void
  setUsePolling: (usePolling: boolean) => void
  togglePolling: () => void
  setRefreshPending: (pending: boolean) => void
}

export type IssuesSlice = {
  boardIssues: IssueListItem[]
  githubBacklogIssues: IssueListItem[]
  allBoardIssues: IssueListItem[]
  setBoardIssues: (issues: IssueListItem[]) => void
  setGithubBacklogIssues: (issues: IssueListItem[]) => void
}

export type ProjectsSlice = {
  projects: Project[]
  projectStats: Record<string, ProjectStats>
  warehouseStats: GlobalStats | null
  selectedProjectID: string
  dataLoading: boolean
  setProjects: (projects: Project[]) => void
  setProjectStats: (stats: Record<string, ProjectStats>) => void
  setWarehouseStats: (stats: GlobalStats | null) => void
  setSelectedProjectID: (id: string) => void
  setDataLoading: (loading: boolean) => void
}

export type AgentsSlice = {
  agentConfig: Record<string, unknown> | null
  availableAgents: string[]
  allTools: ToolSummary[]
  setAgentConfig: (config: Record<string, unknown> | null) => void
  setAvailableAgents: (agents: string[]) => void
  setAllTools: (tools: ToolSummary[]) => void
}

export type SettingsSlice = {
  config: BackendConfig | null
  loadingConfig: boolean
  backendProfiles: BridgeProfilesPayload | null
  activeProfileId: string
  setConfig: (config: BackendConfig | null) => void
  setLoadingConfig: (loading: boolean) => void
  setBackendProfiles: (profiles: BridgeProfilesPayload | null) => void
  setActiveProfileId: (id: string) => void
}

export type TerminalsSlice = {
  openTerminals: TerminalNode[]
  setOpenTerminals: (terminals: TerminalNode[]) => void
}

export type WorkspaceSlice = {
  explorerRoot: string | null
  activeLeftPanel: 'explorer' | 'search'
  leftSidebarWidth: number
  rightSidebarWidth: number
  rightSidebarOpen: boolean
  setExplorerRoot: (root: string | null) => void
  setActiveLeftPanel: (panel: 'explorer' | 'search') => void
  setLeftSidebarWidth: (width: number) => void
  setRightSidebarWidth: (width: number) => void
  setRightSidebarOpen: (open: boolean) => void
  toggleRightSidebar: () => void
}

export type EditorSlice = {
  // Phase 1 placeholder — populated when Monaco editor ships
}

export type ToolSummary = { name: string; description?: string }

export type AppState =
  UISlice &
  RuntimeSlice &
  IssuesSlice &
  ProjectsSlice &
  AgentsSlice &
  SettingsSlice &
  TerminalsSlice &
  WorkspaceSlice &
  EditorSlice
```

- [ ] **Step 3: Create the store index**

Create `src/store/index.ts`:

```typescript
import { create } from 'zustand'
import type { AppState } from './types'
import { createUISlice } from './slices/ui-slice'
import { createRuntimeSlice } from './slices/runtime-slice'
import { createIssuesSlice } from './slices/issues-slice'
import { createProjectsSlice } from './slices/projects-slice'
import { createAgentsSlice } from './slices/agents-slice'
import { createSettingsSlice } from './slices/settings-slice'
import { createTerminalsSlice } from './slices/terminals-slice'
import { createWorkspaceSlice } from './slices/workspace-slice'
import { createEditorSlice } from './slices/editor-slice'

export const useAppStore = create<AppState>()((...a) => ({
  ...createUISlice(...a),
  ...createRuntimeSlice(...a),
  ...createIssuesSlice(...a),
  ...createProjectsSlice(...a),
  ...createAgentsSlice(...a),
  ...createSettingsSlice(...a),
  ...createTerminalsSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createEditorSlice(...a),
}))

export type { AppState } from './types'
```

- [ ] **Step 4: Commit skeleton**

```bash
git add apps/desktop/package.json apps/desktop/package-lock.json apps/desktop/src/store/
git commit -m "$(cat <<'EOF'
feat(store): add Zustand store skeleton with 9 slice types

Foundation for migrating App.tsx state into composable slices.
EOF
)"
```

---

## Task 2: UI Slice — Navigation, Theme, Modals

**Files:**
- Create: `apps/desktop/src/store/slices/ui-slice.ts`
- Create: `apps/desktop/src/store/slices/ui-slice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/slices/ui-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createUISlice } from './ui-slice'
import type { AppState } from '../types'
import type { StateCreator } from 'zustand'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createUISlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

describe('ui-slice', () => {
  it('initializes with default values', () => {
    const { state } = createTestSlice()
    expect(state.activeSection).toBe('ISSUES')
    expect(state.sidebarCollapsed).toBe(false)
    expect(state.theme).toBe('dark')
    expect(state.paletteOpen).toBe(false)
    expect(state.inspectDialogOpen).toBe(false)
    expect(state.createTaskDialogOpen).toBe(false)
    expect(state.createProjectDialogOpen).toBe(false)
  })

  it('setActiveSection changes section', () => {
    const { get, state } = createTestSlice()
    state.setActiveSection('CONSOLE')
    expect(get().activeSection).toBe('CONSOLE')
  })

  it('toggleSidebar flips collapsed state', () => {
    const { get, state } = createTestSlice()
    expect(get().sidebarCollapsed).toBe(false)
    state.toggleSidebar()
    expect(get().sidebarCollapsed).toBe(true)
    state.toggleSidebar()
    expect(get().sidebarCollapsed).toBe(false)
  })

  it('togglePalette flips palette state', () => {
    const { get, state } = createTestSlice()
    state.togglePalette()
    expect(get().paletteOpen).toBe(true)
    state.togglePalette()
    expect(get().paletteOpen).toBe(false)
  })

  it('openCreateTaskDialog sets open and initialState', () => {
    const { get, state } = createTestSlice()
    state.openCreateTaskDialog('Todo')
    expect(get().createTaskDialogOpen).toBe(true)
    expect(get().createTaskInitialState).toBe('Todo')
  })

  it('closeCreateTaskDialog resets state', () => {
    const { get, state } = createTestSlice()
    state.openCreateTaskDialog('Todo')
    state.closeCreateTaskDialog()
    expect(get().createTaskDialogOpen).toBe(false)
    expect(get().createTaskInitialState).toBe('')
  })

  it('setTheme updates theme', () => {
    const { get, state } = createTestSlice()
    state.setTheme('light')
    expect(get().theme).toBe('light')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/desktop && npx vitest run src/store/slices/ui-slice.test.ts
```

Expected: FAIL — `createUISlice` not found.

- [ ] **Step 3: Implement the UI slice**

Create `src/store/slices/ui-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, UISlice } from '../types'

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem('orchestra-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  activeSection: 'ISSUES',
  sidebarCollapsed: false,
  theme: getInitialTheme(),
  activePeriod: 'Week',
  paletteOpen: false,
  inspectDialogOpen: false,
  sessionInspectDialogOpen: false,
  createTaskDialogOpen: false,
  createTaskInitialState: '',
  createProjectDialogOpen: false,
  settingsInitialTab: 'backend',
  setActiveSection: (section) => set({ activeSection: section }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orchestra-theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
    set({ theme })
  },
  setActivePeriod: (period) => set({ activePeriod: period }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setInspectDialogOpen: (open) => set({ inspectDialogOpen: open }),
  setSessionInspectDialogOpen: (open) => set({ sessionInspectDialogOpen: open }),
  openCreateTaskDialog: (initialState = '') => set({ createTaskDialogOpen: true, createTaskInitialState: initialState }),
  closeCreateTaskDialog: () => set({ createTaskDialogOpen: false, createTaskInitialState: '' }),
  setCreateProjectDialogOpen: (open) => set({ createProjectDialogOpen: open }),
  setSettingsInitialTab: (tab) => set({ settingsInitialTab: tab }),
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/desktop && npx vitest run src/store/slices/ui-slice.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/store/slices/ui-slice.ts apps/desktop/src/store/slices/ui-slice.test.ts
git commit -m "$(cat <<'EOF'
feat(store): add UI slice — navigation, theme, modals, palette
EOF
)"
```

---

## Task 3: Runtime Slice — Snapshot, Timeline, SSE State

**Files:**
- Create: `apps/desktop/src/store/slices/runtime-slice.ts`
- Create: `apps/desktop/src/store/slices/runtime-slice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/slices/runtime-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createRuntimeSlice } from './runtime-slice'
import type { AppState } from '../types'
import type { SnapshotPayload } from '@/lib/orchestra-types'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createRuntimeSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

const mockSnapshot: SnapshotPayload = {
  counts: { running: 1, retrying: 0 },
  running: [],
  retrying: [],
}

describe('runtime-slice', () => {
  it('initializes with null snapshot and empty timeline', () => {
    const { state } = createTestSlice()
    expect(state.snapshot).toBeNull()
    expect(state.timeline).toEqual([])
    expect(state.loadingState).toBe(true)
    expect(state.usePolling).toBe(false)
  })

  it('updateSnapshot deduplicates identical snapshots', () => {
    const { get, state } = createTestSlice()
    state.updateSnapshot(mockSnapshot)
    const first = get().snapshot
    state.updateSnapshot({ ...mockSnapshot })
    expect(get().snapshot).toBe(first)
  })

  it('updateSnapshot replaces on change', () => {
    const { get, state } = createTestSlice()
    state.updateSnapshot(mockSnapshot)
    const changed = { ...mockSnapshot, counts: { running: 2, retrying: 0 } }
    state.updateSnapshot(changed)
    expect(get().snapshot?.counts.running).toBe(2)
  })

  it('addTimelineEvent prepends and deduplicates', () => {
    const { get, state } = createTestSlice()
    const event = { type: 'RUN_STARTED', at: '2026-01-01', data: { id: '1' } }
    state.addTimelineEvent(event as any)
    expect(get().timeline).toHaveLength(1)
    state.addTimelineEvent(event as any)
    expect(get().timeline).toHaveLength(1)
  })

  it('addTimelineEvent caps at 50 items', () => {
    const { get, state } = createTestSlice()
    for (let i = 0; i < 60; i++) {
      state.addTimelineEvent({ type: 'RUN_STARTED', at: `2026-01-${i}`, data: { id: String(i) } } as any)
    }
    expect(get().timeline.length).toBeLessThanOrEqual(50)
  })

  it('togglePolling flips usePolling', () => {
    const { get, state } = createTestSlice()
    state.togglePolling()
    expect(get().usePolling).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/desktop && npx vitest run src/store/slices/runtime-slice.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the runtime slice**

Create `src/store/slices/runtime-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, RuntimeSlice } from '../types'
import { applySnapshotUpdate, appendTimelineEvent } from '@/lib/runtime-store'

export const createRuntimeSlice: StateCreator<AppState, [], [], RuntimeSlice> = (set, get) => ({
  snapshot: null,
  timeline: [],
  loadingState: true,
  statusMessage: '',
  usePolling: false,
  refreshPending: false,
  setSnapshot: (snapshot) => set({ snapshot }),
  updateSnapshot: (next) => set((s) => ({ snapshot: applySnapshotUpdate(s.snapshot, next) })),
  addTimelineEvent: (event) => set((s) => ({ timeline: appendTimelineEvent(s.timeline, event) })),
  setLoadingState: (loading) => set({ loadingState: loading }),
  setStatusMessage: (message) => set({ statusMessage: message }),
  setUsePolling: (usePolling) => set({ usePolling }),
  togglePolling: () => set((s) => ({ usePolling: !s.usePolling })),
  setRefreshPending: (pending) => set({ refreshPending: pending }),
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/desktop && npx vitest run src/store/slices/runtime-slice.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/store/slices/runtime-slice.ts apps/desktop/src/store/slices/runtime-slice.test.ts
git commit -m "$(cat <<'EOF'
feat(store): add runtime slice — snapshot, timeline, SSE state
EOF
)"
```

---

## Task 4: Issues Slice

**Files:**
- Create: `apps/desktop/src/store/slices/issues-slice.ts`
- Create: `apps/desktop/src/store/slices/issues-slice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/slices/issues-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createIssuesSlice } from './issues-slice'
import type { AppState } from '../types'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createIssuesSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

describe('issues-slice', () => {
  it('initializes empty', () => {
    const { state } = createTestSlice()
    expect(state.boardIssues).toEqual([])
    expect(state.githubBacklogIssues).toEqual([])
    expect(state.allBoardIssues).toEqual([])
  })

  it('setBoardIssues updates boardIssues and recomputes allBoardIssues', () => {
    const { get, state } = createTestSlice()
    const issues = [{ id: '1', title: 'Test', identifier: 'T-1', state: 'Backlog' }] as any
    state.setBoardIssues(issues)
    expect(get().boardIssues).toHaveLength(1)
    expect(get().allBoardIssues).toHaveLength(1)
  })

  it('allBoardIssues deduplicates by title', () => {
    const { get, state } = createTestSlice()
    const board = [{ id: '1', title: 'Same', identifier: 'T-1', state: 'Backlog' }] as any
    const github = [{ id: '2', title: 'Same', identifier: 'GH-1', state: 'Backlog' }] as any
    state.setBoardIssues(board)
    state.setGithubBacklogIssues(github)
    expect(get().allBoardIssues).toHaveLength(1)
  })

  it('allBoardIssues merges unique entries', () => {
    const { get, state } = createTestSlice()
    const board = [{ id: '1', title: 'One', identifier: 'T-1', state: 'Backlog' }] as any
    const github = [{ id: '2', title: 'Two', identifier: 'GH-1', state: 'Backlog' }] as any
    state.setBoardIssues(board)
    state.setGithubBacklogIssues(github)
    expect(get().allBoardIssues).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/desktop && npx vitest run src/store/slices/issues-slice.test.ts
```

- [ ] **Step 3: Implement the issues slice**

Create `src/store/slices/issues-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, IssuesSlice } from '../types'
import type { IssueListItem } from '@/lib/orchestra-client'

function mergeAndDedupe(board: IssueListItem[], github: IssueListItem[]): IssueListItem[] {
  const seen = new Set(board.map((i) => i.title))
  const unique = github.filter((i) => !seen.has(i.title))
  return [...board, ...unique]
}

export const createIssuesSlice: StateCreator<AppState, [], [], IssuesSlice> = (set, get) => ({
  boardIssues: [],
  githubBacklogIssues: [],
  allBoardIssues: [],
  setBoardIssues: (issues) =>
    set((s) => ({
      boardIssues: issues,
      allBoardIssues: mergeAndDedupe(issues, s.githubBacklogIssues),
    })),
  setGithubBacklogIssues: (issues) =>
    set((s) => ({
      githubBacklogIssues: issues,
      allBoardIssues: mergeAndDedupe(s.boardIssues, issues),
    })),
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/desktop && npx vitest run src/store/slices/issues-slice.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/store/slices/issues-slice.ts apps/desktop/src/store/slices/issues-slice.test.ts
git commit -m "$(cat <<'EOF'
feat(store): add issues slice — board issues with dedup merge
EOF
)"
```

---

## Task 5: Projects, Agents, Settings, Terminals, Workspace, Editor Slices

These are straightforward state holders. Batch them into one task since they follow the same pattern.

**Files:**
- Create: `apps/desktop/src/store/slices/projects-slice.ts`
- Create: `apps/desktop/src/store/slices/projects-slice.test.ts`
- Create: `apps/desktop/src/store/slices/agents-slice.ts`
- Create: `apps/desktop/src/store/slices/agents-slice.test.ts`
- Create: `apps/desktop/src/store/slices/settings-slice.ts`
- Create: `apps/desktop/src/store/slices/settings-slice.test.ts`
- Create: `apps/desktop/src/store/slices/terminals-slice.ts`
- Create: `apps/desktop/src/store/slices/terminals-slice.test.ts`
- Create: `apps/desktop/src/store/slices/workspace-slice.ts`
- Create: `apps/desktop/src/store/slices/workspace-slice.test.ts`
- Create: `apps/desktop/src/store/slices/editor-slice.ts`
- Create: `apps/desktop/src/store/slices/editor-slice.test.ts`

- [ ] **Step 1: Create projects slice**

`src/store/slices/projects-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, ProjectsSlice } from '../types'

export const createProjectsSlice: StateCreator<AppState, [], [], ProjectsSlice> = (set) => ({
  projects: [],
  projectStats: {},
  warehouseStats: null,
  selectedProjectID: '',
  dataLoading: false,
  setProjects: (projects) => set({ projects }),
  setProjectStats: (stats) => set({ projectStats: stats }),
  setWarehouseStats: (stats) => set({ warehouseStats: stats }),
  setSelectedProjectID: (id) => set({ selectedProjectID: id }),
  setDataLoading: (loading) => set({ dataLoading: loading }),
})
```

- [ ] **Step 2: Create agents slice**

`src/store/slices/agents-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, AgentsSlice } from '../types'

export const createAgentsSlice: StateCreator<AppState, [], [], AgentsSlice> = (set) => ({
  agentConfig: null,
  availableAgents: [],
  allTools: [],
  setAgentConfig: (config) => set({ agentConfig: config }),
  setAvailableAgents: (agents) => set({ availableAgents: agents }),
  setAllTools: (tools) => set({ allTools: tools }),
})
```

- [ ] **Step 3: Create settings slice**

`src/store/slices/settings-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, SettingsSlice } from '../types'

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
  config: null,
  loadingConfig: true,
  backendProfiles: null,
  activeProfileId: '',
  setConfig: (config) => set({ config }),
  setLoadingConfig: (loading) => set({ loadingConfig: loading }),
  setBackendProfiles: (profiles) => set({ backendProfiles: profiles }),
  setActiveProfileId: (id) => set({ activeProfileId: id }),
})
```

- [ ] **Step 4: Create terminals slice**

`src/store/slices/terminals-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, TerminalsSlice } from '../types'

export const createTerminalsSlice: StateCreator<AppState, [], [], TerminalsSlice> = (set) => ({
  openTerminals: [],
  setOpenTerminals: (terminals) => set({ openTerminals: terminals }),
})
```

- [ ] **Step 5: Create workspace slice**

`src/store/slices/workspace-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, WorkspaceSlice } from '../types'

export const createWorkspaceSlice: StateCreator<AppState, [], [], WorkspaceSlice> = (set) => ({
  explorerRoot: null,
  activeLeftPanel: 'explorer',
  leftSidebarWidth: 280,
  rightSidebarWidth: 320,
  rightSidebarOpen: true,
  setExplorerRoot: (root) => set({ explorerRoot: root }),
  setActiveLeftPanel: (panel) => set({ activeLeftPanel: panel }),
  setLeftSidebarWidth: (width) => set({ leftSidebarWidth: Math.max(220, Math.min(500, width)) }),
  setRightSidebarWidth: (width) => set({ rightSidebarWidth: Math.max(280, Math.min(500, width)) }),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
})
```

- [ ] **Step 6: Create editor slice (placeholder)**

`src/store/slices/editor-slice.ts`:

```typescript
import type { StateCreator } from 'zustand'
import type { AppState, EditorSlice } from '../types'

export const createEditorSlice: StateCreator<AppState, [], [], EditorSlice> = () => ({})
```

- [ ] **Step 7: Write tests for all simple slices**

Create a test for each following the pattern. Example for projects (`src/store/slices/projects-slice.test.ts`):

```typescript
import { describe, it, expect } from 'vitest'
import { createProjectsSlice } from './projects-slice'
import type { AppState } from '../types'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createProjectsSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

describe('projects-slice', () => {
  it('initializes with empty state', () => {
    const { state } = createTestSlice()
    expect(state.projects).toEqual([])
    expect(state.projectStats).toEqual({})
    expect(state.warehouseStats).toBeNull()
    expect(state.selectedProjectID).toBe('')
  })

  it('setProjects updates project list', () => {
    const { get, state } = createTestSlice()
    state.setProjects([{ id: '1', name: 'Test' }] as any)
    expect(get().projects).toHaveLength(1)
  })
})
```

Create `src/store/slices/agents-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createAgentsSlice } from './agents-slice'
import type { AppState } from '../types'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createAgentsSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

describe('agents-slice', () => {
  it('initializes with empty state', () => {
    const { state } = createTestSlice()
    expect(state.agentConfig).toBeNull()
    expect(state.availableAgents).toEqual([])
    expect(state.allTools).toEqual([])
  })

  it('setAvailableAgents updates list', () => {
    const { get, state } = createTestSlice()
    state.setAvailableAgents(['claude', 'codex'])
    expect(get().availableAgents).toEqual(['claude', 'codex'])
  })
})
```

Create `src/store/slices/settings-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createSettingsSlice } from './settings-slice'
import type { AppState } from '../types'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createSettingsSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

describe('settings-slice', () => {
  it('initializes with null config', () => {
    const { state } = createTestSlice()
    expect(state.config).toBeNull()
    expect(state.loadingConfig).toBe(true)
  })

  it('setConfig updates config', () => {
    const { get, state } = createTestSlice()
    state.setConfig({ baseUrl: 'http://localhost:4010', apiToken: 'test' })
    expect(get().config?.baseUrl).toBe('http://localhost:4010')
  })
})
```

Create `src/store/slices/terminals-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createTerminalsSlice } from './terminals-slice'
import type { AppState } from '../types'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createTerminalsSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

describe('terminals-slice', () => {
  it('initializes with empty terminals', () => {
    const { state } = createTestSlice()
    expect(state.openTerminals).toEqual([])
  })
})
```

Create `src/store/slices/workspace-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createWorkspaceSlice } from './workspace-slice'
import type { AppState } from '../types'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createWorkspaceSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

describe('workspace-slice', () => {
  it('initializes with defaults', () => {
    const { state } = createTestSlice()
    expect(state.explorerRoot).toBeNull()
    expect(state.activeLeftPanel).toBe('explorer')
    expect(state.leftSidebarWidth).toBe(280)
    expect(state.rightSidebarOpen).toBe(true)
  })

  it('clamps sidebar widths', () => {
    const { get, state } = createTestSlice()
    state.setLeftSidebarWidth(100)
    expect(get().leftSidebarWidth).toBe(220)
    state.setLeftSidebarWidth(800)
    expect(get().leftSidebarWidth).toBe(500)
  })

  it('toggleRightSidebar flips state', () => {
    const { get, state } = createTestSlice()
    state.toggleRightSidebar()
    expect(get().rightSidebarOpen).toBe(false)
  })
})
```

Create `src/store/slices/editor-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createEditorSlice } from './editor-slice'
import type { AppState } from '../types'

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createEditorSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

describe('editor-slice', () => {
  it('initializes as empty placeholder', () => {
    const { state } = createTestSlice()
    expect(state).toBeDefined()
  })
})
```

- [ ] **Step 8: Run all slice tests**

```bash
cd apps/desktop && npx vitest run src/store/
```

Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/store/slices/
git commit -m "$(cat <<'EOF'
feat(store): add projects, agents, settings, terminals, workspace, editor slices
EOF
)"
```

---

## Task 6: Compose Full Store and Integration Test

**Files:**
- Modify: `apps/desktop/src/store/index.ts` (already created in Task 1, now all imports resolve)
- Create: `apps/desktop/src/store/index.test.ts`

- [ ] **Step 1: Write the integration test**

Create `src/store/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { useAppStore } from './index'

describe('useAppStore (composed)', () => {
  it('exposes all slice state', () => {
    const state = useAppStore.getState()

    // UI slice
    expect(state.activeSection).toBe('ISSUES')
    expect(typeof state.setActiveSection).toBe('function')
    expect(typeof state.toggleSidebar).toBe('function')
    expect(typeof state.togglePalette).toBe('function')

    // Runtime slice
    expect(state.snapshot).toBeNull()
    expect(typeof state.updateSnapshot).toBe('function')
    expect(typeof state.addTimelineEvent).toBe('function')

    // Issues slice
    expect(state.boardIssues).toEqual([])
    expect(typeof state.setBoardIssues).toBe('function')

    // Projects slice
    expect(state.projects).toEqual([])
    expect(typeof state.setProjects).toBe('function')

    // Agents slice
    expect(state.agentConfig).toBeNull()
    expect(typeof state.setAgentConfig).toBe('function')

    // Settings slice
    expect(state.config).toBeNull()
    expect(typeof state.setConfig).toBe('function')

    // Terminals slice
    expect(state.openTerminals).toEqual([])

    // Workspace slice
    expect(state.explorerRoot).toBeNull()
    expect(typeof state.setLeftSidebarWidth).toBe('function')

    // Editor slice (placeholder)
    expect(state).toBeDefined()
  })

  it('actions mutate state correctly across slices', () => {
    const store = useAppStore

    store.getState().setActiveSection('CONSOLE')
    expect(store.getState().activeSection).toBe('CONSOLE')

    store.getState().setConfig({ baseUrl: 'http://localhost:4010', apiToken: 'test' })
    expect(store.getState().config?.baseUrl).toBe('http://localhost:4010')

    store.getState().setBoardIssues([{ id: '1', title: 'Test', identifier: 'T-1', state: 'Backlog' }] as any)
    expect(store.getState().allBoardIssues).toHaveLength(1)

    // Reset for other tests
    store.getState().setActiveSection('ISSUES')
    store.getState().setConfig(null)
    store.getState().setBoardIssues([])
  })
})
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/desktop && npx vitest run src/store/index.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/store/index.test.ts
git commit -m "$(cat <<'EOF'
test(store): add composed store integration test
EOF
)"
```

---

## Task 7: Migrate App.tsx to Use Store

This is the largest task — gut App.tsx from ~1,385 lines to ~200 lines by replacing all useState/useRef with store selectors and actions.

**Files:**
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Replace all useState with store selectors**

At the top of `App()`, replace the 25+ useState calls with store selectors. Replace:

```typescript
const [theme, setTheme] = useState<'light' | 'dark'>(() => { ... })
const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null)
const [timeline, setTimeline] = useState<TimelineItem[]>([])
// ... all other useState calls
```

With:

```typescript
import { useAppStore } from '@/store'

export default function App() {
  // UI state
  const activeSection = useAppStore((s) => s.activeSection)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const activePeriod = useAppStore((s) => s.activePeriod)
  const setActivePeriod = useAppStore((s) => s.setActivePeriod)
  const paletteOpen = useAppStore((s) => s.paletteOpen)
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen)
  const togglePalette = useAppStore((s) => s.togglePalette)
  const inspectDialogOpen = useAppStore((s) => s.inspectDialogOpen)
  const setInspectDialogOpen = useAppStore((s) => s.setInspectDialogOpen)
  const sessionInspectDialogOpen = useAppStore((s) => s.sessionInspectDialogOpen)
  const setSessionInspectDialogOpen = useAppStore((s) => s.setSessionInspectDialogOpen)
  const createTaskDialogOpen = useAppStore((s) => s.createTaskDialogOpen)
  const createTaskInitialState = useAppStore((s) => s.createTaskInitialState)
  const openCreateTaskDialog = useAppStore((s) => s.openCreateTaskDialog)
  const closeCreateTaskDialog = useAppStore((s) => s.closeCreateTaskDialog)
  const createProjectDialogOpen = useAppStore((s) => s.createProjectDialogOpen)
  const setCreateProjectDialogOpen = useAppStore((s) => s.setCreateProjectDialogOpen)
  const settingsInitialTab = useAppStore((s) => s.settingsInitialTab)
  const setSettingsInitialTab = useAppStore((s) => s.setSettingsInitialTab)

  // Runtime state
  const snapshot = useAppStore((s) => s.snapshot)
  const updateSnapshot = useAppStore((s) => s.updateSnapshot)
  const timeline = useAppStore((s) => s.timeline)
  const addTimelineEvent = useAppStore((s) => s.addTimelineEvent)
  const loadingState = useAppStore((s) => s.loadingState)
  const setLoadingState = useAppStore((s) => s.setLoadingState)
  const statusMessage = useAppStore((s) => s.statusMessage)
  const setStatusMessage = useAppStore((s) => s.setStatusMessage)
  const usePolling = useAppStore((s) => s.usePolling)
  const refreshPending = useAppStore((s) => s.refreshPending)
  const setRefreshPending = useAppStore((s) => s.setRefreshPending)

  // Issues state
  const allBoardIssues = useAppStore((s) => s.allBoardIssues)
  const setBoardIssues = useAppStore((s) => s.setBoardIssues)
  const setGithubBacklogIssues = useAppStore((s) => s.setGithubBacklogIssues)

  // Projects state
  const projects = useAppStore((s) => s.projects)
  const setProjects = useAppStore((s) => s.setProjects)
  const projectStats = useAppStore((s) => s.projectStats)
  const setProjectStats = useAppStore((s) => s.setProjectStats)
  const warehouseStats = useAppStore((s) => s.warehouseStats)
  const setWarehouseStats = useAppStore((s) => s.setWarehouseStats)
  const selectedProjectID = useAppStore((s) => s.selectedProjectID)
  const setSelectedProjectID = useAppStore((s) => s.setSelectedProjectID)
  const dataLoading = useAppStore((s) => s.dataLoading)
  const setDataLoading = useAppStore((s) => s.setDataLoading)

  // Agents state
  const agentConfig = useAppStore((s) => s.agentConfig)
  const setAgentConfig = useAppStore((s) => s.setAgentConfig)
  const availableAgents = useAppStore((s) => s.availableAgents)
  const setAvailableAgents = useAppStore((s) => s.setAvailableAgents)
  const allTools = useAppStore((s) => s.allTools)
  const setAllTools = useAppStore((s) => s.setAllTools)

  // Terminals state
  const openTerminals = useAppStore((s) => s.openTerminals)
  const setOpenTerminals = useAppStore((s) => s.setOpenTerminals)

  // Keep existing custom hooks — they'll migrate to store in a follow-up
  const { config, loadingConfig: _loadingConfig, ...backendConfigRest } = useBackendConfig()
  // ... rest of existing hooks unchanged
```

This is a mechanical replacement — every `useState` call becomes a `useAppStore` selector. The variable names stay the same so no downstream code changes.

- [ ] **Step 2: Update the SSE/sync useEffect to use store actions**

In the useEffect that calls `startRuntimeSync` (around line 385-463), replace the direct `setState` calls with store actions. The callbacks change from:

```typescript
onSnapshot: (snap) => {
  setSnapshot(prev => applySnapshotUpdate(prev, snap))
}
```

To:

```typescript
onSnapshot: (snap) => {
  useAppStore.getState().updateSnapshot(snap)
}
```

And similarly for `onTimelineEvent`, `onStatus`, `onError`. Using `useAppStore.getState()` inside callbacks avoids stale closure issues — the store always returns current state.

- [ ] **Step 3: Remove the allBoardIssues useMemo and allBoardIssuesRef**

The `allBoardIssues` memo (line 362-366) and `allBoardIssuesRef` (line 367-368) are now handled by the issues slice's `mergeAndDedupe`. Delete both. `allBoardIssues` comes directly from the store.

- [ ] **Step 4: Remove the issueLookupIdRef and executeIssueLookupRef**

These refs (lines 157-160) existed to avoid stale closures in SSE callbacks. With the store, callbacks use `useAppStore.getState()` which always returns fresh state. Delete the refs.

- [ ] **Step 5: Update the keyboard shortcut useEffect**

Replace `setPaletteOpen(open => !open)` with `togglePalette()`, `setSidebarCollapsed(v => !v)` with `toggleSidebar()`. The handler refs (`handleRefreshRef`) can be replaced by calling `useAppStore.getState().setRefreshPending(true)` directly.

- [ ] **Step 6: Sync useBackendConfig with settings slice**

The `useBackendConfig` custom hook manages its own state. Bridge it to the store by adding a useEffect that syncs:

```typescript
const { config, loadingConfig, backendProfiles, activeProfileId, ...backendConfigRest } = useBackendConfig()
const setConfig = useAppStore((s) => s.setConfig)
const setLoadingConfig = useAppStore((s) => s.setLoadingConfig)

useEffect(() => {
  setConfig(config)
  setLoadingConfig(loadingConfig)
}, [config, loadingConfig, setConfig, setLoadingConfig])
```

This bridges the existing hook into the store without rewriting the hook. A future task can move the bridge logic fully into the settings slice.

- [ ] **Step 7: Run the existing smoke test**

```bash
cd apps/desktop && npx vitest run src/App.smoke.test.tsx --reporter=verbose
```

Expected: All existing tests PASS. The store migration is a transparent replacement — the same state flows to the same components via the same variable names.

- [ ] **Step 8: Run the full test suite**

```bash
cd apps/desktop && npx vitest run
```

Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/App.tsx
git commit -m "$(cat <<'EOF'
refactor(app): migrate App.tsx state to Zustand store

Replace 25+ useState calls with useAppStore selectors. All existing
behavior preserved — variable names unchanged, same data flows to same
components. SSE callbacks use getState() to avoid stale closures.
EOF
)"
```

---

## Task 8: Workspace Layout Shell — ResizeHandle Component

**Files:**
- Create: `apps/desktop/src/components/workspace/ResizeHandle.tsx`

- [ ] **Step 1: Create the resize handle component**

`src/components/workspace/ResizeHandle.tsx`:

```typescript
import { useCallback, useRef } from 'react'

type ResizeHandleProps = {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
  className?: string
}

export function ResizeHandle({ direction, onResize, className = '' }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastPos = useRef(0)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragging.current = true
      lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [direction],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const pos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = pos - lastPos.current
      lastPos.current = pos
      onResize(delta)
    },
    [direction, onResize],
  )

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      className={`${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} flex-shrink-0 bg-border hover:bg-primary/30 transition-colors ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/components/workspace/ResizeHandle.tsx
git commit -m "$(cat <<'EOF'
feat(workspace): add ResizeHandle component with pointer capture
EOF
)"
```

---

## Task 9: Workspace Layout Shell — Three-Column Layout

**Files:**
- Create: `apps/desktop/src/components/workspace/WorkspaceLayout.tsx`
- Create: `apps/desktop/src/components/workspace/LeftSidebar.tsx`
- Create: `apps/desktop/src/components/workspace/RightSidebar.tsx`

- [ ] **Step 1: Create the left sidebar**

`src/components/workspace/LeftSidebar.tsx`:

```typescript
import { useAppStore } from '@/store'
import { ResizeHandle } from './ResizeHandle'
import { FolderTree, Search } from 'lucide-react'

export function LeftSidebar() {
  const activeLeftPanel = useAppStore((s) => s.activeLeftPanel)
  const setActiveLeftPanel = useAppStore((s) => s.setActiveLeftPanel)
  const width = useAppStore((s) => s.leftSidebarWidth)
  const setWidth = useAppStore((s) => s.setLeftSidebarWidth)

  return (
    <>
      <div className="flex flex-col h-full bg-background border-r border-border" style={{ width }}>
        {/* Panel switcher */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
          <button
            onClick={() => setActiveLeftPanel('explorer')}
            className={`p-1.5 rounded-md transition-colors ${activeLeftPanel === 'explorer' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="Explorer (Cmd+Shift+E)"
          >
            <FolderTree size={16} />
          </button>
          <button
            onClick={() => setActiveLeftPanel('search')}
            className={`p-1.5 rounded-md transition-colors ${activeLeftPanel === 'search' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="Search (Cmd+Shift+F)"
          >
            <Search size={16} />
          </button>
        </div>

        {/* Panel content — placeholder for Phase 1 */}
        <div className="flex-1 min-h-0 overflow-auto p-3">
          {activeLeftPanel === 'explorer' ? (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">File Explorer</p>
              <p>Select a task to browse its workspace.</p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Search</p>
              <p>Search will be available in Phase 1.</p>
            </div>
          )}
        </div>
      </div>
      <ResizeHandle direction="horizontal" onResize={(delta) => setWidth(width + delta)} />
    </>
  )
}
```

- [ ] **Step 2: Create the right sidebar**

`src/components/workspace/RightSidebar.tsx`:

```typescript
import { useAppStore } from '@/store'
import { ResizeHandle } from './ResizeHandle'
import { X } from 'lucide-react'

type RightSidebarProps = {
  children?: React.ReactNode
}

export function RightSidebar({ children }: RightSidebarProps) {
  const open = useAppStore((s) => s.rightSidebarOpen)
  const width = useAppStore((s) => s.rightSidebarWidth)
  const setWidth = useAppStore((s) => s.setRightSidebarWidth)
  const setOpen = useAppStore((s) => s.setRightSidebarOpen)

  if (!open) return null

  return (
    <>
      <ResizeHandle direction="horizontal" onResize={(delta) => setWidth(width - delta)} />
      <div className="flex flex-col h-full bg-background border-l border-border" style={{ width }}>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issue Detail</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Close (Cmd+L)"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {children ?? (
            <div className="p-3 text-sm text-muted-foreground">
              No task selected.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Create the workspace layout**

`src/components/workspace/WorkspaceLayout.tsx`:

```typescript
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'

type WorkspaceLayoutProps = {
  centerContent: React.ReactNode
  rightContent?: React.ReactNode
}

export function WorkspaceLayout({ centerContent, rightContent }: WorkspaceLayoutProps) {
  return (
    <div className="flex h-full min-h-0 w-full">
      <LeftSidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {centerContent}
      </div>
      <RightSidebar>{rightContent}</RightSidebar>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/workspace/
git commit -m "$(cat <<'EOF'
feat(workspace): add three-column layout shell with resizable panels

Left sidebar (explorer/search toggle), center panel (content), right
sidebar (issue detail dock). Panels are resizable with pointer capture.
Content is placeholder — populated in Phase 1.
EOF
)"
```

---

## Task 10: Wire WorkspaceLayout into App.tsx CONSOLE Section

**Files:**
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Import and render WorkspaceLayout for CONSOLE section**

In App.tsx, find the CONSOLE section rendering (where `showConsole` is checked) and wrap the existing `TerminalMultiplexer` with `WorkspaceLayout`:

Add import:

```typescript
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout'
```

Replace the CONSOLE section rendering from:

```tsx
{sectionVisibility.showConsole && (
  <SectionErrorBoundary section="CONSOLE">
    <TerminalMultiplexer
      activeTerminals={openTerminals}
      // ... existing props
    />
  </SectionErrorBoundary>
)}
```

To:

```tsx
{sectionVisibility.showConsole && (
  <SectionErrorBoundary section="CONSOLE">
    <WorkspaceLayout
      centerContent={
        <TerminalMultiplexer
          activeTerminals={openTerminals}
          // ... existing props unchanged
        />
      }
    />
  </SectionErrorBoundary>
)}
```

- [ ] **Step 2: Add workspace keyboard shortcuts**

In the keyboard shortcut useEffect, add handlers for the new workspace shortcuts:

```typescript
// Inside the existing keydown handler:
if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
  e.preventDefault()
  useAppStore.getState().setActiveLeftPanel('explorer')
}
if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
  e.preventDefault()
  useAppStore.getState().setActiveLeftPanel('search')
}
if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
  e.preventDefault()
  // Cmd+B already toggles sidebar — repurpose for workspace left sidebar when in CONSOLE
  if (useAppStore.getState().activeSection === 'CONSOLE') {
    // Toggle left sidebar visibility will be added when explorer has content
  } else {
    useAppStore.getState().toggleSidebar()
  }
}
if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
  e.preventDefault()
  useAppStore.getState().toggleRightSidebar()
}
```

- [ ] **Step 3: Verify the full app works**

```bash
cd apps/desktop && npx vitest run
```

Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(workspace): wire three-column layout into CONSOLE section

Terminal multiplexer now renders inside WorkspaceLayout with explorer
sidebar (left) and issue detail dock (right). Keyboard shortcuts added
for Cmd+Shift+E (explorer), Cmd+Shift+F (search), Cmd+L (toggle right).
EOF
)"
```

---

## Task 11: Update AppShell for Flush Content in CONSOLE

**Files:**
- Modify: `apps/desktop/src/app/layout/AppShell.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Pass flushContent for CONSOLE section**

The CONSOLE section needs the full width without padding since the workspace layout manages its own spacing. In App.tsx, where AppShell is rendered, add:

```typescript
<AppShell
  // ... existing props
  flushContent={activeSection === 'CONSOLE'}
>
```

The `flushContent` prop already exists on AppShell (line 16 of AppShell.tsx) and applies `-mx-4` to remove horizontal padding. This gives the workspace layout edge-to-edge space.

- [ ] **Step 2: Verify visually**

Start the dev server and verify:
- CONSOLE section shows three-column layout (left sidebar with explorer/search toggle, center with terminals, right sidebar placeholder)
- Resize handles work (drag to resize left and right panels)
- Cmd+L toggles the right sidebar
- Other sections (ISSUES, PROJECTS, etc.) render normally with standard padding

```bash
cd apps/desktop && npm run dev:linux
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/app/layout/AppShell.tsx
git commit -m "$(cat <<'EOF'
fix(workspace): pass flushContent for edge-to-edge CONSOLE layout
EOF
)"
```

---

## Task 12: Final Verification — Full Test Suite + Typecheck

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 2: Run full test suite**

```bash
cd apps/desktop && npx vitest run --reporter=verbose
```

Expected: All tests PASS

- [ ] **Step 3: Run lint**

```bash
cd apps/desktop && npm run lint
```

Expected: No errors (or only pre-existing warnings)

- [ ] **Step 4: Run the existing smoke test**

```bash
cd apps/desktop && npm run test:smoke-renderer
```

Expected: PASS

- [ ] **Step 5: Final commit if any fixups needed**

```bash
git status
# If any fixups were needed during verification:
git add -A
git commit -m "fix(workspace): address typecheck and lint issues from Phase 0"
```

---

## Summary

| Task | What | Files Changed |
|---|---|---|
| 1 | Install Zustand, create store skeleton | package.json, store/index.ts, store/types.ts |
| 2 | UI slice (navigation, theme, modals) | slices/ui-slice.ts + test |
| 3 | Runtime slice (snapshot, timeline, SSE) | slices/runtime-slice.ts + test |
| 4 | Issues slice (board issues, dedup merge) | slices/issues-slice.ts + test |
| 5 | Remaining 6 slices (projects, agents, settings, terminals, workspace, editor) | 6 slice files + 6 test files |
| 6 | Compose store + integration test | store/index.test.ts |
| 7 | Migrate App.tsx to use store | App.tsx (major rewrite) |
| 8 | ResizeHandle component | workspace/ResizeHandle.tsx |
| 9 | Three-column workspace layout shell | WorkspaceLayout.tsx, LeftSidebar.tsx, RightSidebar.tsx |
| 10 | Wire layout into CONSOLE section | App.tsx |
| 11 | Flush content for full-width CONSOLE | AppShell.tsx, App.tsx |
| 12 | Full verification (typecheck, tests, lint) | None |

**Next plans to write after Phase 0 ships:**
- Phase 1A: File Explorer + IPC Bridge
- Phase 1B: Code Editor (Monaco)
- Phase 1C: Workspace Search
- Phase 2+3: Browser/Grab Mode, Markdown, Terminal, Settings, Analytics
