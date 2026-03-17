import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary'

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('test explosion')
  }
  return <div>child content</div>
}

describe('SectionErrorBoundary', () => {
  // Suppress console.error from componentDidCatch during tests
  const originalConsoleError = console.error
  beforeAll(() => {
    console.error = vi.fn()
  })
  afterAll(() => {
    console.error = originalConsoleError
  })
  afterEach(() => cleanup())

  it('renders children when no error occurs', () => {
    render(
      <SectionErrorBoundary name="TestSection">
        <div>hello world</div>
      </SectionErrorBoundary>,
    )

    expect(screen.getByText('hello world')).toBeTruthy()
  })

  it('shows error message and retry button when child throws', () => {
    render(
      <SectionErrorBoundary name="Broken">
        <ProblemChild shouldThrow={true} />
      </SectionErrorBoundary>,
    )

    expect(screen.getByText('test explosion')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('clicking retry re-renders children', () => {
    let shouldThrow = true

    function Toggler() {
      if (shouldThrow) throw new Error('boom')
      return <div>recovered</div>
    }

    render(
      <SectionErrorBoundary name="Retry">
        <Toggler />
      </SectionErrorBoundary>,
    )

    expect(screen.getByText('boom')).toBeTruthy()

    // Fix the child before retrying
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.getByText('recovered')).toBeTruthy()
    expect(screen.queryByText('boom')).toBeNull()
  })

  it('displays the section name in the error UI', () => {
    render(
      <SectionErrorBoundary name="Dashboard">
        <ProblemChild shouldThrow={true} />
      </SectionErrorBoundary>,
    )

    expect(screen.getByText('Dashboard failed to render')).toBeTruthy()
  })
})
