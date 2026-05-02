import { tool } from 'ai'
import { z } from 'zod'

type SchedulerCallbacks = {
  scheduleReminder: (message: string, delayMinutes: number) => string
  scheduleAction: (toolName: string, args: Record<string, unknown>, delayMinutes: number) => string
  cancel: (id: string) => void
  activeItems: { id: string; type: string; message?: string; toolName?: string; firesAt: Date }[]
}

/**
 * Creates scheduler tools that allow the agent to set reminders and
 * schedule deferred tool executions.
 */
export function createSchedulerTools(scheduler: SchedulerCallbacks) {
  return {
    schedule_reminder: tool({
      description:
        'Schedule a reminder message to appear in chat after a delay. ' +
        'Use when the user asks to be reminded of something (e.g. "remind me to check analytics in 30 minutes"). ' +
        'Delay range: 0.5 to 1440 minutes. Returns the schedule ID and fire time.',
      inputSchema: z.object({
        message: z.string().describe('The reminder message to display'),
        delay_minutes: z.number().min(0.5).max(1440).describe('Delay in minutes before the reminder fires'),
      }),
      execute: async (params) => {
        const id = scheduler.scheduleReminder(params.message, params.delay_minutes)
        return {
          success: true,
          id,
          message: params.message,
          fires_at: new Date(Date.now() + params.delay_minutes * 60_000).toISOString(),
        }
      },
    }),

    schedule_action: tool({
      description:
        'Schedule a tool execution to run after a delay. ' +
        'Use when the user asks to run something later (e.g. "create a status report in 1 hour"). ' +
        'Provide the tool_name and its arguments. Returns the schedule ID and fire time.',
      inputSchema: z.object({
        tool_name: z.string().describe('Name of the tool to execute'),
        args: z.record(z.string(), z.unknown()).describe('Arguments to pass to the tool'),
        delay_minutes: z.number().min(0.5).max(1440).describe('Delay in minutes'),
      }),
      execute: async (params) => {
        const id = scheduler.scheduleAction(params.tool_name, params.args, params.delay_minutes)
        return {
          success: true,
          id,
          tool_name: params.tool_name,
          fires_at: new Date(Date.now() + params.delay_minutes * 60_000).toISOString(),
        }
      },
    }),

    cancel_schedule: tool({
      description:
        'Cancel a pending scheduled reminder or action by its ID. ' +
        'Use when the user asks to cancel a reminder or scheduled action. ' +
        'Get the ID from list_schedules or from the original schedule response.',
      inputSchema: z.object({
        id: z.string().describe('The schedule ID to cancel'),
      }),
      execute: async (params) => {
        scheduler.cancel(params.id)
        return { success: true, cancelled: params.id }
      },
    }),

    list_schedules: tool({
      description:
        'List all active (pending) scheduled reminders and actions. ' +
        'Use when the user asks what is scheduled or pending.',
      inputSchema: z.object({}),
      execute: async () => {
        const items = scheduler.activeItems.map((i) => ({
          id: i.id,
          type: i.type,
          message: i.message,
          tool_name: i.toolName,
          fires_at: i.firesAt.toISOString(),
        }))
        return { schedules: items, count: items.length }
      },
    }),
  }
}
