import type { ReactNode } from 'react'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'

type WorkspaceLayoutProps = {
  centerContent: ReactNode
  rightContent?: ReactNode
}

export function WorkspaceLayout({ centerContent, rightContent }: WorkspaceLayoutProps) {
  return (
    <div className="flex h-full min-h-0 w-full">
      <LeftSidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {centerContent}
      </div>
      <RightSidebar>{rightContent}</RightSidebar>
    </div>
  )
}
