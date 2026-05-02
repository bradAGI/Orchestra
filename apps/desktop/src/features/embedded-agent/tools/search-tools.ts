import { tool } from 'ai'
import { z } from 'zod'
import type { BackendConfig } from '@core/api/client'
import {
  fetchIssues,
  searchIssues,
  fetchSessions,
  fetchDocs,
  fetchDocContent,
  fetchWarehouseStats,
  fetchProjects,
  fetchProjectStats,
} from '@core/api/client'

/**
 * Creates cross-entity search tools for the embedded agent.
 * Enables searching across issues, sessions, projects, and documentation.
 */
export function createSearchTools(config: BackendConfig) {
  return {
    search_issues: tool({
      description:
        'Search issues by text query, or filter by state, project, and assignee. ' +
        'Use when the user asks to find, search, or filter issues (e.g. "find all failed issues", "show open issues for project X"). ' +
        'Provide query for free-text search, or state/project_id/assignee_id for structured filtering. ' +
        'Returns matched issue objects with identifier, title, and state.',
      inputSchema: z.object({
        query: z.string().optional().describe('Free-text search query'),
        state: z.string().optional().describe('Filter by state (e.g. "open", "in progress", "done", "failed")'),
        project_id: z.string().optional().describe('Filter by project ID'),
        assignee_id: z.string().optional().describe('Filter by assignee ID'),
      }),
      execute: async (params) => {
        if (params.query) {
          const results = await searchIssues(config, params.query)
          return { issues: results, count: results.length }
        }
        const results = await fetchIssues(
          config,
          params.state ? [params.state] : undefined,
          params.project_id,
          params.assignee_id,
        )
        return { issues: results, count: results.length }
      },
    }),

    search_sessions: tool({
      description:
        'Search session history, optionally filtered by project. ' +
        'Use when the user asks to search or find sessions. ' +
        'Returns session summaries with status and timing.',
      inputSchema: z.object({
        project_id: z.string().optional().describe('Filter by project ID'),
      }),
      execute: async (params) => {
        const sessions = await fetchSessions(config, params.project_id)
        return { sessions, count: sessions.length }
      },
    }),

    search_docs: tool({
      description:
        'Search documentation by keyword, or retrieve a specific doc by path. ' +
        'Use when the user asks to search docs or find documentation. ' +
        'Provide query to filter doc titles, or doc_path to fetch full content. ' +
        'Without parameters, lists all available docs.',
      inputSchema: z.object({
        query: z.string().optional().describe('Search term to filter doc titles'),
        doc_path: z.string().optional().describe('Specific doc path to retrieve full content'),
      }),
      execute: async (params) => {
        if (params.doc_path) {
          const content = await fetchDocContent(config, params.doc_path)
          return { path: params.doc_path, content }
        }
        const docs = await fetchDocs(config)
        if (params.query) {
          const q = params.query.toLowerCase()
          const filtered = docs.filter((d) => {
            const name = (d.name || d.path || '').toLowerCase()
            return name.includes(q)
          })
          return { docs: filtered, count: filtered.length }
        }
        return { docs, count: docs.length }
      },
    }),

    get_warehouse_stats: tool({
      description:
        'Get platform-wide analytics: total tokens used, provider breakdown, and recent session stats. ' +
        'Use when the user asks about token usage, analytics, or platform metrics.',
      inputSchema: z.object({}),
      execute: async () => {
        const stats = await fetchWarehouseStats(config)
        return { stats }
      },
    }),

    get_project_stats: tool({
      description:
        'Get statistics for a specific project: session counts, token usage, and activity. ' +
        'Use when the user asks for project stats or metrics. ' +
        'Requires project_id — resolve via find_projects if the user gives a project name.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
      }),
      execute: async (params) => {
        const stats = await fetchProjectStats(config, params.project_id)
        return { stats }
      },
    }),

    find_projects: tool({
      description:
        'Search for projects by name. Use to resolve a project name to its ID before calling tools that require project_id. ' +
        'Returns matching project objects with id, name, and root_path. ' +
        'Without a query, returns all projects.',
      inputSchema: z.object({
        query: z.string().optional().describe('Search term to filter project names'),
      }),
      execute: async (params) => {
        const projects = await fetchProjects(config)
        if (params.query) {
          const q = params.query.toLowerCase()
          const filtered = projects.filter((p) => {
            const name = ((p as Record<string, unknown>).name as string || '').toLowerCase()
            const path = ((p as Record<string, unknown>).root_path as string || '').toLowerCase()
            return name.includes(q) || path.includes(q)
          })
          return { projects: filtered, count: filtered.length }
        }
        return { projects, count: projects.length }
      },
    }),
  }
}
