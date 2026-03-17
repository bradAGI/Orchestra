import type { LucideIcon } from 'lucide-react'

/** A single event entry displayed in the activity timeline. */
export type TimelineItem = {
  type: string
  at: string
  data: Record<string, unknown>
}

/** Descriptor for a navigation entry in the application sidebar. */
export type SidebarItem = {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

/** Available time-range filters for dashboard views. */
export const periodFilters = ['Today', 'Week', 'Month'] as const
