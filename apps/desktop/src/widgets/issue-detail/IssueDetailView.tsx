import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Brain, CheckCircle2, ChevronRight, FileText, GitPullRequest, Github, History, Info, Loader2, Pencil, Play, Terminal, Wrench, X, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Prism } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { BackendConfig, IssueUpdatePayload, IssueHistoryEntry } from '@/lib/orchestra-client'
import { fetchIssueHistory, fetchIssueDiff, fetchIssueLogs, createProjectGitHubPull, gitCommit, updateProjectGitHubIssue, fetchProjectGitBranches } from '@/lib/orchestra-client'
import type { SnapshotPayload } from '@/lib/orchestra-types'
import type { TimelineItem } from '@/components/app-shell/types'
import { AgentSelector, CustomDropdown, getAgentIcon } from '@/components/app-shell/shared/controls'
import type { IssueDetailResult } from './types'
import { extractOperationalPlanItems, extractPlanFromText, getEventIcon, parseDiff, type DiffFile, type PlanItem } from './IssueDetailUtils'

function extractIssueNumber(url: string): string {
  const match = url.match(/\/issues\/(\d+)/)
  return match ? match[1] : ''
}

function DescriptionEditor({ value, onChange, onBlur, theme }: {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  theme?: 'light' | 'dark'
}) {
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.selectionStart = textareaRef.current.value.length
    }
  }, [editing])

  if (editing) {
    return (
      <div className="flex-1 flex flex-col min-h-0 rounded-lg border border-primary/30 bg-muted/10 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/20 shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Editing Markdown</span>
          <button
            className="text-[9px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
            onClick={() => setEditing(false)}
          >
            Preview
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="w-full flex-1 bg-transparent text-sm text-foreground font-mono outline-none focus:outline-none placeholder:text-muted-foreground/15 leading-relaxed resize-none p-4"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => { onBlur(); setEditing(false) }}
          placeholder="Describe what this task should accomplish...&#10;&#10;Supports **Markdown** formatting."
        />
      </div>
    )
  }

  if (!value.trim()) {
    return (
      <button
        className="flex-1 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-text group"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-5 w-5 text-muted-foreground/15 group-hover:text-primary/30 transition-colors mb-2" />
        <span className="text-sm text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors">Click to add a description...</span>
      </button>
    )
  }

  return (
    <div
      className="flex-1 min-h-0 rounded-lg border border-transparent hover:border-border/30 cursor-text transition-all group/md relative overflow-auto"
      onClick={() => setEditing(true)}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover/md:opacity-100 transition-opacity">
        <div className="flex items-center gap-1 rounded-md bg-muted/80 backdrop-blur px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 border border-border/30">
          <Pencil className="h-2.5 w-2.5" />
          Edit
        </div>
      </div>
      <div className={`prose ${theme === 'dark' ? 'prose-invert' : ''} prose-sm max-w-none text-foreground/70 leading-relaxed
        prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight
        prose-h1:text-lg prose-h1:border-b prose-h1:border-border/20 prose-h1:pb-2 prose-h1:mb-3
        prose-h2:text-base prose-h2:mb-2
        prose-h3:text-sm prose-h3:mb-1
        prose-p:mb-2 prose-p:text-foreground/60
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground/80 prose-strong:font-bold
        prose-code:text-[12px] prose-code:font-mono prose-code:bg-muted/40 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:border prose-code:border-border/20 prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-border/20 prose-pre:rounded-lg
        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:text-foreground/60
        prose-li:marker:text-muted-foreground/30
        prose-blockquote:border-l-primary/30 prose-blockquote:text-muted-foreground/50 prose-blockquote:italic prose-blockquote:not-italic prose-blockquote:font-normal
        prose-hr:border-border/20
        prose-img:rounded-lg prose-img:border prose-img:border-border/20
        prose-table:text-sm prose-th:text-foreground/70 prose-td:text-foreground/50
      `}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      </div>
    </div>
  )
}

export function IssueDetailView({
  result,
  onUpdate,
  onStopSession,
  config,
  snapshot,
  timeline = [],
  availableAgents = [],
  theme,
}: {
  result: IssueDetailResult | null
  onUpdate?: (updates: IssueUpdatePayload) => Promise<void>
  onStopSession?: (provider?: string) => Promise<void>
  config: BackendConfig | null
  snapshot: SnapshotPayload | null
  timeline?: TimelineItem[]
  availableAgents?: string[]
  theme?: 'light' | 'dark'
}) {

  const typed = (result ?? {})
  const identifier = (typed.identifier as string) || (typed.issue_identifier as string) || ''
  const issueId = (typed.id as string) || (typed.issue_id as string) || ''
  const title = (typed.title as string) || 'No Title'
  const description = (typed.description as string) || ''
  const projectId = (typed.project_id as string) || ''
  const projectName = (typed.project_name as string) || ''
  const provider = (typed.provider as string) || ''

  const [localState, setLocalState] = useState((typed.state as string) || 'Todo')
  const [localAssignee, setLocalAssignee] = useState((typed.assignee_id as string) || '')
  const [localTitle, setLocalTitle] = useState(title)
  const [localDescription, setLocalDescription] = useState(description)
  const [bottomTab, setBottomTab] = useState<'details' | 'plan' | 'activity' | 'output' | 'changes'>('details')

  const [issueHistory, setIssueHistory] = useState<IssueHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([])
  const [diffLoading, setDiffLoading] = useState(false)
  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null)

  // Only sync state/assignee from result (these are set by dropdowns, not typed input)
  // Title and description are user-editable text - only set on initial load, not on re-fetches
  const resultId = (typed.id as string) || (typed.issue_id as string) || ''
  useEffect(() => {
    setLocalState((typed.state as string) || 'Todo')
    setLocalAssignee((typed.assignee_id as string) || '')
    setLocalTitle((typed.title as string) || 'No Title')
    setLocalDescription((typed.description as string) || '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultId])

  // Extract operational plan from the most recent agent message that contains checkboxes.
  // Agent restates the plan with updated checkboxes as it progresses — we want the LATEST version.
  const planItems: PlanItem[] = useMemo(() => {
    const PLAN_EVENT_KINDS = new Set(['message', 'agent_message', 'item.completed'])
    const messageEvents = issueHistory.filter(e =>
      PLAN_EVENT_KINDS.has(e.kind) && e.message && e.source !== 'pty'
    )

    if (messageEvents.length > 0) {
      // Scan individual messages newest-first for one that has checkboxes
      for (const entry of [...messageEvents].reverse()) {
        const items = extractPlanFromText(entry.message!)
        if (items.length > 0) return items
      }

      // If no single message has checkboxes, try concatenating the last few
      // (agent may have split one plan restatement across 2-3 chunked messages)
      const last5 = messageEvents.slice(-5)
      const combined = last5.map(e => e.message).join('\n')
      const items = extractPlanFromText(combined)
      if (items.length > 0) return items
    }

    // Fallback to timeline events
    const fromTimeline = extractOperationalPlanItems(timeline, issueId, identifier, description)
    if (fromTimeline.length > 0) return fromTimeline

    // Final fallback: parse description
    return extractPlanFromText(description)
  }, [issueHistory, timeline, issueId, identifier, description])
  const completedCount = planItems.filter(i => i.done).length
  const isRunning = snapshot?.running?.some(r => r.issue_id === issueId || r.issue_identifier === identifier) ?? false

  // Fetch history on mount + poll while running (for live operational plan updates)
  useEffect(() => {
    if (!config || !identifier) return
    setHistoryLoading(true)
    fetchIssueHistory(config, identifier)
      .then(setIssueHistory)
      .catch(() => setIssueHistory([]))
      .finally(() => setHistoryLoading(false))

    // Poll history every 5s while agent is running so plan updates live
    if (!isRunning) return
    const interval = setInterval(() => {
      fetchIssueHistory(config, identifier)
        .then(setIssueHistory)
        .catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [config, identifier, isRunning])

  // Fetch tab-specific data
  useEffect(() => {
    if (!config || !identifier) return
    if (bottomTab === 'output' && (isRunning || localState === 'In Progress' || localState === 'Review' || localState === 'Done')) {
      setLogsLoading(true)
      fetchIssueLogs(config, identifier, provider)
        .then(setLogs)
        .catch(() => setLogs(''))
        .finally(() => setLogsLoading(false))
    }
    if (bottomTab === 'changes' && (isRunning || localState === 'In Progress' || localState === 'Review' || localState === 'Done')) {
      setDiffLoading(true)
      fetchIssueDiff(config, identifier, provider)
        .then(raw => {
          const files = parseDiff(raw)
          setDiffFiles(files)
          if (files.length > 0) setActiveDiffFile(files[0].path)
        })
        .catch(() => setDiffFiles([]))
        .finally(() => setDiffLoading(false))
    }
  }, [bottomTab, config, identifier, provider, localState, isRunning])

  const handleStateChange = async (newState: string) => {
    setLocalState(newState)
    // Moving to Done or Todo while running → stop the agent session first
    if (newState !== 'In Progress' && isRunning && onStopSession) {
      await onStopSession(provider)
    }
    if (onUpdate) await onUpdate({ state: newState })
  }

  const handleAssigneeChange = async (newAssignee: string) => {
    setLocalAssignee(newAssignee)
    const agentName = newAssignee.replace('agent-', '')
    if (onUpdate) await onUpdate({ assignee_id: newAssignee, provider: agentName })
  }

  if (!result) {
    return <div className="h-full flex items-center justify-center text-muted-foreground/30 text-sm italic">No issue data.</div>
  }

  const stateColor = localState === 'Done' ? 'text-primary' : localState === 'In Progress' ? 'text-amber-500' : 'text-muted-foreground'
  const stateDot = localState === 'Done' ? 'bg-primary' : localState === 'In Progress' ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground/40'

  const tabItems = [
    { id: 'details' as const, label: 'Details', icon: Info, count: undefined },
    { id: 'plan' as const, label: 'Plan', icon: CheckCircle2, count: planItems.length > 0 ? planItems.length : undefined },
    { id: 'activity' as const, label: 'Activity', icon: History, count: undefined },
    { id: 'output' as const, label: 'Output', icon: Terminal, count: undefined },
    { id: 'changes' as const, label: 'Changes', icon: FileText, count: diffFiles.length > 0 ? diffFiles.length : undefined },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 px-2 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="outline" className="shrink-0 font-mono text-[11px] px-2 py-0.5 bg-primary/5 text-primary border-primary/20">
            {identifier}
          </Badge>
          <h2 className="text-base font-bold truncate">{localTitle}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0 mr-8">
          {isRunning && onStopSession && (
            <button
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              onClick={async () => {
                await onStopSession(provider)
                setLocalState('Todo')
                if (onUpdate) await onUpdate({ state: 'Todo' })
              }}
            >
              Stop
            </button>
          )}
          {localState === 'Review' && typed.url && typeof typed.url === 'string' && (typed.url as string).includes('github.com') && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              onClick={async () => {
                const issueUrl = typed.url as string
                const repoUrl = issueUrl.replace(/\/issues\/\d+$/, '')
                let head = 'main'
                // Try to detect current branch
                if (config && projectId) {
                  try {
                    const branches = await fetchProjectGitBranches(config, projectId)
                    if (branches.current && branches.current !== 'main' && branches.current !== 'master') {
                      head = branches.current
                    }
                  } catch { /* use main */ }
                }
                const base = 'main'
                const title = encodeURIComponent(localTitle || identifier)
                const body = encodeURIComponent(`## ${localTitle || identifier}\n\n${localDescription || 'No description.'}\n\nCloses ${issueUrl}\n\n---\n*Created from Orchestra task ${identifier}*`)
                const compareUrl = `${repoUrl}/compare/${base}...${head}?expand=1&title=${title}&body=${body}`
                const bridge = window.orchestraDesktop
                if (bridge && typeof bridge.openExternal === 'function') {
                  void bridge.openExternal(compareUrl)
                } else {
                  window.open(compareUrl, '_blank')
                }
              }}
            >
              <GitPullRequest size={12} />
              Draft PR
            </button>
          )}
          {localState === 'Review' && config && projectId && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              onClick={async () => {
                const msg = `feat(${identifier}): ${localTitle}\n\nImplemented by ${(typed.provider as string) || 'agent'} via Orchestra.\nCloses #${extractIssueNumber(typed.url as string || '')}`
                try {
                  await gitCommit(config, projectId, msg)
                } catch (err) {
                  console.error('Failed to commit:', err)
                }
              }}
            >
              <CheckCircle2 size={12} />
              Commit
            </button>
          )}
          {localState === 'Review' && onUpdate && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-muted/20 text-muted-foreground border border-border/30 hover:bg-muted/40 transition-colors"
              onClick={async () => {
                await onUpdate({ state: 'Done' })
                setLocalState('Done')
                // Close GitHub issue if linked
                if (config && projectId && typed.url && typeof typed.url === 'string') {
                  const match = (typed.url as string).match(/\/issues\/(\d+)/)
                  if (match) {
                    try {
                      await updateProjectGitHubIssue(config, projectId, parseInt(match[1]), { state: 'closed' })
                    } catch (err) {
                      console.error('Failed to close GitHub issue:', err)
                    }
                  }
                }
              }}
            >
              <CheckCircle2 size={12} />
              Close
            </button>
          )}
          {localState === 'Done' && onUpdate && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              onClick={async () => {
                await onUpdate({ state: 'Backlog' })
                setLocalState('Backlog')
              }}
            >
              <X size={12} />
              Reopen
            </button>
          )}
          <CustomDropdown
            className="w-28"
            value={localState}
            options={[
              { label: 'Backlog', value: 'Backlog', icon: <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" /> },
              { label: 'Todo', value: 'Todo', icon: <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> },
              { label: 'In Progress', value: 'In Progress', icon: <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> },
              { label: 'Review', value: 'Review', icon: <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> },
              { label: 'Done', value: 'Done', icon: <div className="h-1.5 w-1.5 rounded-full bg-primary" /> },
            ]}
            onChange={handleStateChange}
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-0 border-y border-border/40 shrink-0">
        {tabItems.map((tab, idx) => (
          <button
            key={tab.id}
            onClick={() => setBottomTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all border-b-2 ${
              idx < tabItems.length - 1 ? 'border-r border-border/20' : ''
            } ${
              bottomTab === tab.id
                ? 'border-b-primary text-primary bg-primary/5'
                : 'border-b-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/10'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[9px] font-mono px-1 rounded ${bottomTab === tab.id ? 'text-primary/60' : 'text-muted-foreground/30'}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content (fills remaining space) ── */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">

        {/* Details */}
        {bottomTab === 'details' && (
          <div className="h-full flex">
            {/* Main content - editable */}
            <div className="flex-1 p-8 flex flex-col">
              <input
                className="w-full bg-transparent text-xl font-bold text-foreground outline-none focus:outline-none placeholder:text-muted-foreground/20 mb-1"
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
                onBlur={() => { if (localTitle !== title && onUpdate) void onUpdate({ title: localTitle }) }}
                placeholder="Task title..."
              />
              <div className="w-12 h-0.5 bg-primary/30 rounded-full mb-4" />
              <DescriptionEditor
                value={localDescription}
                onChange={setLocalDescription}
                onBlur={() => { if (localDescription !== description && onUpdate) void onUpdate({ description: localDescription }) }}
                theme={theme}
              />
            </div>

            {/* Sidebar properties */}
            <div className="w-56 border-l border-border/20 shrink-0 bg-muted/5">
              {[
                { label: 'Agent', content: (
                  <AgentSelector value={localAssignee} agents={availableAgents} onChange={handleAssigneeChange} direction="down" />
                )},
                { label: 'Project', content: (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText size={10} className="text-primary/60" />
                    </div>
                    <span className="text-xs font-medium text-foreground/60 truncate">{projectName || 'Unlinked'}</span>
                  </div>
                )},
                { label: 'ID', content: (
                  <span className="font-mono text-xs text-primary/60">{identifier}</span>
                )},
                { label: 'Created', content: (
                  <span className="text-xs text-muted-foreground/40">
                    {(typed.created_at as string) ? new Date(typed.created_at as string).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                )},
              ].map(({ label, content }) => (
                <div key={label} className="px-4 py-3 border-b border-border/10">
                  <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30 mb-1.5 block">{label}</label>
                  {content}
                </div>
              ))}
              {typed.url && typeof typed.url === 'string' && (typed.url as string).includes('github.com') && (
                <div className="px-4 py-3 border-b border-border/10">
                  <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30 mb-1.5 block">GitHub</label>
                  <button
                    onClick={() => {
                      const bridge = window.orchestraDesktop
                      if (bridge && typeof bridge.openExternal === 'function') {
                        void bridge.openExternal(typed.url as string)
                      } else {
                        window.open(typed.url as string, '_blank')
                      }
                    }}
                    className="text-xs text-primary/60 hover:text-primary flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                  >
                    <Github size={12} />
                    {(typed.url as string).replace('https://github.com/', '')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plan */}
        {bottomTab === 'plan' && (
          <div className="h-full p-4">
            {planItems.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 min-w-[120px] bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(var(--primary),0.3)]" style={{ width: `${(completedCount / planItems.length) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">{completedCount}/{planItems.length} complete</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {planItems.map((item, idx) => (
                    <div key={idx} className={`flex items-start gap-3 py-2 px-3 rounded-lg ${item.done ? 'bg-primary/5' : 'hover:bg-muted/10'} transition-colors`}>
                      <div className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${item.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border/50'}`}>
                        {item.done && <CheckCircle2 size={12} />}
                      </div>
                      <span className={`text-sm leading-relaxed ${item.done ? 'text-muted-foreground/40 line-through' : 'text-foreground'}`}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 gap-3">
                <CheckCircle2 size={36} />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  {isRunning ? 'Waiting for agent to create plan...' : localState === 'Todo' ? 'Plan will appear when agent starts' : 'No plan recorded'}
                </p>
                {isRunning && <Loader2 size={14} className="animate-spin text-primary/30" />}
              </div>
            )}
          </div>
        )}

        {/* Activity */}
        {bottomTab === 'activity' && (
          <div className="h-full">
            {historyLoading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary/30" /></div>
            ) : (() => {
              // Only show events that matter to a human orchestrator
              const allowedKinds = new Set([
                'state_change', 'assignee_change',          // user actions
                'run_started', 'run_succeeded', 'run_failed', 'run_continues', // lifecycle
                'retry_scheduled',                           // retries
                'hook_started', 'hook_completed', 'hook_failed', // hooks
              ])
              const meaningfulEvents = issueHistory.filter(item => {
                const kind = item.kind?.toLowerCase() ?? ''
                // Always show explicitly allowed events
                if (allowedKinds.has(kind)) return true
                // Show "message" and "agent_message" events only if they have actual content
                if ((kind === 'message' || kind === 'agent_message' || kind === 'item.completed') && item.message && item.message.length > 10) return true
                return false
              })
              return meaningfulEvents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 gap-3">
                <History size={36} />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No events recorded</p>
              </div>
            ) : (
              <div>
                {meaningfulEvents.map((item, idx) => (
                  <div key={item.id || idx} className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors ${idx % 2 === 1 ? 'bg-muted/5' : 'bg-transparent'}`}>
                    <div className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-muted/30 shrink-0">
                      {getEventIcon(item.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground capitalize">{item.kind.replace(/_/g, ' ')}</span>
                        {item.provider && (
                          <span className="text-[9px] text-muted-foreground/40 flex items-center gap-1">{getAgentIcon(item.provider, 10)} {item.provider}</span>
                        )}
                      </div>
                      {item.message && (
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1">{item.message}</p>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground/30 font-mono shrink-0 mt-0.5">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )})()}
          </div>
        )}

        {/* Output */}
        {bottomTab === 'output' && (
          <div className="h-full">
            {logsLoading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary/30" /></div>
            ) : logs && !logs.includes('# No logs available') ? (
              <div className="flex flex-col h-full overflow-auto custom-scrollbar">
                {(() => {
                  // Universal log parser — supports Gemini, Codex, Claude, and OpenCode NDJSON + PTY
                  const parsed: Array<{ idx: number; kind: string; ts: string; label: string; content: string; status?: string }> = []
                  let seenFirstJSON = false

                  logs.split('\n').forEach((line, idx) => {
                    const trimmed = line.trim()
                    if (!trimmed) return
                    if (!trimmed.startsWith('{')) {
                      if (!seenFirstJSON) return
                      if (/error|fail|429|refused|SIGTERM|panic/i.test(trimmed)) {
                        parsed.push({ idx, kind: 'error', ts: '', label: '', content: trimmed })
                      }
                      return
                    }
                    seenFirstJSON = true
                    let obj: Record<string, unknown>
                    try { obj = JSON.parse(trimmed) } catch { return }

                    const type = (obj.type as string) || ''
                    const ts = obj.timestamp ? new Date(obj.timestamp as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''

                    // ── Gemini / Claude / OpenCode (NDJSON with type/role fields) ──
                    if (type === 'init') {
                      parsed.push({ idx, kind: 'session', ts, label: (obj.model as string) || 'agent', content: '' })
                    } else if (type === 'message' && obj.role === 'user') {
                      const c = (obj.content as string) || ''
                      parsed.push({ idx, kind: 'prompt', ts, label: '', content: c.length > 200 ? c.slice(0, 200) + '...' : c })
                    } else if (type === 'message' && obj.role === 'assistant') {
                      const c = (obj.content as string) || ''
                      if (c.trim()) parsed.push({ idx, kind: 'agent', ts, label: '', content: c })
                    } else if (type === 'tool_use') {
                      const tool = (obj.tool_name as string) || 'tool'
                      const p = obj.parameters as Record<string, unknown> | undefined
                      parsed.push({ idx, kind: 'tool', ts, label: tool, content: String(p?.command || p?.dir_path || p?.file_path || p?.pattern || p?.description || '') })
                    } else if (type === 'tool_result') {
                      const o = (obj.output as string) || ''
                      parsed.push({ idx, kind: 'result', ts, label: '', content: o.length > 200 ? o.slice(0, 200) + '...' : o, status: (obj.status as string) || 'success' })
                    // ── Codex (item-based events) ──
                    } else if (type === 'thread.started') {
                      parsed.push({ idx, kind: 'session', ts, label: 'codex', content: '' })
                    } else if (type === 'turn.started' || type === 'turn.completed') {
                      parsed.push({ idx, kind: 'lifecycle', ts, label: type === 'turn.started' ? 'Turn Started' : 'Turn Completed', content: '' })
                    } else if (type === 'item.completed') {
                      const item = obj.item as Record<string, unknown> | undefined
                      if (!item) return
                      const iType = (item.type as string) || ''
                      const text = (item.text as string) || (item.aggregated_output as string) || ''
                      if (iType === 'agent_message') parsed.push({ idx, kind: 'agent', ts, label: '', content: text })
                      else if (iType === 'reasoning') parsed.push({ idx, kind: 'thinking', ts, label: '', content: text })
                      else if (iType === 'command_execution') parsed.push({ idx, kind: 'tool', ts, label: 'shell', content: (item.command as string) || text.slice(0, 150) })
                      else if (iType === 'file_edit' || iType === 'file_create') parsed.push({ idx, kind: 'tool', ts, label: iType === 'file_edit' ? 'edit' : 'create', content: (item.file_path as string) || text.slice(0, 150) })
                      else if (text.trim()) parsed.push({ idx, kind: 'agent', ts, label: '', content: text })
                    // ── Claude (content_block events) ──
                    } else if (type === 'content_block_delta') {
                      const delta = obj.delta as Record<string, unknown> | undefined
                      const text = (delta?.text as string) || ''
                      if (text.trim()) parsed.push({ idx, kind: 'agent', ts, label: '', content: text })
                    } else if (type === 'result') {
                      parsed.push({ idx, kind: 'lifecycle', ts, label: 'Completed', content: (obj.stop_reason as string) || '' })
                    }
                  })

                  if (parsed.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 gap-3">
                        <Terminal size={36} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Logs are empty</p>
                      </div>
                    )
                  }

                  return parsed.map((entry) => {
                    if (entry.kind === 'session') {
                      return (
                        <div key={entry.idx} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/10">
                          <div className="h-5 w-5 rounded-md bg-primary/10 grid place-items-center shrink-0"><Zap size={10} className="text-primary" /></div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Session Started</span>
                          {entry.label && <span className="text-[9px] font-mono text-muted-foreground/30 bg-muted/30 px-1.5 py-0.5 rounded">{entry.label}</span>}
                          <span className="text-[9px] font-mono text-muted-foreground/20 ml-auto">{entry.ts}</span>
                        </div>
                      )
                    }
                    if (entry.kind === 'lifecycle') {
                      return (
                        <div key={entry.idx} className="flex items-center gap-2.5 px-4 py-1.5 border-b border-border/5">
                          <div className="h-4 w-4 rounded grid place-items-center shrink-0"><Play size={8} className="text-muted-foreground/30" /></div>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">{entry.label}</span>
                          {entry.content && <span className="text-[9px] text-muted-foreground/25">{entry.content}</span>}
                          <span className="text-[9px] font-mono text-muted-foreground/15 ml-auto">{entry.ts}</span>
                        </div>
                      )
                    }
                    if (entry.kind === 'prompt') {
                      return (
                        <div key={entry.idx} className="px-4 py-3 border-b border-border/10 bg-primary/[0.03]">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="h-5 w-5 rounded-md bg-primary/10 grid place-items-center shrink-0"><ChevronRight size={10} className="text-primary/60" /></div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary/50">System Prompt</span>
                            <span className="text-[9px] font-mono text-muted-foreground/15 ml-auto">{entry.ts}</span>
                          </div>
                          <p className="text-[11px] text-foreground/30 leading-relaxed line-clamp-2 ml-7">{entry.content}</p>
                        </div>
                      )
                    }
                    if (entry.kind === 'agent') {
                      return (
                        <div key={entry.idx} className="px-4 py-3 border-b border-border/10 hover:bg-muted/[0.03] transition-colors">
                          <div className="flex items-start gap-2.5">
                            <div className="h-5 w-5 rounded-md bg-emerald-500/10 grid place-items-center shrink-0 mt-0.5"><Bot size={10} className="text-emerald-500/70" /></div>
                            <p className="text-[12px] text-foreground/70 leading-[1.6] whitespace-pre-wrap flex-1">{entry.content}</p>
                            <span className="text-[9px] font-mono text-muted-foreground/15 shrink-0">{entry.ts}</span>
                          </div>
                        </div>
                      )
                    }
                    if (entry.kind === 'thinking') {
                      return (
                        <div key={entry.idx} className="flex items-center gap-2.5 px-4 py-2 border-b border-border/5 bg-violet-500/[0.03]">
                          <div className="h-5 w-5 rounded-md bg-violet-500/10 grid place-items-center shrink-0"><Brain size={10} className="text-violet-400/70" /></div>
                          <span className="text-[11px] text-violet-300/40 italic flex-1 truncate">{entry.content.replace(/\*\*/g, '')}</span>
                          <span className="text-[9px] font-mono text-muted-foreground/15 shrink-0">{entry.ts}</span>
                        </div>
                      )
                    }
                    if (entry.kind === 'tool') {
                      return (
                        <div key={entry.idx} className="flex items-center gap-2.5 px-4 py-2 border-b border-border/5 bg-amber-500/[0.03]">
                          <div className="h-5 w-5 rounded-md bg-amber-500/10 grid place-items-center shrink-0"><Wrench size={10} className="text-amber-500/70" /></div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500/50 shrink-0">{entry.label}</span>
                          <code className="text-[10px] font-mono text-muted-foreground/40 truncate flex-1">{entry.content}</code>
                          <span className="text-[9px] font-mono text-muted-foreground/15 shrink-0">{entry.ts}</span>
                        </div>
                      )
                    }
                    if (entry.kind === 'result') {
                      const isError = entry.status === 'error'
                      return (
                        <div key={entry.idx} className={`flex items-center gap-2.5 px-4 py-1.5 border-b border-border/5 ${isError ? 'bg-red-500/[0.03]' : 'bg-emerald-500/[0.02]'}`}>
                          <div className={`h-4 w-4 rounded grid place-items-center shrink-0 ${isError ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                            <CheckCircle2 size={8} className={isError ? 'text-red-400/60' : 'text-emerald-500/50'} />
                          </div>
                          <span className="text-[10px] text-muted-foreground/35 truncate flex-1">{entry.content}</span>
                          <span className="text-[9px] font-mono text-muted-foreground/15 shrink-0">{entry.ts}</span>
                        </div>
                      )
                    }
                    if (entry.kind === 'error') {
                      return (
                        <div key={entry.idx} className="flex items-center gap-2.5 px-4 py-2 border-b border-border/5 bg-red-500/[0.04]">
                          <div className="h-5 w-5 rounded-md bg-red-500/10 grid place-items-center shrink-0"><Zap size={10} className="text-red-400/70" /></div>
                          <span className="text-[10px] font-mono text-red-400/60 flex-1">{entry.content}</span>
                        </div>
                      )
                    }
                    return null
                  })
                })()}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 gap-3">
                <Terminal size={36} />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No output yet</p>
                <p className="text-[10px] text-muted-foreground/15">
                  {localState === 'Todo' ? 'Start the task to see agent output.' : 'Waiting for agent output...'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Changes */}
        {bottomTab === 'changes' && (
          <div className="h-full">
            {diffLoading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary/30" /></div>
            ) : diffFiles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 gap-3">
                <FileText size={36} />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No changes detected</p>
              </div>
            ) : (
              <div className="flex h-full">
                <div className="w-52 border-r border-border/30 shrink-0 overflow-auto bg-card/60">
                  <div className="p-2 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 border-b border-border/20 px-3">
                    {diffFiles.length} file{diffFiles.length !== 1 ? 's' : ''} changed
                  </div>
                  {diffFiles.map(f => (
                    <button
                      key={f.path}
                      onClick={() => setActiveDiffFile(f.path)}
                      className={`w-full text-left px-3 py-2 text-[11px] truncate transition-colors ${
                        activeDiffFile === f.path ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' : 'text-muted-foreground hover:bg-muted/20'
                      }`}
                    >
                      {f.path.split('/').pop()}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-auto bg-[#0d1117]">
                  <Prism
                    language="diff"
                    style={oneDark}
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '11px', lineHeight: '1.6' }}
                    showLineNumbers={false}
                  >
                    {diffFiles.find(f => f.path === activeDiffFile)?.content || ''}
                  </Prism>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
