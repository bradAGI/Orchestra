import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, Github, History, Info, Loader2, Terminal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Prism } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import type { BackendConfig, IssueUpdatePayload, IssueHistoryEntry } from '@/lib/orchestra-client'
import { fetchIssueHistory, fetchIssueDiff, fetchIssueLogs } from '@/lib/orchestra-client'
import type { SnapshotPayload } from '@/lib/orchestra-types'
import type { TimelineItem } from '@/components/app-shell/types'
import { AgentSelector, CustomDropdown, getAgentIcon } from '@/components/app-shell/shared/controls'
import type { IssueDetailResult, ToolSummary } from './types'
import { extractOperationalPlanItems, extractPlanFromText, getEventIcon, parseDiff, type DiffFile, type PlanItem } from './IssueDetailUtils'

export function IssueDetailView({
  result,
  onUpdate,
  onStopSession,
  onJumpToTerminal,
  onNavigate,
  config,
  snapshot,
  timeline = [],
  availableAgents = [],
  allTools = [],
  theme,
}: {
  result: IssueDetailResult | null
  onUpdate?: (updates: IssueUpdatePayload) => Promise<void>
  onStopSession?: (provider?: string) => Promise<void>
  onJumpToTerminal?: (identifier: string) => void
  onNavigate?: (section: string) => void
  config: BackendConfig | null
  snapshot: SnapshotPayload | null
  timeline?: TimelineItem[]
  availableAgents?: string[]
  allTools?: ToolSummary[]
  theme?: 'light' | 'dark'
}) {
  void onJumpToTerminal
  void onNavigate
  void allTools

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

  // Extract operational plan from agent messages in history.
  // Agent messages get chunked across multiple events, so we concatenate
  // consecutive message events and find the best plan from the combined text.
  const planItems: PlanItem[] = (() => {
    // 1. Concatenate consecutive message events into blocks, then scan each block
    const messageEvents = issueHistory.filter(e => e.kind === 'message' && e.message)
    if (messageEvents.length > 0) {
      // Build blocks of consecutive messages (same provider = likely one response split across events)
      const blocks: string[] = []
      let current = ''
      let lastProvider = ''
      for (const entry of messageEvents) {
        if (entry.provider !== lastProvider && current) {
          blocks.push(current)
          current = ''
        }
        current += (current ? '\n' : '') + entry.message
        lastProvider = entry.provider || ''
      }
      if (current) blocks.push(current)

      // Scan blocks newest-first for the most complete plan
      let bestItems: PlanItem[] = []
      for (const block of blocks.reverse()) {
        const items = extractPlanFromText(block)
        if (items.length > bestItems.length) {
          bestItems = items
        }
      }
      if (bestItems.length > 0) return bestItems

      // Also try each individual message (some agents send complete plans in one message)
      for (const entry of [...messageEvents].reverse()) {
        const items = extractPlanFromText(entry.message!)
        if (items.length > 0) return items
      }
    }

    // 2. Fallback to timeline events
    const fromTimeline = extractOperationalPlanItems(timeline, issueId, identifier, description)
    if (fromTimeline.length > 0) return fromTimeline

    // 3. Final fallback: parse description
    return extractPlanFromText(description)
  })()
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
    if (bottomTab === 'output') {
      setLogsLoading(true)
      fetchIssueLogs(config, identifier, provider)
        .then(setLogs)
        .catch(() => setLogs(''))
        .finally(() => setLogsLoading(false))
    }
    if (bottomTab === 'changes') {
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
  }, [bottomTab, config, identifier, provider])

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
              <textarea
                className="w-full flex-1 bg-transparent text-sm text-foreground/60 outline-none focus:outline-none placeholder:text-muted-foreground/15 leading-relaxed resize-none transition-colors"
                value={localDescription}
                onChange={e => setLocalDescription(e.target.value)}
                onBlur={() => { if (localDescription !== description && onUpdate) void onUpdate({ description: localDescription }) }}
                placeholder="Describe what this task should accomplish..."
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
                  <a href={typed.url as string} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary/60 hover:text-primary flex items-center gap-1.5 transition-colors">
                    <Github size={12} />
                    {(typed.url as string).replace('https://github.com/', '')}
                  </a>
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
                // Show "message" events only if they have actual content (agent thinking)
                if (kind === 'message' && item.message && item.message.length > 10) return true
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
              <div className="flex flex-col h-full bg-[#0d1117] overflow-auto">
                <pre className="flex-1 p-4 text-[11px] font-mono text-[#c9d1d9] whitespace-pre-wrap leading-[1.7] selection:bg-primary/30">{
                  logs.split('\n').map((line, i) => {
                    const lineNum = String(i + 1).padStart(4, ' ')
                    // Render markdown-like headings slightly better
                    if (line.startsWith('# ')) {
                      return <span key={i}><span className="text-[#484f58] select-none">{lineNum}  </span><span className="text-[#58a6ff] font-bold">{line}</span>{'\n'}</span>
                    }
                    if (line.startsWith('## ')) {
                      return <span key={i}><span className="text-[#484f58] select-none">{lineNum}  </span><span className="text-[#58a6ff] font-semibold">{line}</span>{'\n'}</span>
                    }
                    return <span key={i}><span className="text-[#484f58] select-none">{lineNum}  </span>{line}{'\n'}</span>
                  })
                }</pre>
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
