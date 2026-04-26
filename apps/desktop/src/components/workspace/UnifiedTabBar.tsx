import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store'
import { File, Globe, Terminal, X, Plus, FileText } from 'lucide-react'
import type { ActiveWorkspaceTab } from '@/store/types'

type UnifiedTab =
  | { type: 'terminal'; id: string; title: string }
  | { type: 'editor'; id: string; title: string; isDirty: boolean }
  | { type: 'browser'; id: string; title: string }

interface UnifiedTabBarProps {
  terminals: { id: string; title: string }[]
  activeTab: ActiveWorkspaceTab
  onSelectTab: (tab: ActiveWorkspaceTab) => void
  onCloseTab: (tab: { type: 'terminal' | 'editor' | 'browser'; id: string }) => void
  onAddTerminal: () => void
  onAddBrowser: () => void
}

export function UnifiedTabBar({
  terminals,
  activeTab,
  onSelectTab,
  onCloseTab,
  onAddTerminal,
  onAddBrowser,
}: UnifiedTabBarProps) {
  const openFiles = useAppStore((s) => s.openFiles)
  const browserTabs = useAppStore((s) => s.browserTabs)
  const openFile = useAppStore((s) => s.openFile)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setDropdownOpen(false)
    }
  }, [])

  useEffect(() => {
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen, handleClickOutside])

  // Build unified tab list: terminals, then editors, then browsers
  const tabs: UnifiedTab[] = [
    ...terminals.map((t): UnifiedTab => ({ type: 'terminal', id: t.id, title: t.title })),
    ...openFiles.map((f): UnifiedTab => ({
      type: 'editor',
      id: f.id,
      title: f.relativePath.split('/').pop() ?? f.relativePath,
      isDirty: f.isDirty,
    })),
    ...browserTabs.map((t): UnifiedTab => ({
      type: 'browser',
      id: t.id,
      title: t.title || 'New Tab',
    })),
  ]

  const isActive = (tab: UnifiedTab) =>
    activeTab?.type === tab.type && activeTab?.id === tab.id

  const iconFor = (tab: UnifiedTab) => {
    switch (tab.type) {
      case 'terminal':
        return <Terminal size={12} className={isActive(tab) ? 'text-primary' : 'text-muted-foreground/50'} />
      case 'editor':
        return <File size={12} className={isActive(tab) ? 'text-primary' : 'text-muted-foreground/50'} />
      case 'browser':
        return <Globe size={12} className={isActive(tab) ? 'text-primary' : 'text-muted-foreground/50'} />
    }
  }

  return (
    <div className="flex items-center border-b border-border bg-card/50 shrink-0 h-9">
      <div className="flex-1 flex items-center overflow-x-auto min-w-0">
        {tabs.map((tab) => {
          const active = isActive(tab)
          return (
            <button
              key={`${tab.type}-${tab.id}`}
              className={`group flex items-center gap-1.5 px-3 h-9 cursor-pointer transition-all relative shrink-0 ${
                active
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30'
              }`}
              onClick={() => onSelectTab({ type: tab.type, id: tab.id })}
            >
              {active && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
              {iconFor(tab)}
              {tab.type === 'editor' && (tab as Extract<UnifiedTab, { type: 'editor' }>).isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              )}
              <span className="text-[11px] font-semibold truncate max-w-[120px]">{tab.title}</span>
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab({ type: tab.type, id: tab.id })
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/20 hover:text-destructive rounded transition-all ml-0.5"
              >
                <X size={10} />
              </span>
            </button>
          )
        })}
      </div>

      {/* (+) dropdown */}
      <div className="relative shrink-0 border-l border-border/50" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center justify-center h-9 px-2.5 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30 transition-all"
          title="New..."
          aria-label="New item menu"
        >
          <Plus size={14} />
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[180px]">
            <button
              onClick={() => { onAddTerminal(); setDropdownOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent"
            >
              <Terminal size={12} /> New Terminal
            </button>
            <button
              onClick={() => { onAddBrowser(); setDropdownOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent"
            >
              <Globe size={12} /> New Browser Tab
            </button>
            <button
              onClick={() => {
                const path = prompt('Enter file path to preview as markdown:')
                if (path) {
                  openFile(path, path.split('/').pop() ?? path)
                }
                setDropdownOpen(false)
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent"
            >
              <FileText size={12} /> Open Markdown Preview
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
