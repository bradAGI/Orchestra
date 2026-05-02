import { useRef, useEffect, useCallback, useState } from 'react'
import { useAppStore } from '@/store'
import { ArrowLeft, ArrowRight, RotateCw, Globe, X, Plus, Crosshair } from 'lucide-react'
import { useGrabMode } from './useGrabMode'
import { GrabConfirmation } from './GrabConfirmation'
import { formatGrabPayload } from './grab-format'

/**
 * Electron webview element type — not part of standard HTMLElement typings.
 * We cast through `any` when accessing webview-specific APIs.
 */
type WebviewElement = HTMLElement & {
  src: string
  getTitle: () => string
  getURL: () => string
  canGoBack: () => boolean
  canGoForward: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
  addEventListener: HTMLElement['addEventListener']
  removeEventListener: HTMLElement['removeEventListener']
}

export function BrowserPane() {
  const browserTabs = useAppStore((s) => s.browserTabs)
  const activeBrowserTabId = useAppStore((s) => s.activeBrowserTabId)
  const updateBrowserTab = useAppStore((s) => s.updateBrowserTab)
  const openBrowserTab = useAppStore((s) => s.openBrowserTab)
  const closeBrowserTab = useAppStore((s) => s.closeBrowserTab)
  const setActiveBrowserTab = useAppStore((s) => s.setActiveBrowserTab)

  const activeTab = browserTabs.find((t) => t.id === activeBrowserTabId)
  const webviewRef = useRef<WebviewElement | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const { grabState, lastPayload, armGrab, handleConsoleMessage, resetGrab } = useGrabMode()

  // Sync URL input with active tab
  useEffect(() => {
    if (activeTab) setUrlInput(activeTab.url)
  }, [activeTab?.id, activeTab?.url])

  // Navigate
  const navigate = useCallback(
    (url: string) => {
      let fullUrl = url
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
        fullUrl = `https://${url}`
      }
      if (webviewRef.current) {
        webviewRef.current.src = fullUrl
      }
      if (activeTab) {
        updateBrowserTab(activeTab.id, { url: fullUrl, loading: true })
      }
    },
    [activeTab, updateBrowserTab],
  )

  // Webview event handlers
  const handleDomReady = useCallback(() => {
    if (!webviewRef.current || !activeTab) return
    const wv = webviewRef.current
    updateBrowserTab(activeTab.id, {
      title: wv.getTitle?.() || activeTab.url,
      url: wv.getURL?.() || activeTab.url,
      loading: false,
      canGoBack: wv.canGoBack?.() || false,
      canGoForward: wv.canGoForward?.() || false,
    })
  }, [activeTab?.id, updateBrowserTab])

  const handleDidNavigate = useCallback(() => {
    if (!webviewRef.current || !activeTab) return
    const wv = webviewRef.current
    updateBrowserTab(activeTab.id, {
      url: wv.getURL?.() || activeTab.url,
      title: wv.getTitle?.() || activeTab.url,
      loading: false,
      canGoBack: wv.canGoBack?.() || false,
      canGoForward: wv.canGoForward?.() || false,
    })
  }, [activeTab?.id, updateBrowserTab])

  const handleDidStartLoading = useCallback(() => {
    if (activeTab) {
      updateBrowserTab(activeTab.id, { loading: true })
    }
  }, [activeTab?.id, updateBrowserTab])

  // Attach / detach webview listeners
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    wv.addEventListener('dom-ready', handleDomReady)
    wv.addEventListener('did-navigate', handleDidNavigate)
    wv.addEventListener('did-navigate-in-page', handleDidNavigate)
    wv.addEventListener('did-start-loading', handleDidStartLoading)

    return () => {
      wv.removeEventListener('dom-ready', handleDomReady)
      wv.removeEventListener('did-navigate', handleDidNavigate)
      wv.removeEventListener('did-navigate-in-page', handleDidNavigate)
      wv.removeEventListener('did-start-loading', handleDidStartLoading)
    }
  }, [activeTab?.id, handleDomReady, handleDidNavigate, handleDidStartLoading])

  // Listen for grab mode console messages from webview
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    wv.addEventListener('console-message', handleConsoleMessage)
    return () => wv.removeEventListener('console-message', handleConsoleMessage)
  }, [activeTab?.id, handleConsoleMessage])

  if (browserTabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Globe size={48} className="opacity-30" />
        <p className="text-sm">No browser tabs open</p>
        <button
          onClick={() => openBrowserTab('http://localhost:5173')}
          className="text-xs px-3 py-1.5 rounded bg-accent hover:bg-accent/80 text-accent-foreground"
        >
          Open localhost:5173
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/30 bg-background overflow-x-auto">
        {browserTabs.map((tab) => {
          const isActive = tab.id === activeBrowserTabId
          return (
            <button
              key={tab.id}
              onClick={() => setActiveBrowserTab(tab.id)}
              className={`group relative inline-flex items-center gap-1.5 px-3 h-9 max-w-[200px] shrink-0 transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.03]'
              }`}
            >
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
              )}
              <Globe size={12} className={isActive ? 'text-primary shrink-0' : 'text-muted-foreground/60 shrink-0'} strokeWidth={isActive ? 2.25 : 2} />
              <span className="text-[12px] font-medium tracking-tight truncate">{tab.title || 'New tab'}</span>
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  closeBrowserTab(tab.id)
                }}
                className="inline-flex items-center justify-center w-4 h-4 -mr-1 rounded text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-foreground/[0.06] transition-all"
              >
                <X size={11} />
              </span>
            </button>
          )
        })}
        <button
          onClick={() => openBrowserTab()}
          className="inline-flex items-center justify-center h-9 w-9 text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.03] transition-colors shrink-0"
          title="New tab"
        >
          <Plus size={13} strokeWidth={2.25} />
        </button>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/20">
        <button
          onClick={() => webviewRef.current?.goBack()}
          disabled={!activeTab?.canGoBack}
          className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          onClick={() => webviewRef.current?.goForward()}
          disabled={!activeTab?.canGoForward}
          className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowRight size={14} />
        </button>
        <button
          onClick={() => webviewRef.current?.reload()}
          className="p-1 rounded text-muted-foreground hover:text-foreground"
        >
          <RotateCw size={14} className={activeTab?.loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => armGrab(webviewRef.current)}
          className={`p-1 rounded ${grabState === 'armed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          title="Grab element (click to capture)"
        >
          <Crosshair size={14} />
        </button>
        <form
          className="flex-1 mx-1"
          onSubmit={(e) => {
            e.preventDefault()
            navigate(urlInput)
          }}
        >
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-0.5 text-xs text-foreground outline-none focus:border-primary"
            placeholder="Enter URL..."
          />
        </form>
      </div>

      {/* Webview */}
      <div className="flex-1 min-h-0 relative">
        {activeTab && (
          <webview
            ref={webviewRef as React.RefObject<never>}
            src={activeTab.url}
            className="w-full h-full"
            partition="persist:orchestra-browser"
            allowpopups={true}
          />
        )}
        {grabState === 'captured' && lastPayload && (
          <GrabConfirmation
            payload={lastPayload}
            onCopy={() => {
              navigator.clipboard.writeText(formatGrabPayload(lastPayload))
              resetGrab()
            }}
            onSendToAgent={() => {
              window.dispatchEvent(new CustomEvent('orchestra-grab-to-agent', {
                detail: { text: formatGrabPayload(lastPayload) }
              }))
              resetGrab()
            }}
            onDismiss={resetGrab}
          />
        )}
      </div>
    </div>
  )
}
