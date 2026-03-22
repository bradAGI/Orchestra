import type { PlanItem } from './IssueDetailUtils'

const cache = new Map<string, PlanItem[]>()

export function getCachedPlan(identifier: string): PlanItem[] {
  return cache.get(identifier) || []
}

export function setCachedPlan(identifier: string, items: PlanItem[]) {
  if (items.length > 0) cache.set(identifier, items)
}

export function clearCachedPlan(identifier: string) {
  cache.delete(identifier)
}
