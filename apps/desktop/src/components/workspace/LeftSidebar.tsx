import { FolderTree, Search } from 'lucide-react'
import { useAppStore } from '@/store'
import { ResizeHandle } from './ResizeHandle'

export function LeftSidebar() {
  const activeLeftPanel = useAppStore(s => s.activeLeftPanel)
  const setActiveLeftPanel = useAppStore(s => s.setActiveLeftPanel)
  const leftSidebarWidth = useAppStore(s => s.leftSidebarWidth)
  const setLeftSidebarWidth = useAppStore(s => s.setLeftSidebarWidth)

  return (
    <div
      className="flex h-full flex-shrink-0"
      style={{ width: leftSidebarWidth }}
    >
      {/* Main sidebar content */}
      <div className="flex flex-col h-full bg-background border-r border-border flex-1 min-w-0">
        {/* Top bar with panel toggle buttons */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-border">
          <button
            className={`p-1.5 rounded transition-colors ${
              activeLeftPanel === 'explorer'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
            onClick={() => setActiveLeftPanel('explorer')}
            title="File Explorer"
            aria-label="File Explorer"
          >
            <FolderTree className="h-4 w-4" />
          </button>
          <button
            className={`p-1.5 rounded transition-colors ${
              activeLeftPanel === 'search'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
            onClick={() => setActiveLeftPanel('search')}
            title="Search"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-auto p-3">
          {activeLeftPanel === 'explorer' ? (
            <p className="text-xs text-muted-foreground">
              File Explorer — Select a task to browse its workspace
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Search — available in Phase 1
            </p>
          )}
        </div>
      </div>

      {/* Resize handle on right edge */}
      <ResizeHandle
        direction="horizontal"
        onResize={(delta) => setLeftSidebarWidth(leftSidebarWidth + delta)}
      />
    </div>
  )
}
