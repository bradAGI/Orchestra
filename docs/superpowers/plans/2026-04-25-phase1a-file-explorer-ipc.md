# Phase 1A: File Explorer + IPC Bridge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a virtual-scrolled file explorer in the workspace left sidebar that browses issue worktree directories, with filesystem IPC bridge for read/write operations.

**Architecture:** IPC bridge in preload.cjs + main.cjs exposes fs operations (readDir, readFile, writeFile, stat, deletePath). File explorer component uses @tanstack/react-virtual for performance, lazy-loads directories on expand, overlays git status. Workspace slice extended with dir cache and expanded dirs state.

**Tech Stack:** @tanstack/react-virtual, Electron IPC, Node.js fs/child_process, Zustand

**Depends on:** Phase 0 (Zustand store + workspace shell) — completed.

---

## File Structure

### New files:
```
electron/
  ipc-filesystem.cjs          — Main process IPC handlers for fs operations
src/
  components/workspace/
    FileExplorer.tsx           — Tree container with virtual scroll
    FileTreeRow.tsx            — Single row in the tree (file or directory)
    FileExplorer.test.tsx      — Component tests
  store/slices/
    workspace-slice.ts         — EXTEND with dirCache, expandedDirs, gitStatusMap
```

### Modified files:
```
electron/main.cjs             — Register IPC handlers from ipc-filesystem.cjs
electron/preload.cjs           — Expose fs APIs on window.orchestraDesktop
src/components/workspace/LeftSidebar.tsx  — Replace placeholder with FileExplorer
src/store/types.ts             — Extend WorkspaceSlice with explorer state
package.json                   — Add @tanstack/react-virtual
```

---

## Task 1: Install @tanstack/react-virtual

- [ ] Install: `cd apps/desktop && npm install @tanstack/react-virtual`
- [ ] Commit: `git add package.json package-lock.json && git commit -m "deps: add @tanstack/react-virtual for virtual scrolling"`

## Task 2: IPC Filesystem Bridge — Main Process

Create `electron/ipc-filesystem.cjs` with IPC handlers and register in main.cjs.

- [ ] Create `electron/ipc-filesystem.cjs` with these handlers:
  - `orchestra:fs:readDir` — Read directory, return sorted DirEntry[] (dirs first, then alpha). Filter `.git`, `node_modules`. Each entry: `{ name, isDirectory }`.
  - `orchestra:fs:stat` — Return `{ size, mtime, isDirectory }` for a path.
  - `orchestra:fs:readFile` — Return `{ content, isBinary }`. Binary detection: scan first 8KB for null bytes. Text limit 5MB.
  - `orchestra:fs:writeFile` — Write UTF-8 string to path. Guard against writing directories.
  - `orchestra:fs:deletePath` — Use `shell.trashItem()` for safe delete.
  - `orchestra:fs:gitStatus` — Run `git status --porcelain` in a directory, return `Record<string, string>` mapping relative path to status code.
  - All handlers validate paths start with an authorized workspace root.

- [ ] In main.cjs, require and call the registration function from ipc-filesystem.cjs.
- [ ] Commit.

## Task 3: IPC Filesystem Bridge — Preload

Expose fs APIs on `window.orchestraDesktop`.

- [ ] Add to preload.cjs:
  ```javascript
  fs: {
    readDir: (dirPath) => ipcRenderer.invoke('orchestra:fs:readDir', dirPath),
    readFile: (filePath) => ipcRenderer.invoke('orchestra:fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('orchestra:fs:writeFile', filePath, content),
    stat: (filePath) => ipcRenderer.invoke('orchestra:fs:stat', filePath),
    deletePath: (filePath) => ipcRenderer.invoke('orchestra:fs:deletePath', filePath),
    gitStatus: (worktreePath) => ipcRenderer.invoke('orchestra:fs:gitStatus', worktreePath),
  },
  ```
- [ ] Commit.

## Task 4: Extend Workspace Slice with Explorer State

- [ ] Update `src/store/types.ts` WorkspaceSlice to add:
  ```typescript
  expandedDirs: Set<string>
  dirCache: Record<string, { children: TreeNode[]; loading: boolean }>
  gitStatusMap: Record<string, string>
  toggleDir: (path: string) => void
  setDirChildren: (path: string, children: TreeNode[]) => void
  setDirLoading: (path: string, loading: boolean) => void
  setGitStatusMap: (map: Record<string, string>) => void
  clearExplorerCache: () => void
  ```
  Where `TreeNode = { name: string; path: string; relativePath: string; isDirectory: boolean; depth: number }` (add to types.ts).

- [ ] Update `src/store/slices/workspace-slice.ts` implementation.
- [ ] Update tests.
- [ ] Commit.

## Task 5: FileTreeRow Component

- [ ] Create `src/components/workspace/FileTreeRow.tsx`:
  - Props: `node: TreeNode`, `isExpanded: boolean`, `gitStatus?: string`, `onToggle: () => void`, `onClick: () => void`
  - Renders: indentation (depth * 16 + 8px padding), folder/file icon, name, git status color
  - Folder icon: chevron right (collapsed) / chevron down (expanded)
  - File icon: infer from extension (use lucide icons)
  - Git status colors: green (A/added), orange (M/modified), grey (?? untracked)
  - Height: 26px fixed
- [ ] Commit.

## Task 6: FileExplorer Component

- [ ] Create `src/components/workspace/FileExplorer.tsx`:
  - Uses `@tanstack/react-virtual` with `useVirtualizer`
  - Reads `explorerRoot`, `expandedDirs`, `dirCache`, `gitStatusMap` from store
  - `flatRows` computed via useMemo: walk dirCache for expanded dirs, produce flat TreeNode[]
  - On dir expand: call `window.orchestraDesktop.fs.readDir()`, store results in dirCache via store action
  - On file click: no-op for now (Phase 1B wires this to Monaco editor)
  - Virtualizer config: estimateSize 26px, overscan 20
  - When `explorerRoot` changes: clear cache, load root dir, fetch git status
  - Loading state: show spinner while dir loads
  - Empty state: "Select a task to browse its workspace"

- [ ] Create `src/components/workspace/FileExplorer.test.tsx`:
  - Test flat row computation with mock dirCache
  - Test expand/collapse toggles expandedDirs

- [ ] Commit.

## Task 7: Wire FileExplorer into LeftSidebar

- [ ] Modify `src/components/workspace/LeftSidebar.tsx`:
  - Import FileExplorer
  - Replace explorer placeholder with `<FileExplorer />`
  - Keep search placeholder as-is (Phase 1C)

- [ ] Commit.

## Task 8: Wire explorerRoot to Active Issue

- [ ] In App.tsx or a new hook, when the user inspects an issue that has a workspace path, set `explorerRoot` in the store:
  - When issue detail is opened and has `workspace.path`, call `useAppStore.getState().setExplorerRoot(path)`
  - When issue detail is closed, optionally keep the root (don't clear — user might want to browse)

- [ ] Commit.

## Task 9: Final Verification

- [ ] Run: `cd apps/desktop && npx tsc --noEmit`
- [ ] Run: `cd apps/desktop && npx vitest run`
- [ ] Run: `cd apps/desktop && npm run lint`
- [ ] Commit any fixups.
