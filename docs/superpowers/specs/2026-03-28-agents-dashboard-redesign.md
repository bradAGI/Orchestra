# Agents Dashboard Redesign — Package Manager UI

**Date:** 2026-03-28
**Issue:** #96
**Status:** Design approved

## Goal

Replace the 1,373-line `AgentsDashboard.tsx` monolith with a modular, three-column "package manager" UI. Users browse, install, configure, and manage agent resources (skills, hooks, MCP servers, rules, sub-agents) through a categorized inventory with an integrated editor panel.

## Layout

```
┌─────────┬───────────────────────────────────────────────┐
│Provider │  Model: [▾]  Effort: [●●○]  Mode: [▾]  Scope: [▾]
│  Tabs   ├──────────────┬────────────────────────────────┤
│         │ Category     │  Detail / Editor               │
│[Claude] │              │                                │
│ Codex   │ ★ Instructions│                               │
│ Gemini  │   Skills (3) │  [selected item editor]        │
│ OpenCode│   Hooks  (2) │                                │
│         │   MCP    (1) │                                │
│         │   Rules  (4) │                                │
│         │   Agents (1) │                                │
│         │              │                                │
│         │  [+ Add New] │              [Save]  [Discard] │
└─────────┴──────────────┴────────────────────────────────┘
  ~50px       ~220px              remaining
```

### Three columns

1. **Provider tabs** (~50px) — Vertical icon tabs: Claude, Codex, Gemini, OpenCode. Always visible, one-click switch. Active provider highlighted with primary color. Dot indicator: green = configured, muted = unconfigured.

2. **Category list** (~220px) — Inventory sidebar. Instructions pinned at top (starred). Below: Skills, Hooks, MCP, Rules, Sub-agents. Each shows item count badge. Clicking a category shows its items as a sub-list. Clicking an item loads it in the detail panel. `+ Add New` button at bottom, contextual to selected category.

3. **Detail / Editor panel** (remaining) — Shows the selected item's content. For text items (Instructions, Skills, Rules, Sub-agents): a code/markdown editor. For structured items (Hooks, MCP): a form with fields. Save and Discard buttons at bottom-right. Unsaved changes show amber dot on category and "Unsaved" badge.

### Header bar

Spans across columns 2+3 above the category/detail area. Contains inline controls for the selected provider:

- **Model** — dropdown with per-provider model list
- **Effort** — segmented control (low/medium/high) or provider-specific levels
- **Permissions mode** — dropdown (default, plan, ask, auto-accept, bypassPermissions)
- **Scope** — dropdown (Global / specific project)

These save immediately on change (no Save button needed — they're atomic settings, not editor content).

## File Structure

```
widgets/agents/
├── AgentsDashboard.tsx        — Shell: 3-column layout, manages selected provider/category/item
├── ProviderTabs.tsx           — Vertical provider icon tabs with status dots
├── ProviderHeader.tsx         — Model, effort, permissions, scope inline controls
├── CategoryList.tsx           — Category sidebar with item counts and sub-item lists
├── panels/
│   ├── InstructionsPanel.tsx  — Markdown/text editor for CLAUDE.md / AGENTS.md / GEMINI.md
│   ├── SkillsPanel.tsx        — SKILL.md list view + editor, create/delete
│   ├── HooksPanel.tsx         — Hook event list with event/command/matcher fields, add/remove
│   ├── MCPPanel.tsx           — MCP server list + add form, provider + Orchestra servers
│   ├── RulesPanel.tsx         — Rules directory list + editor, path-scoped rules with frontmatter
│   └── SubAgentsPanel.tsx     — Sub-agent list + editor, create/delete
├── hooks/
│   └── useAgentConfig.ts      — Centralized data fetching, caching, save handlers, error state
├── constants.ts               — Provider metadata, model lists, hook events, category definitions
├── types.ts                   — Provider, CategoryId, AgentConfigState, panel prop types
└── index.ts                   — Re-export AgentsDashboard
```

Old file `components/agents/AgentsDashboard.tsx` becomes a thin re-export:
```ts
export { AgentsDashboard } from '@widgets/agents'
```

## Component Responsibilities

### AgentsDashboard.tsx (~150 lines)
Shell component. Manages three pieces of state:
- `selectedProvider: Provider` — which agent is active
- `selectedCategory: CategoryId | null` — which category is expanded
- `selectedItem: string | null` — which item is loaded in the editor (path or ID)

Instantiates `useAgentConfig(provider, scope, projectId)` and passes slices to children. Renders the 3-column layout with `ProviderTabs`, `ProviderHeader`, `CategoryList`, and the active panel.

### ProviderTabs.tsx (~60 lines)
Vertical list of 4 provider icons. Props: `providers`, `selected`, `onSelect`, `configuredSet`. Renders icon + dot indicator per provider.

### ProviderHeader.tsx (~100 lines)
Inline controls bar. Props: `modelConfig`, `permissions`, `scope`, `onModelChange`, `onPermissionsChange`, `onScopeChange`, `provider`. Each control is a `CustomDropdown` or segmented button. Changes call save handlers directly (immediate persistence).

### CategoryList.tsx (~120 lines)
Left sidebar. Props: `categories` (with counts), `selectedCategory`, `selectedItem`, `onSelectCategory`, `onSelectItem`, `onAddNew`. Renders:
- Pinned "Instructions" row with star icon
- Collapsible category rows with count badges
- Sub-item list when category is expanded
- `+ Add New` button

### Panel components (~100-180 lines each)
Each panel receives:
- `items: AgentConfig[]` — the items for this category
- `selectedItem: string | null` — currently selected item path
- `onSave: (path: string, content: string) => Promise<void>`
- `onDelete: (path: string) => Promise<void>`
- `onCreate: (name: string, content?: string) => Promise<void>`
- `loading: boolean`
- `error: string`

Text-based panels (Instructions, Skills, Rules, SubAgents) render a `<textarea>` editor with Save/Discard. Structured panels (Hooks, MCP) render forms with add/remove row controls.

### useAgentConfig.ts (~200 lines)
Single hook that owns all data fetching and mutation for the selected provider:

```ts
function useAgentConfig(provider: Provider, scope: Scope, projectId?: string) {
  // Returns:
  return {
    // Data
    configs: AgentConfig[]
    permissions: ProviderPermissions
    modelConfig: ProviderModelConfig
    hooks: ProviderHook[]
    providerMcpServers: ProviderMCPServer[]
    orchestraMcpServers: MCPServer[]
    projects: Project[]

    // State
    loading: boolean
    error: string
    saving: string | null

    // Mutations
    saveConfig: (path: string, content: string) => Promise<void>
    deleteConfig: (path: string) => Promise<void>
    createResource: (type: string, name: string) => Promise<void>
    savePermissions: (perms: ProviderPermissions) => Promise<void>
    saveModel: (model: ProviderModelConfig) => Promise<void>
    saveHooks: (hooks: ProviderHook[]) => Promise<void>
    addMCPServer: (name: string, command: string) => Promise<void>
    deleteMCPServer: (name: string) => Promise<void>

    // Helpers
    configsByCategory: (category: string) => AgentConfig[]
    categoryCounts: Record<CategoryId, number>
  }
}
```

Fetches all data on `(provider, scope, projectId)` change. Caches per-provider to avoid refetch on tab switch. Exposes `categoryCounts` for the sidebar badges.

### constants.ts (~80 lines)
Static data extracted from the current monolith:
- `PROVIDERS` array with id, label, description, icon
- `MODELS_BY_PROVIDER` — model dropdown options per provider
- `HOOK_EVENTS_BY_PROVIDER` — available hook events per provider
- `CATEGORIES` — category definitions with id, label, icon, description
- `EFFORT_LEVELS` — effort level options per provider

### types.ts (~30 lines)
```ts
type Provider = 'claude' | 'codex' | 'gemini' | 'opencode'
type CategoryId = 'instructions' | 'skills' | 'hooks' | 'mcp' | 'rules' | 'agents'
type Scope = 'GLOBAL' | 'PROJECT'

interface AgentConfigState { ... }  // return type of useAgentConfig
interface PanelProps { ... }        // shared props for all panel components
```

## UX Improvements

- **Loading skeletons** — `Skeleton` component from `components/ui/skeleton.tsx` shown during initial data fetch and provider switch
- **Live count badges** — category item counts update after create/delete without full refetch
- **Unsaved indicator** — amber dot on category + "Unsaved" badge in editor when content differs from saved state
- **Empty states** — per-category guidance text (e.g. "No skills configured. Skills are reusable knowledge packages...")
- **Contextual add** — `+ Add New` opens the appropriate create flow for the selected category
- **Provider status dots** — green dot on configured providers, muted on unconfigured
- **Immediate settings** — model/effort/permissions save on change, no explicit save button
- **Error feedback** — inline per-panel errors, not a single global error bar

## Migration

1. Create `widgets/agents/` with all new files
2. Replace `components/agents/AgentsDashboard.tsx` with a re-export from `@widgets/agents`
3. No changes needed to `App.tsx` imports — the re-export preserves the interface
4. Delete the old monolith once the new widget is verified working

## Out of Scope

- Drag-to-reorder for hooks/rules/MCP servers (future enhancement)
- Keyboard navigation between categories (future enhancement)
- Undo/redo in the editor (future enhancement)
- Rich markdown preview for instructions (future enhancement)
