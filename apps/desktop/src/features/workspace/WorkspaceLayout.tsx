import { type ReactNode } from 'react'
import { LeftSidebar } from './panels/LeftSidebar'
import { SplitLayout } from './SplitLayout'
import { WorkspaceWelcome } from './panels/WorkspaceWelcome'
import { useAppStore } from '@core/store'
import { GLOBAL_PROJECT_ID } from '@core/store/types'

type WorkspaceLayoutProps = {
  /** Reserved for legacy plumbing — currently unused; tabs render their own content. */
  centerContent?: ReactNode
  onAddTerminal?: () => void
  onAddNewProject?: () => void
}

export function WorkspaceLayout({ onAddTerminal }: WorkspaceLayoutProps) {
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const layout = useAppStore((s) => s.projectLayouts[activeProjectId])

  const isGlobal = activeProjectId === GLOBAL_PROJECT_ID
  const showWelcome = isGlobal || !layout

  return (
    <div className="flex h-full min-h-0 w-full">
      <LeftSidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {showWelcome ? (
          <WorkspaceWelcome onAddTerminal={onAddTerminal} />
        ) : (
          <SplitLayout projectId={activeProjectId} layout={layout} />
        )}
      </div>
    </div>
  )
}
