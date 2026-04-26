import { describe, it, expect } from 'vitest'
import { createIssuesSlice } from './issues-slice'
import type { AppState } from '../types'
import type { IssueListItem } from '@/lib/orchestra-client'

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function createTestSlice() {
  let state = {} as AppState
  const set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as any
  const slice = createIssuesSlice(set as any, get, api)
  state = { ...state, ...slice }
  return { get: () => state, state: slice }
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const makeIssue = (title: string, id = title): IssueListItem =>
  ({ id, title, status: 'open' }) as unknown as IssueListItem

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IssuesSlice — default initialization', () => {
  it('initializes boardIssues to empty array', () => {
    const { state } = createTestSlice()
    expect(state.boardIssues).toEqual([])
  })

  it('initializes githubBacklogIssues to empty array', () => {
    const { state } = createTestSlice()
    expect(state.githubBacklogIssues).toEqual([])
  })

  it('initializes allBoardIssues to empty array', () => {
    const { state } = createTestSlice()
    expect(state.allBoardIssues).toEqual([])
  })
})

describe('IssuesSlice — setBoardIssues', () => {
  it('updates boardIssues', () => {
    const { get, state } = createTestSlice()
    const issues = [makeIssue('A'), makeIssue('B')]
    state.setBoardIssues(issues)
    expect(get().boardIssues).toEqual(issues)
  })

  it('recomputes allBoardIssues', () => {
    const { get, state } = createTestSlice()
    const issues = [makeIssue('A'), makeIssue('B')]
    state.setBoardIssues(issues)
    expect(get().allBoardIssues).toHaveLength(2)
  })

  it('merges with existing githubBacklogIssues', () => {
    const { get, state } = createTestSlice()
    state.setGithubBacklogIssues([makeIssue('C')])
    state.setBoardIssues([makeIssue('A'), makeIssue('B')])
    expect(get().allBoardIssues).toHaveLength(3)
  })
})

describe('IssuesSlice — setGithubBacklogIssues', () => {
  it('updates githubBacklogIssues', () => {
    const { get, state } = createTestSlice()
    const issues = [makeIssue('X')]
    state.setGithubBacklogIssues(issues)
    expect(get().githubBacklogIssues).toEqual(issues)
  })

  it('recomputes allBoardIssues', () => {
    const { get, state } = createTestSlice()
    state.setGithubBacklogIssues([makeIssue('X'), makeIssue('Y')])
    expect(get().allBoardIssues).toHaveLength(2)
  })
})

describe('IssuesSlice — deduplication by title', () => {
  it('board issues take priority over github backlog on duplicate title', () => {
    const { get, state } = createTestSlice()
    const boardIssue = makeIssue('Dupe', 'board-1')
    const backlogIssue = makeIssue('Dupe', 'backlog-1')
    state.setBoardIssues([boardIssue])
    state.setGithubBacklogIssues([backlogIssue])
    const all = get().allBoardIssues
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('board-1')
  })

  it('unique entries from both lists are included', () => {
    const { get, state } = createTestSlice()
    state.setBoardIssues([makeIssue('A'), makeIssue('B')])
    state.setGithubBacklogIssues([makeIssue('C'), makeIssue('D')])
    expect(get().allBoardIssues).toHaveLength(4)
  })

  it('does not duplicate when same title appears multiple times in backlog', () => {
    const { get, state } = createTestSlice()
    state.setBoardIssues([makeIssue('A', 'board-A')])
    state.setGithubBacklogIssues([makeIssue('A', 'backlog-A'), makeIssue('B', 'backlog-B')])
    const all = get().allBoardIssues
    expect(all).toHaveLength(2)
    expect(all.find((i) => i.title === 'A')?.id).toBe('board-A')
  })
})
