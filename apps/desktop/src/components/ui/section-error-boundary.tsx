import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  name: string
  children: ReactNode
}

type State = {
  hasError: boolean
  message: string
}

/**
 * Lightweight error boundary that wraps individual dashboard sections.
 * Unlike the top-level CrashBoundary, this catches errors per-section
 * so a single broken panel doesn't take down the entire app.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'unknown error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionErrorBoundary:${this.props.name}]`, error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center min-h-[200px]">
        <p className="text-sm font-medium text-muted-foreground">
          {this.props.name} failed to render
        </p>
        <p className="max-w-md rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground/70">
          {this.state.message}
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          Retry
        </button>
      </div>
    )
  }
}
