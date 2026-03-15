# Fix Ralph Loop, Plan Detection, and Review Flow — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the agent execution loop (Ralph loop) so agents run continuously until done, plans are tracked accurately without PTY noise, changes are scoped to the current run, and the Review state provides commit/PR/close-issue actions.

**Architecture:** Seven independent fixes: (1) filter PTY noise from plan parser, (2) remove example checkboxes from WORKFLOW.md, (3) increase max turns for true Ralph loop, (4) scope diff to current session, (5) add commit button to Review UI, (6) add close-GitHub-issue button, (7) fix Draft PR to use current branch.

**Tech Stack:** Go (backend), React + TypeScript (frontend), SQLite, GitHub API

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` | Modify | Add commit button, close-GH-issue button, fix PR button |
| `apps/desktop/src/widgets/issue-detail/IssueDetailUtils.tsx` | Modify | Filter PTY events from plan parser |
| `apps/backend/WORKFLOW.md` | Modify | Remove example checkboxes that cause noise |
| `apps/backend/internal/config/load.go` | Modify | Increase default maxTurns for Ralph loop |
| `apps/backend/internal/app/run.go` | Modify | Filter PTY events from DB recording, improve fallback prompt |
| `apps/backend/internal/api/state.go` | Modify | Scope diff to session-specific changes |

---

### Task 1: Filter PTY noise from plan parser

The plan tab shows fake checkboxes from the echoed WORKFLOW.md prompt. PTY events with `kind: "pty"` contain terminal output including the echoed prompt with example checkboxes.

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx:169` (plan filter)
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailUtils.tsx:160-207` (collectCandidateMessages)

- [ ] **Step 1: Fix plan parser in IssueDetailView.tsx to exclude PTY events**

In `IssueDetailView.tsx:169`, the filter currently includes `item.completed` and `agent_message`:
```typescript
const messageEvents = issueHistory.filter(e =>
  (e.kind === 'message' || e.kind === 'agent_message' || e.kind === 'item.completed') && e.message
)
```

Change to explicitly EXCLUDE pty events and only include known agent message kinds:
```typescript
const PLAN_EVENT_KINDS = new Set(['message', 'agent_message', 'item.completed'])
const messageEvents = issueHistory.filter(e =>
  PLAN_EVENT_KINDS.has(e.kind) && e.message && e.source !== 'pty'
)
```

- [ ] **Step 2: Fix collectCandidateMessages in IssueDetailUtils.tsx**

In `IssueDetailUtils.tsx`, update `collectCandidateMessages()` to skip PTY events and example plan items (containing "step one", "step two", "step three"):
```typescript
// Skip PTY noise and example plan items from WORKFLOW.md
if (kind === 'pty' || kind === 'stderr') continue
if (msg.includes('step one') && msg.includes('step two')) continue
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx apps/desktop/src/widgets/issue-detail/IssueDetailUtils.tsx
git commit -m "fix(desktop): filter PTY noise and WORKFLOW.md examples from plan parser"
```

---

### Task 2: Clean up WORKFLOW.md and fallback prompt

Remove example checkboxes that get echoed back as PTY events. Use placeholder text instead.

**Files:**
- Modify: `apps/backend/WORKFLOW.md`
- Modify: `apps/backend/internal/app/run.go:622-629` (fallback prompt)

- [ ] **Step 1: Remove example checkboxes from WORKFLOW.md**

Replace the current WORKFLOW.md content. Remove the code-block examples with `- [ ] step one` and instead just describe the format:

```markdown
---
---
You are an autonomous coding agent working on issue **{{ .Issue.Identifier }}**.

## Task
**{{ .Issue.Title }}**

{{ .Issue.Description }}

## Instructions

1. First, write an **Operational Plan** using markdown checkboxes to show progress. Example: `- [ ] task` for pending, `- [x] task` for complete.

2. Work through each step. After completing a step, restate the full plan with updated checkboxes.

3. Use the tools available to you (file read/write, shell commands, search) to implement the changes.

4. When all steps are complete, verify your work compiles/passes and restate the final plan with all items checked.

5. Do NOT stop until all plan items are checked off. If you encounter an error, fix it and continue.
```

- [ ] **Step 2: Fix fallback prompt in run.go**

Replace the `buildExecutionPrompt` function to remove example checkboxes:

```go
func buildExecutionPrompt(issueIdentifier string, title string, description string, attempt int64) string {
	prompt := fmt.Sprintf("You are an autonomous coding agent working on issue **%s**.\n\n## Task\n**%s**\n\n%s", issueIdentifier, title, description)
	prompt += "\n\n## Instructions\n\n1. Write an **Operational Plan** using markdown checkboxes (`- [ ]` pending, `- [x]` done).\n\n2. Work through each step. After completing a step, restate the plan with updated checkboxes.\n\n3. Use all available tools to implement changes.\n\n4. Verify your work compiles/passes. Do NOT stop until all items are checked off."
	prompt += fmt.Sprintf("\n\nAttempt: %d", attempt)
	return prompt
}
```

- [ ] **Step 3: Build and test**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/ && go test ./internal/app/ -v | grep -E 'ok|FAIL'`
Expected: Build OK, tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/backend/WORKFLOW.md apps/backend/internal/app/run.go
git commit -m "fix(backend): remove example checkboxes from WORKFLOW.md and fallback prompt"
```

---

### Task 3: Increase max turns for Ralph loop

Default `agentMaxTurns` is 3, which means agents stop after 3 turns even if work is incomplete. For a true Ralph loop, agents should run until they're done.

**Files:**
- Modify: `apps/backend/internal/config/load.go:20` (default maxTurns)

- [ ] **Step 1: Increase default max turns**

Change line 20 from:
```go
agentMaxTurnsDefault := 3
```
To:
```go
agentMaxTurnsDefault := 25
```

This allows agents up to 25 turns (with 30-minute timeout per turn). Most tasks complete in 2-5 turns. The 25-turn cap is a safety net.

- [ ] **Step 2: Build and test**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/ && go test ./internal/config/ -v | grep -E 'ok|FAIL'`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/config/load.go
git commit -m "fix(backend): increase default agent max turns to 25 for Ralph loop"
```

---

### Task 4: Don't record PTY echo noise to database

PTY events that are just the echoed prompt (containing the WORKFLOW.md template) should not be stored in the events database. This reduces noise in history and plan detection.

**Files:**
- Modify: `apps/backend/internal/app/run.go:462-487` (event recording callback)

- [ ] **Step 1: Filter PTY noise from database recording**

In the event callback inside `processExecutionTick`, before `warehouseDB.RecordEvent`, add a filter:

```go
// Skip recording PTY echo noise (echoed prompts, shell decorations)
if event.Kind == "pty" && (event.Message == "" || len(event.Message) < 5) {
    return
}
// Skip PTY events that are just the echoed prompt
if event.Kind == "pty" && (strings.Contains(event.Message, "## Instructions") || strings.Contains(event.Message, "## Task") || strings.Contains(event.Message, "step one")) {
    return
}
```

- [ ] **Step 2: Build and test**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/ && go test ./internal/app/ | grep -E 'ok|FAIL'`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/internal/app/run.go
git commit -m "fix(backend): filter PTY echo noise from event database recording"
```

---

### Task 5: Add Commit button to Review state

The issue detail view in Review state needs a "Commit Changes" button that commits all changes in the project directory with a descriptive message.

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` (header buttons)

- [ ] **Step 1: Add import for gitCommit**

Add to existing imports:
```typescript
import { fetchIssueHistory, fetchIssueDiff, fetchIssueLogs, createProjectGitHubPull, gitCommit } from '@/lib/orchestra-client'
```

- [ ] **Step 2: Add Commit button in header between Draft PR and Close**

After the Draft PR button, add:
```tsx
{localState === 'Review' && config && projectId && (
  <button
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
    onClick={async () => {
      const msg = `feat(${identifier}): ${localTitle}\n\nImplemented by ${(typed.provider as string) || 'agent'} via Orchestra.\nCloses #${extractIssueNumber(typed.url as string || '')}`
      try {
        await gitCommit(config, projectId, msg)
      } catch (err) {
        console.error('Failed to commit:', err)
      }
    }}
  >
    <CheckCircle2 size={12} />
    Commit
  </button>
)}
```

Add helper function at top of file:
```typescript
function extractIssueNumber(url: string): string {
  const match = url.match(/\/issues\/(\d+)/)
  return match ? match[1] : ''
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "feat(desktop): add Commit Changes button to Review state"
```

---

### Task 6: Add Close GitHub Issue button

When closing an issue (moving to Done), also close the linked GitHub issue.

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` (Close button)

- [ ] **Step 1: Add import for updateProjectGitHubIssue**

Add to imports:
```typescript
import { ..., updateProjectGitHubIssue } from '@/lib/orchestra-client'
```

- [ ] **Step 2: Update Close button to also close GitHub issue**

Modify the Close button's onClick handler:
```tsx
onClick={async () => {
  await onUpdate({ state: 'Done' })
  setLocalState('Done')
  // Close GitHub issue if linked
  if (config && projectId && typed.url && typeof typed.url === 'string') {
    const match = (typed.url as string).match(/\/issues\/(\d+)/)
    if (match) {
      try {
        await updateProjectGitHubIssue(config, projectId, parseInt(match[1]), { state: 'closed' })
      } catch (err) {
        console.error('Failed to close GitHub issue:', err)
      }
    }
  }
}}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "feat(desktop): close linked GitHub issue when closing task"
```

---

### Task 7: Fix Draft PR button to use current branch

The Draft PR button should detect the current branch from the project's git state and pre-fill the compare URL correctly.

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx` (Draft PR button)

- [ ] **Step 1: Add fetchProjectGitBranches import**

```typescript
import { ..., fetchProjectGitBranches } from '@/lib/orchestra-client'
```

- [ ] **Step 2: Update Draft PR button to fetch current branch**

Replace the Draft PR button onClick:
```tsx
onClick={async () => {
  const issueUrl = typed.url as string
  const repoUrl = issueUrl.replace(/\/issues\/\d+$/, '')
  let head = 'main'
  // Try to detect current branch
  if (config && projectId) {
    try {
      const branches = await fetchProjectGitBranches(config, projectId)
      if (branches.current && branches.current !== 'main' && branches.current !== 'master') {
        head = branches.current
      }
    } catch { /* use main */ }
  }
  const base = 'main'
  const title = encodeURIComponent(localTitle || identifier)
  const body = encodeURIComponent(`## ${localTitle || identifier}\n\n${localDescription || 'No description.'}\n\nCloses ${issueUrl}\n\n---\n*Created from Orchestra task ${identifier}*`)
  const compareUrl = `${repoUrl}/compare/${base}...${head}?expand=1&title=${title}&body=${body}`
  const bridge = window.orchestraDesktop
  if (bridge && typeof bridge.openExternal === 'function') {
    void bridge.openExternal(compareUrl)
  } else {
    window.open(compareUrl, '_blank')
  }
}}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "feat(desktop): Draft PR detects current branch and pre-fills compare URL"
```

---

### Task 8: Build and verify end-to-end

- [ ] **Step 1: Build backend**

Run: `cd apps/backend && go build -o orchestrad ./cmd/orchestrad/`

- [ ] **Step 2: Typecheck frontend**

Run: `cd apps/desktop && npx tsc --noEmit`

- [ ] **Step 3: Run backend tests**

Run: `cd apps/backend && go test ./... 2>&1 | grep -E 'ok|FAIL'`

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "fix(backend,desktop): complete Ralph loop and review flow overhaul"
git push origin main
```
