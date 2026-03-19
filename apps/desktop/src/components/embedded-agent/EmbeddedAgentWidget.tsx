import { useEffect } from 'react'
import type { BackendConfig } from '@/lib/orchestra-client'
import { EmbeddedAgentProvider, useEmbeddedAgent } from './EmbeddedAgentProvider'
import { EmbeddedAgentPanel } from './EmbeddedAgentPanel'

interface EmbeddedAgentWidgetProps {
  config: BackendConfig | null
  onNavigate: (section: string, id?: string) => void
  onOpenSettings?: () => void
}

function AgentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" role="img">
      <defs>
        <linearGradient id="agent-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <circle
        cx="32" cy="32" r="24"
        fill="none"
        stroke="url(#agent-logo-gradient)"
        strokeWidth="6"
        strokeDasharray="110 40"
        strokeLinecap="round"
        transform="rotate(-10 32 32)"
      />
      <rect
        x="24" y="24" width="16" height="16" rx="3"
        fill="url(#agent-logo-gradient)"
        transform="rotate(45 32 32)"
      />
      <circle cx="32" cy="32" r="3" fill="currentColor" fillOpacity="0.9" />
    </svg>
  )
}

function WidgetInner({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { isPanelOpen, togglePanel, isStreaming } = useEmbeddedAgent()

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

      {/* Floating action button */}
      <button
        type="button"
        onClick={togglePanel}
        className={`fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/30 active:scale-95 ${
          isStreaming ? 'agent-fab-streaming' : ''
        } ${isPanelOpen ? 'rotate-45 opacity-80' : 'rotate-0 opacity-100'}`}
        title="Orchestra Agent (Ctrl+.)"
      >
        <AgentIcon className="h-7 w-7 transition-transform duration-300" />
      </button>
    </>
  )
}

export function EmbeddedAgentWidget({ config, onNavigate, onOpenSettings }: EmbeddedAgentWidgetProps) {
  return (
    <EmbeddedAgentProvider config={config} onNavigate={onNavigate}>
      <WidgetInner onOpenSettings={onOpenSettings} />
    </EmbeddedAgentProvider>
  )
}
