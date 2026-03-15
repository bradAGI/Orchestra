# Git Backend API — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend endpoints for branch management, selective staging, stash, PR reviews, PR merge, and CI status to support the full Git UI overhaul.

**Architecture:** Extend the existing `utils/git/git.go` with new git operations (checkout, stash, stage/unstage), add new GitHub API functions to `utils/github/github.go` (reviews, merge, comments), wire new handlers in `api/projects.go`, and register routes in `api/router.go`.

**Tech Stack:** Go, chi router, GitHub REST API v3, os/exec for git CLI

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `internal/utils/git/git.go` | Modify | Add Checkout, Stash, StashPop, Stage, Unstage, DeleteBranch functions |
| `internal/utils/github/github.go` | Modify | Add ListReviews, SubmitReview, MergePR, ListComments, PostComment functions |
| `internal/api/projects.go` | Modify | Add 9 new handlers for git/github endpoints |
| `internal/api/router.go` | Modify | Register 9 new routes |

---

### Task 1: Git utility functions — branch, checkout, stash, stage

**Files:**
- Modify: `apps/backend/internal/utils/git/git.go`

- [ ] **Step 1: Add Checkout function**

```go
func Checkout(ctx context.Context, dir, branch string) error {
	cmd := exec.CommandContext(ctx, "git", "checkout", branch)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git checkout failed: %v - %s", err, stderr.String())
	}
	return nil
}
```

- [ ] **Step 2: Add DeleteBranch function**

```go
func DeleteBranch(ctx context.Context, dir, name string) error {
	cmd := exec.CommandContext(ctx, "git", "branch", "-d", name)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git branch delete failed: %v - %s", err, stderr.String())
	}
	return nil
}
```

- [ ] **Step 3: Add Stage and Unstage functions**

```go
func Stage(ctx context.Context, dir string, files []string) error {
	args := append([]string{"add"}, files...)
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git add failed: %v - %s", err, stderr.String())
	}
	return nil
}

func Unstage(ctx context.Context, dir string, files []string) error {
	args := append([]string{"reset", "HEAD", "--"}, files...)
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git reset failed: %v - %s", err, stderr.String())
	}
	return nil
}
```

- [ ] **Step 4: Add Stash and StashPop functions**

```go
func Stash(ctx context.Context, dir string) error {
	cmd := exec.CommandContext(ctx, "git", "stash")
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git stash failed: %v - %s", err, stderr.String())
	}
	return nil
}

func StashPop(ctx context.Context, dir string) error {
	cmd := exec.CommandContext(ctx, "git", "stash", "pop")
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git stash pop failed: %v - %s", err, stderr.String())
	}
	return nil
}
```

- [ ] **Step 5: Build and verify**

Run: `cd apps/backend && go build ./internal/utils/git/`
Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add apps/backend/internal/utils/git/git.go
git commit -m "feat(backend): add git checkout, stage, unstage, stash, delete-branch functions"
```

---

### Task 2: GitHub utility functions — reviews, merge, comments

**Files:**
- Modify: `apps/backend/internal/utils/github/github.go`

- [ ] **Step 1: Add ListPRReviews function**

```go
func ListPRReviews(ctx context.Context, owner, repo, token string, prNumber int) ([]map[string]any, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/reviews", owner, repo, prNumber)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var reviews []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&reviews); err != nil {
		return nil, err
	}
	return reviews, nil
}
```

- [ ] **Step 2: Add SubmitPRReview function**

```go
type ReviewRequest struct {
	Body  string `json:"body"`
	Event string `json:"event"` // APPROVE, REQUEST_CHANGES, COMMENT
}

func SubmitPRReview(ctx context.Context, owner, repo, token string, prNumber int, review ReviewRequest) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/reviews", owner, repo, prNumber)
	body, err := json.Marshal(review)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github review api returned status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}
```

- [ ] **Step 3: Add MergePR function**

```go
type MergeRequest struct {
	MergeMethod string `json:"merge_method"` // merge, squash, rebase
}

func MergePR(ctx context.Context, owner, repo, token string, prNumber int, method string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/merge", owner, repo, prNumber)
	body, _ := json.Marshal(MergeRequest{MergeMethod: method})
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github merge api returned status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}
```

- [ ] **Step 4: Add ListPRComments function**

```go
func ListPRComments(ctx context.Context, owner, repo, token string, prNumber int) ([]map[string]any, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/comments", owner, repo, prNumber)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var comments []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&comments); err != nil {
		return nil, err
	}
	return comments, nil
}
```

- [ ] **Step 5: Build and verify**

Run: `cd apps/backend && go build ./internal/utils/github/`
Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add apps/backend/internal/utils/github/github.go
git commit -m "feat(backend): add GitHub PR reviews, merge, and comments API functions"
```

---

### Task 3: API handlers — git operations

**Files:**
- Modify: `apps/backend/internal/api/projects.go`

- [ ] **Step 1: Add PostGitCheckout handler**

```go
func (s *Server) PostGitCheckout(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	if err := workspace.ValidateProjectPath(project.RootPath, s.config.ProjectRoots); err != nil {
		writeJSONError(w, http.StatusForbidden, "unauthorized_project_path", "unauthorized project path")
		return
	}
	var req struct {
		Branch string `json:"branch"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Branch == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "branch is required")
		return
	}
	if err := git.Checkout(r.Context(), project.RootPath, req.Branch); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "git_checkout_failed", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "branch": req.Branch})
}
```

- [ ] **Step 2: Add PostGitCreateBranch handler**

```go
func (s *Server) PostGitCreateBranch(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	if err := workspace.ValidateProjectPath(project.RootPath, s.config.ProjectRoots); err != nil {
		writeJSONError(w, http.StatusForbidden, "unauthorized_project_path", "unauthorized project path")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "name is required")
		return
	}
	if err := git.CreateBranch(r.Context(), project.RootPath, req.Name); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "git_branch_failed", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "branch": req.Name})
}
```

- [ ] **Step 3: Add DeleteGitBranch handler**

```go
func (s *Server) DeleteGitBranch(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	branchName := chi.URLParam(r, "branch")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	if err := workspace.ValidateProjectPath(project.RootPath, s.config.ProjectRoots); err != nil {
		writeJSONError(w, http.StatusForbidden, "unauthorized_project_path", "unauthorized project path")
		return
	}
	if err := git.DeleteBranch(r.Context(), project.RootPath, branchName); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "git_delete_branch_failed", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 4: Add PostGitStage, PostGitUnstage, PostGitStash, PostGitStashPop handlers**

```go
func (s *Server) PostGitStage(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	if err := workspace.ValidateProjectPath(project.RootPath, s.config.ProjectRoots); err != nil {
		writeJSONError(w, http.StatusForbidden, "unauthorized_project_path", "unauthorized project path")
		return
	}
	var req struct {
		Files []string `json:"files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Files) == 0 {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "files array is required")
		return
	}
	if err := git.Stage(r.Context(), project.RootPath, req.Files); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "git_stage_failed", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) PostGitUnstage(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	if err := workspace.ValidateProjectPath(project.RootPath, s.config.ProjectRoots); err != nil {
		writeJSONError(w, http.StatusForbidden, "unauthorized_project_path", "unauthorized project path")
		return
	}
	var req struct {
		Files []string `json:"files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Files) == 0 {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "files array is required")
		return
	}
	if err := git.Unstage(r.Context(), project.RootPath, req.Files); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "git_unstage_failed", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) PostGitStash(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	if err := workspace.ValidateProjectPath(project.RootPath, s.config.ProjectRoots); err != nil {
		writeJSONError(w, http.StatusForbidden, "unauthorized_project_path", "unauthorized project path")
		return
	}
	if err := git.Stash(r.Context(), project.RootPath); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "git_stash_failed", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) PostGitStashPop(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	if err := workspace.ValidateProjectPath(project.RootPath, s.config.ProjectRoots); err != nil {
		writeJSONError(w, http.StatusForbidden, "unauthorized_project_path", "unauthorized project path")
		return
	}
	if err := git.StashPop(r.Context(), project.RootPath); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "git_stash_pop_failed", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
```

- [ ] **Step 5: Build and verify**

Run: `cd apps/backend && go build ./internal/api/`
Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add apps/backend/internal/api/projects.go
git commit -m "feat(backend): add git checkout, branch create/delete, stage, unstage, stash handlers"
```

---

### Task 4: API handlers — GitHub PR reviews and merge

**Files:**
- Modify: `apps/backend/internal/api/projects.go`

- [ ] **Step 1: Add GetPRReviews, PostPRReview, PostPRMerge, GetPRComments handlers**

```go
func (s *Server) GetPRReviews(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	prNumber, _ := strconv.Atoi(chi.URLParam(r, "number"))
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil || project.GitHubOwner == "" || project.GitHubToken == "" {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project or GitHub config not found")
		return
	}
	reviews, err := ghutil.ListPRReviews(r.Context(), project.GitHubOwner, project.GitHubRepo, project.GitHubToken, prNumber)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "github_error", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviews)
}

func (s *Server) PostPRReview(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	prNumber, _ := strconv.Atoi(chi.URLParam(r, "number"))
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil || project.GitHubOwner == "" || project.GitHubToken == "" {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project or GitHub config not found")
		return
	}
	var req ghutil.ReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "invalid review body")
		return
	}
	if err := ghutil.SubmitPRReview(r.Context(), project.GitHubOwner, project.GitHubRepo, project.GitHubToken, prNumber, req); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "github_error", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) PostPRMerge(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	prNumber, _ := strconv.Atoi(chi.URLParam(r, "number"))
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil || project.GitHubOwner == "" || project.GitHubToken == "" {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project or GitHub config not found")
		return
	}
	var req struct {
		Method string `json:"method"` // merge, squash, rebase
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Method = "merge"
	}
	if req.Method == "" {
		req.Method = "merge"
	}
	if err := ghutil.MergePR(r.Context(), project.GitHubOwner, project.GitHubRepo, project.GitHubToken, prNumber, req.Method); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "github_error", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "merged"})
}

func (s *Server) GetPRComments(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	prNumber, _ := strconv.Atoi(chi.URLParam(r, "number"))
	project, err := s.db.GetProjectByID(r.Context(), projectID)
	if err != nil || project.GitHubOwner == "" || project.GitHubToken == "" {
		writeJSONError(w, http.StatusNotFound, "project_not_found", "project or GitHub config not found")
		return
	}
	comments, err := ghutil.ListPRComments(r.Context(), project.GitHubOwner, project.GitHubRepo, project.GitHubToken, prNumber)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "github_error", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}
```

- [ ] **Step 2: Build and verify**

Run: `cd apps/backend && go build ./internal/api/`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/api/projects.go
git commit -m "feat(backend): add GitHub PR review, merge, and comments handlers"
```

---

### Task 5: Register all new routes

**Files:**
- Modify: `apps/backend/internal/api/router.go`

- [ ] **Step 1: Add new routes after existing git routes**

After the existing `protected.Post("/api/v1/projects/{project_id}/git/pull", ...)` line, add:

```go
	// Git branch management
	protected.Post("/api/v1/projects/{project_id}/git/branches", server.PostGitCreateBranch)
	protected.Post("/api/v1/projects/{project_id}/git/checkout", server.PostGitCheckout)
	protected.Delete("/api/v1/projects/{project_id}/git/branches/{branch}", server.DeleteGitBranch)

	// Git staging
	protected.Post("/api/v1/projects/{project_id}/git/stage", server.PostGitStage)
	protected.Post("/api/v1/projects/{project_id}/git/unstage", server.PostGitUnstage)

	// Git stash
	protected.Post("/api/v1/projects/{project_id}/git/stash", server.PostGitStash)
	protected.Post("/api/v1/projects/{project_id}/git/stash/pop", server.PostGitStashPop)

	// GitHub PR reviews and merge
	protected.Get("/api/v1/projects/{project_id}/github/pulls/{number}/reviews", server.GetPRReviews)
	protected.Post("/api/v1/projects/{project_id}/github/pulls/{number}/reviews", server.PostPRReview)
	protected.Put("/api/v1/projects/{project_id}/github/pulls/{number}/merge", server.PostPRMerge)
	protected.Get("/api/v1/projects/{project_id}/github/pulls/{number}/comments", server.GetPRComments)
```

- [ ] **Step 2: Add missing imports if needed**

Ensure `ghutil` alias is imported in projects.go if not already present.

- [ ] **Step 3: Build full backend**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`
Expected: Clean build

- [ ] **Step 4: Run all tests**

Run: `cd apps/backend && go test ./... 2>&1 | grep -E 'ok|FAIL'`
Expected: All pass (existing test failures are pre-existing)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/api/router.go
git commit -m "feat(backend): register all new git and GitHub routes"
```

---

### Task 6: Final build and push

- [ ] **Step 1: Full build**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`

- [ ] **Step 2: Commit binary and push**

```bash
git add apps/backend/orchestrad
git commit -m "build: rebuild orchestrad with full git/github API"
git push origin main
```
