import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { KanbanBoard } from './KanbanBoard'

vi.mock('overlayscrollbars-react', () => ({
  OverlayScrollbarsComponent: ({ children, ...props }: any) => (
    <div data-testid="overlay-scroll" {...props}>{children}</div>
  ),
}))

vi.mock('@/components/ui/tooltip-wrapper', () => ({
  AppTooltip: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/components/app-shell/shared/controls', () => ({
  AgentSelector: () => <div data-testid="agent-selector" />,
  CustomDropdown: () => <div data-testid="custom-dropdown" />,
}))

afterEach(() => {
  cleanup()
})

const defaultProps = {
  loadingState: false,
  snapshot: null,
  boardIssues: [],
  projects: [],
  availableAgents: [],
  onInspectIssue: vi.fn(async () => {}),
  onIssueUpdate: vi.fn(async () => {}),
  onIssueDelete: vi.fn(async () => {}),
  onStopSession: vi.fn(async () => {}),
  onCreateIssue: vi.fn(),
}

describe('KanbanBoard', () => {
  it('renders all 5 column headings', () => {
    render(<KanbanBoard {...defaultProps} />)

    expect(screen.getByText('Backlog')).toBeTruthy()
    expect(screen.getByText('To Do')).toBeTruthy()
    expect(screen.getByText('In Progress')).toBeTruthy()
    expect(screen.getByText('Review')).toBeTruthy()
    expect(screen.getByText('Done')).toBeTruthy()
  })

  it('renders create button only for Backlog column', () => {
    const { container } = render(<KanbanBoard {...defaultProps} />)

    // The Backlog column should have a "Click to add task" button
    expect(screen.getByText('Click to add task')).toBeTruthy()

    // There should be exactly one Plus button in column headers (Backlog only)
    // The Plus icon is rendered inside an SVG with class containing lucide-plus
    const plusButtons = container.querySelectorAll('.lucide-plus')
    // One in the header + one in the empty column body = 2 total (both for Backlog)
    expect(plusButtons.length).toBe(2)
  })

  it('shows "No tasks" for empty non-backlog columns', () => {
    render(<KanbanBoard {...defaultProps} />)

    const noTaskElements = screen.getAllByText('No tasks')
    // To Do, In Progress, Review, Done = 4 columns with "No tasks"
    expect(noTaskElements.length).toBe(4)
  })
})
