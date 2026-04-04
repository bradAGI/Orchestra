import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitTab } from './GitTab'

const { mockFetchProjectGitDiff, mockGitGetConflicts } = vi.hoisted(() => ({
  mockFetchProjectGitDiff: vi.fn().mockResolvedValue(''),
  mockGitGetConflicts: vi.fn().mockResolvedValue({ in_merge: false, files: [] }),
}))

vi.mock('@/lib/orchestra-client', () => ({
  fetchProjectGitBranches: vi.fn().mockResolvedValue({ current: 'main', branches: ['main', 'dev'], remotes: [] }),
  fetchProjectGitStatus: vi.fn().mockResolvedValue({
    files: [
      { path: 'src/app.tsx', status: ' M' },
      { path: 'README.md', status: 'M ' },
    ],
    branch: { ahead: 1, behind: 0 },
  }),
  fetchProjectGitHistory: vi.fn().mockResolvedValue([
    { hash: 'abc123', message: 'initial commit', author: 'test', date: '2026-01-01' },
  ]),
  fetchProjectGitDiff: mockFetchProjectGitDiff,
  gitStage: vi.fn().mockResolvedValue(undefined),
  gitUnstage: vi.fn().mockResolvedValue(undefined),
  gitCommit: vi.fn().mockResolvedValue(undefined),
  gitPush: vi.fn().mockResolvedValue(undefined),
  gitPull: vi.fn().mockResolvedValue(undefined),
  gitCheckout: vi.fn().mockResolvedValue(undefined),
  gitCreateBranch: vi.fn().mockResolvedValue(undefined),
  gitStash: vi.fn().mockResolvedValue(undefined),
  gitStashPop: vi.fn().mockResolvedValue(undefined),
  gitFetch: vi.fn().mockResolvedValue(undefined),
  gitMerge: vi.fn().mockResolvedValue(undefined),
  gitDeleteBranch: vi.fn().mockResolvedValue(undefined),
  createGitHubRepo: vi.fn().mockResolvedValue(undefined),
  gitStashList: vi.fn().mockResolvedValue([]),
  gitStashApply: vi.fn().mockResolvedValue(undefined),
  gitStashDrop: vi.fn().mockResolvedValue(undefined),
  gitGetConflicts: mockGitGetConflicts,
  gitMergeAbort: vi.fn().mockResolvedValue(undefined),
  gitConflictResolve: vi.fn().mockResolvedValue(undefined),
  fetchProjectGitHubIssues: vi.fn().mockResolvedValue([]),
  fetchProjectGitHubPulls: vi.fn().mockResolvedValue([]),
  createProjectGitHubIssue: vi.fn().mockResolvedValue(undefined),
  updateProjectGitHubIssue: vi.fn().mockResolvedValue(undefined),
  createProjectGitHubPull: vi.fn().mockResolvedValue(undefined),
  fetchDefaultBranch: vi.fn().mockResolvedValue('main'),
  fetchProjectGitHubPullDiff: vi.fn().mockResolvedValue(''),
  fetchPRReviews: vi.fn().mockResolvedValue([]),
  submitPRReview: vi.fn().mockResolvedValue(undefined),
  mergePR: vi.fn().mockResolvedValue(undefined),
}))

const mockProject = {
  id: 'proj-1',
  name: 'Test Project',
  root_path: '/tmp/test',
  github_owner: '',
  github_repo: '',
  github_token: '',
  remote_url: '',
}

const mockConfig = { baseUrl: 'http://localhost:4010', apiToken: 'test-token' }

describe('GitTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGitGetConflicts.mockResolvedValue({ in_merge: false, files: [] })
    mockFetchProjectGitDiff.mockResolvedValue('')
  })

  it('renders without crashing', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    const el = await screen.findByText('Changes')
    expect(el).toBeTruthy()
  })

  it('renders sub-tabs', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    expect(await screen.findByText('Changes')).toBeTruthy()
    expect(await screen.findByText('History')).toBeTruthy()
  })

  it('shows unstaged and staged sections after load', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    expect(await screen.findByText('Unstaged')).toBeTruthy()
    expect(await screen.findByText('Staged')).toBeTruthy()
  })

  it('switches to History tab when clicked', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    const historyTab = await screen.findByText('History')
    fireEvent.click(historyTab)
    // History tab shows CommitTimeline with the commit message
    expect(await screen.findByText('initial commit')).toBeTruthy()
    // Changes-specific sections should not be visible
    expect(screen.queryByText('Unstaged')).toBeFalsy()
  })

  it('switches to PRs tab when clicked', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    const prsTab = await screen.findByText('PRs')
    fireEvent.click(prsTab)
    // With no github_owner, should show the "not connected" message
    expect(await screen.findByText('No GitHub repository connected')).toBeTruthy()
  })

  it('shows "No GitHub repository connected" when project has no github_owner', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    const prsTab = await screen.findByText('PRs')
    fireEvent.click(prsTab)
    expect(await screen.findByText('No GitHub repository connected')).toBeTruthy()
  })

  it('still shows the disconnected message when token exists but no repo', async () => {
    const projectWithToken = {
      ...mockProject,
      github_token: 'ghp_testtoken123',
    }
    render(<GitTab project={projectWithToken} config={mockConfig} />)
    const prsTab = await screen.findByText('PRs')
    fireEvent.click(prsTab)
    expect(await screen.findByText('No GitHub repository connected')).toBeTruthy()
    expect(screen.queryByText('Create GitHub Repository')).toBeFalsy()
  })

  it('renders ConflictBanner when conflicts exist', async () => {
    mockGitGetConflicts.mockResolvedValue({
      in_merge: true,
      files: ['src/conflict.tsx', 'src/other.tsx'],
    })
    render(<GitTab project={mockProject} config={mockConfig} />)
    expect(await screen.findByText(/Merge in progress/)).toBeTruthy()
    expect(await screen.findByText(/2 conflicted files/)).toBeTruthy()
  })

  it('shows commit bar in Changes tab', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    // CommitBar renders a "Commit" button and a commit message input
    expect(await screen.findByText('Commit')).toBeTruthy()
    const input = await screen.findByPlaceholderText('Commit message...')
    expect(input).toBeTruthy()
  })

  it('shows diff viewer empty state initially', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    expect(await screen.findByText('Select a file to view its diff')).toBeTruthy()
  })

  it('calls fetchProjectGitDiff when file selected', async () => {
    mockFetchProjectGitDiff.mockResolvedValue('diff --git a/src/app.tsx')
    render(<GitTab project={mockProject} config={mockConfig} />)
    // Wait for the staging area to load, then click an unstaged file
    const fileEl = await screen.findByText('src/app.tsx')
    fireEvent.click(fileEl)
    await waitFor(() => {
      expect(mockFetchProjectGitDiff).toHaveBeenCalledWith(
        mockConfig,
        'proj-1',
        expect.objectContaining({ file: 'src/app.tsx' }),
      )
    })
  })

  it('shows branch name in branch bar', async () => {
    render(<GitTab project={mockProject} config={mockConfig} />)
    expect(await screen.findByText('main')).toBeTruthy()
  })
})
