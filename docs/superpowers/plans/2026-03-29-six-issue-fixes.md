# Six Issue Fixes — Notification, Plan, Changes, Terminal, Agents Mode, Review UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 issues found during E2E testing: notification timing, plan stability, worktree diff, terminal project selector, agents mode removal, and Review UI cleanup.

**Architecture:** All fixes are independent — each task modifies different files. Can be executed sequentially with commit after each.

**Tech Stack:** Go backend, React/TypeScript frontend

---

### Task 1: Fix notification — only fire when state reaches Review (#107)

**Files:**
- Modify: `apps/desktop/src/App.tsx:404-416`

The `RUN_SUCCEEDED` event fires after EVERY turn (Todo planning turn, each InProgress execution turn). The notification should only fire when the issue actually reaches Review.

- [ ] **Step 1: Change the notification trigger**

In `apps/desktop/src/App.tsx`, find the `RUN_SUCCEEDED` handler (around line 404). Replace:

```tsx
if (eventType === 'RUN_SUCCEEDED') {
    const issueIdentifier = (envelope.data.issue_identifier as string) || ''
    fetchIssues(config).then((issues) => {
      setBoardIssues(issues)
      if (issueIdentifier && issues.some(i => (i.identifier || i.issue_identifier) === issueIdentifier)) {
        playNotification(issueIdentifier)
      }
    }).catch(() => {})
    lastIssueFetchRef.current = Date.now()
}
```

With:

```tsx
if (eventType === 'RUN_SUCCEEDED') {
    const issueIdentifier = (envelope.data.issue_identifier as string) || ''
    fetchIssues(config).then((issues) => {
      setBoardIssues(issues)
      // Only notify when issue reaches Review (not after every turn)
      const issue = issues.find(i => (i.identifier || i.issue_identifier) === issueIdentifier)
      if (issue && issue.state === 'Review') {
        playNotification(issueIdentifier)
      }
    }).catch(() => {})
    lastIssueFetchRef.current = Date.now()
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/App.tsx
git commit -m "fix(desktop): only notify when issue reaches Review, not every turn (#107)"
```

---

### Task 2: Fix plan stability — include original plan in execution prompt (#108)

**Files:**
- Modify: `apps/backend/internal/orchestrator/state.go:929-935`
- Modify: `apps/backend/internal/app/run.go:447-453`

The agent creates a new plan each turn because the execution prompt doesn't include the ORIGINAL plan from the Todo phase. The agent has no memory of what it planned.

- [ ] **Step 1: Fetch the original plan from DB and include in execution prompt**

In `apps/backend/internal/app/run.go`, after the prompt is built (around line 447), add logic to fetch the plan from the Todo phase events and include it:

```go
// After renderedPrompt is built, before the priorContext append:

// Include the original plan from the planning phase so the agent
// executes the SAME plan instead of creating a new one each turn.
if strings.EqualFold(entry.State, "In Progress") && warehouseDB != nil {
    originalPlan := extractOriginalPlan(warehouseDB, entry.IssueID)
    if originalPlan != "" {
        renderedPrompt += "\n\n## YOUR PLAN (from planning phase — execute this, do NOT create a new plan)\n\n" + originalPlan
    }
}
```

Add the helper function:

```go
// extractOriginalPlan retrieves the first agent message containing 3+ checkboxes
// from the issue's event history. This is the plan created during the Todo phase.
func extractOriginalPlan(warehouseDB *db.DB, issueID string) string {
    history, err := warehouseDB.GetUnifiedHistory(context.Background(), issueID)
    if err != nil {
        return ""
    }
    for _, h := range history {
        msg, _ := h["message"].(string)
        if msg == "" {
            continue
        }
        // Count checkbox items
        count := 0
        for _, line := range strings.Split(msg, "\n") {
            trimmed := strings.TrimSpace(line)
            if strings.HasPrefix(trimmed, "- [") || strings.HasPrefix(trimmed, "* [") {
                count++
            }
        }
        if count >= 3 {
            return msg
        }
    }
    return ""
}
```

- [ ] **Step 2: Update the execution prompt to be clearer**

In `apps/backend/internal/orchestrator/state.go` line 931, change the MODE: EXECUTE instruction:

```go
// CURRENT:
desc = desc + "\n\n---\nMODE: EXECUTE. You have already explored this codebase and created a plan. Skip codebase exploration — go straight to implementation. Follow your plan step by step. Write code, run tests, commit changes.\n\nIMPORTANT: After completing each step, restate your FULL plan with updated checkboxes. Mark completed steps with [x]:\n   - [x] Step 1: (completed)\n   - [ ] Step 2: (next)\nThis lets the human track your progress in real-time."

// CHANGE TO:
desc = desc + "\n\n---\nMODE: EXECUTE — DO NOT CREATE A NEW PLAN.\n\nYou ALREADY have a plan (included below). Execute it step by step.\nDo NOT re-plan, do NOT explore the codebase. Go straight to implementation.\n\nAfter completing each step, restate the FULL plan with [x] for completed steps:\n   - [x] Step 1: (done)\n   - [ ] Step 2: (next)\n\nWrite code, run tests, commit when done."
```

- [ ] **Step 3: Verify Go compiles and commit**

```bash
cd apps/backend && go vet ./...
git add apps/backend/internal/app/run.go apps/backend/internal/orchestrator/state.go
git commit -m "fix(backend): include original plan in execution prompt — prevent re-planning (#108)"
```

---

### Task 3: Fix Changes tab worktree diff (#109)

**Files:**
- Modify: `apps/backend/internal/api/state.go` (GetIssueDiff handler)

The diff handler constructs `filepath.Join(s.worktreeRoot, project.ID, issue.BranchName)` but the actual worktrees are at `filepath.Join(s.worktreeRoot, project.ID, branchName)` where branchName is lowercase. Need to add logging and verify the path matches.

- [ ] **Step 1: Add debug logging to GetIssueDiff**

In the `GetIssueDiff` handler, add logging to show what paths it's checking:

```go
s.logger.Info().
    Str("identifier", identifier).
    Str("worktree_root", s.worktreeRoot).
    Str("project_id", project.ID).
    Str("branch_name", issue.BranchName).
    Str("base_sha", issue.BaseSHA).
    Msg("computing issue diff")
```

Also log when the worktree path is checked:

```go
wtPath := filepath.Join(s.worktreeRoot, project.ID, issue.BranchName)
s.logger.Info().Str("wt_path", wtPath).Bool("exists", info != nil).Msg("checking worktree path")
```

- [ ] **Step 2: Also try the worktree scan fallback path**

The fallback scan at the "no base_sha/branch_name" block scans for directories matching the identifier. But if `base_sha` and `branch_name` ARE set, it goes to the branch-scoped diff which constructs the path directly. Make sure this path construction is correct by also trying lowercase branchName.

- [ ] **Step 3: Build, commit**

```bash
cd apps/backend && go build -o orchestrad ./cmd/orchestrad/
git add apps/backend/internal/api/state.go
git commit -m "fix(backend): add logging to GetIssueDiff for worktree path debugging (#109)"
```

---

### Task 4: Terminal project selector (#110)

**Files:**
- Modify: `apps/desktop/src/components/terminal/TerminalMultiplexer.tsx`

Add a project dropdown next to the quick-launch agent buttons. Agent quick-launch buttons are disabled until a project is selected. When clicked, the terminal opens in the selected project's root directory.

- [ ] **Step 1: Add project selector state and dropdown**

Add a `selectedProjectId` prop or state to `TerminalMultiplexer`. Add a dropdown before the quick-launch buttons that lists registered projects.

The multiplexer already receives `activeTerminals`, `baseUrl`, `apiToken` as props. It needs to also receive `projects` (list of registered projects).

```tsx
// Add to TerminalMultiplexerProps:
projects?: { id: string; name: string; root_path?: string }[]

// Add state:
const [selectedProjectId, setSelectedProjectId] = useState<string>('')

// Add dropdown before agent buttons:
<select
  value={selectedProjectId}
  onChange={(e) => setSelectedProjectId(e.target.value)}
  className="px-2 py-1 rounded text-[10px] bg-background border border-border/40 text-foreground"
>
  <option value="">Select project...</option>
  {projects?.map(p => (
    <option key={p.id} value={p.id}>{p.name}</option>
  ))}
</select>
```

- [ ] **Step 2: Disable agent buttons without project selected**

Wrap the agent quick-launch buttons with a disabled state:

```tsx
{agentCommands.map((agent) => (
  <button
    key={agent.id}
    disabled={!selectedProjectId}
    onClick={() => onAddAgentTerminal(
      `${agent.id}-${Date.now()}`,
      agent.label,
      agent.cmd
    )}
    className={`... ${!selectedProjectId ? 'opacity-30 cursor-not-allowed' : ''}`}
  >
    {agent.label}
  </button>
))}
```

- [ ] **Step 3: Pass project ID to terminal creation**

Update `onAddAgentTerminal` to include the project ID so the terminal opens in the right directory.

- [ ] **Step 4: Wire up projects prop from App.tsx**

Pass the `projects` list to the `TerminalMultiplexer` component.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/terminal/TerminalMultiplexer.tsx apps/desktop/src/App.tsx
git commit -m "feat(desktop): add project selector to terminal tab — require project for agent launch (#110)"
```

---

### Task 5: Remove MODE from Agents ProviderHeader (#111)

**Files:**
- Modify: `apps/desktop/src/widgets/agents/ProviderHeader.tsx:68-74`

- [ ] **Step 1: Remove the MODE dropdown**

Delete lines 68-74:

```tsx
// DELETE THIS BLOCK:
<label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 shrink-0 ml-2">Mode</label>
<CustomDropdown
  className="min-w-[120px]"
  value={permissions.approval_mode}
  options={approvalModes}
  onChange={(val) => onPermissionsChange({ ...permissions, approval_mode: val })}
/>
```

- [ ] **Step 2: Remove unused imports**

If `APPROVAL_MODES` is no longer used anywhere in this file, remove it from the imports.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/widgets/agents/ProviderHeader.tsx
git commit -m "fix(desktop): remove redundant MODE selector from Agents ProviderHeader (#111)"
```

---

### Task 6: Clean up Review state UI (#112)

**Files:**
- Modify: `apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx`

Three changes:
1. After PR created: replace "Create PR" with "Move to Done", keep PR link
2. Remove sidebar Approve/Reject/Stop & Reset in Review (duplicates header)
3. Request Changes only available when NO PR exists

- [ ] **Step 1: Conditional header buttons based on PR status**

Replace the Review header buttons block (lines 374-414):

```tsx
{localState === 'Review' && config && projectId && onUpdate && (
  <>
    {prUrl && (
      <a href={prUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <Github size={12} />
        PR Open
      </a>
    )}
    {prUrl ? (
      // PR exists — show Done button
      <button
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg transition-all"
        onClick={async () => {
          await onUpdate({ state: 'Done' })
          setLocalState('Done')
        }}
      >
        <CheckCircle2 size={14} />
        Move to Done
      </button>
    ) : (
      // No PR yet — show Create PR
      <button
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
        onClick={() => setPRDialogOpen(true)}
      >
        <GitPullRequest size={14} />
        Create PR
      </button>
    )}
    {/* Request Changes — only when no PR */}
    {!prUrl && (
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-muted/20 text-muted-foreground border border-border/30 hover:bg-muted/40 transition-colors"
        onClick={() => setShowFeedback(true)}
      >
        <Pencil size={12} />
        Request Changes
      </button>
    )}
    {/* Close/Abandon */}
    <button
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors"
      onClick={async () => {
        await onUpdate({ state: 'Done' })
        setLocalState('Done')
      }}
    >
      <X size={12} />
      Close
    </button>
  </>
)}
```

- [ ] **Step 2: Remove sidebar Approve/Reject/Stop & Reset for Review state**

Delete the entire `{localState === 'Review' && (...)}` block from the sidebar (lines 569-586):

```tsx
// DELETE THIS ENTIRE BLOCK:
{localState === 'Review' && (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        <span className="text-[11px] text-purple-400">Awaiting Review</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => { ... }} ...>Approve</button>
        <button onClick={() => setShowFeedback(true)} ...>Reject</button>
      </div>
      <button onClick={() => setShowStopConfirm(true)} ...>Stop & Reset</button>
    </div>
)}
```

Replace with just a status indicator:

```tsx
{localState === 'Review' && (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-purple-500" />
      <span className="text-[11px] text-purple-400">{prUrl ? 'PR Created' : 'Awaiting Review'}</span>
    </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/widgets/issue-detail/IssueDetailView.tsx
git commit -m "fix(desktop): clean up Review UI — conditional buttons based on PR status (#112)"
```
