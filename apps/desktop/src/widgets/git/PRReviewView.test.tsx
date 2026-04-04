import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PRReviewView } from './PRReviewView'
import type { BackendConfig, GitHubPR } from '@/lib/orchestra-client'

vi.mock('@/lib/orchestra-client', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/orchestra-client')
  return {
    ...actual,
    fetchProjectGitHubPullDiff: vi.fn().mockResolvedValue('diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,4 @@\n+import React from "react"\n export default {}'),
    fetchPRReviews: vi.fn().mockResolvedValue([
      { id: 1, user: { login: 'alice' }, body: 'Looks great!', state: 'APPROVED', submitted_at: '2026-03-20T10:00:00Z' },
      { id: 2, user: { login: 'bob' }, body: 'Needs a fix here', state: 'CHANGES_REQUESTED', submitted_at: '2026-03-20T11:00:00Z' },
    ]),
    submitPRReview: vi.fn().mockResolvedValue({}),
    mergePR: vi.fn().mockResolvedValue({}),
  }
})

vi.mock('./DiffViewer', () => ({
  DiffViewer: ({ filePath, diff }: { filePath: string; diff: string | null }) => (
    <div data-testid="diff-viewer">
      <span>{filePath}</span>
      {diff && <pre>{diff}</pre>}
    </div>
  ),
}))

const config: BackendConfig = { baseUrl: 'http://localhost:4010', apiToken: 'dev-token' }

function makePR(overrides: Partial<GitHubPR> = {}): GitHubPR {
  return {
    number: 42,
    title: 'Add authentication flow',
    body: 'Implements OAuth2',
    state: 'open',
    html_url: 'https://github.com/org/repo/pull/42',
    diff_url: 'https://github.com/org/repo/pull/42.diff',
    head: { ref: 'feat/auth', label: 'org:feat/auth' },
    base: { ref: 'main', label: 'org:main' },
    user: { login: 'alice', avatar_url: '' },
    created_at: '2026-03-20T09:00:00Z',
    merged_at: null,
    ...overrides,
  }
}

const defaultProps = {
  projectId: 'proj-1',
  config,
  pr: makePR(),
  onClose: vi.fn(),
}

describe('PRReviewView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders PR title and number', () => {
    render(<PRReviewView {...defaultProps} />)
    expect(screen.getByText('Add authentication flow')).toBeTruthy()
    expect(screen.getByText('#42')).toBeTruthy()
  })

  it('renders branch info (head -> base)', () => {
    render(<PRReviewView {...defaultProps} />)
    // The component renders "base ← head" using &larr; HTML entity
    const branchInfo = screen.getByText(/main/)
    expect(branchInfo).toBeTruthy()
    expect(branchInfo.textContent).toContain('feat/auth')
  })

  it('shows Files Changed and Reviews tabs', () => {
    render(<PRReviewView {...defaultProps} />)
    expect(screen.getByText('Files Changed')).toBeTruthy()
    // Reviews tab shows count; initially 0 before async load
    expect(screen.getByText(/Reviews/)).toBeTruthy()
  })

  it('renders diff content after load', async () => {
    render(<PRReviewView {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/diff --git/)).toBeTruthy()
    })
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<PRReviewView {...defaultProps} onClose={onClose} />)
    // The close button is the first button in the header (contains X icon)
    const buttons = screen.getAllByRole('button')
    // First button is the close button
    fireEvent.click(buttons[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows merge dropdown with methods (merge, squash, rebase)', () => {
    render(<PRReviewView {...defaultProps} />)
    // Click the Merge dropdown button
    const mergeButton = screen.getByText(/Merge/)
    fireEvent.click(mergeButton)
    expect(screen.getByText('Squash')).toBeTruthy()
    expect(screen.getByText('Rebase')).toBeTruthy()
    // "Merge" appears both as the dropdown trigger and as an option
    const mergeOptions = screen.getAllByText('Merge')
    expect(mergeOptions.length).toBeGreaterThanOrEqual(2)
  })

  it('shows review submission form', () => {
    render(<PRReviewView {...defaultProps} />)
    expect(screen.getByPlaceholderText('Review comment...')).toBeTruthy()
    expect(screen.getByText(/Approve/)).toBeTruthy()
    expect(screen.getByText(/Changes/)).toBeTruthy()
  })

  it('renders existing reviews', async () => {
    render(<PRReviewView {...defaultProps} />)
    // Switch to Reviews tab
    const reviewsTab = screen.getByText(/Reviews/)
    fireEvent.click(reviewsTab)
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy()
      expect(screen.getByText('Looks great!')).toBeTruthy()
      expect(screen.getByText('bob')).toBeTruthy()
      expect(screen.getByText('Needs a fix here')).toBeTruthy()
    })
  })

  it('shows PR state badge for open PR', () => {
    render(<PRReviewView {...defaultProps} />)
    expect(screen.getByText('open')).toBeTruthy()
  })

  it('shows PR state badge for merged PR', () => {
    render(<PRReviewView {...defaultProps} pr={makePR({ merged_at: '2026-03-20T12:00:00Z' })} />)
    expect(screen.getByText('merged')).toBeTruthy()
    expect(screen.queryByText('open')).toBeFalsy()
  })

  it('shows PR state badge for closed PR', () => {
    render(<PRReviewView {...defaultProps} pr={makePR({ state: 'closed' })} />)
    expect(screen.getByText('closed')).toBeTruthy()
    expect(screen.queryByText('open')).toBeFalsy()
  })
})
