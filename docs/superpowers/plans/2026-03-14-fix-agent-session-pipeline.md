# Fix Agent Session Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three critical bugs preventing agent sessions from receiving task context, operating on project source code, and exposing session logs.

**Architecture:** The dispatch pipeline flows: `enqueueCandidates()` → `ClaimNextRunnable()` → `processExecutionTick()`. Three independent bugs exist at different points: (1) `RunningEntry` lacks a `Description` field so the prompt template renders empty, (2) the workspace fallback creates an empty directory instead of using project source, (3) `RecordRunArtifact()` is never called so `SessionLogPath` is always empty, breaking log retrieval.

**Tech Stack:** Go, chi router, SQLite (modernc.org/sqlite)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `internal/orchestrator/state.go` | Modify | Add `Description` to `RunningEntry`, populate in `enqueueCandidates` |
| `internal/app/run.go` | Modify | Pass `Description` to prompt builder, call `RecordRunArtifact` after session starts |
| `internal/api/state.go` | Modify | Improve log path fallback to scan directory for actual log files |
| `internal/orchestrator/state_test.go` (or `dispatch_test.go`) | Modify | Test that Description propagates through enqueue |
| `internal/app/run_test.go` | Modify | Test that Description reaches the prompt |
| `internal/prompt/builder_test.go` | Modify | Test that Description renders in prompt template |
| `internal/logfile/logfile_test.go` | Modify | Test latest.log symlink resolution |
| `internal/api/state_test.go` | Modify | Test log fallback with real files |

---

### Task 1: Add `Description` to `RunningEntry` and propagate through dispatch

**Files:**
- Modify: `apps/backend/internal/orchestrator/state.go:33-54` (RunningEntry struct)
- Modify: `apps/backend/internal/orchestrator/state.go:815-829` (enqueueCandidates)
- Test: `apps/backend/internal/orchestrator/dispatch_test.go`

- [ ] **Step 1: Write the failing test**

Add to `dispatch_test.go`:

```go
func TestPerformRefreshCarriesDescriptionIntoRunningEntry(t *testing.T) {
	service := NewService()
	service.SetTrackerClient(memory.NewClient([]tracker.Issue{
		{ID: "1", Identifier: "ORC-1", State: "Todo", AssignedToWorker: true, Title: "Fix bug", Description: "Detailed description of the bug"},
	}))

	service.QueueRefresh()
	if err := service.PerformRefresh(context.Background()); err != nil {
		t.Fatalf("perform refresh: %v", err)
	}

	snapshot := service.Snapshot()
	if len(snapshot.Running) != 1 {
		t.Fatalf("expected 1 running, got %d", len(snapshot.Running))
	}
	if snapshot.Running[0].Description != "Detailed description of the bug" {
		t.Fatalf("expected description carried through, got %q", snapshot.Running[0].Description)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && go test ./internal/orchestrator/ -run TestPerformRefreshCarriesDescriptionIntoRunningEntry -v`
Expected: FAIL — `RunningEntry` has no `Description` field

- [ ] **Step 3: Add `Description` field to `RunningEntry`**

In `state.go:33-54`, add after `Title`:

```go
type RunningEntry struct {
	IssueID         string   `json:"issue_id"`
	IssueIdentifier string   `json:"issue_identifier"`
	Title           string   `json:"title,omitempty"`
	Description     string   `json:"description,omitempty"`  // ADD THIS LINE
	State           string   `json:"state"`
	// ... rest unchanged
}
```

- [ ] **Step 4: Populate `Description` in `enqueueCandidates`**

In `state.go:815-829`, add `Description: issue.Description,` after the Title line:

```go
entry := RunningEntry{
	IssueID:         issue.ID,
	IssueIdentifier: issue.Identifier,
	Title:           issue.Title,
	Description:     issue.Description,  // ADD THIS LINE
	State:           issue.State,
	// ... rest unchanged
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && go test ./internal/orchestrator/ -run TestPerformRefreshCarriesDescriptionIntoRunningEntry -v`
Expected: PASS

- [ ] **Step 6: Run full orchestrator test suite**

Run: `cd apps/backend && go test ./internal/orchestrator/ -v`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
cd apps/backend
git add internal/orchestrator/state.go internal/orchestrator/dispatch_test.go
git commit -m "fix(orchestrator): add Description to RunningEntry and populate in dispatch"
```

---

### Task 2: Pass `Description` to the prompt builder

**Files:**
- Modify: `apps/backend/internal/app/run.go:343-346` (prompt building)
- Test: `apps/backend/internal/prompt/builder_test.go`

- [ ] **Step 1: Write the failing test**

Add to `builder_test.go`:

```go
func TestBuildRendersDescriptionInTemplate(t *testing.T) {
	workflowPath := filepath.Join(t.TempDir(), "WORKFLOW.md")
	content := "---\n---\nTask: {{ .Issue.Title }}\n\n{{ .Issue.Description }}"
	if err := os.WriteFile(workflowPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write workflow: %v", err)
	}

	prompt, err := Build(workflowPath, BuildInput{
		Issue: tracker.Issue{
			ID:          "1",
			Identifier:  "ORC-9",
			Title:       "Fix bug",
			Description: "The login button is broken on mobile",
			State:       "Todo",
		},
		Attempt: 1,
	})
	if err != nil {
		t.Fatalf("build prompt: %v", err)
	}

	if !strings.Contains(prompt, "Fix bug") {
		t.Fatalf("expected title in prompt, got %q", prompt)
	}
	if !strings.Contains(prompt, "The login button is broken on mobile") {
		t.Fatalf("expected description in prompt, got %q", prompt)
	}
}
```

- [ ] **Step 2: Run test to verify it passes (template already supports Description)**

Run: `cd apps/backend && go test ./internal/prompt/ -run TestBuildRendersDescriptionInTemplate -v`
Expected: PASS — the prompt builder already maps `Description` from the Issue struct. The bug is in `run.go` which constructs the Issue without Description.

- [ ] **Step 3: Fix the Issue construction in `run.go:343-346`**

Change:

```go
renderedPrompt, promptErr := prompt.Build(workflowFile, prompt.BuildInput{
	Issue:   tracker.Issue{ID: entry.IssueID, Identifier: entry.IssueIdentifier, Title: entry.Title, State: entry.State},
	Attempt: attempt,
})
```

To:

```go
renderedPrompt, promptErr := prompt.Build(workflowFile, prompt.BuildInput{
	Issue:   tracker.Issue{ID: entry.IssueID, Identifier: entry.IssueIdentifier, Title: entry.Title, Description: entry.Description, State: entry.State},
	Attempt: attempt,
})
```

- [ ] **Step 4: Run full prompt and app test suites**

Run: `cd apps/backend && go test ./internal/prompt/ ./internal/app/ -v`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add internal/app/run.go internal/prompt/builder_test.go
git commit -m "fix(app): pass issue Description to prompt builder"
```

---

### Task 3: Wire up `RecordRunArtifact` and fix log retrieval

**Files:**
- Modify: `apps/backend/internal/app/run.go:409-410` (after session ID creation)
- Modify: `apps/backend/internal/api/state.go:450-478` (log retrieval fallback)
- Test: `apps/backend/internal/logfile/logfile_test.go`
- Test: `apps/backend/internal/api/state_test.go`

- [ ] **Step 1: Write a test for symlink resolution in logfile**

Add to `logfile_test.go`:

```go
func TestResetLatestLogCreatesWorkingSymlink(t *testing.T) {
	root := t.TempDir()
	issueID := "ORC-10"
	sessionID := "ORC-10-12345"

	// Write the actual log file first
	_, err := WriteSessionLog(root, issueID, sessionID, "test log content")
	if err != nil {
		t.Fatalf("write session log: %v", err)
	}

	// Verify latest.log symlink works
	latestPath := filepath.Join(root, "_logs", "ORC-10", "latest.log")
	content, err := os.ReadFile(latestPath)
	if err != nil {
		t.Fatalf("read latest.log via symlink: %v", err)
	}
	if string(content) != "test log content" {
		t.Fatalf("unexpected latest.log content: %q", string(content))
	}

	// Verify the symlink target is relative
	target, err := os.Readlink(latestPath)
	if err != nil {
		t.Fatalf("readlink latest.log: %v", err)
	}
	if filepath.IsAbs(target) {
		t.Fatalf("expected relative symlink target, got %q", target)
	}
}
```

- [ ] **Step 2: Run test to verify it passes (symlink logic is already correct)**

Run: `cd apps/backend && go test ./internal/logfile/ -run TestResetLatestLogCreatesWorkingSymlink -v`
Expected: PASS — the symlink logic is fine. The problem is `RecordRunArtifact` is never called.

- [ ] **Step 3: Call `RecordRunArtifact` in `run.go` after session ID creation**

After line 410 in `run.go` (after `_ = logfile.ResetLatestLog(...)`), add:

```go
sessionID := fmt.Sprintf("%s-%d", entry.IssueIdentifier, time.Now().UnixNano())
_ = logfile.ResetLatestLog(workspaceRoot, entry.IssueIdentifier, sessionID)
logPath := filepath.Join(workspaceRoot, "_logs", logfile.Sanitize(entry.IssueIdentifier), "latest.log")
service.RecordRunArtifact(entry.IssueID, activeProviderName, sessionID, logPath)
```

Note: `logfile.Sanitize` needs to be exported (currently lowercase `sanitize`).

- [ ] **Step 4: Export the `sanitize` function in logfile.go**

In `internal/logfile/logfile.go:76`, rename `sanitize` to `Sanitize`:

```go
func Sanitize(value string) string {
```

And update all internal callers (lines 22, 27, 48, 53, 68, 70) to use `Sanitize`.

- [ ] **Step 5: Improve `GetIssueLogs` fallback in `api/state.go`**

Replace lines 454-475 with a fallback that scans for the actual log file if `latest.log` doesn't exist:

```go
logPath := ""
if ok && runtime.Running != nil && runtime.Running.SessionLogPath != "" {
	logPath = runtime.Running.SessionLogPath
} else {
	// Try latest.log symlink first
	candidate := filepath.Join(s.workspaceRoot, "_logs", identifier, "latest.log")
	if _, err := os.Stat(candidate); err == nil {
		logPath = candidate
	} else {
		// Scan for most recent .log file in the directory
		logsDir := filepath.Join(s.workspaceRoot, "_logs", identifier)
		entries, dirErr := os.ReadDir(logsDir)
		if dirErr == nil {
			var newest string
			var newestTime time.Time
			for _, e := range entries {
				if e.IsDir() || !strings.HasSuffix(e.Name(), ".log") || e.Name() == "latest.log" {
					continue
				}
				info, infoErr := e.Info()
				if infoErr != nil {
					continue
				}
				if newest == "" || info.ModTime().After(newestTime) {
					newest = filepath.Join(logsDir, e.Name())
					newestTime = info.ModTime()
				}
			}
			logPath = newest
		}
	}
}

if logPath == "" {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("# No logs available yet\n\nThis issue hasn't started processing or logs haven't been created."))
	return
}

if _, err := os.Stat(logPath); os.IsNotExist(err) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("# No logs available yet\n\nThis issue hasn't started processing or logs haven't been created."))
	return
}

http.ServeFile(w, r, logPath)
```

- [ ] **Step 6: Add `time` and `strings` imports to `api/state.go` if not present**

Check existing imports; add `"strings"` and `"time"` if they're missing.

- [ ] **Step 7: Run full test suite**

Run: `cd apps/backend && go test ./internal/logfile/ ./internal/api/ ./internal/app/ -v`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
cd apps/backend
git add internal/logfile/logfile.go internal/logfile/logfile_test.go internal/app/run.go internal/api/state.go
git commit -m "fix(logs): wire up RecordRunArtifact and add fallback log file scanning"
```

---

### Task 4: Build and verify end-to-end

- [ ] **Step 1: Run the full backend test suite**

Run: `cd apps/backend && go test ./... 2>&1 | tail -20`
Expected: All packages pass

- [ ] **Step 2: Build the backend binary**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`
Expected: Clean build, no errors

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "fix(backend): agent sessions receive task context, logs, and source code"
```
