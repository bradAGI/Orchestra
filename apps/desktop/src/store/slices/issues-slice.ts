/**
 * Issues slice — board issues, GitHub backlog, and computed merged list.
 */

import type { StateCreator } from 'zustand'
import type { AppState, IssuesSlice } from '../types'
import type { IssueListItem } from '@/lib/orchestra-client'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mergeIssues(
  boardIssues: IssueListItem[],
  githubBacklogIssues: IssueListItem[],
): IssueListItem[] {
  const seen = new Set<string>()
  const result: IssueListItem[] = []

  for (const issue of boardIssues) {
    seen.add(issue.title)
    result.push(issue)
  }

  for (const issue of githubBacklogIssues) {
    if (!seen.has(issue.title)) {
      result.push(issue)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Slice factory
// ---------------------------------------------------------------------------

export const createIssuesSlice: StateCreator<AppState, [], [], IssuesSlice> = (set, get) => ({
  // ---- State ----------------------------------------------------------------
  boardIssues: [],
  githubBacklogIssues: [],
  allBoardIssues: [],

  // ---- Actions --------------------------------------------------------------
  setBoardIssues: (issues) => {
    const githubBacklogIssues = get().githubBacklogIssues
    set({
      boardIssues: issues,
      allBoardIssues: mergeIssues(issues, githubBacklogIssues),
    })
  },

  setGithubBacklogIssues: (issues) => {
    const boardIssues = get().boardIssues
    set({
      githubBacklogIssues: issues,
      allBoardIssues: mergeIssues(boardIssues, issues),
    })
  },
})
