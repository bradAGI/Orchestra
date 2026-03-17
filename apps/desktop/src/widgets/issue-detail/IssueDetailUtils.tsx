import { Activity, AlertCircle, CheckCircle2, Code, Database, File, FileText, Layers, Play, Rows, Terminal, Wrench } from 'lucide-react'

import type { TimelineItem } from '@/components/app-shell/types'

export type DiffFile = {
  path: string
  content: string
}

export type IssueHook = {
  id: string
  label: string
  description: string
}

export type PlanItem = {
  text: string
  done: boolean
}

export const ISSUE_HOOKS: IssueHook[] = [
  { id: 'after_create', label: 'Workspace Setup', description: 'Provisioning environment and dependencies' },
  { id: 'before_run', label: 'Pre-run Hook', description: 'Preparing context for agent execution' },
  { id: 'after_run', label: 'Post-run Hook', description: 'Capturing artifacts and cleaning up' },
]

function asEventData(event: TimelineItem): Record<string, unknown> {
  return (event.data && typeof event.data === 'object') ? (event.data as Record<string, unknown>) : {}
}

export function parseDiff(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = []
  const lines = rawDiff.split('\n')
  let currentFile: string | null = null
  let currentContent: string[] = []

  lines.forEach((line) => {
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files.push({ path: currentFile, content: currentContent.join('\n') })
      }
      const match = line.match(/b\/(.+)$/)
      currentFile = match ? match[1] : 'unknown'
      currentContent = [line]
    } else if (currentFile) {
      currentContent.push(line)
    }
  })

  if (currentFile) {
    files.push({ path: currentFile, content: currentContent.join('\n') })
  }

  return files
}

export function extractHookOutputs(timeline: TimelineItem[], issueId: string, issueIdentifier: string): Record<string, string> {
  const relevant = timeline.filter((event) => {
    const data = asEventData(event)
    return data.issue_id === issueId || data.issue_identifier === issueIdentifier
  })
  const outputs: Record<string, string> = {}
  relevant.forEach((event) => {
    const data = asEventData(event)
    if (event.type === 'HOOK_COMPLETED' || event.type === 'HOOK_FAILED') {
      const type = typeof data.hook_type === 'string' ? data.hook_type : ''
      const output = typeof data.output === 'string' ? data.output : ''
      if (type && output) {
        outputs[type] = output
      }
    }
  })
  return outputs
}

export function getHookStatus(timeline: TimelineItem[], issueId: string, issueIdentifier: string, type: string) {
  const relevant = timeline.filter((event) => {
    const data = asEventData(event)
    return data.issue_id === issueId || data.issue_identifier === issueIdentifier
  })
  const failed = relevant.find((event) => event.type === 'HOOK_FAILED' && asEventData(event).hook_type === type)
  if (failed) return 'failed'
  const completed = relevant.find((event) => event.type === 'HOOK_COMPLETED' && asEventData(event).hook_type === type)
  if (completed) return 'completed'
  const started = relevant.find((event) => event.type === 'HOOK_STARTED' && asEventData(event).hook_type === type)
  if (started) return 'active'
  return 'pending'
}

export function getEventIcon(kind: string) {
  const normalizedKind = kind.toLowerCase()
  if (normalizedKind.includes('started') || normalizedKind.includes('init')) {
    return <Play className="h-3 w-3 text-emerald-500" fill="currentColor" />
  }
  if (normalizedKind.includes('failed') || normalizedKind.includes('error')) {
    return <AlertCircle className="h-3 w-3 text-red-500" />
  }
  if (normalizedKind.includes('completed') || normalizedKind.includes('success')) {
    return <CheckCircle2 className="h-3 w-3 text-primary" />
  }
  if (normalizedKind.includes('tool')) {
    return <Wrench className="h-3 w-3 text-amber-500" />
  }
  if (normalizedKind.includes('hook')) {
    return <Rows className="h-3 w-3 text-blue-400" />
  }
  return <Activity size={12} className="text-muted-foreground/40" />
}

export function getFileIcon(path: string, active: boolean) {
  const ext = path.split('.').pop()?.toLowerCase()
  const color = active ? 'text-primary' : 'text-muted-foreground/40 group-hover:text-muted-foreground/60'

  switch (ext) {
    case 'md':
      return <FileText size={14} className={color} />
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <Code size={14} className={active ? 'text-blue-400' : 'text-blue-400/40 group-hover:text-blue-400/60'} />
    case 'json':
      return <Database size={14} className={active ? 'text-amber-400' : 'text-amber-400/40 group-hover:text-amber-400/60'} />
    case 'sh':
      return <Terminal size={14} className={active ? 'text-emerald-400' : 'text-emerald-400/40 group-hover:text-emerald-400/60'} />
    case 'css':
      return <Layers size={14} className={active ? 'text-pink-400' : 'text-pink-400/40 group-hover:text-pink-400/60'} />
    default:
      return <File size={14} className={color} />
  }
}

export function extractPlanFromText(text: string): PlanItem[] {
  return parsePlanItemsFromText(text)
}

function parsePlanItemsFromText(text: string): PlanItem[] {
  if (!text) return []

  // Strip code blocks (``` ... ```) so we don't parse example checkboxes from templates
  const stripped = text.replace(/```[\s\S]*?```/g, '')

  const lines = stripped.split('\n')
  const checkboxItems = lines
    .map((line) => line.match(/^\s*[-*+]\s*\[\s*([xX ])\s*\]\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => !!match)
    .map((match) => ({
      done: match[1].toLowerCase() === 'x',
      text: match[2].trim(),
    }))
    .filter((item) => item.text.length > 0 && item.text !== 'step one' && item.text !== 'step two' && item.text !== 'step three')

  if (checkboxItems.length > 0) {
    return checkboxItems
  }

  return []
}

function collectCandidateMessages(timeline: TimelineItem[], issueId: string, issueIdentifier: string): string[] {
  const relevant = timeline.filter((item) => {
    const eventIssueID = typeof item.data?.issue_id === 'string' ? item.data.issue_id : ''
    const eventIssueIdentifier = typeof item.data?.issue_identifier === 'string' ? item.data.issue_identifier : ''
    if (!eventIssueID && !eventIssueIdentifier) return true
    return eventIssueID === issueId || eventIssueIdentifier === issueIdentifier
  })

  const messages: string[] = []
  for (const event of relevant) {
    if (event.type === 'thought') {
      const directMessage = typeof event.data?.message === 'string' ? event.data.message : ''
      if (directMessage) {
        messages.push(directMessage)
      }
      continue
    }

    if (event.type !== 'RUN_EVENT') {
      continue
    }

    const runEvent = event.data?.event
    if (!runEvent || typeof runEvent !== 'object') {
      continue
    }

    const kind = typeof (runEvent as Record<string, unknown>).kind === 'string' ? (runEvent as Record<string, string>).kind : ''
    const msg = typeof (runEvent as Record<string, unknown>).message === 'string' ? (runEvent as Record<string, string>).message : ''
    if (!msg) {
      continue
    }

    // Skip PTY noise and example plan items from WORKFLOW.md
    if (kind === 'pty' || kind === 'stderr') continue
    if (msg.includes('step one') && msg.includes('step two')) continue

    const message = msg
    const normalizedKind = kind.toLowerCase()
    if (
      normalizedKind.includes('thought') ||
      normalizedKind.includes('plan') ||
      normalizedKind.includes('reason') ||
      message.includes('- [ ]') ||
      message.includes('- [x]') ||
      /^\s*\d+\.\s+/m.test(message)
    ) {
      messages.push(message)
    }
  }

  return messages
}

export function extractOperationalPlanItems(timeline: TimelineItem[], issueId: string, issueIdentifier: string, description: string): PlanItem[] {
  const messages = collectCandidateMessages(timeline, issueId, issueIdentifier)

  for (const message of messages) {
    const items = parsePlanItemsFromText(message)
    if (items.length > 0) {
      return items
    }
  }

  return parsePlanItemsFromText(description)
}
