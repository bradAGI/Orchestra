import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitHubPanel } from './GitHubPanel'
import type { GitHubIssue, GitHubPR, BackendConfig } from '@core/api/client'

vi.mock('@core/api/client', () => ({
  fetchProjectGitHubIssues: vi.fn(),
  fetchProjectGitHubPulls: vi.fn(),
  createProjectGitHubIssue: vi.fn(),
  updateProjectGitHubIssue: vi.fn(),
  createProjectGitHubPull: vi.fn(),
  fetchProjectGitBranches: vi.fn(),
  fetchDefaultBranch: vi.fn(),
}))

import {
  fetchProjectGitHubIssues,
  fetchProjectGitHubPulls,
  fetchProjectGitBranches,
  fetchDefaultBranch,
} from '@core/api/client'

const mockFetchIssues = fetchProjectGitHubIssues as ReturnType<typeof vi.fn>
const mockFetchPulls = fetchProjectGitHubPulls as ReturnType<typeof vi.fn>
const mockFetchBranches = fetchProjectGitBranches as ReturnType<typeof vi.fn>
const mockFetchDefaultBranch = fetchDefaultBranch as ReturnType<typeof vi.fn>

const config: BackendConfig = { baseUrl: 'http://localhost:4010', apiToken: 'dev-token' }

const sampleIssues: GitHubIssue[] = [
  {
    number: 1,
    title: 'Fix login bug',
    body: 'Login fails on mobile',
    state: 'open',
    html_url: 'https://github.com/test/repo/issues/1',
    labels: [{ name: 'bug' }],
  },
  {
    number: 2,
    title: 'Add dark mode',
    body: '',
    state: 'closed',
    html_url: 'https://github.com/test/repo/issues/2',
    labels: [],
  },
]

const samplePRs: GitHubPR[] = [
  {
    number: 10,
    title: 'Feature branch PR',
    body: 'Adds feature X',
    state: 'open',
    html_url: 'https://github.com/test/repo/pull/10',
    diff_url: 'https://github.com/test/repo/pull/10.diff',
    head: { ref: 'feature-x', label: 'user:feature-x' },
    base: { ref: 'main', label: 'user:main' },
    user: { login: 'dev', avatar_url: 'https://example.com/avatar.png' },
    created_at: '2026-01-01T00:00:00Z',
    merged_at: null,
  },
  {
    number: 11,
    title: 'Merged hotfix',
    body: 'Hotfix for prod',
    state: 'closed',
    html_url: 'https://github.com/test/repo/pull/11',
    diff_url: 'https://github.com/test/repo/pull/11.diff',
    head: { ref: 'hotfix', label: 'user:hotfix' },
    base: { ref: 'main', label: 'user:main' },
    user: { login: 'dev', avatar_url: 'https://example.com/avatar.png' },
    created_at: '2026-01-02T00:00:00Z',
    merged_at: '2026-01-03T00:00:00Z',
  },
]

function setupMocks({
  issues = sampleIssues,
  prs = samplePRs,
  branches = ['main', 'feature-x', 'hotfix'],
  defaultBranch = 'main',
}: {
  issues?: GitHubIssue[]
  prs?: GitHubPR[]
  branches?: string[]
  defaultBranch?: string
} = {}) {
  mockFetchIssues.mockResolvedValue({ issues, has_more: false })
  mockFetchPulls.mockResolvedValue({ pulls: prs, has_more: false })
  mockFetchBranches.mockResolvedValue({ current: 'main', branches })
  mockFetchDefaultBranch.mockResolvedValue(defaultBranch)
}

const defaultProps = {
  projectId: 'proj-1',
  config,
  githubToken: 'ghp_test123',
  onOpenPR: vi.fn(),
}

describe('GitHubPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Issues and PRs tabs', async () => {
    setupMocks()
    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Issues')).toBeTruthy()
      expect(screen.getByText('PRs')).toBeTruthy()
    })
  })

  it('shows loading state initially (empty before data arrives)', () => {
    // Never resolve the promises so we stay in loading state
    mockFetchIssues.mockReturnValue(new Promise(() => {}))
    mockFetchPulls.mockReturnValue(new Promise(() => {}))
    mockFetchBranches.mockReturnValue(new Promise(() => {}))
    mockFetchDefaultBranch.mockReturnValue(new Promise(() => {}))

    render(<GitHubPanel {...defaultProps} />)
    // The summary line should show 0 issues / 0 PRs while loading
    expect(screen.getByText('0 issues · 0 PRs')).toBeTruthy()
  })

  it('renders issues after load', async () => {
    setupMocks()
    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/Fix login bug/)).toBeTruthy()
      expect(screen.getByText(/Add dark mode/)).toBeTruthy()
    })
  })

  it('renders PRs after load', async () => {
    setupMocks()
    render(<GitHubPanel {...defaultProps} />)
    // Switch to PRs tab
    await waitFor(() => expect(screen.getByText('PRs')).toBeTruthy())
    fireEvent.click(screen.getByText('PRs'))
    await waitFor(() => {
      expect(screen.getByText(/Feature branch PR/)).toBeTruthy()
      expect(screen.getByText(/Merged hotfix/)).toBeTruthy()
    })
  })

  it('shows "No issues" when empty', async () => {
    setupMocks({ issues: [] })
    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('No issues')).toBeTruthy()
    })
  })

  it('shows "No pull requests" when empty', async () => {
    setupMocks({ prs: [] })
    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByText('PRs')).toBeTruthy())
    fireEvent.click(screen.getByText('PRs'))
    await waitFor(() => {
      expect(screen.getByText('No pull requests')).toBeTruthy()
    })
  })

  it('switches between Issues and PRs tabs', async () => {
    setupMocks()
    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByText(/Fix login bug/)).toBeTruthy())

    // Switch to PRs
    fireEvent.click(screen.getByText('PRs'))
    await waitFor(() => {
      expect(screen.getByText(/Feature branch PR/)).toBeTruthy()
    })
    // Issues should no longer be visible
    expect(screen.queryByText(/Fix login bug/)).toBeFalsy()

    // Switch back to Issues
    fireEvent.click(screen.getByText('Issues'))
    await waitFor(() => {
      expect(screen.getByText(/Fix login bug/)).toBeTruthy()
    })
    expect(screen.queryByText(/Feature branch PR/)).toBeFalsy()
  })

  it('shows create issue form', async () => {
    setupMocks()
    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByText('Issues')).toBeTruthy())

    // The create issue form should not be visible initially
    expect(screen.queryByPlaceholderText('Issue title')).toBeFalsy()

    // Click the "New issue" button (has title="New issue")
    const newIssueBtn = screen.getByTitle('New issue')
    fireEvent.click(newIssueBtn)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Issue title')).toBeTruthy()
      expect(screen.getByPlaceholderText('Description (optional)')).toBeTruthy()
    })
  })

  it('shows create PR form', async () => {
    setupMocks()
    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByText('PRs')).toBeTruthy())
    fireEvent.click(screen.getByText('PRs'))

    await waitFor(() => expect(screen.queryByText('No pull requests')).toBeFalsy())

    // Click the + button in PRs tab
    const buttons = screen.getAllByRole('button')
    // The + button in PRs section
    const plusButtons = buttons.filter(
      (b) => b.querySelector('svg') && !b.textContent?.trim()
    )
    // The last icon-only button should be the PR + button
    if (plusButtons.length > 0) {
      fireEvent.click(plusButtons[plusButtons.length - 1])
    }

    await waitFor(() => {
      expect(screen.getByPlaceholderText('PR title')).toBeTruthy()
      expect(screen.getByPlaceholderText('Description')).toBeTruthy()
      expect(screen.getByText('Create PR')).toBeTruthy()
    })
  })

  it('calls onOpenPR when PR clicked', async () => {
    const onOpenPR = vi.fn()
    setupMocks()
    render(<GitHubPanel {...defaultProps} onOpenPR={onOpenPR} />)
    await waitFor(() => expect(screen.getByText('PRs')).toBeTruthy())
    fireEvent.click(screen.getByText('PRs'))

    await waitFor(() => expect(screen.getByText(/Feature branch PR/)).toBeTruthy())
    fireEvent.click(screen.getByText(/Feature branch PR/).closest('button')!)
    expect(onOpenPR).toHaveBeenCalledWith(samplePRs[0])
  })

  it('shows error message when token is invalid (401)', async () => {
    mockFetchIssues.mockRejectedValue(new Error('401 Unauthorized'))
    mockFetchPulls.mockRejectedValue(new Error('401 Unauthorized'))
    mockFetchBranches.mockResolvedValue({ current: 'main', branches: [] })
    mockFetchDefaultBranch.mockResolvedValue('main')

    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => {
      expect(
        screen.getByText('GitHub authentication failed. Reconnect in project settings.')
      ).toBeTruthy()
    })
  })

  it('renders issue state badges (open/closed)', async () => {
    setupMocks()
    render(<GitHubPanel {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/Fix login bug/)).toBeTruthy()
      expect(screen.getByText(/Add dark mode/)).toBeTruthy()
    })

    // Open issue (#1) should have a green-colored CircleDot icon
    const issue1Row = screen.getByText(/Fix login bug/).closest('div')!
    const issue1Icon = issue1Row.querySelector('svg')
    expect(issue1Icon?.classList.toString()).toContain('text-emerald-500')

    // Closed issue (#2) should have a red-colored CircleDot icon
    const issue2Row = screen.getByText(/Add dark mode/).closest('div')!
    const issue2Icon = issue2Row.querySelector('svg')
    expect(issue2Icon?.classList.toString()).toContain('text-destructive')
  })
})
