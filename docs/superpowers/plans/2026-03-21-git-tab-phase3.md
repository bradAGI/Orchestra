# Git Tab Phase 3: GitHub Repo Creation & Publish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable creating GitHub repositories from Orchestra and publishing local projects to GitHub — bridging the gap for projects that don't yet have a remote.

**Architecture:** Add `CreateRepository` to the backend GitHub utils, a new API endpoint, and a frontend dialog in the GitHubPanel. After repo creation, automatically set the remote origin and do an initial push.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, GitHub REST API, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/backend/internal/utils/github/github.go` | Modify | Add CreateRepository function |
| `apps/backend/internal/api/projects.go` | Modify | Add create-repo handler |
| `apps/backend/internal/api/router.go` | Modify | Register create-repo route |
| `apps/desktop/src/lib/orchestra-client.ts` | Modify | Add createGitHubRepo client function |
| `apps/desktop/src/widgets/git/CreateRepoDialog.tsx` | Create | Dialog for creating GitHub repo |
| `apps/desktop/src/widgets/git/CreateRepoDialog.test.tsx` | Create | Tests for dialog |
| `apps/desktop/src/widgets/git/GitHubPanel.tsx` | Modify | Add "Create Repository" button for unconnected projects |
| `apps/desktop/src/widgets/git/GitTab.tsx` | Modify | Pass github connection state, handle repo creation |

---

### Task 1: Backend — Add CreateRepository to GitHub Utils

**Files:**
- Modify: `apps/backend/internal/utils/github/github.go`

- [ ] **Step 1: Add CreateRepository function**

Add after the existing functions:

```go
type CreateRepoOptions struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Private     bool   `json:"private"`
}

type CreateRepoResult struct {
	FullName string `json:"full_name"`
	CloneURL string `json:"clone_url"`
	SSHURL   string `json:"ssh_url"`
	HTMLURL  string `json:"html_url"`
}

func CreateRepository(ctx context.Context, token string, opts CreateRepoOptions) (*CreateRepoResult, error) {
	body, err := json.Marshal(opts)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.github.com/user/repos", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github api %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		FullName string `json:"full_name"`
		CloneURL string `json:"clone_url"`
		SSHURL   string `json:"ssh_url"`
		HTMLURL  string `json:"html_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	return &CreateRepoResult{
		FullName: result.FullName,
		CloneURL: result.CloneURL,
		SSHURL:   result.SSHURL,
		HTMLURL:  result.HTMLURL,
	}, nil
}
```

- [ ] **Step 2: Add necessary imports**

Ensure `bytes` and `io` are imported.

- [ ] **Step 3: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/internal/utils/github/github.go
git commit -m "feat(backend): add CreateRepository function for GitHub API"
```

---

### Task 2: Backend — Add Create Repo Endpoint

**Files:**
- Modify: `apps/backend/internal/api/projects.go`
- Modify: `apps/backend/internal/api/router.go`

- [ ] **Step 1: Add the handler**

Add a new handler `PostCreateGitHubRepo`:

```go
func (s *Server) PostCreateGitHubRepo(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}

	// Get token — need decrypted token
	token := project.GitHubToken
	if token == "" {
		writeJSONError(w, http.StatusBadRequest, "no_token", "no GitHub token configured")
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Private     bool   `json:"private"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_body", "invalid request body")
		return
	}
	if req.Name == "" {
		writeJSONError(w, http.StatusBadRequest, "missing_name", "repository name is required")
		return
	}

	// Create the repo on GitHub
	result, err := ghutil.CreateRepository(r.Context(), token, ghutil.CreateRepoOptions{
		Name:        req.Name,
		Description: req.Description,
		Private:     req.Private,
	})
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "create_failed", err.Error())
		return
	}

	// Set remote origin on the local git repo
	setRemoteCmd := exec.CommandContext(r.Context(), "git", "remote", "add", "origin", result.CloneURL)
	setRemoteCmd.Dir = project.RootPath
	if out, err := setRemoteCmd.CombinedOutput(); err != nil {
		// If origin already exists, update it instead
		updateCmd := exec.CommandContext(r.Context(), "git", "remote", "set-url", "origin", result.CloneURL)
		updateCmd.Dir = project.RootPath
		if out2, err2 := updateCmd.CombinedOutput(); err2 != nil {
			s.logger.Warn().Str("output", string(out)).Str("output2", string(out2)).Msg("failed to set remote")
		}
	}

	// Update project record with GitHub info
	owner, repo, _ := git.ParseGitHubRemote(result.CloneURL)
	s.db.UpdateProjectGitHub(r.Context(), projectID, owner, repo, result.CloneURL)

	// Do initial push
	pushCmd := exec.CommandContext(r.Context(), "git", "push", "-u", "origin", "HEAD")
	pushCmd.Dir = project.RootPath
	if out, err := pushCmd.CombinedOutput(); err != nil {
		s.logger.Warn().Str("output", string(out)).Msg("initial push failed")
		// Don't fail — repo was created successfully, push can be retried
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"full_name": result.FullName,
		"html_url":  result.HTMLURL,
		"clone_url": result.CloneURL,
		"owner":     owner,
		"repo":      repo,
	})
}
```

Note: Check how the existing handlers access the decrypted GitHub token — the `project` returned from `GetProjectByID` should already have it decrypted. Read the code to verify.

- [ ] **Step 2: Check if UpdateProjectGitHub exists in the DB layer**

Search for `UpdateProjectGitHub` in the db package. If it doesn't exist, you'll need to add a method that updates `github_owner`, `github_repo`, and `remote_url` on the project record. Also look at how the existing GitHub callback handler saves these fields — follow the same pattern.

- [ ] **Step 3: Register route**

```go
protected.Post("/api/v1/projects/{project_id}/github/create-repo", server.PostCreateGitHubRepo)
```

- [ ] **Step 4: Build and verify**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/
git commit -m "feat(backend): add create GitHub repo endpoint with auto-push"
```

---

### Task 3: Frontend — Add API Client Function

**Files:**
- Modify: `apps/desktop/src/lib/orchestra-client.ts`

- [ ] **Step 1: Add createGitHubRepo function**

```typescript
export type CreateRepoOptions = {
  name: string
  description?: string
  private: boolean
}

export type CreateRepoResult = {
  full_name: string
  html_url: string
  clone_url: string
  owner: string
  repo: string
}

export async function createGitHubRepo(
  config: BackendConfig,
  projectId: string,
  opts: CreateRepoOptions
): Promise<CreateRepoResult> {
  return requestJSON<CreateRepoResult>(config, `/api/v1/projects/${encodeURIComponent(projectId)}/github/create-repo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/lib/orchestra-client.ts
git commit -m "feat(desktop): add createGitHubRepo client function"
```

---

### Task 4: Create CreateRepoDialog Component

**Files:**
- Create: `apps/desktop/src/widgets/git/CreateRepoDialog.tsx`
- Create: `apps/desktop/src/widgets/git/CreateRepoDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Tests to cover:
1. Renders repo name input
2. Renders visibility toggle (public/private, default private)
3. Renders description textarea
4. Disables Create button when name is empty
5. Enables Create button when name provided
6. Calls onCreate with options when submitted
7. Shows loading state during creation
8. Calls onCancel when Cancel clicked

**IMPORTANT:** No `@testing-library/jest-dom`. Use `toBeTruthy()`, `.disabled`, `.textContent`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/desktop && npx vitest run src/widgets/git/CreateRepoDialog.test.tsx
```

- [ ] **Step 3: Write the implementation**

A modal/overlay dialog with:

**Props:**
```typescript
interface CreateRepoDialogProps {
  projectName: string
  onCancel: () => void
  onCreate: (opts: { name: string; description: string; private: boolean }) => Promise<void>
}
```

**UI:**
- Overlay backdrop (semi-transparent)
- Dialog card centered on screen
- Title: "Create GitHub Repository"
- Name input (pre-filled with project name, sanitized to lowercase kebab)
- Description textarea (optional)
- Visibility toggle: Private (default) / Public — two buttons, one selected
- Cancel button + Create button
- Loading state: Create button shows spinner, inputs disabled
- Error state: red text below form if creation fails

**Styling:** Match existing dialog patterns in the codebase (check CreateTaskDialog for reference).

- [ ] **Step 4: Run tests**

```bash
cd apps/desktop && npx vitest run src/widgets/git/CreateRepoDialog.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/widgets/git/CreateRepoDialog.tsx apps/desktop/src/widgets/git/CreateRepoDialog.test.tsx
git commit -m "feat(desktop): add CreateRepoDialog component"
```

---

### Task 5: Integrate into GitTab and GitHubPanel

**Files:**
- Modify: `apps/desktop/src/widgets/git/GitTab.tsx`
- Modify: `apps/desktop/src/widgets/git/GitHubPanel.tsx`
- Modify: `apps/desktop/src/widgets/git/index.ts`

- [ ] **Step 1: Add "Create Repository" to the GitHub sub-tab**

In GitTab.tsx, when `activeSubTab === 'github'` and the project does NOT have `github_owner`/`github_repo`, show a prompt instead of the GitHubPanel:

```tsx
{activeSubTab === 'github' && (
  project.github_owner && project.github_repo ? (
    <div className="flex-1 overflow-auto">
      <GitHubPanel ... />
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground text-sm">No GitHub repository connected</p>
        {project.github_token ? (
          <button onClick={() => setShowCreateRepo(true)} className="...">
            Create GitHub Repository
          </button>
        ) : (
          <p className="text-[11px] text-muted-foreground/50">Connect GitHub first to create a repository</p>
        )}
      </div>
    </div>
  )
)}
```

- [ ] **Step 2: Add CreateRepoDialog state and handler**

```typescript
const [showCreateRepo, setShowCreateRepo] = useState(false)

const handleCreateRepo = useCallback(async (opts: { name: string; description: string; private: boolean }) => {
  if (!config) return
  await createGitHubRepo(config, project.id, opts)
  setShowCreateRepo(false)
  loadAll() // Refresh to pick up new github_owner/repo
}, [config, project.id, loadAll])
```

Render the dialog when `showCreateRepo` is true:
```tsx
{showCreateRepo && (
  <CreateRepoDialog
    projectName={project.name}
    onCancel={() => setShowCreateRepo(false)}
    onCreate={handleCreateRepo}
  />
)}
```

- [ ] **Step 3: Show GitHub sub-tab even without github_owner**

Currently the GitHub sub-tab is only shown when `project.github_owner && project.github_repo`. Update the subTabs array to always include GitHub (so users can see the "Create Repository" prompt):

```typescript
const subTabs: { key: SubTab; label: string }[] = [
  { key: 'changes', label: 'Changes' },
  { key: 'history', label: 'History' },
  { key: 'github', label: 'GitHub' },
]
```

- [ ] **Step 4: Update exports**

Add to `apps/desktop/src/widgets/git/index.ts`:
```typescript
export { CreateRepoDialog } from './CreateRepoDialog'
```

- [ ] **Step 5: Run full test suite**

```bash
cd apps/desktop && npx vitest run
```

- [ ] **Step 6: Build backend**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/widgets/git/
git commit -m "feat(desktop): integrate GitHub repo creation into Git tab"
```
