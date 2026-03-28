# Issue Lifecycle — End-to-End Test Plan

> Run this test to verify the full issue pipeline: creation, planning, execution, review, feedback, and merge.

## Prerequisites

- Backend running (`orchestrad` built and started)
- Desktop app running (Electron or `npm run dev:linux`)
- At least one project registered with a valid `root_path`
- Chrome DevTools available for inspection
- Agent CLI installed (e.g. `claude` on PATH)

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

---

## Step 2: Move to Todo

**Action:** Drag the issue from Backlog to the **Todo** column (or change state via dropdown).

**Verify:**
- [ ] State changes to **Todo**
- [ ] Orchestrator claims the issue (check terminal logs or SSE events)
- [ ] Git worktree is created at `{worktree_root}/{project_id}/{branch_name}`
- [ ] `base_sha` is recorded on the issue (merge-base with main)
- [ ] `branch_name` is recorded on the issue

---

## Step 3: Verify Planning Phase (Todo)

**Action:** Open the Issue Inspector by clicking the issue.

### Plan Tab
- [ ] Agent is running in **PLAN ONLY** mode (max 1 turn)
- [ ] Agent explores codebase briefly (2-3 tool calls)
- [ ] Agent outputs a plan as markdown checkboxes (`- [ ] Step 1: ...`)
- [ ] Plan tab displays the extracted checkboxes
- [ ] Plan has 5-10 actionable steps

### Session Tab
- [ ] Shows the agent's session output (planning activity)
- [ ] Events stream in real-time via SSE

### Changes Tab
- [ ] **Empty** — no code changes during planning phase
- [ ] Shows "No changes detected" or similar empty state

### Title & Description
- [ ] Title and description are still **editable** (Backlog → Todo allows editing)

---

## Step 4: Verify Terminal

**Action:** Switch to the Terminal tab in the main UI.

- [ ] A terminal session exists for this issue (named with issue identifier)
- [ ] Terminal shows the **correct agent** running (matches the assigned provider)
- [ ] Agent is running in the issue's **worktree directory** (not the project root)
- [ ] Terminal shows interactive TUI output (not JSON noise)
- [ ] No text injection from other sessions

---

## Step 5: Auto-Advance to InProgress

**Action:** Wait for the planning agent to finish and exit.

**Verify:**
- [ ] State automatically advances from **Todo** to **InProgress**
- [ ] No manual intervention required
- [ ] Title and description are now **read-only** (not editable in InProgress)
- [ ] The plan from the Todo phase is preserved in the Plan tab

---

## Step 6: Verify Execution Phase (InProgress)

**Action:** Open the Issue Inspector during InProgress.

### Plan Tab
- [ ] Shows the plan from the Todo phase
- [ ] Checkboxes may update as the agent completes steps
- [ ] Plan items are not lost or reset

### Session Tab
- [ ] Shows the execution session output
- [ ] Events stream in real-time
- [ ] Session content mirrors the Terminal tab output
- [ ] Agent is in **EXECUTE** mode (writing code, running tests, committing)

### Changes Tab
- [ ] Changes appear as the agent writes code
- [ ] Shows the **worktree diff** (only this issue's changes, not other issues)
- [ ] File list shows files changed by this agent
- [ ] Diff content is correct (additions in green, deletions in red)
- [ ] No files from other issues leak into this diff

### Terminal Tab
- [ ] Agent is still running in the same terminal session
- [ ] Terminal shows interactive execution (not JSON)
- [ ] User can observe the agent working in real-time

### Token Tracking
- [ ] Analytics dashboard shows token usage for this session
- [ ] Provider is correctly attributed (matches assigned agent)

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

### Plan Tab
- [ ] Plan checkboxes are checked off (completed steps marked `[x]`)
- [ ] Plan is complete or shows which steps were done

### Session Tab
- [ ] Session is complete (no longer streaming)
- [ ] Full session history is viewable
- [ ] Session log shows both planning and execution phases

### Changes Tab
- [ ] All changes from the execution phase are visible
- [ ] Diff is computed from the **worktree** (isolated from other issues)
- [ ] File count and line counts are accurate
- [ ] Changes are the final state (committed + uncommitted)

### Title & Description
- [ ] Still **read-only** in Review state

---

## Step 9: Feedback / Rejection Flow

**Action:** Enter feedback in the Review dialog and reject the task.

### With Feedback
- [ ] Feedback dialog appears with a text input
- [ ] User can type feedback about what needs to change
- [ ] On submit, issue moves back to **InProgress** (not Todo — re-execute, don't re-plan)
- [ ] Feedback text is stored on the issue (`feedback` field)
- [ ] When agent re-runs, the prompt includes: "FEEDBACK FROM REVIEW: {feedback text}"
- [ ] Agent addresses the feedback in its next execution pass
- [ ] After re-execution, state advances back to **Review**

### Without Feedback (Approve)
- [ ] If no feedback needed, user can approve the task
- [ ] Issue remains in **Review** or advances to **Done**
- [ ] PR creation option becomes available (see Step 10)

---

## Step 10: Pull Request Creation

**Action:** Click "Create Pull Request" in the Review/Done state.

**Verify:**
- [ ] PR creation dialog appears with pre-filled title and description
- [ ] Base branch is detected dynamically (not hardcoded to `main`)
- [ ] Head branch is the issue's worktree branch
- [ ] PR is created on the correct GitHub repository
- [ ] PR URL is displayed and clickable
- [ ] If no GitHub remote is configured, a helpful error message is shown

---

## Step 11: Merge / Complete

**Action:** Click "Complete & Merge" (or equivalent) after PR is approved.

**Verify:**
- [ ] Main branch is checked out
- [ ] Issue branch is merged into main
- [ ] Worktree branch is cleaned up (deleted)
- [ ] Worktree directory is removed
- [ ] Issue state moves to **Done**
- [ ] Issue appears in the Done column on the Kanban board
- [ ] Git history shows the merged commits

---

## Failure Scenarios to Test

### Agent Fails During Planning
- [ ] If agent errors out during Todo, issue should NOT auto-advance
- [ ] Error is visible in Session tab
- [ ] User can retry by moving issue back to Todo

### Agent Fails During Execution
- [ ] If agent errors out during InProgress, issue should NOT auto-advance to Review
- [ ] Error is visible in Session tab
- [ ] Changes tab shows partial changes (if any)

### Wrong Agent Provider
- [ ] If provider is set to "claude", the terminal must show `claude` running (not `codex`)
- [ ] Provider case normalization works (lowercase "claude" → uppercase "CLAUDE" for command lookup)

### Worktree Isolation
- [ ] Two issues on the same project show **different** diffs in their Changes tabs
- [ ] Issue A's changes do not leak into Issue B's Changes tab
- [ ] Each issue operates in its own worktree directory

### Terminal Tab Switching
- [ ] Switching between terminal tabs does NOT re-inject agent commands
- [ ] WebSocket connections persist across tab switches
- [ ] Each terminal shows its own session output

---

## Notes

- **Interactive yolo mode**: Agents run as full interactive TUIs (`claude --dangerously-skip-permissions`, `codex --full-auto`, `gemini --yolo`)
- **Token tracking**: Telemetry watcher reads session files from disk, not from PTY JSON
- **Plan extraction**: Reads markdown checkboxes from agent message events
- **State machine**: Backlog → Todo (plan) → InProgress (execute) → Review → Done
- **Feedback loop**: Review → reject with feedback → InProgress → Review (repeat until approved)
