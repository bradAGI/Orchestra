import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, History, Loader2, Terminal } from 'lucide-react'
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
  const provider = (typed.provider as string) || ''

  const [localState, setLocalState] = useState((typed.state as string) || 'Todo')
  const [localAssignee, setLocalAssignee] = useState((typed.assignee_id as string) || '')
  const [bottomTab, setBottomTab] = useState<'activity' | 'output' | 'changes'>('activity')

  const [issueHistory, setIssueHistory] = useState<IssueHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([])
  const [diffLoading, setDiffLoading] = useState(false)
  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null)

  useEffect(() => {
    setLocalState((typed.state as string) || 'Todo')
    setLocalAssignee((typed.assignee_id as string) || '')
  }, [result])

  // Extract operational plan from agent messages in history (agent outputs `- [ ]` / `- [x]` items)
  const planItems: PlanItem[] = (() => {
    // First try extracting from history (agent messages contain the plan)
    for (const entry of [...issueHistory].reverse()) {
      if (!entry.message) continue
      const items = extractPlanFromText(entry.message)
      if (items.length > 0) return items
    }
    // Fallback to timeline events
    const fromTimeline = extractOperationalPlanItems(timeline, issueId, identifier, description)
    if (fromTimeline.length > 0) return fromTimeline
    // Final fallback: parse description
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
    { id: 'activity' as const, label: 'Activity', icon: History, count: issueHistory.length },
    { id: 'output' as const, label: 'Output', icon: Terminal },
    { id: 'changes' as const, label: 'Changes', icon: FileText, count: diffFiles.length },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 px-2 pb-4 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${stateDot}`} />
          <Badge variant="outline" className="shrink-0 font-mono text-[11px] px-2 py-0.5 bg-primary/5 text-primary border-primary/20">
            {identifier}
          </Badge>
          <h2 className="text-base font-bold truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CustomDropdown
            className="w-28"
            value={localState}
            options={[
              { label: 'Todo', value: 'Todo', icon: <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> },
              { label: 'In Progress', value: 'In Progress', icon: <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> },
              { label: 'Done', value: 'Done', icon: <div className="h-1.5 w-1.5 rounded-full bg-primary" /> },
            ]}
            onChange={handleStateChange}
          />
          <AgentSelector value={localAssignee} agents={availableAgents} onChange={handleAssigneeChange} />
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
        </div>
      </div>

      {/* ── Operational Plan ── */}
      <div className="px-2 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-2">
            <CheckCircle2 size={12} className="text-primary/60" />
            Operational Plan
          </h3>
          {planItems.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1 w-16 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(completedCount / planItems.length) * 100}%` }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/40">{completedCount}/{planItems.length}</span>
            </div>
          )}
        </div>

        {description && (
          <p className="text-sm text-foreground/80 leading-relaxed mb-3">{description}</p>
        )}

        {planItems.length > 0 ? (
          <div className="space-y-1.5 max-h-[200px] overflow-auto custom-scrollbar">
            {planItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 py-1">
                <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${item.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border/50'}`}>
                  {item.done && <CheckCircle2 size={10} />}
                </div>
                <span className={`text-sm leading-snug ${item.done ? 'text-muted-foreground/40 line-through' : 'text-foreground/90'}`}>{item.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground/30">
            {isRunning ? (
              <><Loader2 size={12} className="animate-spin text-primary/40" /><span className="text-xs">Agent working — plan updates as steps are identified...</span></>
            ) : localState === 'Todo' ? (
              <span className="text-xs">Assign an agent and set to "In Progress" to begin.</span>
            ) : (
              <span className="text-xs">No plan steps recorded.</span>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center border-y border-border/40 shrink-0">
        {tabItems.map(tab => (
          <button
            key={tab.id}
            onClick={() => setBottomTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all border-b-2 ${
              bottomTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/10'
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[9px] font-mono px-1 rounded ${bottomTab === tab.id ? 'text-primary/60' : 'text-muted-foreground/30'}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content (fills remaining space) ── */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">

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
              <div className="divide-y divide-border/20">
                {meaningfulEvents.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
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
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-2">{item.message}</p>
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
              <div className="h-full bg-[#0d1117] overflow-auto">
                <pre className="p-4 text-[11px] font-mono text-[#c9d1d9] whitespace-pre-wrap leading-[1.7] selection:bg-primary/30">{logs}</pre>
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
                <div className="w-52 border-r border-border/30 shrink-0 overflow-auto">
                  <div className="p-2 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 border-b border-border/20 px-3">
                    {diffFiles.length} file{diffFiles.length !== 1 ? 's' : ''} changed
                  </div>
                  {diffFiles.map(f => (
                    <button
                      key={f.path}
                      onClick={() => setActiveDiffFile(f.path)}
                      className={`w-full text-left px-3 py-2 text-[11px] truncate transition-colors ${
                        activeDiffFile === f.path ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/20'
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
