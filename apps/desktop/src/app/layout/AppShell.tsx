import type { ComponentProps, ReactNode } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { SidebarNav } from '@/components/app-shell/sidebar-nav'
import { TopBar } from '@/components/app-shell/top-bar'
import type { SidebarItem } from '@/components/app-shell/types'

type AppShellProps = {
  items: SidebarItem[]
  activeSection: string
  onSectionChange: (section: string) => void
  sidebarCollapsed: boolean
  sidebarWidth: number
  onToggleCollapsed: () => void
  osOptions: ComponentProps<typeof OverlayScrollbarsComponent>['options']
  topBarProps: ComponentProps<typeof TopBar>
  flushContent?: boolean
  children: ReactNode
}

export function AppShell({
  items,
  activeSection,
  onSectionChange,
  sidebarCollapsed,
  sidebarWidth,
  onToggleCollapsed,
  osOptions,
  topBarProps,
  flushContent,
  children,
}: AppShellProps) {
  return (
    <div className="h-full w-full overflow-hidden bg-background text-foreground">
      <div className="flex h-full w-full">
        <SidebarNav
          items={items}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          sidebarCollapsed={sidebarCollapsed}
          onToggleCollapsed={onToggleCollapsed}
          sidebarWidth={sidebarWidth}
        />

        <OverlayScrollbarsComponent
          element="main"
          options={osOptions}
          className="min-w-0 flex-1 bg-gradient-to-b from-background via-background to-muted/30 h-full flex flex-col"
        >
          <div className="w-full flex flex-col h-full min-h-0 px-4 pt-3 pb-4">
            <TopBar {...topBarProps} flush={flushContent} />
            <div className={`flex-1 flex flex-col min-h-0 ${flushContent ? '-mx-4' : ''}`}>
              {children}
            </div>
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </div>
  )
}
