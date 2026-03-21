import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ProjectGrid } from '@/components/projects/ProjectGrid'
import type { Project, ProjectStats } from '@/lib/orchestra-types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Alpha',
    root_path: '/home/user/alpha',
    remote_url: 'git@github.com:user/alpha.git',
    ...overrides,
  }
}

const projects: Project[] = [
  makeProject({ id: 'p1', name: 'Alpha', root_path: '/home/user/alpha' }),
  makeProject({ id: 'p2', name: 'Bravo', root_path: '/home/user/bravo', remote_url: '' }),
  makeProject({ id: 'p3', name: 'Charlie', root_path: '/tmp/charlie' }),
]

const stats: Record<string, ProjectStats> = {
  p1: { total_sessions: 5, total_input: 1200, total_output: 800, last_active: '2026-03-21T10:00:00Z' },
  p2: { total_sessions: 12, total_input: 500000, total_output: 500000, last_active: '2026-03-20T08:00:00Z' },
  p3: { total_sessions: 1, total_input: 50, total_output: 30, last_active: '' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderGrid(overrides: Partial<Parameters<typeof ProjectGrid>[0]> = {}) {
  const defaults = {
    projects,
    stats,
    loading: false,
    onProjectClick: vi.fn(),
    onAddProject: vi.fn(),
    onDeleteProject: vi.fn(),
  }
  const props = { ...defaults, ...overrides }
  const result = render(<ProjectGrid {...props} />)
  return { ...result, props }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectGrid', () => {
  afterEach(() => cleanup())

  // 1. Renders project list with name, path, sessions, tokens, last active
  it('renders project rows with name, path, sessions, and tokens', () => {
    renderGrid()

    // Names
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Bravo')).toBeTruthy()
    expect(screen.getByText('Charlie')).toBeTruthy()

    // Paths
    expect(screen.getByText('/home/user/alpha')).toBeTruthy()
    expect(screen.getByText('/home/user/bravo')).toBeTruthy()
    expect(screen.getByText('/tmp/charlie')).toBeTruthy()

    // Sessions counts
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()

    // Tokens — Alpha: 2000 -> "2.0k", Bravo: 1000000 -> "1.0M", Charlie: 80
    expect(screen.getByText('2.0k')).toBeTruthy()
    expect(screen.getByText('1.0M')).toBeTruthy()
    expect(screen.getByText('80')).toBeTruthy()

    // Project count label
    expect(screen.getByText('3 projects')).toBeTruthy()
  })

  // 2. Search filtering works (filters by name and path)
  it('filters projects by name when searching', () => {
    renderGrid()

    const searchInput = screen.getByPlaceholderText('Search projects...')
    fireEvent.change(searchInput, { target: { value: 'bravo' } })

    expect(screen.getByText('Bravo')).toBeTruthy()
    expect(screen.queryByText('Alpha')).toBeNull()
    expect(screen.queryByText('Charlie')).toBeNull()
    expect(screen.getByText('1 project')).toBeTruthy()
  })

  it('filters projects by path when searching', () => {
    renderGrid()

    const searchInput = screen.getByPlaceholderText('Search projects...')
    fireEvent.change(searchInput, { target: { value: '/tmp' } })

    expect(screen.getByText('Charlie')).toBeTruthy()
    expect(screen.queryByText('Alpha')).toBeNull()
    expect(screen.queryByText('Bravo')).toBeNull()
  })

  // 3. Sorting by column headers toggles asc/desc
  it('sorts by sessions column ascending then descending', () => {
    renderGrid()

    const sessionsBtn = screen.getByRole('button', { name: /Sessions/i })

    // Click once -> sort sessions asc (1, 5, 12)
    fireEvent.click(sessionsBtn)

    // Get all session-count cells. They live in w-20 text-right divs.
    // We can check ordering by looking at text content of rows.
    const rows = screen.getAllByText(/^(Alpha|Bravo|Charlie)$/)
    expect(rows[0].textContent).toBe('Charlie')  // 1 session
    expect(rows[1].textContent).toBe('Alpha')     // 5 sessions
    expect(rows[2].textContent).toBe('Bravo')     // 12 sessions

    // Click again -> sort sessions desc (12, 5, 1)
    fireEvent.click(sessionsBtn)
    const rowsDesc = screen.getAllByText(/^(Alpha|Bravo|Charlie)$/)
    expect(rowsDesc[0].textContent).toBe('Bravo')
    expect(rowsDesc[1].textContent).toBe('Alpha')
    expect(rowsDesc[2].textContent).toBe('Charlie')
  })

  it('sorts by name ascending by default, toggles to descending', () => {
    renderGrid()

    // Default sort is name asc
    const names = screen.getAllByText(/^(Alpha|Bravo|Charlie)$/)
    expect(names[0].textContent).toBe('Alpha')
    expect(names[1].textContent).toBe('Bravo')
    expect(names[2].textContent).toBe('Charlie')

    // Click name header to toggle to desc
    const nameBtn = screen.getByRole('button', { name: /Name/i })
    fireEvent.click(nameBtn)
    const namesDesc = screen.getAllByText(/^(Alpha|Bravo|Charlie)$/)
    expect(namesDesc[0].textContent).toBe('Charlie')
    expect(namesDesc[1].textContent).toBe('Bravo')
    expect(namesDesc[2].textContent).toBe('Alpha')
  })

  // 4. Shows empty state when no projects
  it('shows empty state when no projects exist', () => {
    renderGrid({ projects: [] })

    expect(screen.getByText('No Projects')).toBeTruthy()
    expect(screen.getByText('Add a local repository to get started.')).toBeTruthy()
  })

  // 5. Shows empty state when search has no matches
  it('shows empty state when search has no matches', () => {
    renderGrid()

    const searchInput = screen.getByPlaceholderText('Search projects...')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

    expect(screen.getByText('No matches')).toBeTruthy()
    expect(screen.getByText('Nothing matched "nonexistent"')).toBeTruthy()
  })

  // 6. Delete button appears and opens confirmation dialog
  it('opens delete confirmation dialog when delete button is clicked', () => {
    renderGrid()

    const deleteBtns = screen.getAllByTestId('project-delete-btn')
    // Click delete on the first project (Alpha, sorted asc by name)
    fireEvent.click(deleteBtns[0])

    // Dialog title and confirm button both say "Remove Project"
    const removeTexts = screen.getAllByText('Remove Project')
    expect(removeTexts.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Are you sure you want to remove/)).toBeTruthy()
    // The project name should appear in the dialog description
    expect(screen.getByText(/Are you sure you want to remove/).textContent).toContain('Alpha')
  })

  it('calls onDeleteProject when confirming deletion', () => {
    const { props } = renderGrid()

    const deleteBtns = screen.getAllByTestId('project-delete-btn')
    fireEvent.click(deleteBtns[0])

    // Confirm removal
    const confirmBtn = screen.getByRole('button', { name: 'Remove Project' })
    fireEvent.click(confirmBtn)

    expect(props.onDeleteProject).toHaveBeenCalledWith('p1')
  })

  it('delete button click does not trigger row click', () => {
    const { props } = renderGrid()

    const deleteBtns = screen.getAllByTestId('project-delete-btn')
    fireEvent.click(deleteBtns[0])

    // onProjectClick should NOT have been called because stopPropagation is used
    expect(props.onProjectClick).not.toHaveBeenCalled()
  })

  // 7. Clicking a project row calls onProjectClick with the project ID
  it('calls onProjectClick with the project id when a row is clicked', () => {
    const { props } = renderGrid()

    fireEvent.click(screen.getByText('Bravo'))

    expect(props.onProjectClick).toHaveBeenCalledWith('p2')
  })

  // 8. Loading skeleton state renders when loading=true and no projects
  it('renders loading skeleton when loading is true and no projects', () => {
    const { container } = renderGrid({ loading: true, projects: [] })

    // The skeleton state renders 6 skeleton row containers with animate-pulse
    const pulseRows = container.querySelectorAll('.animate-pulse')
    expect(pulseRows.length).toBeGreaterThanOrEqual(6)
  })

  it('does not render skeleton when loading is true but projects exist', () => {
    const { container } = renderGrid({ loading: true })

    const pulseRows = container.querySelectorAll('.animate-pulse')
    expect(pulseRows.length).toBe(0)

    // Should still show project rows
    expect(screen.getByText('Alpha')).toBeTruthy()
  })
})
