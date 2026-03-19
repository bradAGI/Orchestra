import { useMemo, useCallback } from 'react'
import { Renderer, StateProvider, ActionProvider } from '@json-render/react'
import type { Spec } from '@json-render/react'
import { createAgentRegistry } from '../lib/json-render-registry'
import type { JsonRenderSpec } from '../lib/types'

interface JsonRenderBlockProps {
  spec: JsonRenderSpec
  onAction?: (actionName: string, params?: Record<string, unknown>) => void
}

export function JsonRenderBlock({ spec, onAction }: JsonRenderBlockProps) {
  const handleAction = useCallback(
    (actionName: string, params?: Record<string, unknown>) => {
      onAction?.(actionName, params)
    },
    [onAction],
  )

  const { registry, handlers } = useMemo(
    () => createAgentRegistry(handleAction),
    [handleAction],
  )

  const actionHandlers = useMemo(
    () => handlers(() => undefined, () => ({})),
    [handlers],
  )

  // Convert our JsonRenderSpec to the json-render Spec format.
  // Derive error state during render instead of using setState in useMemo.
  const [rendererSpec, renderError] = useMemo<[Spec | null, string | null]>(() => {
    try {
      return [spec as unknown as Spec, null]
    } catch {
      return [null, 'Failed to parse render spec']
    }
  }, [spec])

  if (renderError) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="mb-2 text-xs font-medium text-destructive">
          Render error: {renderError}
        </p>
        <pre className="overflow-x-auto text-xs text-muted-foreground">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-destructive">
            Component render error
          </p>
          <pre className="overflow-x-auto text-xs text-muted-foreground">
            {JSON.stringify(spec, null, 2)}
          </pre>
        </div>
      }
    >
      <StateProvider>
        <ActionProvider handlers={actionHandlers}>
          <Renderer spec={rendererSpec} registry={registry} />
        </ActionProvider>
      </StateProvider>
    </ErrorBoundary>
  )
}

// ── Minimal error boundary ─────────────────────────────────────
import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[JsonRenderBlock] Render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
