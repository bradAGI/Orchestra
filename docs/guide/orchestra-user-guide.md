# Orchestra Desktop — User Guide

Orchestra is a multi-agent development platform that combines task management, Git version control, GitHub integration, and AI-powered agents in a single desktop application.

---

## Task Workflow

Orchestra enforces a strict task lifecycle. Every task flows through five states with gates at each transition.

```
BACKLOG → TODO → IN PROGRESS → REVIEW → DONE
```

### Task Board

![Task Board](screenshots/01-task-board.png)

The Kanban board has five columns. Tasks can only be created in **Backlog** — all other columns show "NO TASKS" until work flows into them.

- **Backlog** — drafting area. The only column with a "+" create button.
- **Todo** — agent creates a plan automatically
- **In Progress** — agent executes the plan
- **Review** — human reviews the work
- **Done** — completed, branch preserved for PR

### Creating a Task

![Create Task](screenshots/02-create-task.png)

Click **"CLICK TO ADD TASK"** in the Backlog column. All four fields are **required**:

- **Title** — what needs to be done
- **Description** — detailed instructions for the agent
- **Project** — which codebase the agent works in
- **Agent** — which AI agent to assign (Claude, Codex, Gemini, OpenCode)

The **CREATE** button stays disabled until all fields are filled.

### Backlog — The Staging Area

![Task in Backlog](screenshots/03-task-in-backlog.png)

Tasks in Backlog are fully editable drafts. You can change the title, description, agent, and project at any time.

![Backlog Detail](screenshots/04-backlog-detail.png)

The inspector shows:
- Editable title and description (with markdown support)
- Agent and project selectors
- Status: **"Draft — drag to Todo when ready"**
- Auto-created GitHub issue link

**Moving to Todo:** Drag the task card from Backlog to the Todo column. This requires all fields to be filled — if anything is missing, the card snaps back.

### Todo — Planning Phase

When a task enters Todo:
1. The agent is automatically dispatched in **planning mode**
2. It reads the description, explores the codebase, and creates a structured plan
3. The agent stops — it does **not** write code yet
4. Review the plan in the **Plan** tab

**Fields are locked** — title, description, agent, and project cannot be changed.

Drag to **In Progress** when the plan looks good.

### In Progress — Execution Phase

![In Progress - Locked](screenshots/05-inprogress-locked.png)

When a task enters In Progress:
1. The agent is dispatched to **execute the plan**
2. Watch progress in the **Session** tab (live terminal output)
3. See code changes in the **Changes** tab
4. The agent automatically moves the task to **Review** when done

The inspector shows:
- **Status: "Executing"** with amber pulse indicator
- **"STOP & RESET"** button — kills the agent, clears plan and changes, returns to Backlog
- All fields locked (read-only title, description, no selectors)

### Review — Human QA

When the agent completes, the task moves to Review automatically. You review:
- **Plan** tab — what the agent intended to do
- **Session** tab — what actually happened
- **Changes** tab — the code diff

Two actions:
- **Approve** → moves to Done
- **Reject** → opens a feedback dialog. Describe what needs to change. The task returns to Todo with your feedback, the agent re-plans incorporating it, and the branch is preserved.

### Done — Completed

The task is finished. All tabs remain viewable. The branch is preserved — go to the project's **Git** tab to create a PR when ready.

### Stop & Reset

Available from any active state (Todo, In Progress, Review). Pressing **STOP & RESET**:
- Kills any running agent session
- Clears the plan and changes
- Returns the task to **Backlog** for editing
- Requires confirmation: "This will clear the plan and all changes"

---

## Drag Rules

| Transition | Allowed? | Gate |
|------------|----------|------|
| Backlog → Todo | Drag | Title + description + agent + project required |
| Todo → In Progress | Drag | Agent auto-executes plan |
| In Progress → Review | Automatic | Agent completes |
| Review → Done | Drag | Human approval |
| Review → Todo | Button only | Requires feedback text |
| Any → Backlog | Button only | Stop & Reset (clears everything) |
| Backward drag | Blocked | Cannot drag cards left |
| Skip states | Blocked | Must go through each state in order |

---

## Projects & Git

Navigate to **Projects** in the sidebar to see all registered workspaces. Click a project to open it. Each project has three tabs:

- **Tasks** — project-scoped Kanban board
- **Files** — browse the project's file tree
- **Git** — full Git client with Changes, History, and GitHub sub-tabs

### Git Tab — Changes

The Changes view has a two-panel layout:
- **Left panel**: Stacked Unstaged/Staged file lists with drag-and-drop staging, commit bar at bottom
- **Right panel**: Diff viewer for the selected file

### Git Tab — History

Scrollable commit timeline with search. Click a commit to view its diff.

### Git Tab — GitHub

Issues and pull requests from the connected repository. Create issues, PRs, and review/merge PRs directly from Orchestra.

For projects without a GitHub connection, shows a "Create GitHub Repository" button.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+.** | Toggle embedded agent |
| **Ctrl+K** | Universal search |
| **Ctrl+Enter** | Commit (in Git tab) |
| **Escape** | Close dialogs and dropdowns |
