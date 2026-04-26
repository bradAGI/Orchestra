import { FolderTree, Search, PanelLeftOpen } from 'lucide-react'
import { useAppStore } from '@/store'
import { ResizeHandle } from './ResizeHandle'
import { FileExplorer } from './FileExplorer'
import { WorkspaceSearch } from './WorkspaceSearch'

export function LeftSidebar() {
  const activeLeftPanel = useAppStore(s => s.activeLeftPanel)
  const setActiveLeftPanel = useAppStore(s => s.setActiveLeftPanel)
  const leftSidebarOpen = useAppStore(s => s.leftSidebarOpen)
  const toggleLeftSidebar = useAppStore(s => s.toggleLeftSidebar)
  const leftSidebarWidth = useAppStore(s => s.leftSidebarWidth)
  const setLeftSidebarWidth = useAppStore(s => s.setLeftSidebarWidth)

  if (!leftSidebarOpen) {
    return (
      <div className="flex flex-col items-center py-2 px-1 border-r border-border bg-background flex-shrink-0">
        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          onClick={toggleLeftSidebar}
          title="Open Sidebar (Cmd+B)"
          aria-label="Open sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    )
  }

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
        <div className="flex-1 min-h-0 overflow-auto">
          {activeLeftPanel === 'explorer' ? (
            <FileExplorer />
          ) : (
            <WorkspaceSearch />
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
