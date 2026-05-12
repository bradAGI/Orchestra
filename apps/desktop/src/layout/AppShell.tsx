import type { ReactNode } from 'react'
import { AppSidebar } from '@layout/AppSidebar'
import type { SidebarItem } from '@layout/types'
import type { Project } from '@core/api/types'
import type { IssueListItem } from '@core/api/client'

type AppShellProps = {
  items: SidebarItem[]
  activeSection: string
  onSectionChange: (section: string) => void
  bottomBar?: ReactNode
  children: ReactNode
  projects: Project[]
  selectedProjectID: string | null
  onSelectProject: (id: string) => void
  onCreateProject: () => void
  onSearch?: (query: string) => Promise<IssueListItem[]>
  onResultClick?: (issueIdentifier: string) => void
}

export function AppShell({
  items,
  activeSection,
  onSectionChange,
  bottomBar,
  children,
  projects,
  selectedProjectID,
  onSelectProject,
  onCreateProject,
  onSearch,
  onResultClick,
}: AppShellProps) {
  return (
    <div className="h-full w-full overflow-hidden bg-background text-foreground flex flex-col">
      <div className="flex flex-1 w-full min-h-0">
        <AppSidebar
          items={items}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          projects={projects}
          selectedProjectID={selectedProjectID}
          onSelectProject={onSelectProject}
          onCreateProject={onCreateProject}
          onSearch={onSearch}
          onResultClick={onResultClick}
        />

        <main className="min-w-0 flex-1 bg-background h-full flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
      {bottomBar}
    </div>
  )
}
