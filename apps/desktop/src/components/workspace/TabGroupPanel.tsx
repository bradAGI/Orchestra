import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  File,
  Globe,
  Terminal,
  X,
  Plus,
  FileText,
  SplitSquareHorizontal,
  SplitSquareVertical,
} from 'lucide-react'
import { useAppStore } from '@/store'
import type { TabGroup, TabRef, WorkspaceContextID } from '@/store/types'
import { EditorContent } from './EditorContent'
import { BrowserContent } from './BrowserContent'
import { TerminalView } from '@/components/terminal/TerminalView'
import { TabContextMenu } from './TabContextMenu'
import { ORCHESTRA_FILE_MIME } from './FileTreeRow'

interface TabGroupPanelProps {
  projectId: WorkspaceContextID
  group: TabGroup
  isFocused: boolean
  /** Existing groupIds in the project — used for "Move to" submenu (future). */
  siblingGroupIds: string[]
}

export function TabGroupPanel({ projectId, group, isFocused, siblingGroupIds }: TabGroupPanelProps) {
  const openFiles = useAppStore((s) => s.openFiles)
  const browserTabs = useAppStore((s) => s.browserTabs)
  const openTerminals = useAppStore((s) => s.openTerminals)
  const config = useAppStore((s) => s.config)
  const explorerRoot = useAppStore((s) => s.explorerRoot)

  const activateTabInGroup = useAppStore((s) => s.activateTabInGroup)
  const removeTabFromGroup = useAppStore((s) => s.removeTabFromGroup)
  const addTabToGroup = useAppStore((s) => s.addTabToGroup)
  const splitGroup = useAppStore((s) => s.splitGroup)
  const closeGroup = useAppStore((s) => s.closeGroup)
  const setFocusedGroup = useAppStore((s) => s.setFocusedGroup)
  const closeFile = useAppStore((s) => s.closeFile)
  const closeBrowserTab = useAppStore((s) => s.closeBrowserTab)
  const setOpenTerminals = useAppStore((s) => s.setOpenTerminals)
  const openFile = useAppStore((s) => s.openFile)
  const openBrowserTab = useAppStore((s) => s.openBrowserTab)

  const [plusOpen, setPlusOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: TabRef } | null>(null)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const plusRef = useRef<HTMLButtonElement>(null)
  const splitRef = useRef<HTMLButtonElement>(null)
  const [plusAnchor, setPlusAnchor] = useState<{ left: number; top: number } | null>(null)
  const [splitAnchor, setSplitAnchor] = useState<{ right: number; top: number } | null>(null)

  // Close popovers on outside click / Esc
  useEffect(() => {
    if (!plusOpen && !splitOpen) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        plusRef.current && !plusRef.current.contains(target) &&
        splitRef.current && !splitRef.current.contains(target) &&
        !document.querySelector('[data-portal-menu="open"]')?.contains(target)
      ) {
        setPlusOpen(false)
        setSplitOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlusOpen(false)
        setSplitOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [plusOpen, splitOpen])

  const closeTab = useCallback(
    (ref: TabRef) => {
      // Remove from group's tab list first
      removeTabFromGroup(projectId, ref.id)
      // Then dispose the underlying resource
      if (ref.type === 'editor') closeFile(ref.id)
      if (ref.type === 'browser') closeBrowserTab(ref.id)
      if (ref.type === 'terminal') {
        setOpenTerminals(openTerminals.filter((t) => t.id !== ref.id))
      }
    },
    [projectId, removeTabFromGroup, closeFile, closeBrowserTab, setOpenTerminals, openTerminals],
  )

  // Render content for the active tab
  const activeRef = group.tabs.find((t) => t.id === group.activeTabId)
  const activeContent: ReactNode = (() => {
    if (!activeRef) return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/40 p-8">
        <Plus size={28} strokeWidth={1.4} />
        <p className="text-xs">Open a tab in this group via the + button.</p>
      </div>
    )
    if (activeRef.type === 'editor') {
      const file = openFiles.find((f) => f.id === activeRef.id)
      return file ? <EditorContent file={file} /> : null
    }
    if (activeRef.type === 'browser') {
      const tab = browserTabs.find((t) => t.id === activeRef.id)
      return tab ? <BrowserContent tab={tab} /> : null
    }
    if (activeRef.type === 'terminal') {
      const term = openTerminals.find((t) => t.id === activeRef.id)
      if (!term || !config) return null
      return (
        <TerminalView
          sessionId={term.id}
          projectId={term.projectId}
          cwd={term.cwd}
          baseUrl={config.baseUrl}
          apiToken={config.apiToken}
          initialCommand={term.initialCommand}
        />
      )
    }
    return null
  })()

  const titleFor = (ref: TabRef): { title: string; isDirty?: boolean } => {
    if (ref.type === 'editor') {
      const f = openFiles.find((x) => x.id === ref.id)
      return { title: f?.relativePath.split('/').pop() ?? 'Untitled', isDirty: f?.isDirty }
    }
    if (ref.type === 'browser') {
      const t = browserTabs.find((x) => x.id === ref.id)
      return { title: t?.title || 'New Tab' }
    }
    if (ref.type === 'terminal') {
      const t = openTerminals.find((x) => x.id === ref.id)
      return { title: t?.title || 'Shell' }
    }
    return { title: '' }
  }

  const iconFor = (ref: TabRef, isActive: boolean) => {
    const cls = isActive ? 'text-primary' : 'text-muted-foreground/50'
    if (ref.type === 'editor') return <File size={11} className={cls} />
    if (ref.type === 'browser') return <Globe size={11} className={cls} />
    return <Terminal size={11} className={cls} />
  }

  return (
    <div
      className="flex flex-col h-full min-h-0 min-w-0 bg-background relative"
      onMouseDownCapture={() => {
        if (!isFocused) setFocusedGroup(projectId, group.id)
      }}
    >
      {/* Tab strip */}
      <div className="flex items-center border-b border-border/30 shrink-0 h-9">
        <div className="flex-1 flex items-center overflow-x-auto min-w-0">
          {group.tabs.map((ref) => {
            const isActive = group.activeTabId === ref.id
            const { title, isDirty } = titleFor(ref)
            return (
              <button
                key={`${ref.type}-${ref.id}`}
                onClick={() => activateTabInGroup(projectId, ref.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ x: e.clientX, y: e.clientY, tab: ref })
                }}
                className={`group relative inline-flex items-center gap-1.5 px-3 h-9 cursor-pointer transition-colors shrink-0 ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.03]'
                }`}
                title={title}
              >
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
                )}
                {iconFor(ref, isActive)}
                {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                <span className="text-[12px] font-medium tracking-tight truncate max-w-[160px]">{title}</span>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(ref)
                  }}
                  className="inline-flex items-center justify-center w-4 h-4 -mr-1 rounded text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-foreground/[0.06] transition-all"
                >
                  <X size={11} />
                </span>
              </button>
            )
          })}

          {/* + button — pinned right after the last tab */}
          <button
            ref={plusRef}
            onClick={() => {
              if (!plusOpen && plusRef.current) {
                const r = plusRef.current.getBoundingClientRect()
                setPlusAnchor({ left: r.left, top: r.bottom + 4 })
              }
              setPlusOpen((v) => !v)
            }}
            className={`inline-flex items-center justify-center h-9 w-9 transition-colors shrink-0 ${
              plusOpen
                ? 'text-foreground bg-foreground/[0.04]'
                : 'text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]'
            }`}
            title="New…"
          >
            <Plus size={13} strokeWidth={2.25} />
          </button>
        </div>

        {/* Split + close-group menu — far right */}
        <div className="flex items-center shrink-0">
          <button
            ref={splitRef}
            onClick={() => {
              if (!splitOpen && splitRef.current) {
                const r = splitRef.current.getBoundingClientRect()
                setSplitAnchor({ right: window.innerWidth - r.right, top: r.bottom + 4 })
              }
              setSplitOpen((v) => !v)
            }}
            className={`flex items-center justify-center h-7 w-7 my-1 mx-0.5 rounded-md transition-colors ${
              splitOpen
                ? 'bg-accent/60 text-foreground'
                : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/40'
            }`}
            title="Split"
          >
            <SplitSquareHorizontal size={13} />
          </button>
          {siblingGroupIds.length > 1 && (
            <button
              onClick={() => closeGroup(projectId, group.id)}
              className="flex items-center justify-center h-7 w-7 my-1 mx-0.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Close group"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        className={`flex-1 min-h-0 min-w-0 relative ${
          isDropTarget ? 'outline outline-2 outline-primary/60 outline-offset-[-4px]' : ''
        }`}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes(ORCHESTRA_FILE_MIME)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            if (!isDropTarget) setIsDropTarget(true)
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDropTarget(false)
        }}
        onDrop={(e) => {
          setIsDropTarget(false)
          const raw = e.dataTransfer.getData(ORCHESTRA_FILE_MIME)
          if (!raw) return
          e.preventDefault()
          try {
            const { path, relativePath } = JSON.parse(raw) as { path: string; relativePath: string }
            setFocusedGroup(projectId, group.id)
            openFile(path, relativePath, undefined, projectId)
          } catch (err) {
            console.warn('[drop] failed to parse file payload', err)
          }
        }}
      >
        {activeContent}
      </div>

      {/* Portaled menus */}
      {plusOpen && plusAnchor && createPortal(
        <div
          data-portal-menu="open"
          className="fixed z-[9999] bg-popover border border-border/60 rounded-lg shadow-xl py-1.5 min-w-[200px] backdrop-blur-sm"
          style={(() => {
            const w = 220, h = 130, m = 8
            const left = Math.min(Math.max(m, plusAnchor.left), window.innerWidth - w - m)
            const top = plusAnchor.top + h + m > window.innerHeight ? Math.max(m, plusAnchor.top - h - 12) : plusAnchor.top
            return { left, top }
          })()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setPlusOpen(false)
              setFocusedGroup(projectId, group.id)
              const id = `shell-${Date.now()}`
              const proj = useAppStore.getState().projects.find((p) => p.id === projectId)
              const cwd = proj?.root_path
              const initialCommand = cwd ? `cd "${cwd.replace(/"/g, '\\"')}" && clear` : undefined
              const title = proj ? `${proj.name} Shell` : 'Shell'
              setOpenTerminals([
                ...openTerminals,
                { id, title, projectId: proj ? projectId : undefined, cwd, initialCommand },
              ])
              addTabToGroup(projectId, { type: 'terminal', id }, group.id)
            }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] font-medium text-foreground/90 hover:text-foreground hover:bg-accent/60 text-left transition-colors"
          >
            <Terminal size={12} /> New Terminal
          </button>
          <button
            onClick={() => {
              setPlusOpen(false)
              setFocusedGroup(projectId, group.id)
              openBrowserTab()
            }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] font-medium text-foreground/90 hover:text-foreground hover:bg-accent/60 text-left transition-colors"
          >
            <Globe size={12} /> New Browser Tab
          </button>
          <button
            onClick={async () => {
              setPlusOpen(false)
              setFocusedGroup(projectId, group.id)
              const proj = useAppStore.getState().projects.find((p) => p.id === projectId)
              const root = proj?.root_path || explorerRoot
              console.log('[markdown] create requested', { projectId, hasProject: !!proj, root, hasConfig: !!config?.baseUrl })
              if (!root) {
                alert('Cannot create markdown: no project root available. Open a project first.')
                return
              }
              if (!config?.baseUrl) {
                alert('Cannot create markdown: backend not connected.')
                return
              }
              const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
              const filename = `Untitled-${stamp}.md`
              const absPath = `${root.replace(/\/$/, '')}/${filename}`
              const initial = `# Untitled\n\n`
              try {
                const url = `${config.baseUrl}/api/v1/workspace/file?path=${encodeURIComponent(absPath)}`
                const headers: Record<string, string> = { 'Content-Type': 'text/plain' }
                if (config.apiToken) headers['Authorization'] = `Bearer ${config.apiToken}`
                const res = await fetch(url, { method: 'PUT', headers, body: initial })
                if (!res.ok) {
                  const errText = await res.text().catch(() => '')
                  console.error('[markdown] backend PUT failed', { status: res.status, body: errText })
                  alert(`Failed to create file: HTTP ${res.status} ${errText.slice(0, 200)}`)
                  return
                }
                console.log('[markdown] created', absPath)
                openFile(absPath, filename, undefined, projectId)
              } catch (err) {
                console.error('[markdown] fetch error', err)
                alert(`Failed to create file: ${(err as Error).message}`)
              }
            }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] font-medium text-foreground/90 hover:text-foreground hover:bg-accent/60 text-left transition-colors"
          >
            <FileText size={12} /> New Markdown File
          </button>
        </div>,
        document.body,
      )}

      {splitOpen && splitAnchor && createPortal(
        <div
          data-portal-menu="open"
          className="fixed z-[9999] bg-popover border border-border/60 rounded-lg shadow-xl py-1.5 min-w-[180px] backdrop-blur-sm"
          style={(() => {
            const w = 200, h = 140, m = 8
            const right = Math.max(m, Math.min(splitAnchor.right, window.innerWidth - w - m))
            const top = splitAnchor.top + h + m > window.innerHeight ? Math.max(m, splitAnchor.top - h - 12) : splitAnchor.top
            return { right, top }
          })()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { splitGroup(projectId, group.id, 'horizontal'); setSplitOpen(false) }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] font-medium text-foreground/90 hover:text-foreground hover:bg-accent/60 text-left transition-colors"
          >
            <SplitSquareHorizontal size={11} /> Split right
          </button>
          <button
            onClick={() => { splitGroup(projectId, group.id, 'vertical'); setSplitOpen(false) }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] font-medium text-foreground/90 hover:text-foreground hover:bg-accent/60 text-left transition-colors"
          >
            <SplitSquareVertical size={11} /> Split down
          </button>
          <div className="my-1 h-px bg-border/40" />
          <button
            onClick={() => { closeGroup(projectId, group.id); setSplitOpen(false) }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 text-left transition-colors"
          >
            <X size={11} /> Close group
          </button>
        </div>,
        document.body,
      )}

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCloseTab={() => closeTab(contextMenu.tab)}
        />
      )}
    </div>
  )
}
