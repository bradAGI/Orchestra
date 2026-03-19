import { tool } from 'ai'
import { z } from 'zod'
import type { BackendConfig } from '@/lib/orchestra-client'
import {
  executeUnsandbox,
  fetchUnsandboxStatus,
  fetchUnsandboxSessions,
} from '@/lib/orchestra-client'

/**
 * Creates code execution tools powered by the Unsandbox integration.
 * Enables the embedded agent to run code snippets in a sandboxed environment.
 */
export function createCodeExecutionTools(config: BackendConfig) {
  return {
    execute_code: tool({
      description: 'Execute a code snippet in the Unsandbox sandboxed environment. Supports Python, JavaScript, bash, and other languages. Returns stdout, stderr, and execution status.',
      inputSchema: z.object({
        language: z.string().describe('Programming language (e.g. "python", "javascript", "bash", "go", "rust")'),
        code: z.string().describe('Source code to execute'),
        network: z.enum(['none', 'semitrusted', 'trusted']).optional().default('semitrusted').describe('Network access level for the sandbox'),
      }),
      execute: async (params) => {
        // Check if Unsandbox is configured first
        const status = await fetchUnsandboxStatus(config)
        if (!status.configured) {
          return {
            success: false,
            error: 'Unsandbox is not configured. Please set up Unsandbox API keys in Settings > Integrations.',
          }
        }
        if (status.valid === false) {
          return {
            success: false,
            error: `Unsandbox configuration is invalid: ${status.error || 'unknown error'}`,
          }
        }

        const result = await executeUnsandbox(config, params.language, params.code, params.network)
        return {
          success: result.status === 'success' || result.status === 'completed',
          status: result.status,
          output: result.output || '(no output)',
          error: result.error || '',
          job_id: result.job_id,
        }
      },
    }),

    check_sandbox_status: tool({
      description: 'Check whether the Unsandbox code execution environment is configured and available.',
      inputSchema: z.object({}),
      execute: async () => {
        const status = await fetchUnsandboxStatus(config)
        return { status }
      },
    }),

    list_sandbox_sessions: tool({
      description: 'List recent Unsandbox execution sessions.',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await fetchUnsandboxSessions(config)
        return { sessions: result.sessions, count: result.sessions.length }
      },
    }),
  }
}
