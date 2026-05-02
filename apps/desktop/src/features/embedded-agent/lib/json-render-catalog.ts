import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react'
import { z } from 'zod'

export const agentCatalog = defineCatalog(schema, {
  components: {
    // ── Layout ──────────────────────────────────────────────
    Card: {
      props: z.object({
        title: z.string(),
        description: z.string().optional(),
        padding: z.enum(['none', 'sm', 'md', 'lg']).optional(),
      }),
      slots: ['default'],
      description: 'A card container with optional title and description.',
    },
    Stack: {
      props: z.object({
        direction: z.enum(['horizontal', 'vertical']).optional(),
        gap: z.enum(['none', 'sm', 'md', 'lg']).optional(),
        align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
      }),
      slots: ['default'],
      description: 'Flex container that stacks children horizontally or vertically.',
    },
    Divider: {
      props: z.object({
        label: z.string().optional(),
      }),
      slots: [],
      description: 'A horizontal divider with optional label.',
    },

    // ── Data ────────────────────────────────────────────────
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        format: z.enum(['number', 'currency', 'percent', 'bytes']).optional(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
        trendValue: z.string().optional(),
      }),
      slots: [],
      description: 'Displays a single metric with label, value, and optional trend indicator.',
    },
    Table: {
      props: z.object({
        columns: z.array(z.object({
          key: z.string(),
          label: z.string(),
          align: z.enum(['left', 'center', 'right']).optional(),
        })),
        rows: z.array(z.record(z.string(), z.unknown())),
        striped: z.boolean().optional(),
      }),
      slots: [],
      description: 'A data table with columns and rows.',
    },
    Badge: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['default', 'success', 'warning', 'error', 'info']).optional(),
      }),
      slots: [],
      description: 'A small status badge with color variants.',
    },
    CodeBlock: {
      props: z.object({
        code: z.string(),
        language: z.string().optional(),
        title: z.string().optional(),
      }),
      slots: [],
      description: 'Displays a block of code with optional syntax label.',
    },
    KeyValue: {
      props: z.object({
        pairs: z.array(z.object({
          key: z.string(),
          value: z.union([z.string(), z.number()]),
        })),
      }),
      slots: [],
      description: 'Displays a list of key-value pairs.',
    },

    // ── Interactive ─────────────────────────────────────────
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['default', 'primary', 'secondary', 'destructive', 'ghost']).optional(),
        action: z.string(),
        params: z.record(z.string(), z.unknown()).optional(),
      }),
      slots: [],
      description: 'A clickable button that triggers an action.',
    },
    ButtonGroup: {
      props: z.object({
        direction: z.enum(['horizontal', 'vertical']).optional(),
      }),
      slots: ['default'],
      description: 'Groups buttons together.',
    },

    // ── Feedback ────────────────────────────────────────────
    Alert: {
      props: z.object({
        message: z.string(),
        variant: z.enum(['info', 'success', 'warning', 'error']).optional(),
        title: z.string().optional(),
      }),
      slots: [],
      description: 'An alert banner with contextual styling.',
    },
    Progress: {
      props: z.object({
        value: z.number(),
        max: z.number().optional(),
        label: z.string().optional(),
      }),
      slots: [],
      description: 'A progress bar with label.',
    },
  },

  actions: {
    navigate: {
      params: z.object({
        section: z.string(),
        id: z.string().optional(),
      }),
      description: 'Navigate to a section of the app.',
    },
    send_chat: {
      params: z.object({
        message: z.string(),
      }),
      description: 'Send a message in the chat.',
    },
    copy_to_clipboard: {
      params: z.object({
        text: z.string(),
      }),
      description: 'Copy text to the clipboard.',
    },
  },
})

export type AgentCatalog = typeof agentCatalog
