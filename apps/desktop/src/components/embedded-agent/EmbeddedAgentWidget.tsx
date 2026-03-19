import { useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import type { BackendConfig } from '@/lib/orchestra-client'
import { EmbeddedAgentProvider, useEmbeddedAgent } from './EmbeddedAgentProvider'
import { EmbeddedAgentPanel } from './EmbeddedAgentPanel'

interface EmbeddedAgentWidgetProps {
  config: BackendConfig | null
  onNavigate: (section: string, id?: string) => void
}

function WidgetInner() {
  const { isPanelOpen, togglePanel, isStreaming } = useEmbeddedAgent()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault()
        togglePanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanel])

  return (
    <>
      {isPanelOpen && <EmbeddedAgentPanel />}

      <button
        type="button"
        onClick={togglePanel}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
        aria-label="Toggle agent panel"
      >
        <MessageCircle className={`size-6 ${isStreaming ? 'animate-pulse' : ''}`} />
      </button>
    </>
  )
}

export function EmbeddedAgentWidget({ config, onNavigate }: EmbeddedAgentWidgetProps) {
  return (
    <EmbeddedAgentProvider config={config} onNavigate={onNavigate}>
      <WidgetInner />
    </EmbeddedAgentProvider>
  )
}
