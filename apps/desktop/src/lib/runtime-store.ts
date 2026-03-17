import type { SnapshotPayload } from '@/lib/orchestra-types'
import type { TimelineItem } from '@/components/app-shell/types'

/**
 * Produces a JSON string fingerprint of a snapshot for change detection.
 * @param snapshot - The snapshot to fingerprint.
 * @returns A JSON string representation.
 */
function snapshotFingerprint(snapshot: SnapshotPayload): string {
  return JSON.stringify(snapshot)
}

/**
 * Returns the next snapshot, or the previous reference if content is unchanged,
 * to avoid unnecessary re-renders.
 */
export function applySnapshotUpdate(previous: SnapshotPayload | null, next: SnapshotPayload): SnapshotPayload {
  if (!previous) {
    return next
  }

  if (snapshotFingerprint(previous) === snapshotFingerprint(next)) {
    return previous
  }

  return next
}

/**
 * Prepends a timeline event to the list, deduplicating against the most recent
 * entry and capping the list at {@link maxItems}.
 */
export function appendTimelineEvent(previous: TimelineItem[], next: TimelineItem, maxItems = 50): TimelineItem[] {
  const head = previous[0]
  if (head && head.type === next.type && head.at === next.at && JSON.stringify(head.data) === JSON.stringify(next.data)) {
    return previous
  }

  return [next, ...previous].slice(0, maxItems)
}
