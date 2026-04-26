import { type ReactNode, useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Globe, Terminal, FileText } from 'lucide-react'
import { LeftSidebar } from './LeftSidebar'
import { EditorPanel } from './EditorPanel'
import { BrowserPane } from './BrowserPane'
import { useAppStore } from '@/store'

type WorkspaceLayoutProps = {
  centerContent: ReactNode
  onAddTerminal?: () => void
}

export function WorkspaceLayout({ centerContent, onAddTerminal }: WorkspaceLayoutProps) {
  const hasOpenFiles = useAppStore((s) => s.openFiles.length > 0)
  const hasBrowserTabs = useAppStore((s) => s.browserTabs.length > 0)
  const openBrowserTab = useAppStore((s) => s.openBrowserTab)

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

  return (
    <div className="flex h-full min-h-0 w-full">
      <LeftSidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Workspace toolbar */}
        <div className="flex items-center justify-end px-2 py-1 border-b border-border bg-muted/10">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title="New..."
              aria-label="New item menu"
            >
              <Plus size={14} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[180px]">
                {onAddTerminal && (
                  <button
                    onClick={() => { onAddTerminal(); setDropdownOpen(false) }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                  >
                    <Terminal size={12} /> New Terminal
                  </button>
                )}
                <button
                  onClick={() => { openBrowserTab(); setDropdownOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                >
                  <Globe size={12} /> New Browser Tab
                </button>
                <button
                  onClick={() => {
                    const path = prompt('Enter file path to preview as markdown:')
                    if (path) {
                      useAppStore.getState().openFile(path, path.split('/').pop() ?? path)
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
        {hasOpenFiles && (
          <div className="flex-1 min-h-0 border-b border-border">
            <EditorPanel />
          </div>
        )}
        {hasBrowserTabs && (
          <div className="flex-1 min-h-0 border-b border-border">
            <BrowserPane />
          </div>
        )}
        <div className={hasOpenFiles || hasBrowserTabs ? 'h-[40%] min-h-[200px] flex-shrink-0' : 'flex-1 min-h-0'}>
          {centerContent}
        </div>
      </div>
    </div>
  )
}
