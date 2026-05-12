import { useCallback } from 'react'
import { useAppStore } from '@core/store'

/**
 * Returns a stable `openUrl` function that routes http/https URLs into the
 * internal browser (Development section) and falls back to the system handler
 * for file:// and other non-web schemes.
 */
export function useOpenUrl(projectId?: string) {
  const openBrowserTab = useAppStore((s) => s.openBrowserTab)
  const setActiveSection = useAppStore((s) => s.setActiveSection)

  return useCallback(
    (url: string) => {
      if (!url) return
      if (url.startsWith('http://') || url.startsWith('https://')) {
        setActiveSection('CONSOLE')
        openBrowserTab(url, projectId)
        return
      }
      // file:// and other schemes go to the system handler
      const bridge = (window as { orchestraDesktop?: { openExternal?: (u: string) => Promise<void> } }).orchestraDesktop
      if (bridge?.openExternal) {
        void bridge.openExternal(url)
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [openBrowserTab, setActiveSection, projectId],
  )
}
