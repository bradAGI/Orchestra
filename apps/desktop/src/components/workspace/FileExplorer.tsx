import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppStore } from '@/store'
import type { TreeNode } from '@/store/types'
import { FileTreeRow } from './FileTreeRow'

export function FileExplorer() {
  const explorerRoot = useAppStore((s) => s.explorerRoot)
  const expandedDirs = useAppStore((s) => s.expandedDirs)
  const dirCache = useAppStore((s) => s.dirCache)
  const gitStatusMap = useAppStore((s) => s.gitStatusMap)
  const toggleDir = useAppStore((s) => s.toggleDir)
  const setDirChildren = useAppStore((s) => s.setDirChildren)
  const setDirLoading = useAppStore((s) => s.setDirLoading)
  const setGitStatusMap = useAppStore((s) => s.setGitStatusMap)
  const clearExplorerCache = useAppStore((s) => s.clearExplorerCache)
  const openFile = useAppStore((s) => s.openFile)
  const config = useAppStore((s) => s.config)

  // ---- Auto-detect workspace root from running issues -----------------------
  const snapshot = useAppStore((s) => s.snapshot)
  useEffect(() => {
    if (explorerRoot) return
    const running = snapshot?.running ?? []
    for (const entry of running) {
      if (entry.session_log_path) {
        const logsIdx = entry.session_log_path.indexOf('/_logs/')
        if (logsIdx > 0) {
          useAppStore.getState().setExplorerRoot(entry.session_log_path.slice(0, logsIdx))
          return
        }
      }
    }
  }, [explorerRoot, snapshot])

  // ---- Load root directory when explorerRoot changes -------------------------
  useEffect(() => {
    if (!explorerRoot) return
    clearExplorerCache()

    const loadRoot = async () => {
      if (!config) return
      try {
        const url = `${config.baseUrl}/api/v1/workspace/tree?path=${encodeURIComponent(explorerRoot)}`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${config.apiToken}` },
        })
        if (!res.ok) {
          setDirChildren(explorerRoot, [])
          return
        }
        const tree: Array<{ name: string; path: string; is_dir: boolean }> = await res.json()
        const children: TreeNode[] = tree.map((entry) => ({
          name: entry.name,
          path: `${explorerRoot}/${entry.name}`,
          relativePath: entry.name,
          isDirectory: entry.is_dir,
          depth: 0,
        }))
        setDirChildren(explorerRoot, children)

        try {
          const status = await window.orchestraDesktop?.fs?.gitStatus?.(explorerRoot)
          if (status) setGitStatusMap(status)
        } catch { /* git status is best-effort */ }
      } catch {
        setDirChildren(explorerRoot, [])
      }
    }

    loadRoot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explorerRoot])

  // ---- Flatten the tree for virtual scrolling --------------------------------
  const flatRows = useMemo(() => {
    if (!explorerRoot || !dirCache[explorerRoot]) return []
    const rows: TreeNode[] = []

    function walk(dirPath: string) {
      const cache = dirCache[dirPath]
      if (!cache) return
      for (const child of cache.children) {
        rows.push(child)
        if (child.isDirectory && expandedDirs.has(child.path)) {
          walk(child.path)
        }
      }
    }

    walk(explorerRoot)
    return rows
  }, [explorerRoot, dirCache, expandedDirs])

  // ---- Virtualizer -----------------------------------------------------------
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 20,
  })

  // ---- Directory toggle with lazy loading ------------------------------------
  async function handleToggleDir(node: TreeNode) {
    const wasExpanded = expandedDirs.has(node.path)
    toggleDir(node.path)

    if (!wasExpanded && !dirCache[node.path]) {
      setDirLoading(node.path, true)

      if (config) {
        try {
          const url = `${config.baseUrl}/api/v1/workspace/tree?path=${encodeURIComponent(node.path)}`
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${config.apiToken}` },
          })
          if (res.ok) {
            const tree: Array<{ name: string; path: string; is_dir: boolean }> = await res.json()
            const children: TreeNode[] = tree.map((entry) => ({
              name: entry.name,
              path: `${node.path}/${entry.name}`,
              relativePath: `${node.relativePath}/${entry.name}`,
              isDirectory: entry.is_dir,
              depth: node.depth + 1,
            }))
            setDirChildren(node.path, children)
          } else {
            setDirChildren(node.path, [])
          }
          return
        } catch {
          setDirChildren(node.path, [])
          return
        }
      }

      // Fallback: Electron IPC
      try {
        const entries = await window.orchestraDesktop.fs.readDir(node.path)
        const children: TreeNode[] = entries.map((e) => ({
          name: e.name,
          path: `${node.path}/${e.name}`,
          relativePath: `${node.relativePath}/${e.name}`,
          isDirectory: e.isDirectory,
          depth: node.depth + 1,
        }))
        setDirChildren(node.path, children)
      } catch {
        setDirChildren(node.path, [])
      }
    }
  }

  // ---- Empty state -----------------------------------------------------------
  if (!explorerRoot) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="text-xs text-muted-foreground">
          No workspace folder open
        </p>
        <button
          className="text-xs px-3 py-1.5 rounded bg-accent hover:bg-accent/80 text-accent-foreground w-fit"
          onClick={async () => {
            try {
              const folder = await window.orchestraDesktop.selectFolder()
              if (folder) {
                useAppStore.getState().setExplorerRoot(folder)
              }
            } catch { /* user cancelled */ }
          }}
        >
          Open Folder
        </button>
      </div>
    )
  }

  // ---- Render ----------------------------------------------------------------
  return (
    <div ref={parentRef} className="h-full overflow-auto" role="tree">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const node = flatRows[virtualRow.index]
          return (
            <FileTreeRow
              key={node.path}
              node={node}
              isExpanded={expandedDirs.has(node.path)}
              gitStatus={gitStatusMap[node.relativePath]}
              onToggle={() => handleToggleDir(node)}
              onClick={() => {
                if (!node.isDirectory) {
                  openFile(node.path, node.relativePath)
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
