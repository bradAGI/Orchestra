import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Brain, CheckCircle2, ChevronDown, ChevronRight, FileText, GitPullRequest, Github, History, Info, Loader2, Pencil, Play, Terminal, Wrench, X, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Prism } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { BackendConfig, IssueUpdatePayload, IssueHistoryEntry } from '@/lib/orchestra-client'
import { fetchIssueHistory, fetchIssueDiff, fetchIssueLogs, createProjectGitHubPull, gitCommit, gitCheckout, gitMerge, gitDeleteBranch, updateProjectGitHubIssue, fetchProjectGitBranches } from '@/lib/orchestra-client'
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
        prose-pre:bg-card dark:bg-card prose-pre:border prose-pre:border-border/20 prose-pre:rounded-lg
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
  const [bottomTab, setBottomTab] = useState<'details' | 'plan' | 'output' | 'changes'>('details')

  const [issueHistory, setIssueHistory] = useState<IssueHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([])
  const [diffLoading, setDiffLoading] = useState(false)
  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null)
  const [expandedOutputEntries, setExpandedOutputEntries] = useState<Set<number>>(new Set())

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
    const PLAN_EVENT_KINDS = new Set(['message', 'agent_message', 'item.completed', 'assistant', 'result/end_turn', 'result'])
    const messageEvents = issueHistory.filter(e =>
      PLAN_EVENT_KINDS.has(e.kind) && e.message && e.kind !== 'pty'
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
  // Skip fetching when in Backlog/Todo — no agent data to show
  useEffect(() => {
    if (!config || !identifier) return
    if (localState === 'Backlog' || localState === 'Todo') {
      setIssueHistory([])
      return
    }
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
  }, [config, identifier, isRunning, localState])

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
    // Reset plan/activity/output when moving back to Backlog or Todo
    if (newState === 'Backlog' || newState === 'Todo') {
      setIssueHistory([])
      setLogs('')
      setDiffFiles([])
      setActiveDiffFile(null)
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
    { id: 'output' as const, label: 'Session', icon: Terminal, count: undefined },
    { id: 'changes' as const, label: 'Changes', icon: FileText, count: diffFiles.length > 0 ? diffFiles.length : undefined },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border/30">
        <div className="flex items-center gap-4 px-6 h-14 pr-12">
          <span className="shrink-0 font-mono text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/15">{identifier}</span>
          <h2 className="text-base font-bold truncate flex-1 min-w-0">{localTitle}</h2>
          <div className="flex items-center gap-2 shrink-0">
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
          {localState === 'Review' && config && projectId && onUpdate && (
            <>
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                onClick={async () => {
                  try {
                    const branchName = (typed.branch_name as string) || ''
                    if (branchName && branchName !== 'main') {
                      await gitCheckout(config, projectId, 'main')
                      await gitMerge(config, projectId, branchName)
                      try { await gitDeleteBranch(config, projectId, branchName) } catch { /* branch cleanup optional */ }
                    }
                    // Close GitHub issue (non-blocking — don't let failure prevent Done state)
                    if (typed.url && typeof typed.url === 'string') {
                      const match = (typed.url as string).match(/\/issues\/(\d+)/)
                      if (match) {
                        try {
                          await updateProjectGitHubIssue(config, projectId, parseInt(match[1]), { state: 'closed' })
                        } catch (ghErr) {
                          console.warn('GitHub issue close failed (continuing):', ghErr)
                        }
                      }
                    }
                    await onUpdate({ state: 'Done' })
                    setLocalState('Done')
                  } catch (err) {
                    console.error('Merge & Close failed:', err)
                  }
                }}
              >
                <GitPullRequest size={14} />
                Merge &amp; Close
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-muted/20 text-muted-foreground border border-border/30 hover:bg-muted/40 transition-colors"
                onClick={async () => {
                  await onUpdate({ state: 'Done' })
                  setLocalState('Done')
                }}
              >
                <X size={12} />
                Close
              </button>
            </>
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
          </div>
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
            <div className="w-72 border-l border-border/40 shrink-0 overflow-y-auto bg-muted/5">
              <div className="px-4 py-3 border-b border-border/20">
                <label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/30 mb-1.5 block">Status</label>
                <CustomDropdown
                  className="w-full"
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
              {[
                { label: 'Agent', content: (
                  <AgentSelector value={localAssignee} agents={availableAgents} onChange={handleAssigneeChange} direction="down" />
                )},
                { label: 'Project', content: (
                  <span className="text-[11px] font-bold text-foreground/80">{projectName || 'Unlinked'}</span>
                )},
                { label: 'Identifier', content: (
                  <span className="font-mono text-[11px] font-black text-primary/70">{identifier}</span>
                )},
                { label: 'Created', content: (
                  <span className="text-[11px] text-muted-foreground/50">
                    {(typed.created_at as string) ? new Date(typed.created_at as string).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                )},
              ].map(({ label, content }) => (
                <div key={label} className="px-4 py-3 border-b border-border/20">
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/30 mb-1.5 block">{label}</label>
                  {content}
                </div>
              ))}
              {typed.url && typeof typed.url === 'string' && (typed.url as string).includes('github.com') && (
                <div className="px-4 py-3 border-b border-border/20">
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/30 mb-1.5 block">GitHub</label>
                  <button
                    onClick={() => {
                      const bridge = window.orchestraDesktop
                      if (bridge && typeof bridge.openExternal === 'function') {
                        void bridge.openExternal(typed.url as string)
                      } else {
                        window.open(typed.url as string, '_blank')
                      }
                    }}
                    className="text-[11px] text-primary/60 hover:text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
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
        {/* Output */}
        {bottomTab === 'output' && (
          <div className="h-full bg-gradient-to-b from-card via-card to-muted/10">
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
                      const c = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content || '').slice(0, 300)
                      parsed.push({ idx, kind: 'prompt', ts, label: '', content: c.length > 200 ? c.slice(0, 200) + '...' : c })
                    } else if (type === 'message' && obj.role === 'assistant') {
                      const c = typeof obj.content === 'string' ? obj.content : ''
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
                    // ── Claude Code stream-json events ──
                    } else if (type === 'system' && (obj.subtype as string) === 'init') {
                      parsed.push({ idx, kind: 'session', ts, label: (obj.model as string) || 'claude', content: '' })
                    } else if (type === 'assistant') {
                      const msg = obj.message as Record<string, unknown> | undefined
                      const content = msg?.content as Array<Record<string, unknown>> | undefined
                      if (content) {
                        for (const block of content) {
                          if (block.type === 'text' && block.text) {
                            parsed.push({ idx, kind: 'agent', ts, label: '', content: block.text as string })
                          } else if (block.type === 'tool_use') {
                            parsed.push({ idx, kind: 'tool', ts, label: (block.name as string) || 'tool', content: JSON.stringify((block.input as Record<string, unknown>)?.command || (block.input as Record<string, unknown>)?.file_path || '').slice(0, 150) })
                          } else if (block.type === 'thinking') {
                            const thinking = (block.thinking as string) || ''
                            if (thinking.trim()) parsed.push({ idx, kind: 'thinking', ts, label: '', content: thinking })
                          }
                        }
                      }
                    } else if (type === 'user') {
                      const msg = obj.message as Record<string, unknown> | undefined
                      const content = msg?.content as Array<Record<string, unknown>> | undefined
                      if (content) {
                        for (const block of content) {
                          if (block.type === 'tool_result') {
                            const raw = block.content
                            const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw as Array<Record<string,unknown>>).map(b => typeof b.text === 'string' ? b.text : '').join('') : ''
                            parsed.push({ idx, kind: 'result', ts, label: '', content: text.length > 200 ? text.slice(0, 200) + '...' : text, status: block.is_error ? 'error' : 'success' })
                          }
                        }
                      }
                    } else if (type === 'content_block_delta') {
                      const delta = obj.delta as Record<string, unknown> | undefined
                      const text = (delta?.text as string) || ''
                      if (text.trim()) parsed.push({ idx, kind: 'agent', ts, label: '', content: text })
                    } else if (type === 'result') {
                      const resultText = (obj.result as string) || ''
                      if (resultText.trim()) {
                        parsed.push({ idx, kind: 'agent', ts, label: '', content: resultText })
                      }
                      parsed.push({ idx: idx + 0.5, kind: 'lifecycle', ts, label: 'Completed', content: (obj.stop_reason as string) || '' })
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

                  return (
                    <div className="p-4 space-y-3">
                      {parsed.map((entry) => {
                        const isExpanded = expandedOutputEntries.has(entry.idx)
                        const toggleExpand = () => setExpandedOutputEntries(prev => {
                          const next = new Set(prev)
                          if (next.has(entry.idx)) next.delete(entry.idx)
                          else next.add(entry.idx)
                          return next
                        })

                        if (entry.kind === 'session') {
                          return (
                            <div key={entry.idx} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/10">
                              <div className="h-6 w-6 rounded-lg bg-primary/15 grid place-items-center"><Zap size={12} className="text-primary" /></div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Session</span>
                              {entry.label && <span className="text-[9px] font-mono text-primary/50 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/10">{entry.label}</span>}
                              <span className="text-[9px] font-mono text-muted-foreground/30 ml-auto">{entry.ts}</span>
                            </div>
                          )
                        }
                        if (entry.kind === 'lifecycle') return null
                        if (entry.kind === 'prompt') {
                          return (
                            <button key={entry.idx} onClick={toggleExpand} className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/20 border border-border/20 text-left group hover:border-border/40 transition-all">
                              <ChevronRight size={11} className={`text-muted-foreground/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 group-hover:text-muted-foreground/60">System Prompt</span>
                              <span className="text-[9px] font-mono text-muted-foreground/20 ml-auto">{entry.ts}</span>
                              {isExpanded && (
                                <p className="text-[11px] text-foreground/30 leading-relaxed mt-2 whitespace-pre-wrap max-h-40 overflow-auto custom-scrollbar w-full" onClick={e => e.stopPropagation()}>{entry.content}</p>
                              )}
                            </button>
                          )
                        }
                        if (entry.kind === 'agent') {
                          return (
                            <div key={entry.idx} className="rounded-xl border border-border/20 bg-gradient-to-b from-card to-muted/10 overflow-hidden">
                              <div className="flex items-start gap-3 px-4 py-3">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/15 grid place-items-center shrink-0 mt-0.5">{getAgentIcon(provider, 16)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="prose prose-invert prose-sm max-w-none text-[12px] leading-relaxed prose-p:my-1 prose-p:text-foreground/90 prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[11px] prose-pre:bg-background prose-pre:border prose-pre:border-border/30 prose-pre:rounded-lg prose-li:text-foreground/80 prose-headings:text-foreground prose-headings:text-xs prose-strong:text-foreground">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
                                  </div>
                                </div>
                                <span className="text-[8px] font-mono text-muted-foreground/20 shrink-0 mt-1">{entry.ts}</span>
                              </div>
                            </div>
                          )
                        }
                        if (entry.kind === 'thinking') {
                          return (
                            <div key={entry.idx} className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-transparent overflow-hidden transition-all hover:border-violet-500/30">
                              <button onClick={toggleExpand} className="w-full flex items-center gap-3 px-4 py-2.5 text-left group">
                                <div className="h-6 w-6 rounded-lg bg-violet-500/15 border border-violet-500/20 grid place-items-center shrink-0">
                                  <Brain size={11} className="text-violet-400" />
                                </div>
                                <span className="text-[10px] font-bold text-violet-400/70 italic">Reasoning</span>
                                <ChevronDown size={10} className={`text-violet-400/40 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`} />
                                <span className="text-[8px] font-mono text-muted-foreground/40 shrink-0">{entry.ts}</span>
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-3">
                                  <p className="text-[11px] text-violet-300/60 leading-relaxed whitespace-pre-wrap max-h-48 overflow-auto custom-scrollbar rounded-lg bg-violet-500/5 border border-violet-500/10 p-3">{entry.content.replace(/\*\*/g, '')}</p>
                                </div>
                              )}
                            </div>
                          )
                        }
                        if (entry.kind === 'tool') {
                          return (
                            <div key={entry.idx} className="group/tool rounded-xl border border-border/30 bg-gradient-to-r from-muted/20 to-transparent overflow-hidden transition-all hover:border-border/50">
                              <div className="flex items-center gap-3 px-4 py-2.5">
                                <div className="h-6 w-6 rounded-lg bg-amber-500/15 border border-amber-500/20 grid place-items-center shrink-0">
                                  <Wrench size={11} className="text-amber-400" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 shrink-0">{entry.label}</span>
                                <code className="text-[10px] font-mono text-foreground/60 truncate flex-1">{entry.content.replace(/"/g, '')}</code>
                                <span className="text-[8px] font-mono text-muted-foreground/40 shrink-0">{entry.ts}</span>
                              </div>
                            </div>
                          )
                        }
                        if (entry.kind === 'result') {
                          const isError = entry.status === 'error'
                          return (
                            <div key={entry.idx} className={`rounded-xl border overflow-hidden transition-all ${isError ? 'border-red-500/20 bg-red-500/5' : 'border-border/20 bg-muted/10 hover:border-border/40'}`}>
                              <button onClick={toggleExpand} className="w-full flex items-center gap-3 px-4 py-2 text-left">
                                <div className={`h-5 w-5 rounded-md grid place-items-center shrink-0 ${isError ? 'bg-red-500/15' : 'bg-primary/15'}`}>
                                  <CheckCircle2 size={10} className={isError ? 'text-red-400' : 'text-primary/70'} />
                                </div>
                                <span className={`text-[10px] font-mono truncate flex-1 ${isError ? 'text-red-400/70' : 'text-foreground/50'}`}>
                                  {entry.content.slice(0, 120)}{entry.content.length > 120 ? '…' : ''}
                                </span>
                                {entry.content.length > 60 && <ChevronDown size={10} className={`text-muted-foreground/40 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />}
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-3 pt-0">
                                  <pre className="text-[10px] text-foreground/60 leading-relaxed whitespace-pre-wrap max-h-40 overflow-auto custom-scrollbar font-mono rounded-lg bg-background/50 border border-border/20 p-3">{entry.content}</pre>
                                </div>
                              )}
                            </div>
                          )
                        }
                        if (entry.kind === 'error') {
                          return (
                            <div key={entry.idx} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/15 bg-red-500/5">
                              <Zap size={12} className="text-red-400/60 shrink-0" />
                              <span className="text-[10px] font-mono text-red-400/70 flex-1">{entry.content}</span>
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  )
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
                <div className="flex-1 overflow-auto bg-card dark:bg-card">
                  <pre className="p-4 text-[11px] font-mono leading-[1.7]">
                    {(diffFiles.find(f => f.path === activeDiffFile)?.content || '').split('\n').map((line, i) => {
                      let bg = 'transparent'
                      let color = '#8b949e'
                      if (line.startsWith('+') && !line.startsWith('+++')) {
                        bg = 'rgba(63, 185, 80, 0.08)'
                        color = '#7ee787'
                      } else if (line.startsWith('-') && !line.startsWith('---')) {
                        bg = 'rgba(248, 81, 73, 0.08)'
                        color = '#ff7b72'
                      } else if (line.startsWith('@@')) {
                        bg = 'rgba(56, 139, 253, 0.06)'
                        color = '#79c0ff'
                      } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
                        color = '#484f58'
                      }
                      return (
                        <div key={i} style={{ background: bg }} className="px-3 -mx-4">
                          <span className="inline-block w-8 text-right mr-3 select-none" style={{ color: '#484f58' }}>{i + 1}</span>
                          <span style={{ color }}>{line}</span>
                        </div>
                      )
                    })}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
