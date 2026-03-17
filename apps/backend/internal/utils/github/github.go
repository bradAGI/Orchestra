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
	Title *string `json:"title,omitempty"`
	Body  *string `json:"body,omitempty"`
	State *string `json:"state,omitempty"`
}

// ListIssues fetches issues from a GitHub repository filtered by state.
func ListIssues(ctx context.Context, owner, repo, token, state string) ([]Issue, error) {
	if state == "" {
		state = "open"
	}
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues?state=%s&per_page=50", owner, repo, state)

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
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
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
func ListPullRequests(ctx context.Context, owner, repo, token string) ([]PullRequest, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls?state=all&per_page=30", owner, repo)

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
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
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
		return "", fmt.Errorf("github api returned status %d", resp.StatusCode)
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
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
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
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
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
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
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
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
	}

	var comments []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&comments); err != nil {
		return nil, err
	}

	return comments, nil
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
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
	}

	var prResp PRResponse
	if err := json.NewDecoder(resp.Body).Decode(&prResp); err != nil {
		return nil, err
	}

	return &prResp, nil
}
