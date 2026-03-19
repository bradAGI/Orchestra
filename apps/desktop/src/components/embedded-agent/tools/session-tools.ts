import { tool } from 'ai'
import { z } from 'zod'
import type { BackendConfig } from '@/lib/orchestra-client'
import {
  fetchSessions,
  fetchSessionDetail,
  fetchIssueHistory,
  fetchIssueLogs,
  fetchIssueDetail,
} from '@/lib/orchestra-client'

/**
 * Creates session log and summarization tools for the embedded agent.
 * Enables fetching session history, raw logs, and issue event timelines.
 */
export function createSessionTools(config: BackendConfig) {
  return {
    get_session_logs: tool({
      description: 'Get the raw event timeline and logs for an issue. Returns the event history with kinds, messages, timestamps, and token usage.',
      inputSchema: z.object({
        issue_identifier: z.string().describe('The issue identifier (e.g. "ISS-1")'),
      }),
      execute: async (params) => {
        const [history, detail] = await Promise.all([
          fetchIssueHistory(config, params.issue_identifier),
          fetchIssueDetail(config, params.issue_identifier),
        ])
        return {
          issue: {
            identifier: detail.identifier || detail.issue_identifier,
            title: detail.title,
            state: detail.state,
          },
          events: history,
          event_count: history.length,
        }
      },
    }),

    get_raw_logs: tool({
      description: 'Get the raw text logs for an issue session. Useful for debugging or seeing exact agent output.',
      inputSchema: z.object({
        issue_identifier: z.string().describe('The issue identifier (e.g. "ISS-1")'),
        provider: z.string().optional().describe('Optional provider filter'),
      }),
      execute: async (params) => {
        const logs = await fetchIssueLogs(config, params.issue_identifier, params.provider)
        return { logs: logs || '(no logs available)' }
      },
    }),

    summarize_session: tool({
      description: 'Summarize what happened in an issue session. Fetches the event history and provides a structured summary of actions taken, tools used, token consumption, and outcome.',
      inputSchema: z.object({
        issue_identifier: z.string().describe('The issue identifier (e.g. "ISS-1")'),
      }),
      execute: async (params) => {
        const [history, detail] = await Promise.all([
          fetchIssueHistory(config, params.issue_identifier),
          fetchIssueDetail(config, params.issue_identifier),
        ])

        // Aggregate stats from events
        let totalInputTokens = 0
        let totalOutputTokens = 0
        const eventKinds = new Map<string, number>()
        const providers = new Set<string>()

        for (const event of history) {
          totalInputTokens += event.input_tokens || 0
          totalOutputTokens += event.output_tokens || 0
          eventKinds.set(event.kind, (eventKinds.get(event.kind) || 0) + 1)
          if (event.provider) providers.add(event.provider)
        }

        return {
          issue: {
            identifier: detail.identifier || detail.issue_identifier,
            title: detail.title,
            state: detail.state,
          },
          summary: {
            total_events: history.length,
            event_breakdown: Object.fromEntries(eventKinds),
            providers_used: Array.from(providers),
            tokens: {
              input: totalInputTokens,
              output: totalOutputTokens,
              total: totalInputTokens + totalOutputTokens,
            },
            first_event: history.length > 0 ? history[0].timestamp : null,
            last_event: history.length > 0 ? history[history.length - 1].timestamp : null,
          },
          events: history.slice(-10), // Last 10 events for context
        }
      },
    }),

    list_sessions: tool({
      description: 'List all agent sessions, optionally filtered by project. Shows session summaries with status and timing.',
      inputSchema: z.object({
        project_id: z.string().optional().describe('Optional project ID to filter sessions'),
      }),
      execute: async (params) => {
        const sessions = await fetchSessions(config, params.project_id)
        return { sessions, count: sessions.length }
      },
    }),

    get_session_detail: tool({
      description: 'Get full details for a specific agent session including all events.',
      inputSchema: z.object({
        session_id: z.string().describe('The session UUID'),
      }),
      execute: async (params) => {
        const detail = await fetchSessionDetail(config, params.session_id)
        return { session: detail }
      },
    }),
  }
}
