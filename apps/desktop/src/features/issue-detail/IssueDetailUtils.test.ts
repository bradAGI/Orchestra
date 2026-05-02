import { describe, expect, it } from 'vitest'

import type { TimelineItem } from '@layout/types'

import { extractOperationalPlanItems } from './IssueDetailUtils'

function runEvent(issueId: string, issueIdentifier: string, kind: string, message: string): TimelineItem {
  return {
    type: 'RUN_EVENT',
    at: '2026-03-13T00:00:00Z',
    data: {
      issue_id: issueId,
      issue_identifier: issueIdentifier,
      event: { kind, message },
    },
  }
}

describe('extractOperationalPlanItems', () => {
  it('parses markdown checkbox items from run events', () => {
    const timeline: TimelineItem[] = [
      runEvent(
        'issue-1',
        'OPS-1',
        'thought',
        '### Operational Plan\n- [x] Inspect current flow\n- [ ] Implement parser\n- [ ] Verify end to end',
      ),
    ]

    const items = extractOperationalPlanItems(timeline, 'issue-1', 'OPS-1', '')

    expect(items).toEqual([
      { text: 'Inspect current flow', done: true },
      { text: 'Implement parser', done: false },
      { text: 'Verify end to end', done: false },
    ])
  })

  it('returns empty for numbered lists without checkboxes', () => {
    const timeline: TimelineItem[] = [
      runEvent(
        'issue-1',
        'OPS-1',
        'turn.message',
        'Plan:\n1. Analyze task details\n2. Implement changes\n3. Run validation',
      ),
    ]

    const items = extractOperationalPlanItems(timeline, 'issue-1', 'OPS-1', '')
    expect(items).toEqual([])
  })

  it('returns empty when no checkbox items found', () => {
    const timeline: TimelineItem[] = [runEvent('issue-1', 'OPS-1', 'tool_call', 'using Read tool')]

    const items = extractOperationalPlanItems(timeline, 'issue-1', 'OPS-1', 'Just a plain description')
    expect(items).toEqual([])
  })

  it('ignores plan events from other issues', () => {
    const timeline: TimelineItem[] = [
      runEvent('issue-2', 'OPS-2', 'thought', '- [x] wrong issue item'),
      runEvent('issue-1', 'OPS-1', 'thought', '- [ ] right issue item'),
    ]

    const items = extractOperationalPlanItems(timeline, 'issue-1', 'OPS-1', '')

    expect(items).toEqual([{ text: 'right issue item', done: false }])
  })
})
