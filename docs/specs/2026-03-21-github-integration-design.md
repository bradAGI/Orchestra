# GitHub Integration Fixes and Project Connection UX

**Date:** 2026-03-21
**Issue:** [#62](https://github.com/Traves-Theberge/Orchestra/issues/62)
**Status:** Design

## Problem

The GitHub integration has 11 defects across error handling, token lifecycle, pagination, and missing struct fields. The project-to-GitHub connection UX lacks status visibility, instant feedback, and proper disconnect behavior.

## Solution

Fix all backend error handling in the GitHub API client. Add pagination with "Load more" for issues and PRs. Replace hardcoded PR base branch with auto-detection and user override. Add instant OAuth feedback via SSE events. Add GitHub connection status badges to the project list. Fix token decryption fallback.

## Design

### Backend Error Handling

All 8 functions in `utils/github/github.go` that return `"github api returned status %d"` will read the response body and include it:

```go
body, _ := io.ReadAll(resp.Body)
return nil, fmt.Errorf("github api returned status %d: %s", resp.StatusCode, string(body))
```

Affected: `ListIssues`, `ListPullRequests`, `GetPullRequestDiff`, `CreateIssue`, `UpdateIssue`, `ListPRReviews`, `ListPRComments`, `CreatePullRequest`.

The frontend displays errors in two tiers: a friendly message mapped from the HTTP status code as the primary text, with the raw GitHub error in a collapsible "Details" section. Unmapped errors show the raw message directly.

Rate limit handling: detect HTTP 429, read `Retry-After` header, return `"GitHub rate limit exceeded. Try again in {N} seconds."` instead of a generic failure.

### Pagination with Load More

`ListIssues` and `ListPullRequests` gain a `page` parameter. Defaults: `per_page=50` (issues), `per_page=30` (PRs), page 1.

API endpoints accept an optional `page` query param. Response includes `has_more` boolean (true when result count equals `per_page`):

```json
{
  "issues": [...],
  "has_more": true
}
```

Frontend `GitHubPanel.tsx` shows a "Load more" button at the bottom when `has_more` is true. Clicking fetches page+1 and appends to existing list.

### Disconnect Flow and Connection Status

**Disconnect** clears `github_token` only — keeps `github_owner`/`github_repo` metadata (auto-detected from git remote, harmless to keep, makes reconnection smoother). Adds:
- Confirmation dialog before disconnecting
- `github_disconnected` SSE event for instant UI update

**Connection status badge** in project list — three states:
- Green "GitHub Connected" — token present
- Amber "GitHub Detected" — owner/repo detected from remote, no token
- No badge — not a GitHub repo

**ProjectDetailView** shows the same badge plus action buttons:
- Connected: "Disconnect" button
- Detected: "Connect GitHub" button
- Neither: no GitHub section

### PR Creation with Auto-Detected Base Branch

New endpoint: `GET /api/v1/projects/{project_id}/git/default-branch` returns `{"branch": "main"}` using existing `git.DefaultBranch()`.

Frontend PR dialogs (`useIssueDetailPR.ts`, `GitHubPanel.tsx`):
- Fetch default branch on dialog open, pre-fill base field
- Show dropdown of available branches for override
- Remove hardcoded `base: 'main'`

### Instant OAuth Feedback via SSE

After storing the token in `github_auth.go` (both CLI auto-detect and browser OAuth paths), publish `github_connected` event on PubSub with the project ID.

Frontend SSE handler triggers project list refresh on `github_connected`. Remove the polling timer (2s/4s/7s/11s) from `handleConnectGitHub`.

Disconnect publishes `github_disconnected` after clearing the token.

### Token Decryption Fallback

In `db/projects.go`, when `DecryptToken()` fails: log a warning and set the token field to empty string. The UI shows "Detected but not connected" state, prompting reconnection. No more encrypted garbage passed to GitHub API calls.

### Additional Struct Fields

Additive changes that don't affect existing behavior:
- Add `Draft bool` to `PullRequest` struct — enables future draft PR indication
- Add `Assignees []string` and `Labels []string` to `UpdateIssueRequest` — enables future issue management

### Out of Scope

- Token refresh mechanism — GitHub CLI tokens are long-lived, OAuth app tokens don't expire (only revocation)
- Stubbed tracker methods (`SearchIssues`, `CreateIssue` in `tracker/github/client.go`) — not called by current UI
- Merge conflict detection before PR merge
- Submodule support in worktrees

## Files Changed

| File | Change |
|------|--------|
| `apps/backend/internal/utils/github/github.go` | Read response body in 8 error paths. Add `page` param to list functions. Add 429 handling. Add `Draft` to `PullRequest`, `Assignees`/`Labels` to `UpdateIssueRequest`. |
| `apps/backend/internal/api/projects.go` | Pass `page` query param to GitHub list functions. Return `has_more`. Add `GetDefaultBranch` endpoint. |
| `apps/backend/internal/api/router.go` | Register `GET /api/v1/projects/{project_id}/git/default-branch`. |
| `apps/backend/internal/api/github_auth.go` | Publish `github_connected` SSE event after token storage (CLI and OAuth paths). |
| `apps/backend/internal/api/state.go` | Publish `github_disconnected` SSE event in disconnect handler. |
| `apps/backend/internal/db/projects.go` | Log warning and clear token on decryption failure. |
| `apps/desktop/src/widgets/git/GitHubPanel.tsx` | "Load more" for issues/PRs. Friendly errors with collapsible details. PR branch dropdown. |
| `apps/desktop/src/widgets/issue-detail/useIssueDetailPR.ts` | Fetch default branch, replace hardcoded `base: 'main'`. |
| `apps/desktop/src/components/projects/ProjectGrid.tsx` | GitHub connection status badge. |
| `apps/desktop/src/components/projects/ProjectDetailView.tsx` | Update badge states, disconnect confirmation, remove polling timer. |
| `apps/desktop/src/lib/orchestra-client.ts` | Add `fetchDefaultBranch`, update list functions with `page` param. |
| `apps/desktop/src/lib/runtime-sync.ts` | Handle `github_connected`/`github_disconnected` SSE events. |

**No changes:**
- `apps/backend/internal/tracker/github/client.go` — stubbed methods stay
- `apps/backend/internal/db/schema.go` — no schema changes
- `apps/backend/internal/workspace/` — unrelated
