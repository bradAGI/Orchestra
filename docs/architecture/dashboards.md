# Dashboards & Views Architecture

The Orchestra frontend relies on a series of specialized dashboards and views, each designed for a specific operational context. By separating these concerns, the UI remains highly performant and contextually relevant.

## Task Board (`KanbanBoard`)

The default landing view. A visual, drag-and-drop interface for managing issue states across a 5-column board.
- **State Mapping**: Maps task states to visual columns: Backlog, Todo, In Progress, Review, Done.
- **Interactive Triggers**: Dragging an issue into the `In Progress` column triggers a backend API call to update the issue state, which automatically provisions a workspace and dispatches an agent.

## Activity Feed

A real-time, chronological stream of all system events (e.g., `run_started`, `hook_completed`, `run_failed`). It uses Server-Sent Events (SSE) to update instantly without polling. Accessible from the **Activity Feed** sidebar item.

## 📂 Project Management (`ProjectGrid` & `ProjectDetailView`)

Views dedicated to managing isolated workspaces.
- **Grid View**: Displays all tracked local repositories with key metrics.
- **Detail View**: Provides deep inspection of a specific workspace, including:
  - **File Explorer**: A recursive tree view of the current workspace directory.
  - **Git History**: A timeline of all commits made by agents in that workspace.

## ⚙️ Agent Control Plane (`AgentsDashboard`)

A dedicated IDE for managing agent configurations.
- **Categorization**: Splits configurations into "Core" (dotfiles) and "Skills" (Markdown guidance).
- **Pro Editor**: Features JSON validation, auto-formatting, and Markdown previews.
- **Scope Context**: Allows operators to switch between editing Global defaults and Project-specific overrides.

## 📊 Analytics Warehouse (`AnalyticsDashboard`)

A historical archive and metrics viewer.
- **Recharts Integration**: Uses `recharts` to render a stacked area chart showing token burn trajectories over time (Input vs. Output tokens).
- **Session Archive**: A paginated, searchable table of all completed agent sessions, allowing operators to drill down into past performance and logs.

## 📖 Knowledge Base (`DocsDashboard`)

The integrated Deep Wiki.
- **Triple-Column Layout**: Features a nested file explorer, a high-fidelity Markdown renderer (`react-markdown` + `Prism`), and an auto-generated Table of Contents.
- **Interactive Diagrams**: Supports embedding `d3.js` visualizations directly from Markdown source.
