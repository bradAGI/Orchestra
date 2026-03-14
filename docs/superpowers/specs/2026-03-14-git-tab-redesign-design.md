# Git Tab Redesign — Project Detail View

**Date:** 2026-03-14
**Status:** Approved

## Problem

The Project Detail View's Git tab mixes local orchestrator tasks (OPS-*) with GitHub issues, creating confusion. Git operations, issue tracking, and PR management are tangled into one scrollable view.

## Solution

Replace the Git tab with a sub-tabbed view: **Commits | Issues | PRs**. Each sub-tab is a focused, full-height view. Local tasks stay exclusively in the Overview tab's Kanban board.

## Tab Structure

```
Project Detail View
├── Overview (Kanban board — local OPS-* tasks only)
├── Files (file tree + viewer)
└── Git
    ├── Commits (branch selector, operations, changes, history)
    ├── Issues (GitHub issues — full CRUD)
    └── PRs (GitHub pull requests — list, create, inline diff)
```

## Commits Sub-tab

### Layout
1. **Branch selector** — dropdown showing current branch, lists all local branches
2. **Operations bar** — Commit, Push, Pull buttons
3. **Uncommitted changes** — file status list with diff viewer
4. **Commit history** — log entries for selected branch

### New Backend
- `GET /api/v1/projects/{id}/git/branches` → `{ current: string, branches: string[] }`

### Frontend Changes
- Add branch dropdown above operations bar
- Pass selected branch to history fetch

## Issues Sub-tab

### Layout
1. **Filter pills** — Open | Closed | All
2. **Create button** — opens dialog (title, body, labels)
3. **Issue list** — rows with number, title, labels, state
4. **Expandable rows** — click to show full body, edit title/body, close/reopen
5. **Import to Board** — button creates local OPS-* task from GitHub issue

### New Backend
- `GET /api/v1/projects/{id}/github/issues?state=open|closed|all` — list with filter (update existing)
- `POST /api/v1/projects/{id}/github/issues` — create issue on GitHub
- `PATCH /api/v1/projects/{id}/github/issues/{number}` — update title/body/state

### Data Model
```typescript
type GitHubIssue = {
  number: number
  title: string
  body: string
  state: string // "open" | "closed"
  html_url: string
  labels: { name: string }[]
  created_at: string
  updated_at: string
  user: { login: string; avatar_url: string }
}
```

## PRs Sub-tab

### Layout
1. **PR list** — number, title, author, status, branch info
2. **Create PR** — dialog with head/base branch, title, body
3. **Inline diff** — clicking a PR expands to show the diff
4. **External link** — button to open PR on GitHub

### New Backend
- `GET /api/v1/projects/{id}/github/pulls` — list pull requests
- `GET /api/v1/projects/{id}/github/pulls/{number}/diff` — fetch PR diff
- `POST /api/v1/projects/{id}/github/pulls` — create PR (refactor existing route)

### Data Model
```typescript
type GitHubPR = {
  number: number
  title: string
  body: string
  state: string // "open" | "closed" | "merged"
  html_url: string
  head: { ref: string; label: string }
  base: { ref: string; label: string }
  user: { login: string; avatar_url: string }
  created_at: string
  merged_at: string | null
  diff_url: string
}
```

## Changes from Current Behavior

1. **Overview tab** — Kanban shows local tasks only (no GitHub issues)
2. **Main Tasks board** — no longer merges GitHub backlog issues
3. **GitHub issues** — live exclusively in Git > Issues sub-tab
4. **PR creation** — moves from issue inspector to Git > PRs sub-tab
5. **Branch context** — new branch selector drives commit history view

## API Summary

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/projects/{id}/git/branches` | List branches + current |
| GET | `/projects/{id}/github/issues?state=` | List issues with filter |
| POST | `/projects/{id}/github/issues` | Create issue |
| PATCH | `/projects/{id}/github/issues/{number}` | Update issue |
| GET | `/projects/{id}/github/pulls` | List PRs |
| POST | `/projects/{id}/github/pulls` | Create PR |
| GET | `/projects/{id}/github/pulls/{number}/diff` | Fetch PR diff |
