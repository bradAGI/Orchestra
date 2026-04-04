# Git And GitHub Domain

## Scope

Local git routes:

- `/api/v1/projects/{project_id}/git/*`

GitHub routes:

- `/api/v1/projects/{project_id}/github/*`
- `/api/v1/github/login`
- `/api/v1/github/callback`

## Canonical Resources

- `GitStatus`
- `GitDiff`
- `GitBranch`
- `GitConflict`
- `GitCommitRequest`
- `GitHubIssue`
- `GitHubPullRequest`
- `GitHubReview`
- `GitHubComment`

## Current Weak Spots

- Local VCS models and remote GitHub models should not share files just because they are under one route prefix.
- Branch, stash, diff, and conflict payloads need explicit schema ownership.
- GitHub issue and PR resources should be modeled as first-class domain types instead of informal JSON blobs.

## Shared Refs

- `common/id`
- `common/timestamp`
- `issues/issue-ref` where issue linkage exists

## Test Targets

- `/api/v1/projects/{project_id}/git/status`
- `/api/v1/projects/{project_id}/git/branches`
- `/api/v1/projects/{project_id}/github/issues`
- `/api/v1/projects/{project_id}/github/pulls`
