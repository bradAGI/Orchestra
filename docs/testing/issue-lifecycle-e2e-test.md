# Issue Lifecycle — End-to-End Test Plan

> Run this test to verify the full issue pipeline: creation, planning, execution, review, PR creation, feedback loop, and cleanup.

## Prerequisites

- Backend running (`orchestrad` built and started)
- Desktop app running (Electron or `npm run dev:linux`)
- At least one project registered with a valid `root_path` and GitHub remote
- `expect-cli` installed (`npm install -g expect-cli`)
- Agent CLI installed (e.g. `claude` on PATH)
- `EXPECT_BASE_URL` set to the app URL (e.g. `http://localhost:5173`)

---

## Step 1: Create Task

**Action:** Create a new issue via the Task Board UI (+ button or Create Task dialog).

**Verify:**
- [ ] Title is set (non-empty, descriptive)
- [ ] Description is set (non-empty, explains what needs to be done)
- [ ] Project is assigned (dropdown shows registered projects)
- [ ] Agent provider is assigned (Claude, Codex, Gemini, or OpenCode)
- [ ] Initial state is **Backlog**
- [ ] Issue appears on the Kanban board in the Backlog column
- [ ] Issue identifier is generated (e.g. `PROJ-1`)

**expect-cli:**
```bash
expect-cli -m "Navigate to task board. Click Create Task. Fill in title 'Test Task', description 'Test the full lifecycle', select a project, select Claude as provider. Submit. Verify task appears in Backlog column with identifier." -y
```

---

## Step 2: Move to Todo

**Action:** Move the issue from Backlog to Todo from the board.

**Verify:**
- [ ] State changes to **Todo**
- [ ] Orchestrator claims the issue (SSE event or terminal activity)
- [ ] Git worktree is created at `{worktree_root}/{project_id}/{branch_name}`
- [ ] `base_sha` is recorded on the issue
- [ ] `branch_name` is recorded on the issue

**expect-cli:**
```bash
expect-cli -m "Find the test task in Backlog. Click it to open inspector. Click 'Move to Todo'. Verify state changes. Wait 30s and check if orchestrator picks it up (task may auto-advance to InProgress)." -y
```

---

## Step 3: Verify Planning Phase (Todo)

**Action:** Open the Issue Inspector while in Todo state.

### Plan Tab
- [ ] Agent is running in planning mode
- [ ] Agent outputs a plan as markdown checkboxes (`- [ ] Step 1: ...`)
- [ ] Plan tab displays the extracted checkboxes

### Session Tab
- [ ] Shows planning output for the active run
- [ ] Agent is in the worktree directory

### Changes Tab
- [ ] Remains scoped to the issue worktree only

### Title & Description
- [ ] Title and description are **not editable** in Todo state

**expect-cli:**
```bash
expect-cli -m "Open the test task inspector. Check Plan tab for checkboxes. Check Session tab for planning output. Check Changes tab stays scoped to the issue worktree. Verify title and description are read-only." -y
```

---

## Step 4: Verify Terminal / Session Surfaces

**Action:** Inspect the live run through the issue Session tab, and optionally compare with the Terminals section if a related harness is open.

- [ ] The issue Session tab shows the **correct agent** running (matches assigned provider)
- [ ] Agent is in the issue's **worktree directory** (not project root)
- [ ] If a terminal harness is opened for the issue, it stays scoped to that issue or shell
- [ ] No text injection from other sessions

**expect-cli:**
```bash
expect-cli -m "Check the issue Session tab while the run is active. If a related harness is opened in Terminals, verify it shows the same issue-specific workspace context and not another task's output." -y
```

---

## Step 5: Auto-Advance to InProgress

**Action:** Wait for the planning agent to finish and exit.

**Verify:**
- [ ] State automatically advances from **Todo** to **InProgress** after the planning run succeeds
- [ ] No manual intervention required
- [ ] Title and description become **read-only**
- [ ] Plan from Todo phase is preserved in Plan tab

---

## Step 6: Verify Execution Phase (InProgress)

**Action:** Open the Issue Inspector during InProgress.

### Plan Tab
- [ ] Shows the plan from the Todo phase
- [ ] Checkboxes may update as agent completes steps

### Session Tab
- [ ] Shows live execution — agent writing code, running tests
- [ ] If a terminal harness is opened for the issue, it remains scoped to the same worktree

### Changes Tab
- [ ] Changes appear as the agent writes code
- [ ] Shows **worktree diff only** (not other issues' changes)
- [ ] File list accurate, diff content correct

### Title & Description
- [ ] **Read-only** — not editable in InProgress

**expect-cli:**
```bash
expect-cli -m "Open the test task inspector. Verify state is InProgress. Check Plan tab still has checkboxes. Check Session tab shows live agent execution. Check Changes tab shows files being modified. Verify title is not editable." -y
```

---

## Step 7: Auto-Advance to Review

**Action:** Wait for the execution agent to finish and exit.

**Verify:**
- [ ] State automatically advances from **InProgress** to **Review**
- [ ] No manual intervention required
- [ ] Agent process has exited cleanly

---

## Step 8: Verify Review Phase

**Action:** Open the Issue Inspector in Review state.

### Header Buttons
- [ ] **Create PR** button is visible (primary/green)
- [ ] **Request Changes** button is visible (secondary/outline)
- [ ] **Close** button is visible (red/destructive)
- [ ] Old "Merge & Close" button is gone from the review header

### Plan Tab
- [ ] Plan checkboxes are checked off (completed steps)

### Terminal Tab
- [ ] Shows "Session completed" message (agent not running)

### Changes Tab
- [ ] All changes from execution are visible
- [ ] Diff computed from **worktree** (isolated, no cross-issue leaking)
- [ ] File count and diff content accurate

**expect-cli:**
```bash
expect-cli -m "Open the test task inspector in Review state. Verify three buttons: Create PR, Request Changes, Close. Check Plan tab shows completed checkboxes. Check Session tab shows session completed. Check Changes tab shows all file changes." -y
```

---

## Step 9: Request Changes (Feedback Flow)

**Action:** Click "Request Changes" to test the feedback loop.

### Feedback Dialog
- [ ] Feedback dialog opens with textarea
- [ ] Two action choices: **Re-execute** (default) and **Re-plan**
- [ ] Feedback text is required (can't submit empty)
- [ ] Submit button text changes based on choice

### Re-execute path
- [ ] Select "Re-execute", enter feedback, submit
- [ ] Issue moves back to **InProgress**
- [ ] Agent re-runs with feedback appended to prompt
- [ ] After agent finishes, issue returns to **Review**

### Re-plan path
- [ ] Select "Re-plan", enter feedback, submit
- [ ] Issue moves back to **Todo**
- [ ] Agent re-plans from scratch with feedback context
- [ ] After planning, auto-advances to InProgress, then Review

**expect-cli:**
```bash
expect-cli -m "Open the test task in Review. Click Request Changes. Verify feedback dialog opens with Re-execute and Re-plan options. Enter feedback text 'Add error handling for edge cases'. Select Re-execute. Submit. Verify issue moves to InProgress." -y
```

---

## Step 10: Create Pull Request

**Action:** After the feedback loop returns to Review, click "Create PR".

### PR Creation Dialog
- [ ] Dialog opens with pre-filled fields
- [ ] Title pre-filled from issue title
- [ ] Description pre-filled from issue description
- [ ] Base branch auto-detected (not hardcoded to main)
- [ ] Head branch shows the issue's worktree branch (read-only)
- [ ] Draft PR checkbox available
- [ ] Submit creates the PR on GitHub

### After PR Creation
- [ ] PR URL stored on the issue
- [ ] "PR Open" badge/link appears in inspector header
- [ ] Link opens GitHub PR in new tab
- [ ] Issue automatically advances to **Done** after PR creation

### Non-GitHub Projects
- [ ] If no GitHub remote is configured, verify the review flow still allows closing the task without PR creation

**expect-cli:**
```bash
expect-cli -m "Open the test task in Review. Click Create PR. Verify dialog opens with pre-filled title, description, and branches. Submit. Verify PR Open badge appears with GitHub link. Verify issue auto-advances to Done." -y
```

---

## Step 11: Close / Done

**Action:** After PR is created (or merged on GitHub), close the issue.

**Verify:**
- [ ] Click "Close" to move to Done
- [ ] Worktree directory is removed
- [ ] Local branch is deleted
- [ ] `git worktree prune` runs
- [ ] Linked GitHub issue is closed (if applicable)
- [ ] Issue appears in Done column on Kanban board
- [ ] Final metrics recorded (tokens, cost, duration)

**expect-cli:**
```bash
expect-cli -m "Open the test task in Review (with PR created). Click Close. Verify issue moves to Done column on kanban board." -y
```

---

## Failure Scenarios

### Agent Fails During Planning
- [ ] If agent errors out during Todo, issue should NOT auto-advance
- [ ] Error visible in Session tab
- [ ] User can retry by moving back to Todo

### Agent Fails During Execution
- [ ] If agent errors out during InProgress, should NOT advance to Review
- [ ] Error visible in Session tab
- [ ] Changes tab shows partial changes (if any)

### Wrong Agent Provider
- [ ] Provider set to "claude" → terminal shows `claude` running (not `codex`)
- [ ] Case normalization works (lowercase → uppercase for command lookup)

### Worktree Isolation
- [ ] Two issues on same project show **different** diffs in Changes tab
- [ ] No cross-issue diff leaking
- [ ] Each issue in its own worktree directory

### Terminal Tab Switching
- [ ] Switching terminal tabs does NOT re-inject agent commands
- [ ] WebSocket connections persist across tab switches

### PR Creation Failures
- [ ] Invalid branch → helpful error in dialog
- [ ] No GitHub remote → review flow still surfaces a non-PR close path
- [ ] Network error → error message shown, dialog stays open for retry

### Feedback Loop
- [ ] Empty feedback text → validation prevents submit
- [ ] Re-plan sends to Todo, Re-execute sends to InProgress
- [ ] Feedback text included in agent prompt on re-dispatch

---

## Full Flow Diagram

```
GitHub Issues / Manual Create / Embedded Agent
        │
        ▼
   BACKLOG (editable)
        │ User moves to Todo
        ▼
   TODO — agent plans
        │ Auto-advance on successful planning run
        ▼
   IN PROGRESS — agent executes
        │ Auto-advance on successful execution run
        ▼
   REVIEW — human reviews
        │
        ├── Create PR → PR on GitHub → Done
        │
        ├── Request Changes → feedback dialog
        │   ├── Re-execute → InProgress (with feedback)
        │   └── Re-plan → Todo (with feedback)
        │
        └── Close → Done (abandon + cleanup)
```

## Notes

- **Interactive yolo mode**: Agents run as full TUIs (`claude --dangerously-skip-permissions`, `codex --full-auto`, `gemini --yolo`)
- **Token tracking**: Telemetry watcher reads session files from disk
- **Plan extraction**: Reads markdown checkboxes from agent messages
- **Session tab in inspector**: Shows live PTY when running, "Session completed" when done
- **PR creation**: Orchestra's job ends at the PR — CI/CD handles code review from there
- **The circle**: CI/CD finds issues → new issues created → Backlog → agents fix them
