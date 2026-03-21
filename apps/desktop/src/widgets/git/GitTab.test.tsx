import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GitTab } from './GitTab'

vi.mock('@/lib/orchestra-client', () => ({
  fetchProjectGitBranches: vi.fn().mockResolvedValue({ current: 'main', branches: ['main', 'dev'] }),
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
  fetchProjectGitDiff: vi.fn().mockResolvedValue(''),
  gitStage: vi.fn().mockResolvedValue(undefined),
  gitUnstage: vi.fn().mockResolvedValue(undefined),
  gitCommit: vi.fn().mockResolvedValue(undefined),
  gitPush: vi.fn().mockResolvedValue(undefined),
  gitPull: vi.fn().mockResolvedValue(undefined),
  gitCheckout: vi.fn().mockResolvedValue(undefined),
  gitCreateBranch: vi.fn().mockResolvedValue(undefined),
  gitStash: vi.fn().mockResolvedValue(undefined),
  gitStashPop: vi.fn().mockResolvedValue(undefined),
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
})
