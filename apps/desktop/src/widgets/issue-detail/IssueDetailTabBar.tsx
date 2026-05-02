import { FileText } from 'lucide-react'

import { AppTooltip } from '@/components/ui/tooltip-wrapper'

type Tab = 'overview' | 'changes' | 'logs' | 'artifacts' | 'activity'

export function IssueDetailTabBar({
  reportContent,
  activeTab,
  setActiveTab,
  localState,
}: {
  reportContent: string | null
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  localState: string
}) {
  const items: { id: Tab; label: string; icon?: React.ReactNode; tooltip: string }[] = [
    { id: 'overview', label: 'Overview', tooltip: 'Task metadata, agent configuration, and runtime pulse' },
    { id: 'changes', label: 'Changes', tooltip: 'Workspace diff and file-level modifications' },
    { id: 'logs', label: localState === 'In Progress' ? 'Live logs' : 'Logs', tooltip: localState === 'In Progress' ? 'Connect to live PTY session' : 'View historical agent execution logs' },
    { id: 'artifacts', label: 'Artifacts', tooltip: 'Review generated documentation, code, and session assets' },
    { id: 'activity', label: 'Activity', tooltip: 'Full chronological audit trail of all session events' },
  ]

  return (
    <div className="flex items-center gap-0 px-3 border-b border-border/30 shrink-0">
      {reportContent && (
        <AppTooltip content="Executive summary and autonomous verification report">
          <button
            onClick={() => setActiveTab('artifacts')}
            className="relative inline-flex items-center gap-1.5 px-3 h-9 text-[12px] font-medium tracking-tight text-primary hover:text-primary/90 transition-colors"
          >
            <FileText size={12} strokeWidth={2.5} />
            Report
          </button>
        </AppTooltip>
      )}
      {items.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <AppTooltip key={tab.id} content={tab.tooltip}>
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`relative inline-flex items-center gap-1.5 px-3 h-9 text-[12px] font-medium tracking-tight transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground/70 hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
              {isActive && <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />}
            </button>
          </AppTooltip>
        )
      })}
    </div>
  )
}
