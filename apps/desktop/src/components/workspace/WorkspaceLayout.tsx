import type { ReactNode } from 'react'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'
import { EditorPanel } from './EditorPanel'
import { BrowserPane } from './BrowserPane'
import { useAppStore } from '@/store'

type WorkspaceLayoutProps = {
  centerContent: ReactNode
  rightContent?: ReactNode
}

export function WorkspaceLayout({ centerContent, rightContent }: WorkspaceLayoutProps) {
  const hasOpenFiles = useAppStore((s) => s.openFiles.length > 0)
  const hasBrowserTabs = useAppStore((s) => s.browserTabs.length > 0)

  return (
    <div className="flex h-full min-h-0 w-full">
      <LeftSidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
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
      <RightSidebar>{rightContent}</RightSidebar>
    </div>
  )
}
