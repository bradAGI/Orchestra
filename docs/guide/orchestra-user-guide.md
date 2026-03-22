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

The Kanban board has five columns:

- **Backlog** — drafting area where new tasks land
- **Todo** — agent creates a plan automatically
- **In Progress** — agent executes the plan
- **Review** — human reviews the work
- **Done** — completed, branch preserved for PR

The toolbar has:
- **Create Task** button (left) — opens the task creation dialog
- **Project filter** (right) — filter by project when viewing all tasks
- **Board/List toggle** (right) — switch between Kanban board and table view

### Creating a Task

![Create Task](screenshots/02-create-task-filled.png)

Click **Create Task** in the toolbar. All four fields are **required**:

- **Title** — what needs to be done
- **Description** — detailed instructions for the agent
- **Project** — which codebase the agent works in
- **Agent** — which AI agent to assign (Claude, Codex, Gemini, OpenCode)

The **CREATE** button stays disabled until all fields are filled. Tasks always start in Backlog.

### Backlog — The Staging Area

![Task in Backlog](screenshots/03-task-in-backlog.png)

Tasks in Backlog are fully editable drafts. You can change the title, description, agent, and project.

![Backlog Inspector](screenshots/04-backlog-inspector.png)

The inspector shows:
- Editable title and description (with Edit button)
- Agent and project selectors
- Status: **"Draft — drag to Todo when ready"**
- Auto-created GitHub issue link

**Moving to Todo:** Drag the task card from Backlog to Todo. Requires all fields filled — missing fields snap the card back.

### Todo — Planning Phase

![Todo Board](screenshots/05-todo-board.png)

When a task enters Todo, the agent is automatically dispatched in **planning mode**.

![Todo Inspector](screenshots/06-todo-inspector.png)

The inspector shows:
- Status: **"Planning"** with blue dot
- **STOP & RESET** button
- All fields **locked** (read-only text, no edit button)

![Todo Session](screenshots/08-todo-session.png)

The agent explores the codebase and creates a structured plan. Review the plan in the **Plan** tab. When satisfied, drag to **In Progress**.

### In Progress — Execution Phase

![In Progress Board](screenshots/10-inprogress-board.png)

The agent is dispatched to execute the plan.

![In Progress Inspector](screenshots/11-inprogress-inspector.png)

The inspector shows:
- Status: **"Executing"** with amber dot
- **STOP & RESET** button
- All fields locked

![In Progress Session](screenshots/12-inprogress-session.png)

Watch the agent work in real time via the **Session** tab. The agent automatically moves the task to **Review** when complete.

### Review — Human QA

![Review Board](screenshots/13-review-board.png)

The task is ready for human review.

![Review Inspector](screenshots/14-review-inspector.png)

The inspector shows:
- Status: **"Awaiting Review"** with purple dot
- **APPROVE** button (green) — moves to Done
- **REJECT** button (red) — opens feedback dialog, sends back to Todo
- **STOP & RESET** button
- **MERGE & CLOSE** in header

Review the work across all tabs:
- **Plan** — what the agent intended
- **Session** — what happened
- **Changes** — the code diff

### Done — Completed

![Done Inspector](screenshots/15-done-inspector.png)

The inspector shows:
- Status: **"Completed"** with green dot
- **REOPEN** button in header
- All tabs viewable

![Done Board](screenshots/16-done-board.png)

The branch is preserved — go to the project's **Git** tab to commit, push, and create a PR.

### Stop & Reset

Available from any active state (Todo, In Progress, Review). Pressing **STOP & RESET**:
- Kills any running agent session
- Clears the plan and changes
- Returns the task to **Backlog** for editing
- Requires confirmation dialog

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

Navigate to **Projects** to see all workspaces. Click **Add Project** to register a new directory.

Each project has three tabs: **Tasks**, **Files**, **Git**.

### Git Tab

![Git Changes](screenshots/17-git-changes.png)

The Git tab has three sub-tabs:

**Changes** — two-panel layout:
- Left: Stacked Unstaged/Staged file lists with drag-and-drop, commit bar at bottom
- Right: Diff viewer (unified or split)

**History** — scrollable commit timeline with search. Click a commit to view its diff.

**GitHub** — issues and PRs from the connected repo. Create issues, PRs, review and merge.

---

## Sidebar Navigation

| Section | Description |
|---------|-------------|
| **Tasks** | Task board and inspector |
| **Projects** | Local workspace grouping |
| **Terminals** | Live agent sessions and shells |
| **Agents** | Global agent configurations |
| **Analytics** | Token usage and session archives |
| **Sandbox** | Remote code execution |
| **Settings** | Backend and migration controls |
| **Documentation** | User and engineering guides |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+.** | Toggle embedded agent |
| **Ctrl+K** | Universal search |
| **Ctrl+Enter** | Commit (in Git tab) |
| **Escape** | Close dialogs and dropdowns |

---

## Getting Started

1. **Add a project** — go to Projects → Add Project
2. **Connect GitHub** — click the GitHub button to authenticate
3. **Create a task** — click Create Task, fill all fields, assign an agent
4. **Drag to Todo** — agent auto-plans
5. **Review the plan** — check the Plan tab
6. **Drag to In Progress** — agent executes
7. **Review** — approve or reject with feedback
8. **Ship it** — go to Git tab to commit and create a PR
