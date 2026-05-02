import { useEffect } from 'react'
import type { BackendConfig } from '@core/api/client'
import { EmbeddedAgentProvider, useEmbeddedAgent } from './EmbeddedAgentProvider'
import { EmbeddedAgentPanel } from './EmbeddedAgentPanel'

interface EmbeddedAgentWidgetProps {
  config: BackendConfig | null
  onNavigate: (section: string, id?: string) => void
  onOpenSettings?: () => void
  activeSection?: string
  selectedProjectId?: string
}

function AgentIcon({ className }: { className?: string }) {
  return (
    <img
      src="/Orchesta.png"
      alt="Orchestra"
      className={`${className ?? ''} invert dark:invert-0`}
      aria-hidden="true"
    />
  )
}

function WidgetInner({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { isPanelOpen, togglePanel, isStreaming, watchMode } = useEmbeddedAgent()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault()
        togglePanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanel])

  return (
    <>
      {isPanelOpen && <EmbeddedAgentPanel onOpenSettings={onOpenSettings} />}

      {/* Floating action button — hidden when panel is open */}
      {!isPanelOpen && (
        <button
          type="button"
          onClick={togglePanel}
          className={`agent-fab-enter fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full border border-white/30 bg-white text-black shadow-lg shadow-black/25 transition-all duration-300 hover:scale-110 hover:bg-white/90 hover:shadow-xl hover:shadow-black/30 active:scale-95 ${
            isStreaming ? 'agent-fab-streaming' : ''
          }`}
          title="Orchestra Agent (Ctrl+.)"
        >
          <AgentIcon className="h-12 w-12" />
          {watchMode.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
              {watchMode.unreadCount > 9 ? '9+' : watchMode.unreadCount}
            </span>
          )}
        </button>
      )}
    </>
  )
}

export function EmbeddedAgentWidget({ config, onNavigate, onOpenSettings, activeSection, selectedProjectId }: EmbeddedAgentWidgetProps) {
  return (
    <EmbeddedAgentProvider config={config} onNavigate={onNavigate} activeSection={activeSection} selectedProjectId={selectedProjectId}>
      <WidgetInner onOpenSettings={onOpenSettings} />
    </EmbeddedAgentProvider>
  )
}
