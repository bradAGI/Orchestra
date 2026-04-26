import { type ReactNode } from 'react'
import { useAppStore } from '@/store'
import { EditorContent } from './EditorContent'
import { BrowserContent } from './BrowserContent'
import type { ActiveWorkspaceTab } from '@/store/types'

interface UnifiedWorkspaceContentProps {
  activeTab: ActiveWorkspaceTab
  terminalContent: ReactNode
}

export function UnifiedWorkspaceContent({ activeTab, terminalContent }: UnifiedWorkspaceContentProps) {
  const activeFile = useAppStore((s) =>
    activeTab?.type === 'editor' ? s.openFiles.find((f) => f.id === activeTab.id) : undefined,
  )
  const activeBrowserTab = useAppStore((s) =>
    activeTab?.type === 'browser' ? s.browserTabs.find((t) => t.id === activeTab.id) : undefined,
  )

  return (
    <div className="flex-1 min-h-0 relative">
      {/* Terminal — always mounted to preserve PTY state, hidden when not active */}
      <div
        className="h-full"
        style={{ display: activeTab?.type === 'terminal' || !activeTab ? 'block' : 'none' }}
      >
        {terminalContent}
      </div>

      {/* Editor — show when an editor tab is active */}
      {activeTab?.type === 'editor' && activeFile && (
        <div className="h-full">
          <EditorContent file={activeFile} />
        </div>
      )}

      {/* Browser — show when a browser tab is active */}
      {activeTab?.type === 'browser' && activeBrowserTab && (
        <div className="h-full">
          <BrowserContent tab={activeBrowserTab} />
        </div>
      )}
    </div>
  )
}
