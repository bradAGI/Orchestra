# GitHub Integration & Project UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix GitHub API error handling, add pagination, replace hardcoded PR base branch, add instant OAuth feedback via SSE, and add GitHub connection status badges to the project list.

**Architecture:** Backend fixes in `utils/github/github.go` (error messages, pagination, rate limits, struct fields). API layer changes in `projects.go` and `github_auth.go` (pagination passthrough, SSE events, default branch endpoint). Frontend changes across `GitHubPanel.tsx`, `ProjectGrid.tsx`, `ProjectDetailView.tsx`, `useIssueDetailPR.ts`, `orchestra-client.ts`, and `runtime-sync.ts`.

**Tech Stack:** Go 1.25, React 19, TypeScript, chi router, SSE via PubSub

**Spec:** `docs/specs/2026-03-21-github-integration-design.md`

---

### Task 1: Fix GitHub API error messages and add rate limit handling

**Files:**
- Modify: `apps/backend/internal/utils/github/github.go`

- [ ] **Step 1: Add `io` import if missing**

Check imports at top of file. Add `"io"` if not present (it's already used by `PostIssueComment` and `MergePR`).

- [ ] **Step 2: Fix all 8 error handling sites**

Replace each `return ..., fmt.Errorf("github api returned status %d", resp.StatusCode)` with:

```go
respBody, _ := io.ReadAll(resp.Body)
if resp.StatusCode == http.StatusTooManyRequests {
    retryAfter := resp.Header.Get("Retry-After")
    if retryAfter == "" {
        retryAfter = "60"
    }
    return ..., fmt.Errorf("GitHub rate limit exceeded. Try again in %s seconds.", retryAfter)
}
return ..., fmt.Errorf("github api returned status %d: %s", resp.StatusCode, string(respBody))
```

Apply to these functions (return type varies — use `nil` for pointer/slice returns, `""` for string):
- `ListIssues` (line 106) — returns `nil, err`
- `ListPullRequests` (line 142) — returns `nil, err`
- `GetPullRequestDiff` (line 172) — returns `"", err`
- `CreateIssue` (line 208) — returns `nil, err`
- `UpdateIssue` (line 244) — returns `nil, err`
- `ListPRReviews` (line 317) — returns `nil, err`
- `ListPRComments` (line 412) — returns `nil, err`
- `CreatePullRequest` (line 448) — returns `nil, err`

- [ ] **Step 3: Add 401 detection for token expiry**

In the same error block, before the generic error return, add:

```go
if resp.StatusCode == http.StatusUnauthorized {
    return ..., fmt.Errorf("GitHub authentication failed (401). Reconnect GitHub in project settings. Details: %s", string(respBody))
}
```

- [ ] **Step 4: Verify build**

Run: `cd apps/backend && go build ./...`

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/utils/github/github.go
git commit -m "fix: include response body in GitHub API errors, add 429/401 handling"
```

---

### Task 2: Add struct fields (Draft, Assignees, Labels)

**Files:**
- Modify: `apps/backend/internal/utils/github/github.go`

- [ ] **Step 1: Add Draft to PullRequest struct (after line 66)**

```go
Draft     bool    `json:"draft"`
```

- [ ] **Step 2: Add Assignees and Labels to UpdateIssueRequest (after line 81)**

```go
Assignees []string `json:"assignees,omitempty"`
Labels    []string `json:"labels,omitempty"`
```

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && go build ./...`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/utils/github/github.go
git commit -m "feat: add Draft to PullRequest, Assignees/Labels to UpdateIssueRequest"
```

---

### Task 3: Add pagination to ListIssues and ListPullRequests

**Files:**
- Modify: `apps/backend/internal/utils/github/github.go`
- Modify: `apps/backend/internal/api/projects.go`

- [ ] **Step 1: Add page parameter to ListIssues**

Change signature from:
```go
func ListIssues(ctx context.Context, owner, repo, token, state string) ([]Issue, error) {
```
to:
```go
func ListIssues(ctx context.Context, owner, repo, token, state string, page int) ([]Issue, error) {
```

Update the URL (line ~89):
```go
if page < 1 {
    page = 1
}
url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues?state=%s&per_page=50&page=%d", owner, repo, state, page)
```

- [ ] **Step 2: Add page parameter to ListPullRequests**

Change signature from:
```go
func ListPullRequests(ctx context.Context, owner, repo, token string) ([]PullRequest, error) {
```
to:
```go
func ListPullRequests(ctx context.Context, owner, repo, token string, page int) ([]PullRequest, error) {
```

Update the URL (line ~125):
```go
if page < 1 {
    page = 1
}
url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls?state=all&per_page=30&page=%d", owner, repo, page)
```

- [ ] **Step 3: Update callers in projects.go**

In `GetProjectGitHubIssues` (line ~670), parse page from query and pass through:
```go
page := 1
if p := r.URL.Query().Get("page"); p != "" {
    if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
        page = parsed
    }
}
issues, err := ghutil.ListIssues(r.Context(), project.GitHubOwner, project.GitHubRepo, project.GitHubToken, state, page)
```

Return with `has_more`:
```go
writeJSON(w, http.StatusOK, map[string]any{"issues": issues, "has_more": len(issues) == 50})
```

In `GetProjectGitHubPulls` (line ~810), same pattern:
```go
page := 1
if p := r.URL.Query().Get("page"); p != "" {
    if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
        page = parsed
    }
}
prs, err := ghutil.ListPullRequests(r.Context(), project.GitHubOwner, project.GitHubRepo, project.GitHubToken, page)
```

Return:
```go
writeJSON(w, http.StatusOK, map[string]any{"pulls": prs, "has_more": len(prs) == 30})
```

- [ ] **Step 4: Fix any other callers of ListIssues/ListPullRequests**

Search the codebase for other callers and add `page` param (likely `tracker/github/client.go`). Pass `1` for default page.

- [ ] **Step 5: Verify build and tests**

Run: `cd apps/backend && go build ./... && go test ./internal/api/ -count=1`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/internal/utils/github/github.go apps/backend/internal/api/projects.go apps/backend/internal/tracker/github/client.go
git commit -m "feat: add pagination to GitHub issue and PR list endpoints"
```

---

### Task 4: Add default branch endpoint

**Files:**
- Modify: `apps/backend/internal/api/projects.go`
- Modify: `apps/backend/internal/api/router.go`

- [ ] **Step 1: Add GetDefaultBranch handler to projects.go**

```go
func (s *Server) GetDefaultBranch(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	branch := gitutil.DefaultBranch(r.Context(), project.RootPath)
	writeJSON(w, http.StatusOK, map[string]string{"branch": branch})
}
```

- [ ] **Step 2: Register route in router.go**

Find the git operations block (around line 130-140) and add:
```go
protected.Get("/api/v1/projects/{project_id}/git/default-branch", server.GetDefaultBranch)
```

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && go build ./...`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/api/projects.go apps/backend/internal/api/router.go
git commit -m "feat: add GET /api/v1/projects/{id}/git/default-branch endpoint"
```

---

### Task 5: Publish SSE events for GitHub connect/disconnect

**Files:**
- Modify: `apps/backend/internal/api/github_auth.go`

- [ ] **Step 1: Add PubSub import**

Add `"github.com/orchestra/orchestra/apps/backend/internal/observability"` to imports if not present.

- [ ] **Step 2: Publish github_connected after CLI token detection**

In `HandleGitHubLogin`, after `s.updateProjectGitHubToken(...)` succeeds (around line 41), add:

```go
if s.pubsub != nil {
    s.pubsub.Publish(observability.Event{
        Type: "GITHUB_CONNECTED",
        Data: map[string]any{"project_id": projectID},
    })
}
```

- [ ] **Step 3: Publish github_connected after OAuth callback**

In `HandleGitHubCallback`, after `s.updateProjectGitHubToken(...)` succeeds (around line 95), add the same publish block with `state` as the project ID.

- [ ] **Step 4: Publish github_disconnected in HandleGitHubDisconnect**

After the successful DB update (around line 135), add:

```go
if s.pubsub != nil {
    s.pubsub.Publish(observability.Event{
        Type: "GITHUB_DISCONNECTED",
        Data: map[string]any{"project_id": projectID},
    })
}
```

- [ ] **Step 5: Verify build**

Run: `cd apps/backend && go build ./...`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/internal/api/github_auth.go
git commit -m "feat: publish SSE events on GitHub connect/disconnect"
```

---

### Task 6: Fix token decryption fallback

**Files:**
- Modify: `apps/backend/internal/db/projects.go`

- [ ] **Step 1: Find DecryptToken fallback in GetProjects (line ~240)**

Change from:
```go
if dec, err := DecryptToken(p.GitHubToken); err == nil {
    p.GitHubToken = dec
}
```

To:
```go
if p.GitHubToken != "" {
    if dec, err := DecryptToken(p.GitHubToken); err == nil {
        p.GitHubToken = dec
    } else {
        log.Printf("WARN: failed to decrypt github token for project %s: %v", p.ID, err)
        p.GitHubToken = ""
    }
}
```

- [ ] **Step 2: Apply same fix to GetProjectByID (line ~373)**

Same pattern — log warning, clear token on decryption failure.

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && go build ./...`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/db/projects.go
git commit -m "fix: log warning and clear token on decryption failure instead of silent fallback"
```

---

### Task 7: Update orchestra-client.ts with pagination and default branch

**Files:**
- Modify: `apps/desktop/src/lib/orchestra-client.ts`

- [ ] **Step 1: Update fetchProjectGitHubIssues to accept page**

```typescript
export async function fetchProjectGitHubIssues(
  config: BackendConfig, projectId: string, state: string = 'open', page: number = 1
): Promise<{ issues: GitHubIssue[]; has_more: boolean }> {
  return requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/issues?state=${state}&page=${page}`)
}
```

- [ ] **Step 2: Update fetchProjectGitHubPulls to accept page**

```typescript
export async function fetchProjectGitHubPulls(
  config: BackendConfig, projectId: string, page: number = 1
): Promise<{ pulls: GitHubPR[]; has_more: boolean }> {
  return requestJSON(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/pulls?page=${page}`)
}
```

- [ ] **Step 3: Add fetchDefaultBranch**

```typescript
export async function fetchDefaultBranch(
  config: BackendConfig, projectId: string
): Promise<string> {
  const result = await requestJSON<{ branch: string }>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/git/default-branch`)
  return result.branch
}
```

- [ ] **Step 4: Fix all callers of the updated functions**

The return type changed from `GitHubIssue[]` to `{ issues: GitHubIssue[]; has_more: boolean }`. Find all callers and update them to destructure `.issues` from the response. Key callers:
- `GitHubPanel.tsx` loadData function
- `ProjectDetailView.tsx` GitHub issues fetch

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/lib/orchestra-client.ts
git commit -m "feat: add pagination and default branch to orchestra client"
```

---

### Task 8: Add Load More to GitHubPanel

**Files:**
- Modify: `apps/desktop/src/widgets/git/GitHubPanel.tsx`

- [ ] **Step 1: Add pagination state**

```typescript
const [issuePage, setIssuePage] = useState(1)
const [issueHasMore, setIssueHasMore] = useState(false)
const [prPage, setPrPage] = useState(1)
const [prHasMore, setPrHasMore] = useState(false)
```

- [ ] **Step 2: Update loadData to use pagination response**

```typescript
const loadData = useCallback(async () => {
    try {
        const [issueResult, prResult, branchData] = await Promise.all([
            fetchProjectGitHubIssues(config, projectId, issueFilter, 1),
            fetchProjectGitHubPulls(config, projectId, 1),
            fetchProjectGitBranches(config, projectId),
        ])
        setIssues(issueResult.issues)
        setIssueHasMore(issueResult.has_more)
        setIssuePage(1)
        setPRs(prResult.pulls)
        setPrHasMore(prResult.has_more)
        setPrPage(1)
        setBranches(branchData.branches || [])
    } catch (err) {
        console.error('github load failed', err)
    }
}, [config, projectId, issueFilter])
```

- [ ] **Step 3: Add loadMoreIssues and loadMorePRs handlers**

```typescript
const loadMoreIssues = async () => {
    const nextPage = issuePage + 1
    const result = await fetchProjectGitHubIssues(config, projectId, issueFilter, nextPage)
    setIssues(prev => [...prev, ...result.issues])
    setIssueHasMore(result.has_more)
    setIssuePage(nextPage)
}

const loadMorePRs = async () => {
    const nextPage = prPage + 1
    const result = await fetchProjectGitHubPulls(config, projectId, nextPage)
    setPRs(prev => [...prev, ...result.pulls])
    setPrHasMore(result.has_more)
    setPrPage(nextPage)
}
```

- [ ] **Step 4: Add Load More buttons in render**

After the issues list, add:
```tsx
{issueHasMore && (
    <button onClick={loadMoreIssues} className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        Load more issues...
    </button>
)}
```

Same pattern after PRs list with `prHasMore` and `loadMorePRs`.

- [ ] **Step 5: Add friendly error display with collapsible details**

Wrap API calls in try/catch. On error, show a two-tier message:

```tsx
const [error, setError] = useState<{ message: string; details?: string } | null>(null)

// In catch blocks:
const msg = err instanceof Error ? err.message : String(err)
const friendly = msg.includes('401') ? 'GitHub authentication failed. Reconnect in project settings.'
    : msg.includes('429') ? 'GitHub rate limit exceeded. Please wait and try again.'
    : msg.includes('502') ? 'GitHub is temporarily unavailable.'
    : 'Failed to load GitHub data.'
setError({ message: friendly, details: msg })
```

Render:
```tsx
{error && (
    <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-xs">
        <p className="text-red-400">{error.message}</p>
        <details className="mt-1">
            <summary className="text-red-400/60 cursor-pointer">Details</summary>
            <pre className="mt-1 text-red-400/40 whitespace-pre-wrap">{error.details}</pre>
        </details>
    </div>
)}
```

- [ ] **Step 6: Verify typecheck and tests**

Run: `cd apps/desktop && npx tsc --noEmit && npx vitest run`

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/widgets/git/GitHubPanel.tsx
git commit -m "feat: add Load More pagination and friendly error display to GitHubPanel"
```

---

### Task 9: Replace hardcoded PR base branch

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/useIssueDetailPR.ts`
- Modify: `apps/desktop/src/widgets/git/GitHubPanel.tsx`

- [ ] **Step 1: Update useIssueDetailPR to fetch default branch**

Add state for default branch and fetch it when dialog opens:

```typescript
const [defaultBranch, setDefaultBranch] = useState('main')

useEffect(() => {
    if (prDialogOpen && config && projectId) {
        fetchDefaultBranch(config, projectId)
            .then(setDefaultBranch)
            .catch(() => setDefaultBranch('main'))
    }
}, [prDialogOpen, config, projectId])
```

Replace `base: 'main'` (line 38) with `base: defaultBranch`.

Note: the hook needs access to `projectId`. Check if it's already available via the issue data or needs to be passed as a parameter.

- [ ] **Step 2: Update GitHubPanel PR creation**

In the PR creation form, replace the hardcoded base field with a dropdown pre-filled with the default branch. The `branches` state already exists from the `fetchProjectGitBranches` call.

```tsx
<select value={newPRBase} onChange={e => setNewPRBase(e.target.value)} className="...">
    {branches.map(b => <option key={b} value={b}>{b}</option>)}
</select>
```

Initialize `newPRBase` from `fetchDefaultBranch` instead of hardcoding.

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/useIssueDetailPR.ts apps/desktop/src/widgets/git/GitHubPanel.tsx
git commit -m "fix: auto-detect PR base branch instead of hardcoding 'main'"
```

---

### Task 10: Add GitHub connection badges to ProjectGrid

**Files:**
- Modify: `apps/desktop/src/components/projects/ProjectGrid.tsx`

- [ ] **Step 1: Add badge to project row**

In the project card render (around line 230), after the project name, add:

```tsx
{project.github_token ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-500 border border-green-500/20">
        GitHub Connected
    </span>
) : project.github_owner ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
        GitHub Detected
    </span>
) : null}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/projects/ProjectGrid.tsx
git commit -m "feat: add GitHub connection status badges to project list"
```

---

### Task 11: Add SSE handlers and disconnect confirmation

**Files:**
- Modify: `apps/desktop/src/lib/runtime-sync.ts`
- Modify: `apps/desktop/src/components/projects/ProjectDetailView.tsx`

- [ ] **Step 1: Add SSE event handlers in runtime-sync.ts**

In the `attachStream` function, after the lifecycle event loop (around line 183), add dedicated handlers:

```typescript
stream.addEventListener('GITHUB_CONNECTED', () => {
    onProjectRefresh?.()
})
stream.addEventListener('GITHUB_DISCONNECTED', () => {
    onProjectRefresh?.()
})
```

This requires `onProjectRefresh` to be passed into `attachStream` or accessible as a callback. Check how the function is called and add the callback parameter if needed. The callback should trigger a project list refresh.

- [ ] **Step 2: Remove polling timer from ProjectDetailView**

Remove the `scheduleProjectRefreshAfterGitHubAuth` function (lines 192-200) and all references to it. The SSE events now handle instant refresh.

Clean up `refreshTimersRef` if it's only used for this polling.

- [ ] **Step 3: Add disconnect confirmation dialog**

In `handleDisconnectGitHub`, add a confirmation before proceeding:

```typescript
const handleDisconnectGitHub = async () => {
    if (!window.confirm(`Disconnect GitHub from ${project.github_owner}/${project.github_repo}?`)) return
    setGithubDisconnectPending(true)
    try {
        await disconnectProjectGitHub(config, project.id)
    } catch (err) {
        console.error('disconnect failed', err)
    } finally {
        setGithubDisconnectPending(false)
    }
}
```

Remove the manual `onRefreshProjects()` call after disconnect — the SSE event handles it now.

- [ ] **Step 4: Verify typecheck and tests**

Run: `cd apps/desktop && npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/runtime-sync.ts apps/desktop/src/components/projects/ProjectDetailView.tsx
git commit -m "feat: instant GitHub connect/disconnect via SSE, add disconnect confirmation"
```

---

### Task 12: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd apps/backend && go test -race ./...`
Expected: all tests pass

- [ ] **Step 2: Build backend binary**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`
Expected: compiles clean

- [ ] **Step 3: Run desktop typecheck and tests**

Run: `cd apps/desktop && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass

- [ ] **Step 4: Verify no regressions**

No commit needed — verification only.
