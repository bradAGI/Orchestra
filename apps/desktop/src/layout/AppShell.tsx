import type { ComponentProps, ReactNode } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { SidebarNav } from '@layout/sidebar-nav'
import { TopBar } from '@layout/top-bar'
import type { SidebarItem } from '@layout/types'

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
  bottomBar?: ReactNode
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
  bottomBar,
  children,
}: AppShellProps) {
  // Development view (CONSOLE) goes full-bleed — no top bar, no outer padding,
  // mirroring Orca's edge-to-edge workspace layout.
  const fullBleed = activeSection === 'CONSOLE'
  return (
    <div className="h-full w-full overflow-hidden bg-background text-foreground flex flex-col">
      <div className="flex flex-1 w-full min-h-0">
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
          className="min-w-0 flex-1 bg-background h-full flex flex-col"
        >
          {fullBleed ? (
            <div className="w-full flex flex-col h-full min-h-0">
              {children}
            </div>
          ) : (
            <div className={`w-full flex flex-col h-full min-h-0 px-4 pt-3 ${flushContent ? 'pb-0' : 'pb-4'}`}>
              <TopBar {...topBarProps} flush={flushContent} />
              <div className={`flex-1 flex flex-col min-h-0 ${flushContent ? '-mx-4' : ''}`}>
                {children}
              </div>
            </div>
          )}
        </OverlayScrollbarsComponent>
      </div>
      {bottomBar}
    </div>
  )
}
