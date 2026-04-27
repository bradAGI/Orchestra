import { type ReactNode, useCallback } from 'react'
import { LeftSidebar } from './LeftSidebar'
import { UnifiedTabBar } from './UnifiedTabBar'
import { UnifiedWorkspaceContent } from './UnifiedWorkspaceContent'
import { useAppStore } from '@/store'
import { clearInitialCommandTracking } from '@/components/terminal/TerminalView'

type WorkspaceLayoutProps = {
  centerContent: ReactNode
  onAddTerminal?: () => void
}

export function WorkspaceLayout({ centerContent, onAddTerminal }: WorkspaceLayoutProps) {
  const openTerminals = useAppStore((s) => s.openTerminals)
  const activeWorkspaceTab = useAppStore((s) => s.activeWorkspaceTab)
  const setActiveWorkspaceTab = useAppStore((s) => s.setActiveWorkspaceTab)
  const closeFile = useAppStore((s) => s.closeFile)
  const closeBrowserTab = useAppStore((s) => s.closeBrowserTab)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const setActiveBrowserTab = useAppStore((s) => s.setActiveBrowserTab)
  const openBrowserTab = useAppStore((s) => s.openBrowserTab)
  const setOpenTerminals = useAppStore((s) => s.setOpenTerminals)

  const handleSelectTab = useCallback(
    (tab: { type: 'terminal' | 'editor' | 'browser'; id: string } | null) => {
      setActiveWorkspaceTab(tab)
      if (tab?.type === 'editor') {
        setActiveFile(tab.id)
      } else if (tab?.type === 'browser') {
        setActiveBrowserTab(tab.id)
      }
    },
    [setActiveWorkspaceTab, setActiveFile, setActiveBrowserTab],
  )

  const handleCloseTab = useCallback(
    (tab: { type: 'terminal' | 'editor' | 'browser'; id: string }) => {
      if (tab.type === 'terminal') {
        clearInitialCommandTracking(tab.id)
        const remaining = openTerminals.filter((t) => t.id !== tab.id)
        setOpenTerminals(remaining)
        // If we closed the active tab, switch to next available
        if (activeWorkspaceTab?.type === 'terminal' && activeWorkspaceTab.id === tab.id) {
          if (remaining.length > 0) {
            setActiveWorkspaceTab({ type: 'terminal', id: remaining[0].id })
          } else {
            setActiveWorkspaceTab(null)
          }
        }
      } else if (tab.type === 'editor') {
        closeFile(tab.id)
        // Editor slice handles activeFileId; check if we need to switch workspace tab
        if (activeWorkspaceTab?.type === 'editor' && activeWorkspaceTab.id === tab.id) {
          const remaining = useAppStore.getState().openFiles.filter((f) => f.id !== tab.id)
          if (remaining.length > 0) {
            setActiveWorkspaceTab({ type: 'editor', id: remaining[0].id })
          } else {
            setActiveWorkspaceTab(null)
          }
        }
      } else if (tab.type === 'browser') {
        closeBrowserTab(tab.id)
        if (activeWorkspaceTab?.type === 'browser' && activeWorkspaceTab.id === tab.id) {
          const remaining = useAppStore.getState().browserTabs.filter((t) => t.id !== tab.id)
          if (remaining.length > 0) {
            setActiveWorkspaceTab({ type: 'browser', id: remaining[0].id })
          } else {
            setActiveWorkspaceTab(null)
          }
        }
      }
    },
    [openTerminals, activeWorkspaceTab, setOpenTerminals, setActiveWorkspaceTab, closeFile, closeBrowserTab],
  )

  return (
    <div className="flex h-full min-h-0 w-full">
      <LeftSidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <UnifiedTabBar
          terminals={openTerminals}
          activeTab={activeWorkspaceTab}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onAddTerminal={onAddTerminal ?? (() => {})}
          onAddBrowser={() => openBrowserTab()}
        />
        <UnifiedWorkspaceContent
          activeTab={activeWorkspaceTab}
          terminalContent={centerContent}
        />
      </div>
    </div>
  )
}
