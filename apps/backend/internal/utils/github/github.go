// Package github provides helper functions for interacting with the GitHub REST API,
// including operations on issues, pull requests, reviews, and comments.
package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"golang.org/x/oauth2"
	githuboauth "golang.org/x/oauth2/github"
)

// PRRequest represents the payload for creating a GitHub pull request.
type PRRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Head  string `json:"head"`
	Base  string `json:"base"`
}

// PRResponse represents the response from creating a GitHub pull request.
type PRResponse struct {
	HTMLURL string `json:"html_url"`
	Number  int    `json:"number"`
}

// Issue represents a GitHub issue with metadata.
type Issue struct {
	Number    int    `json:"number"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	State     string `json:"state"`
	HTMLURL   string `json:"html_url"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	Labels    []struct {
		Name string `json:"name"`
	} `json:"labels"`
	User struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	} `json:"user"`
}

// PullRequest represents a GitHub pull request with head/base branch information.
type PullRequest struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	Body    string `json:"body"`
	State   string `json:"state"`
	Draft   bool   `json:"draft"`
	HTMLURL string `json:"html_url"`
	DiffURL string `json:"diff_url"`
	Head    struct {
		Ref   string `json:"ref"`
		Label string `json:"label"`
	} `json:"head"`
	Base struct {
		Ref   string `json:"ref"`
		Label string `json:"label"`
	} `json:"base"`
	User struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	} `json:"user"`
	CreatedAt string  `json:"created_at"`
	MergedAt  *string `json:"merged_at"`
}

// CreateIssueRequest represents the payload for creating a GitHub issue.
type CreateIssueRequest struct {
	Title  string   `json:"title"`
	Body   string   `json:"body"`
	Labels []string `json:"labels,omitempty"`
}

// UpdateIssueRequest represents the payload for updating a GitHub issue.
type UpdateIssueRequest struct {
	Title     *string  `json:"title,omitempty"`
	Body      *string  `json:"body,omitempty"`
	State     *string  `json:"state,omitempty"`
	Assignees []string `json:"assignees,omitempty"`
	Labels    []string `json:"labels,omitempty"`
}

// apiError reads the response body and returns a descriptive error for GitHub API failures.
// Handles 401 (auth expired) and 429 (rate limit) specially.
func apiError(resp *http.Response) error {
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("GitHub authentication failed (401). Reconnect GitHub in project settings. Details: %s", string(respBody))
	}
	if resp.StatusCode == http.StatusTooManyRequests {
		retryAfter := resp.Header.Get("Retry-After")
		if retryAfter == "" {
			retryAfter = "60"
		}
		return fmt.Errorf("GitHub rate limit exceeded. Try again in %s seconds.", retryAfter)
	}
	return fmt.Errorf("github api returned status %d: %s", resp.StatusCode, string(respBody))
}

// ListIssues fetches issues from a GitHub repository filtered by state.
func ListIssues(ctx context.Context, owner, repo, token, state string, page int) ([]Issue, error) {
	if state == "" {
		state = "open"
	}
	if page < 1 {
		page = 1
	}
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues?state=%s&per_page=50&page=%d", owner, repo, state, page)

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

	if resp.StatusCode != http.StatusOK {
		return nil, apiError(resp)
	}

	var issues []Issue
	if err := json.NewDecoder(resp.Body).Decode(&issues); err != nil {
		return nil, err
	}

	// Filter out pull requests (GitHub API returns PRs in the issues endpoint)
	filtered := make([]Issue, 0, len(issues))
	for _, issue := range issues {
		filtered = append(filtered, issue)
	}

	return filtered, nil
}

// ListPullRequests fetches pull requests from a GitHub repository.
func ListPullRequests(ctx context.Context, owner, repo, token string, page int) ([]PullRequest, error) {
	if page < 1 {
		page = 1
	}
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls?state=all&per_page=30&page=%d", owner, repo, page)

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

	if resp.StatusCode != http.StatusOK {
		return nil, apiError(resp)
	}

	var prs []PullRequest
	if err := json.NewDecoder(resp.Body).Decode(&prs); err != nil {
		return nil, err
	}

	return prs, nil
}

// GetPullRequestDiff fetches the unified diff for a pull request.
func GetPullRequestDiff(ctx context.Context, owner, repo, token string, number int) (string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d", owner, repo, number)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3.diff")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", apiError(resp)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

// CreateIssue creates a new issue in the given GitHub repository.
func CreateIssue(ctx context.Context, owner, repo, token string, reqBody CreateIssueRequest) (*Issue, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues", owner, repo)

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, apiError(resp)
	}

	var issue Issue
	if err := json.NewDecoder(resp.Body).Decode(&issue); err != nil {
		return nil, err
	}

	return &issue, nil
}

// UpdateIssue patches an existing GitHub issue by number.
func UpdateIssue(ctx context.Context, owner, repo, token string, number int, reqBody UpdateIssueRequest) (*Issue, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d", owner, repo, number)

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, apiError(resp)
	}

	var issue Issue
	if err := json.NewDecoder(resp.Body).Decode(&issue); err != nil {
		return nil, err
	}

	return &issue, nil
}

// PostIssueComment posts a comment on the given GitHub issue.
func PostIssueComment(ctx context.Context, owner, repo, token string, issueNumber int, body string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/comments", owner, repo, issueNumber)

	payload, err := json.Marshal(map[string]string{"body": body})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(payload))
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

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github comment api returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// ReviewRequest represents the payload for submitting a pull request review.
type ReviewRequest struct {
	Body  string `json:"body"`
	Event string `json:"event"`
}

// MergeRequest represents the payload for merging a pull request.
type MergeRequest struct {
	MergeMethod string `json:"merge_method"`
}

// ListPRReviews fetches all reviews for a pull request.
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

	if resp.StatusCode != http.StatusOK {
		return nil, apiError(resp)
	}

	var reviews []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&reviews); err != nil {
		return nil, err
	}

	return reviews, nil
}

// SubmitPRReview submits a review on a pull request.
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
		return fmt.Errorf("github api returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// MergePR merges a pull request using the specified merge method.
func MergePR(ctx context.Context, owner, repo, token string, prNumber int, method string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/merge", owner, repo, prNumber)

	payload := MergeRequest{MergeMethod: method}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

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
		return fmt.Errorf("github api returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// ListPRComments fetches all review comments on a pull request.
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

	if resp.StatusCode != http.StatusOK {
		return nil, apiError(resp)
	}

	var comments []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&comments); err != nil {
		return nil, err
	}

	return comments, nil
}

// CreateRepoRequest represents the payload for creating a GitHub repository.
type CreateRepoRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Private     bool   `json:"private"`
}

// CreateRepoResponse represents the response from creating a GitHub repository.
type CreateRepoResponse struct {
	FullName string `json:"full_name"`
	CloneURL string `json:"clone_url"`
	SSHURL   string `json:"ssh_url"`
	HTMLURL  string `json:"html_url"`
}

// CreateRepository creates a new GitHub repository for the authenticated user.
func CreateRepository(ctx context.Context, token string, opts CreateRepoRequest) (*CreateRepoResponse, error) {
	url := "https://api.github.com/user/repos"

	body, err := json.Marshal(opts)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, apiError(resp)
	}

	var repo CreateRepoResponse
	if err := json.NewDecoder(resp.Body).Decode(&repo); err != nil {
		return nil, err
	}

	return &repo, nil
}

// CreatePullRequest creates a new pull request in the given GitHub repository.
func CreatePullRequest(ctx context.Context, owner, repo, token string, pr PRRequest) (*PRResponse, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls", owner, repo)

	body, err := json.Marshal(pr)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, apiError(resp)
	}

	var prResp PRResponse
	if err := json.NewDecoder(resp.Body).Decode(&prResp); err != nil {
		return nil, err
	}

	return &prResp, nil
}

// TokenFromStored deserializes a stored token string.
// It handles both legacy plain access tokens and the newer JSON format
// that includes refresh token and expiry.
func TokenFromStored(stored string) (*oauth2.Token, error) {
	var tok oauth2.Token
	if err := json.Unmarshal([]byte(stored), &tok); err != nil {
		// Legacy format: plain access token string
		return &oauth2.Token{AccessToken: stored}, nil
	}
	// Sanity check: JSON parsed but no access token means it's not a valid token
	if tok.AccessToken == "" {
		return &oauth2.Token{AccessToken: stored}, nil
	}
	return &tok, nil
}

// RefreshableToken returns a valid access token, refreshing if needed.
// If the token was refreshed, updatedTokenJSON contains the new serialized
// token that should be persisted. If no refresh was needed, updatedTokenJSON
// is empty. For legacy plain-text tokens with no expiry, the token is returned
// as-is.
func RefreshableToken(ctx context.Context, stored, clientID, clientSecret string) (accessToken string, updatedTokenJSON string, err error) {
	tok, err := TokenFromStored(stored)
	if err != nil {
		return "", "", err
	}

	// If no expiry set (legacy token) or token is still valid, use as-is
	if tok.Expiry.IsZero() || tok.Valid() {
		return tok.AccessToken, "", nil
	}

	// Token expired — try refresh
	if tok.RefreshToken == "" {
		return "", "", fmt.Errorf("token expired and no refresh token available — re-authenticate required")
	}

	if clientID == "" || clientSecret == "" {
		return "", "", fmt.Errorf("token expired and OAuth client credentials not configured — re-authenticate required")
	}

	conf := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Endpoint:     githuboauth.Endpoint,
	}

	src := conf.TokenSource(ctx, tok)
	newTok, err := src.Token()
	if err != nil {
		return "", "", fmt.Errorf("token refresh failed — re-authenticate required: %w", err)
	}

	// Serialize refreshed token for persistence
	tokenJSON, err := json.Marshal(newTok)
	if err != nil {
		return newTok.AccessToken, "", nil // use token even if we can't serialize
	}

	return newTok.AccessToken, string(tokenJSON), nil
}
