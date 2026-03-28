import { tool } from 'ai'
import { z } from 'zod'
import type { BackendConfig } from '@/lib/orchestra-client'
import {
  fetchIssues,
  createIssue,
  updateIssue,
  deleteIssue,
  fetchState,
  fetchProjects,
  stopIssueSession,
} from '@/lib/orchestra-client'
import type { JsonRenderSpec } from '../lib/types'

/** Notify the host app that orchestra data was mutated so it can refresh the board. */
function notifyDataChanged() {
  window.dispatchEvent(new Event('orchestra-data-changed'))
}

/** Normalize state names to match what the Kanban board expects (title case). */
function normalizeState(state: string): string {
  const map: Record<string, string> = {
    'backlog': 'Backlog',
    'todo': 'Todo',
    'to do': 'Todo',
    'in progress': 'In Progress',
    'in_progress': 'In Progress',
    'review': 'Review',
    'done': 'Done',
    'cancelled': 'Cancelled',
    'closed': 'Closed',
  }
  return map[state.toLowerCase()] ?? state
}

/**
 * Creates the set of Orchestra API tools that the embedded agent can invoke.
 * Each tool wraps an orchestra-client function and exposes it via the AI SDK
 * tool interface with a zod input schema.
 */
export function createOrchestraTools(config: BackendConfig) {
  return {
    list_issues: tool({
      description:
        'List issues, optionally filtered by state, project, or assignee. ' +
        'Use when the user asks to show, list, or view issues. ' +
        'Filters are optional — omit them to return all issues. ' +
        'Returns an array of issue objects with identifier, title, state, and assignee.',
      inputSchema: z.object({
        state: z.string().optional().describe('Filter by issue state (e.g. "open", "in progress", "done")'),
        project_id: z.string().optional().describe('Filter by project ID'),
        assignee_id: z.string().optional().describe('Filter by assignee ID'),
      }),
      execute: async (params) => {
        const issues = await fetchIssues(
          config,
          params.state ? [params.state] : undefined,
          params.project_id,
          params.assignee_id,
        )
        return { issues }
      },
    }),

    create_issue: tool({
      description:
        'Create a new issue with title, description, state, project, and optional provider assignment. ' +
        'Use when the user asks to create, add, or file a new issue, task, or ticket. ' +
        'IMPORTANT: You MUST always provide both a title AND a description. Never create an issue with an empty description. ' +
        'If the user only gives a title, write a clear description yourself based on context. ' +
        'Always ask the user which project to assign or call list_projects/find_projects first to resolve the project_id. ' +
        'Defaults to state="Backlog". Valid states: Backlog, Todo, In Progress, Review, Done. Returns the created issue with its identifier.',
      inputSchema: z.object({
        title: z.string().min(1).describe('Title of the issue — concise and descriptive'),
        description: z.string().min(1).describe('Description of what needs to be done — REQUIRED, never leave empty'),
        state: z.string().optional().default('Backlog').describe('Initial state: Backlog, Todo, In Progress, Review, Done'),
        project_id: z.string().describe('Project ID to assign the issue to. Call list_projects or find_projects first to get available IDs.'),
        provider: z.string().optional().describe('Agent provider to assign (e.g. "claude", "openai")'),
      }),
      execute: async (params) => {
        const issue = await createIssue(config, {
          title: params.title,
          description: params.description,
          state: normalizeState(params.state),
          assignee_id: params.provider ? 'agent-' + params.provider : '',
          project_id: params.project_id,
        })
        notifyDataChanged()
        return { issue }
      },
    }),

    update_issue: tool({
      description:
        'Update fields on an existing issue by its identifier (e.g. "ISS-1"). ' +
        'Use when the user asks to change, update, edit, or move an issue. ' +
        'Only send the fields being changed — omitted fields are left unchanged. ' +
        'Returns the updated issue object.',
      inputSchema: z.object({
        identifier: z.string().describe('The issue identifier (e.g. "ISS-1")'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        state: z.string().optional().describe('New state'),
        assignee_id: z.string().optional().describe('New assignee ID'),
        provider: z.string().optional().describe('Agent provider'),
        project_id: z.string().optional().describe('Project ID to assign'),
      }),
      execute: async (params) => {
        const { identifier, ...updates } = params
        if (updates.state) updates.state = normalizeState(updates.state)
        const issue = await updateIssue(config, identifier, updates)
        notifyDataChanged()
        return { issue }
      },
    }),

    delete_issue: tool({
      description:
        'Permanently delete an issue by its identifier. Cannot be undone. ' +
        'Use when the user explicitly asks to delete or remove an issue. ' +
        'CONFIRM BEFORE CALLING — state what will be deleted and wait for "yes". ' +
        'Returns {success: true}.',
      inputSchema: z.object({
        identifier: z.string().describe('The issue identifier to delete'),
      }),
      execute: async (params) => {
        await deleteIssue(config, params.identifier)
        notifyDataChanged()
        return { success: true }
      },
    }),

    get_orchestrator_state: tool({
      description:
        'Get the full orchestrator runtime snapshot: all issues, running/queued/retrying sessions, and agent status. ' +
        'Use when the user asks for system status, what is running, or a runtime overview. ' +
        'Returns a large object — summarize key points for the user.',
      inputSchema: z.object({}),
      execute: async () => {
        const state = await fetchState(config)
        return { state }
      },
    }),

    dispatch_agent: tool({
      description:
        'Assign an agent provider to an issue WITHOUT changing its state. ' +
        'Use when the user asks to assign, attach, or set an agent on an issue. ' +
        'Does NOT move the issue to In Progress — only the user can change state. ' +
        'Returns the updated issue object.',
      inputSchema: z.object({
        identifier: z.string().describe('The issue identifier to assign'),
        provider: z.string().describe('Agent provider to assign (e.g. "claude", "codex", "gemini")'),
      }),
      execute: async (params) => {
        const updates: Record<string, unknown> = {}
        if (params.provider) {
          updates.provider = params.provider
          updates.assignee_id = `agent-${params.provider}`
        }
        const issue = await updateIssue(config, params.identifier, updates)
        notifyDataChanged()
        return { issue }
      },
    }),

    stop_session: tool({
      description:
        'Stop the active agent session for an issue. ' +
        'Use when the user asks to stop, kill, or cancel a running session. ' +
        'CONFIRM BEFORE CALLING — state which session will be stopped and wait for "yes". ' +
        'Returns {success: true}.',
      inputSchema: z.object({
        identifier: z.string().describe('The issue identifier whose session to stop'),
        provider: z.string().optional().describe('Provider of the session to stop'),
      }),
      execute: async (params) => {
        await stopIssueSession(config, params.identifier, params.provider)
        notifyDataChanged()
        return { success: true }
      },
    }),

    list_projects: tool({
      description:
        'List all projects in the orchestrator. ' +
        'Use when the user asks to list, show, or view projects. ' +
        'Returns an array of project objects with id, name, and metadata.',
      inputSchema: z.object({}),
      execute: async () => {
        const projects = await fetchProjects(config)
        return { projects }
      },
    }),

    render_ui: tool({
      description:
        'Render structured data visually using a JSON render spec. ' +
        'Use instead of plain text when the response benefits from layout: tables, metrics, cards, code blocks, key-value pairs, or action buttons. ' +
        'Components: Card, Stack, Divider, Metric, Table, Badge, CodeBlock, KeyValue, Button, ButtonGroup, Alert, Progress. ' +
        'Actions: navigate, send_chat, copy_to_clipboard. ' +
        'See system prompt for full spec structure and component props.',
      inputSchema: z.object({
        spec: z.object({
          root: z.string().describe('The key of the root element'),
          elements: z.record(z.string(), z.object({
            type: z.string().describe('The element type (e.g. "card", "text", "list")'),
            props: z.record(z.string(), z.unknown()).describe('Properties for the element'),
            children: z.array(z.string()).optional().describe('Keys of child elements'),
          })).describe('Map of element keys to their definitions'),
        }).describe('The JSON render specification'),
      }),
      execute: async (params) => {
        return { type: 'json_render' as const, spec: params.spec as JsonRenderSpec }
      },
    }),
  }
}
