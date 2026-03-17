import type { LucideIcon } from 'lucide-react'

/** A single event entry displayed in the activity timeline. */
export type TimelineItem = {
  /** Event type identifier (e.g. "RUN_STARTED", "HOOK_COMPLETED"). */
  type: string
  /** ISO-8601 timestamp when the event occurred. */
  at: string
  /** Arbitrary event payload data. */
  data: Record<string, unknown>
}

/** Descriptor for a navigation entry in the application sidebar. */
export type SidebarItem = {
  /** Unique section identifier (matches SectionID values). */
  id: string
  /** Short display label shown in the sidebar. */
  label: string
  /** Tooltip or subtitle description for the section. */
  description: string
  /** Lucide icon component rendered alongside the label. */
  icon: LucideIcon
}

/** Available time-range filters for dashboard views. */
export const periodFilters = ['Today', 'Week', 'Month'] as const
