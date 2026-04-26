# Workspace Platform Upgrade — Design Spec

**Date:** 2026-04-25
**Status:** Draft
**Scope:** Evolve Nautilus from an orchestration dashboard into a full workspace platform by integrating file explorer, code editor, browser preview, enhanced settings, analytics, and markdown rendering — borrowing architectural patterns from the Orca IDE while preserving Nautilus's backend-driven task orchestration model.

---

## 1. Goals

- Give users direct visibility into what agents produce (files, diffs, running apps) without leaving Nautilus
- Maintain Nautilus's task-first identity: issue → agent → result, with workspace context alongside
- Decompose the 1,385-line App.tsx into maintainable Zustand slices before adding features
- Ship in phases: foundation first, then parallel feature tracks

## 2. Non-Goals

- SSH/remote execution support (future work)
- Replacing the backend orchestration model with local-only agent management
- Building a general-purpose IDE (no debugger, no refactoring tools, no extension marketplace)
- Mobile or web-only support — this is Electron-only

## 3. Architecture Approach

**Hybrid: port Orca's patterns, build components against Nautilus's backend.**

Orca is local-first (all state in the renderer, filesystem IPC for everything). Nautilus is server-driven (Go backend, SQLite warehouse, SSE streaming). We port Orca's proven UI patterns (Zustand slice composition, virtual scrolling, webview registry, grab mode state machine) but wire them to the Orchestra backend API as the source of truth.

Key difference: Orca's file explorer reads from local git repos. Nautilus's file explorer reads from worktrees that the backend's workspace service created per-issue. Orca's analytics scan local JSONL files. Nautilus's analytics query the warehouse DB. The backend remains authoritative.

---

## 4. Foundation — Zustand Store Migration

### 4.1 Store Structure

Replace App.tsx's 46+ hooks with a single Zustand store composed from 9 slices using the spread-merge pattern. Each slice is a `StateCreator<AppState, [], [], SliceType>` factory.

| Slice | State | Current Source |
|---|---|---|
| `runtime` | Snapshot, timeline events, SSE connection status, polling fallback, reconnect generation counter | `runtime-sync.ts` + App.tsx hooks |
| `issues` | Issue list, active issue ID, issue detail cache, kanban column state, drag state | App.tsx useState calls |
| `projects` | Project list, active project ID, project detail cache | App.tsx project hooks |
| `terminals` | Terminal tabs (per-issue + user shells), active tab ID, PTY associations, split layouts, unread indicators, startup commands | TerminalMultiplexer local state |
| `agents` | Agent registry, provider config, active provider, per-issue agent status (working/blocked/done/idle) | App.tsx agent state |
| `settings` | Backend profiles, agent tokens, notification prefs, all new settings (terminal, appearance, git, browser, editor) | SettingsCard local state + localStorage |
| `ui` | Active section, sidebar collapsed state, modal stack, command palette state, toasts, theme | App.tsx navigation + modal state |
| `workspace` | Explorer root path, expanded dirs, dir cache, git status map, search query/results, active left sidebar panel (explorer/search) | **New** |
| `editor` | Open files array, active file ID, dirty state map, cursor/scroll position LRU cache, pending reveal (line/col from search) | **New** |

### 4.2 Persistence

No Zustand persist middleware. Instead:
- `settings` slice writes through to Electron IPC on every change (JSON file in `userData`)
- `runtime` slice is hydrated from SSE on connect
- `terminals` slice saves buffer captures on `beforeunload` via IPC
- `editor` slice saves open file list + cursor positions on `beforeunload`
- `issues`, `projects`, `agents` are server-driven — hydrated from backend API on startup

### 4.3 App.tsx Reduction

App.tsx shrinks from ~1,385 lines to ~200 lines:
- Store initialization and hydration
- Top-level layout shell (sidebar + main content routing)
- Global keyboard shortcut handler
- SSE connection lifecycle (connect on mount, reconnect on error)

All section-specific logic moves into the components that own it.

---

## 5. Three-Column Workspace Layout

### 5.1 Layout Structure

When `activeSection === 'CONSOLE'`, the main content area renders a three-column flex layout:

```
┌──────────────┬────────────────────────────────┬──────────────────┐
│  Left Sidebar│     Center Panel               │  Right Sidebar   │
│  (resizable) │     (flex-1)                   │  (resizable,     │
│              │                                │   optional)      │
│  ┌─────────┐ │  Tab Bar:                      │                  │
│  │Explorer │ │  [bash ▾] [main.tsx] [Preview] │  Issue Detail    │
│  │ / Search│ │                                │  - Overview      │
│  └─────────┘ │  ┌────────────────────────────┐│  - Plan          │
│              │  │                            ││  - Session Log   │
│  File tree   │  │  Active pane content       ││  - PR            │
│  or search   │  │  (terminal / editor /      ││                  │
│  results     │  │   browser)                 ││                  │
│              │  │                            ││                  │
│              │  └────────────────────────────┘│                  │
└──────────────┴────────────────────────────────┴──────────────────┘
```

### 5.2 Left Sidebar (Explorer/Search)

- Resizable via pointer capture (min 220px, max 500px), width persisted to settings
- Toggle: `Cmd+B`
- Two modes switched via icon buttons at the top:
  - **Explorer** (`Cmd+Shift+E`): File tree for the active issue's worktree
  - **Search** (`Cmd+Shift+F`): Workspace-scoped code search
- Root path comes from the backend: `GET /api/v1/issues/{id}` returns `workspace_path`
- When no issue is active: empty state with "Select a task to browse its workspace"

### 5.3 Center Panel (Tabbed Content)

Three tab types coexist in one tab bar:

| Type | Icon | Created By |
|---|---|---|
| Terminal | Terminal icon | Default on issue open, (+) menu |
| Editor | File-type icon (ts, go, md, etc.) | Click file in explorer, click search result |
| Browser | Globe icon | (+) menu → "New browser tab", agent suggestion |

- Tabs are draggable for reorder
- Split via drag-to-edge using react-mosaic (already a dependency)
- Tab context menu: Close, Close Others, Close All, Split Right, Split Down
- Active tab state persisted per-issue in the terminals slice

### 5.4 Right Sidebar (Issue Detail)

- The existing `IssueDetailView` component, docked as a collapsible right panel
- Resizable (min 280px, max 500px)
- Toggle: `Cmd+L`
- Shows the currently active issue's detail (Overview, Plan, Session Log, PR tabs)
- Collapses to zero width when hidden, stays mounted to preserve tab state

### 5.5 Other Sections

ISSUES (kanban), PROJECTS, AGENTS, WAREHOUSE, SETTINGS, DOCS keep their existing single-panel layouts. The three-column treatment is exclusive to the CONSOLE/workspace view.

---

## 6. File Explorer

### 6.1 Data Model

```typescript
interface TreeNode {
  name: string
  path: string           // absolute path
  relativePath: string   // relative to worktree root
  isDirectory: boolean
  depth: number
}

interface DirCache {
  children: TreeNode[]
  loading: boolean
}

// Zustand workspace slice (explorer + search state)
interface WorkspaceSlice {
  explorerRoot: string | null
  expandedDirs: Set<string>
  dirCache: Record<string, DirCache>
  gitStatusMap: Record<string, string>  // relativePath → status code (M, A, ??, etc.)
  searchQuery: string
  searchResults: SearchResult[]
  activeLeftPanel: 'explorer' | 'search'
}
```

### 6.2 Rendering

Virtual-scrolled flat list using `@tanstack/react-virtual`:
- Estimated row height: 26px
- Overscan: 20 items
- `flatRows` computed via `useMemo`: recursively walk `dirCache` for expanded directories, producing a flat array
- Indentation: `depth * 16 + 8px` left padding
- Icons: folder open/closed, file-type icons (from file extension)
- Git status: colored dot or text color override per row (green=added, orange=modified, grey=untracked)

### 6.3 Lazy Loading

- Directories load children on expand via IPC `fs:readDir`
- Unexpanded directories never fetched
- Default filters: `.git`, `node_modules`, `.orchestra` excluded
- Sort: directories first, then alphabetical case-insensitive

### 6.4 File Watching

- `@parcel/watcher` (native, fast) as primary, with `chokidar` as fallback
- 150ms trailing-edge debounce with 500ms max wait for burst coalescing
- On filesystem change: reconcile the affected `DirCache` entry
- Agent writes trigger automatic tree updates (visible in real-time as agents create/modify files)

### 6.5 Context Menu

- New File / New Folder
- Rename (inline input, selection covers filename stem only)
- Delete (via `shell.trashItem`, not permanent delete)
- Copy Path / Copy Relative Path
- Reveal in System File Manager
- Open in Terminal (creates new terminal tab cd'd to the directory)

### 6.6 Auto-Reveal

When an SSE event indicates an agent modified a file in the active worktree, the explorer auto-expands parent directories and scrolls to highlight the changed file. Throttled to once per second to avoid thrashing during rapid agent writes.

---

## 7. Code Editor (Monaco)

### 7.1 Integration

Monaco editor renders inside editor tabs in the center panel. One `MonacoEditor` component instance per open file, wrapped in `EditorPanel`.

### 7.2 File Opening Flow

1. User clicks file in explorer (or search result)
2. Store action `openFile({ filePath, relativePath, worktreeId, language })` fires
3. If file already open, activate its tab
4. Otherwise: add to `openFiles` array, set as `activeFileId`
5. `EditorPanel` reacts, calls `fs:readFile` via IPC
6. IPC returns `{ content, isBinary, mimeType? }` — binary detection scans first 8KB for null bytes
7. If binary: render preview (image viewer for png/jpg/gif/svg, PDF viewer for pdf, hex dump for unknown)
8. If text: render Monaco with detected language

### 7.3 Tab Management

- Editor tabs sit alongside terminal and browser tabs in the same tab bar
- Distinguished by file-type icon (inferred from extension)
- Dirty indicator: dot overlay on tab icon when unsaved changes exist
- Close tab: if dirty, prompt "Save changes to {filename}?" with Save/Don't Save/Cancel
- Middle-click to close
- Double-click tab to pin (pinned tabs can't be accidentally closed)

### 7.4 Editing Features

- **Save**: `Cmd+S` writes via `fs:writeFile` IPC. Clears dirty state.
- **Autosave**: Configurable delay (off / 1s / 3s / 5s) in editor settings. Managed by a debounced write timer per file.
- **Undo/Redo**: Monaco built-in. `keepCurrentModel` flag preserves undo history across tab switches.
- **Scroll/cursor cache**: LRU cache (max 100 entries) keyed by file path. Restores position when re-opening a file.
- **Language detection**: Map file extension to Monaco language ID. Covers all common languages (TypeScript, Go, Python, Rust, etc.).
- **Theme**: Follows app dark/light theme. Custom Monaco theme matching Nautilus color palette.
- **Minimap**: Toggleable in editor settings, off by default.
- **Word wrap**: Toggleable in editor settings, on by default for markdown.

### 7.5 Diff Mode

- Triggered from git widget or file context menu ("Compare with HEAD")
- Uses Monaco's built-in diff editor
- Side-by-side view showing working copy vs last commit
- Useful for reviewing agent changes before committing

---

## 8. Workspace Search

### 8.1 Backend

`git grep -n -I --null --untracked` scoped to the active issue's worktree path. Chosen because:
- Always available (every workspace is a git repo)
- No external dependency (no ripgrep install needed)
- Respects .gitignore automatically
- Fast enough for most repos

Executed via IPC in the main process. A JS regex re-scans each matched line to find all submatch positions (git grep only reports first per line).

### 8.2 UI

Located in the left sidebar as an alternate panel to the explorer:

- **Input**: Search query with 300ms debounce
- **Toggles**: Case-sensitive, whole word, regex
- **Filters**: Include/exclude glob patterns (e.g., `*.go`, `!vendor/`)
- **Results**: Virtual-scrolled list (28px file headers, 20px match rows, 12-item overscan)
- **File grouping**: Results grouped by file with match count badge. Files collapsible.
- **Match highlighting**: Query matches highlighted in yellow within result lines
- **Action**: Click a match → opens file in editor tab at the matched line/column via `pendingEditorReveal`

### 8.3 Constraints

- Max 2000 results
- Max 100 matches per file
- 15-second timeout
- Previous search killed before starting a new one (avoid stale results)
- Scope indicator: "Searching in {worktree branch name}" shown above results

---

## 9. Browser Preview + Grab Mode

### 9.1 Browser Pane

A third tab type in the center panel:

- **Webview**: Electron `<webview>` tag with dedicated partition `ORCHESTRA_BROWSER_PARTITION`
- **Creation**: Imperative `document.createElement('webview')` with attributes set before DOM insertion
- **Persistent registry**: Module-level `Map<string, WebviewTag>`. Inactive webviews parked in hidden off-screen container (`position: fixed; left: -9999px`). LRU eviction at max 6 parked entries.
- **Navigation bar**: URL input (omnibox-style with autocomplete from history), back/forward/refresh buttons, loading spinner, page title display
- **Navigation state**: Per-tab `BrowserPageState` updated from webview DOM events (`did-navigate`, `did-fail-load`, `page-title-updated`, `page-favicon-updated`, `did-start-loading`, `did-stop-loading`)
- **DevTools**: Menu button opens Chromium DevTools for the guest webview
- **Multiple tabs**: Each browser tab is a separate entry in the store's `browser` state
- **Drag passthrough**: Global drag listeners toggle `pointerEvents: none` on all webviews so drag-drop works in the host app

### 9.2 Grab Mode

State machine for capturing UI elements → feeding to embedded agent chat.

**States:**

```
idle → armed → awaiting → confirming → idle (or re-arm)
                                     ↘ error
```

1. **idle**: Default. Crosshair button in browser toolbar.
2. **armed**: Click crosshair. Guest script injected via `webview.executeJavaScript()`. Transparent overlay renders in the guest page with hover tracking (white border + label pill: tag, dimensions, role).
3. **awaiting**: IPC call awaits user click. Left-click = quick capture (auto-copy, re-arm). Right-click = context menu.
4. **confirming**: Payload received. Confirmation sheet with "Copy to clipboard" and "Attach to agent chat".

**Guest script**: Self-contained JS string, no dependencies. Injected into the webview's page world. Handles hover tracking, element highlighting, click capture, payload extraction. Communicates back via IPC.

**BrowserGrabPayload:**

```typescript
interface BrowserGrabPayload {
  page: {
    url: string          // query strings stripped
    title: string
    viewport: { width: number; height: number }
    scroll: { x: number; y: number }
  }
  target: {
    tag: string
    selector: string     // CSS selector
    text: string         // 200 char cap
    html: string         // 4KB cap
    attributes: Record<string, string>  // safe whitelist only
    rect: DOMRect
  }
  accessibility: {
    role: string
    ariaLabels: Record<string, string>
    accessibleName: string
  }
  styles: Record<string, string>  // 16 key computed properties
  nearby: string[]       // up to 10 sibling text entries
  ancestors: string[]    // tag path to root
  screenshot?: string    // base64 viewport crop, max 2MB
}
```

Secret redaction: filter `access_token`, `api_key`, `password`, `secret`, `credential` patterns from attributes, URLs, and text content.

### 9.3 Integration with Embedded Agent

"Attach to agent chat" action:
1. Serialize `BrowserGrabPayload` as structured text (element info, styles, accessibility, context)
2. Inject into `EmbeddedAgentPanel` as a user message
3. If screenshot captured, attach as an image
4. Exit grab mode so user continues in the chat
5. Agent receives full context about the selected element — structure, styles, a11y info, visual reference

---

## 10. Settings Redesign

### 10.1 Layout

Replace tabbed `SettingsCard` with single scrollable page + sidebar navigator:

- **Sidebar** (fixed, ~200px): Section list with active section highlighted. Click to smooth-scroll with 900ms CSS flash animation. Search input at top filters sections by keyword.
- **Content** (scrollable): All panes stacked vertically with section headers and dividers.
- **Scroll tracking**: `scroll` event + `requestAnimationFrame` throttle. Probe line at 40% viewport height determines active section. Force-highlights last section when scrolled to bottom.

### 10.2 Panes

| # | Pane | Contents | Status |
|---|---|---|---|
| 1 | **General** | Workspace root, auto-start backend, update check | Merge from Backend tab |
| 2 | **Connections** | Backend profiles (CRUD, baseUrl, apiToken), GitHub OAuth, agent API keys | Merge from Backend + Integrations |
| 3 | **Agents** | Default provider, per-provider config (model, max turns, commands) | Enhance existing |
| 4 | **Git** | Branch naming convention, auto-commit, PR template defaults | New |
| 5 | **Appearance** | Theme (system/dark/light), UI scale, sidebar width, accent color | New |
| 6 | **Terminal** | Font family/size, scrollback (1K/5K/10K/custom), cursor style, theme preview | New |
| 7 | **Editor** | Font size, tab width, word wrap, autosave delay, minimap | New |
| 8 | **Browser** | Home page URL, link routing (internal/external), clear session | New |
| 9 | **Notifications** | Sound, volume, mute, desktop notification triggers | Enhance existing |
| 10 | **Shortcuts** | Keyboard shortcut reference grouped by category | Enhance existing |
| 11 | **Experimental** | Feature flags (browser preview, grab mode, etc.) | New |
| 12+ | **Per-Project** | Default agent, hooks, branch naming, workspace root override | New |

### 10.3 Persistence

All settings stored as JSON in `app.getPath('userData')/orchestra-settings.json` via Electron IPC. The `settings` Zustand slice holds in-memory state. Changes write-through immediately (no save button). Backend profiles remain in their existing `backend-profiles.json` file.

### 10.4 Search

Each pane exports a `SEARCH_ENTRIES` array:
```typescript
interface SettingsSearchEntry {
  title: string
  description: string
  keywords: string[]
  sectionId: string
}
```

Sidebar search filters by matching against all entries. Non-matching sections visually dim or collapse.

---

## 11. Analytics Enhancement

### 11.1 Landing Dashboard

Top of the WAREHOUSE section, above the existing drill-down tabs:

**6 stat cards (top row):**

| Card | Source | Display |
|---|---|---|
| Active Sessions | Runtime snapshot (SSE) | Count with provider breakdown |
| Total Tokens | Warehouse DB | Formatted (1.2M) with input/output split |
| Cache Reuse Rate | Warehouse DB | Percentage with trend arrow vs previous period |
| Estimated Cost | Warehouse DB + pricing config | USD total with daily delta |
| Issues Completed | Warehouse DB | Count in selected time range |
| Avg Session Duration | Warehouse DB | Minutes with trend vs previous period |

**Controls:**
- Time range selector: 7d / 30d / 90d / All
- Scope filter: "All projects" / specific project dropdown

**Daily token chart:**
- Stacked bar chart (one bar per day)
- Segments colored by model (distinct colors for Opus, Sonnet, Haiku, etc.)
- Tooltip on hover: exact token counts per model
- Built with recharts or raw SVG

**Summary tables (below chart):**
- Top 5 models: name, tokens, cost, % of total
- Top 5 projects: name, sessions, tokens, cost
- Recent sessions: ID, project, provider, duration, tokens, cost, status (clickable → session detail)

### 11.2 Drill-Down Tabs

Preserved from existing analytics, rendered below the landing dashboard:
- **Executive** — High-level KPIs
- **Operational** — Detailed session metrics, per-agent breakdowns, timeline
- **Optimization** — Cost analysis, cache hit rate trends, efficiency recommendations

### 11.3 Cost Estimation

Pricing config (editable in settings):

| Model | Input (per 1M) | Output (per 1M) | Cache Read | Cache Write |
|---|---|---|---|---|
| claude-opus-4 | $15.00 | $75.00 | 0.1x input | 1.25x input |
| claude-sonnet-4 | $3.00 | $15.00 | 0.1x input | 1.25x input |
| claude-haiku-3.5 | $0.80 | $4.00 | 0.1x input | 1.25x input |

Applied to warehouse DB columns: `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` (all already exist in the events table schema).

### 11.4 Data Source

All data from the warehouse DB via backend API. No local JSONL file scanning — the `sessionlogger` package writes through the backend, which is authoritative. Cleaner and more reliable than Orca's file-scanning approach.

---

## 12. Markdown Rendering

### 12.1 Shared Component

Single `MarkdownRenderer` component replaces all three current `ReactMarkdown` usages (docs dashboard, embedded agent chat, issue descriptions):

```typescript
interface MarkdownRendererProps {
  content: string
  className?: string
  allowHtml?: boolean     // default false
  enableMermaid?: boolean // default true
  enableMath?: boolean    // default true
}
```

### 12.2 Plugin Stack

**Remark:** `remark-gfm` (existing), `remark-math` (new), `remark-breaks` (new)

**Rehype:** `rehype-highlight` (replace Prism), `rehype-katex` (new), `rehype-sanitize` (new, extended schema: `details`, `summary`, `kbd`, `sub`, `sup`, `ins`, `id` on headings, `className` on code), `rehype-slug` (new, heading anchors via GithubSlugger)

### 12.3 Mermaid Diagrams

`MermaidBlock` component for fenced code blocks with language `mermaid`:
- Serialized render queue (module-level promise chain) to avoid global DOM state races
- `mermaid.initialize()` called inside the serialized task (prevents theme config races)
- Output sanitized: `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })`
- Theme follows app dark/light mode
- Fallback: raw source in code block with error banner on render failure

### 12.4 Code Blocks

- Copy-to-clipboard button (top-right, on hover)
- Language label badge
- Syntax highlighting via `rehype-highlight` + `lowlight`

### 12.5 Find-in-Preview

For the docs dashboard:
- `Cmd+F` intercept when markdown preview focused
- Match highlighting with active match distinction (yellow vs orange)
- Navigation: `Enter`/`Shift+Enter` or arrow buttons
- Match count display

---

## 13. Terminal Enhancements

### 13.1 Terminal Search

Floating search panel (absolute top-right, z-50) inside the active terminal pane:
- xterm `SearchAddon` with custom decoration colors (yellow matches, orange active match)
- Case-sensitive and regex toggle buttons
- Match count display, next/prev navigation
- `Cmd+F` to open, `Escape` to close, `Cmd+G` / `Cmd+Shift+G` for next/prev

### 13.2 Buffer Capture + Session Restore

- **Capture**: On `beforeunload`, serialize all terminal panes via `SerializeAddon.serialize({ scrollback })`. Binary search on scrollback param if result exceeds 512KB. Store keyed by pane ID.
- **Storage**: Persist to `userData` via IPC (too large for in-memory state).
- **Restore**: On hydration, write saved ANSI buffer into xterm. `replayingRef` guard suppresses `onData` during restore.
- **Scope**: Per-issue terminal sessions restored when returning to an issue.

### 13.3 Agent Completion Detection

- PTY exit callback marks terminal tab with completion indicator
- SSE event correlation: match terminal sessions with backend agent events for richer status (working/waiting/completed/errored)
- Unread indicator on background tabs when agent completes
- Desktop notification (optional, configurable in settings)

---

## 14. IPC Bridge Extensions

New filesystem APIs exposed via `window.orchestraDesktop` in `preload.cjs`:

```typescript
interface OrchestraDesktopFS {
  readDir(dirPath: string): Promise<DirEntry[]>
  readFile(filePath: string): Promise<{ content: string; isBinary: boolean; mimeType?: string }>
  writeFile(filePath: string, content: string): Promise<void>
  stat(filePath: string): Promise<{ size: number; mtime: number; isDirectory: boolean }>
  deletePath(filePath: string): Promise<void>
  search(worktreePath: string, query: string, options: SearchOptions): Promise<SearchResult[]>
  watch(dirPath: string, callback: (events: WatchEvent[]) => void): () => void
}
```

All paths validated against authorized workspace roots (worktree paths from the backend). No arbitrary filesystem access. The `search` method wraps `git grep` execution in the main process.

Browser-related IPC additions:
```typescript
interface OrchestraDesktopBrowser {
  registerGuest(webContentsId: number): void
  unregisterGuest(webContentsId: number): void
  openDevTools(webContentsId: number): void
  setGrabMode(webContentsId: number, enabled: boolean): void
  awaitGrabSelection(webContentsId: number): Promise<BrowserGrabPayload>
  cancelGrab(webContentsId: number): void
  captureScreenshot(webContentsId: number, rect: DOMRect): Promise<string>
}
```

---

## 15. New Dependencies

| Package | Purpose | Phase |
|---|---|---|
| `zustand` | Global state management | 0 (Foundation) |
| `@tanstack/react-virtual` | Virtual scrolling for file tree and search results | 1 (Explorer) |
| `monaco-editor` | Code editing | 1 (Editor) |
| `@monaco-editor/react` | React wrapper for Monaco | 1 (Editor) |
| `@parcel/watcher` | Native filesystem watching | 1 (Explorer) |
| `remark-math` | Parse math notation in markdown | 2 (Markdown) |
| `remark-breaks` | Newline handling in markdown | 2 (Markdown) |
| `rehype-katex` | Render math equations | 2 (Markdown) |
| `rehype-highlight` | Code syntax highlighting (replaces Prism) | 2 (Markdown) |
| `rehype-sanitize` | HTML sanitization | 2 (Markdown) |
| `rehype-slug` | Heading anchors | 2 (Markdown) |
| `katex` | Math rendering engine | 2 (Markdown) |
| `mermaid` | Diagram rendering | 2 (Markdown) |
| `dompurify` | SVG sanitization for Mermaid output | 2 (Markdown) |
| `recharts` | Charts for analytics dashboard | 3 (Analytics) |
| `github-slugger` | Heading ID generation | 2 (Markdown) |

---

## 16. Implementation Phases

### Phase 0: Foundation (Zustand + Workspace Shell)
- Extract App.tsx into 8 Zustand slices
- Build three-column workspace layout shell (empty panels, resize handles, toggles)
- Wire keyboard shortcuts (`Cmd+B`, `Cmd+L`, `Cmd+Shift+E`, `Cmd+Shift+F`)
- Verify all existing features work unchanged after migration

### Phase 1: Workspace Features (parallel tracks after Phase 0)

**Track A — File Explorer:**
- IPC bridge for filesystem operations
- TreeNode data model + DirCache
- Virtual-scrolled file tree component
- Git status overlay
- File watching + auto-reconciliation
- Context menu (new, rename, delete, copy path)
- Auto-reveal on agent file changes

**Track B — Code Editor:**
- Monaco integration with EditorPanel wrapper
- Tab management (open, close, switch, dirty state)
- File read/write via IPC
- Autosave with configurable delay
- Scroll/cursor position cache
- Diff mode (compare with HEAD)
- Language detection + theme

**Track C — Search:**
- git grep IPC wrapper
- Search UI panel in left sidebar
- Virtual-scrolled results with file grouping
- Click-to-open-in-editor wiring
- Filter toggles (case, word, regex, globs)

### Phase 2: Browser + Markdown + Terminal (parallel tracks)

**Track D — Browser Preview:**
- Webview integration with persistent registry
- Navigation bar (URL, back/forward/refresh)
- Multiple browser tabs
- DevTools access

**Track E — Grab Mode:**
- State machine (idle → armed → awaiting → confirming)
- Guest script injection
- Payload capture and secret redaction
- Integration with embedded agent chat

**Track F — Markdown Upgrade:**
- Shared MarkdownRenderer component
- Mermaid rendering with serialized queue
- KaTeX math support
- Enhanced code blocks (copy, language label)
- Find-in-preview

**Track G — Terminal Enhancements:**
- Terminal search (SearchAddon integration)
- Buffer capture + session restore
- Agent completion detection + unread indicators

### Phase 3: Settings + Analytics

**Track H — Settings Redesign:**
- Scrollable page layout with sidebar navigator
- Migrate existing 4 tabs into new pane structure
- Add new panes (Git, Appearance, Terminal, Editor, Browser, Experimental, per-Project)
- Settings search

**Track I — Analytics Enhancement:**
- Stat cards landing dashboard
- Daily token chart
- Cost estimation with pricing config
- Summary tables (models, projects, sessions)
- Scope and time range filtering

---

## 17. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+B` | Toggle left sidebar (explorer/search) |
| `Cmd+L` | Toggle right sidebar (issue detail) |
| `Cmd+Shift+E` | Open explorer in left sidebar |
| `Cmd+Shift+F` | Open search in left sidebar |
| `Cmd+P` | Quick open file (fuzzy search) |
| `Cmd+S` | Save active editor file |
| `Cmd+W` | Close active tab |
| `Cmd+F` | Search in terminal / find in markdown preview |
| `Cmd+G` | Next search match |
| `Cmd+Shift+G` | Previous search match |
| `Cmd+\` | Split active pane |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Cmd+1-8` | Switch to sidebar section (existing) |

---

## 18. Security Considerations

- **Filesystem access**: All IPC file operations validate paths against authorized workspace roots. No arbitrary filesystem access from the renderer.
- **Webview isolation**: Browser preview uses a dedicated partition. Guest pages cannot access the host renderer's DOM or IPC.
- **Grab mode**: Secret patterns (api_key, password, token, secret, credential) are redacted from captured payloads before they reach the renderer or agent chat.
- **CSP**: Existing Content Security Policy in main.cjs remains enforced. Webview partition means the guest's CSP is independent.
- **Editor writes**: Write operations are gated to files within worktree directories. Cannot write outside workspace roots.
