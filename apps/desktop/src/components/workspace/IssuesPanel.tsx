import { useAppStore } from '@/store'
import { Terminal, Circle, RotateCw, CheckCircle2, AlertCircle } from 'lucide-react'

function statusIcon(state: string) {
  switch (state?.toLowerCase()) {
    case 'running':
      return <Circle size={8} className="fill-green-400 text-green-400" />
    case 'retrying':
      return <RotateCw size={8} className="text-yellow-400" />
    case 'done':
    case 'completed':
      return <CheckCircle2 size={8} className="text-muted-foreground" />
    case 'failed':
    case 'error':
      return <AlertCircle size={8} className="text-red-400" />
    default:
      return <Circle size={8} className="text-muted-foreground" />
  }
}

export function IssuesPanel() {
  const allBoardIssues = useAppStore((s) => s.allBoardIssues)
  const snapshot = useAppStore((s) => s.snapshot)
  const openTerminals = useAppStore((s) => s.openTerminals)
  const setExplorerRoot = useAppStore((s) => s.setExplorerRoot)
  const setActiveLeftPanel = useAppStore((s) => s.setActiveLeftPanel)

  const running = snapshot?.running ?? []
  const retrying = snapshot?.retrying ?? []

  const runningIds = new Set(running.map((r) => r.issue_identifier ?? '').filter(Boolean))
  const retryingIds = new Set(retrying.map((r) => r.issue_identifier ?? '').filter(Boolean))

  const issuesWithStatus = allBoardIssues.map((issue) => {
    let status = issue.state ?? 'backlog'
    if (issue.identifier && runningIds.has(issue.identifier)) status = 'running'
    else if (issue.identifier && retryingIds.has(issue.identifier)) status = 'retrying'
    return { ...issue, liveStatus: status }
  })

  const activeIssues = issuesWithStatus.filter(
    (i) => i.liveStatus === 'running' || i.liveStatus === 'retrying' || i.liveStatus === 'InProgress',
  )
  const otherIssues = issuesWithStatus.filter(
    (i) => i.liveStatus !== 'running' && i.liveStatus !== 'retrying' && i.liveStatus !== 'InProgress',
  )

  const handleIssueClick = (issue: typeof issuesWithStatus[number]) => {
    const runEntry = running.find((r) => r.issue_identifier === issue.identifier)
    if (runEntry?.session_log_path) {
      const workspacePath = runEntry.session_log_path.split('/_logs/')[0]
      if (workspacePath) {
        setExplorerRoot(workspacePath)
        setActiveLeftPanel('explorer')
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Active issues */}
      {activeIssues.length > 0 && (
        <div className="px-2 pt-2 pb-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Active</p>
          {activeIssues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => handleIssueClick(issue)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-accent/50 transition-colors"
            >
              {statusIcon(issue.liveStatus)}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground truncate">{issue.title || issue.identifier}</p>
                <p className="text-[10px] text-muted-foreground">{issue.identifier}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Terminals */}
      {openTerminals.length > 0 && (
        <div className="px-2 pt-2 pb-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Terminals</p>
          {openTerminals.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-muted-foreground"
            >
              <Terminal size={10} />
              <span className="truncate">{t.title || t.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Other issues */}
      {otherIssues.length > 0 && (
        <div className="px-2 pt-2 pb-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Backlog</p>
          {otherIssues.slice(0, 20).map((issue) => (
            <button
              key={issue.id}
              onClick={() => handleIssueClick(issue)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-accent/50 transition-colors"
            >
              {statusIcon(issue.liveStatus)}
              <p className="text-xs text-muted-foreground truncate">{issue.title || issue.identifier}</p>
            </button>
          ))}
          {otherIssues.length > 20 && (
            <p className="text-[10px] text-muted-foreground px-2 py-1">+{otherIssues.length - 20} more</p>
          )}
        </div>
      )}

      {allBoardIssues.length === 0 && openTerminals.length === 0 && (
        <p className="text-xs text-muted-foreground p-3">No tasks or terminals</p>
      )}
    </div>
  )
}
