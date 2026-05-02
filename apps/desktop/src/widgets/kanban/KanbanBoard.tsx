import { useEffect, useMemo, useState } from 'react'
import {
  CircleDashed,
  Folder,
  FolderTree,
  Github,
  Layout,
  Play,
  Plus,
  Rows,
  Square,
  ClipboardList,
  Trash2,
} from 'lucide-react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { AgentSelector, CustomDropdown } from '@/components/app-shell/shared/controls'
import type { IssueListItem, IssueUpdatePayload } from '@/lib/orchestra-client'
import type { Project, SnapshotPayload } from '@/lib/orchestra-types'

type EnrichedIssue = IssueListItem & {
  issue_id: string
  issue_identifier?: string
  lane: 'running' | 'retrying' | null
  detail: string
  at: string
}

const COLUMN_TO_STATE: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

const STATE_TO_COLUMN: Record<string, string> = Object.fromEntries(
  Object.entries(COLUMN_TO_STATE).map(([k, v]) => [v, k]),
)

export function KanbanBoard({
  loadingState,
  snapshot,
  boardIssues = [],
  projects = [],
  availableAgents = [],
  onInspectIssue,
  onIssueUpdate,
  onIssueDelete,
  onStopSession,
  onCreateIssue,
}: {
  loadingState: boolean
  snapshot: SnapshotPayload | null
  boardIssues?: IssueListItem[]
  projects?: Project[]
  availableAgents?: string[]
  onInspectIssue: (issueIdentifier: string) => Promise<void>
  onJumpToTerminal?: (identifier: string) => void
  onIssueUpdate?: (identifier: string, updates: IssueUpdatePayload) => Promise<void>
  onIssueDelete?: (identifier: string) => Promise<void>
  onStopSession?: (identifier: string) => Promise<void>
  onCreateIssue?: (state: string) => void
}) {
  const handleCreateClick = (columnId: string) => {
    if (columnId !== 'backlog') return
    if (!onCreateIssue) return
    onCreateIssue('Backlog')
  }

  const [stateFilter, setStateFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>(projects.length === 1 ? projects[0].id : 'all')
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [issueToDelete, setIssueToDelete] = useState<{ identifier: string; title?: string } | null>(null)
  const [deleteTaskPending, setDeleteTaskPending] = useState(false)
  const [deleteTaskError, setDeleteTaskError] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState<string | null>(null)
  const [dragValidationMsg, setDragValidationMsg] = useState<string | null>(null)
  const [columnOrder, setColumnOrder] = useState<string[]>(['backlog', 'todo', 'progress', 'review', 'done'])
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null)

  const osOptions = useMemo(() => ({
    scrollbars: { autoHide: 'move' as const, theme: 'os-theme-custom' },
    overflow: { x: 'hidden' as const, y: 'scroll' as const },
  }), [])

  useEffect(() => {
    if (projects.length === 1) {
      setProjectFilter(projects[0].id)
    }
  }, [projects])

  const isNoDragTarget = (target: EventTarget | null) => {
    return target instanceof Element && !!target.closest('[data-no-drag="true"]')
  }

  const handleDragStart = (e: React.DragEvent, issueIdentifier: string) => {
    if (isNoDragTarget(e.target)) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('issueIdentifier', issueIdentifier)
    e.dataTransfer.setData('type', 'issue')
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleColumnDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData('columnId', columnId)
    e.dataTransfer.setData('type', 'column')
    setDraggingColumnId(columnId)
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setIsDraggingOver(columnId)
  }

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    setIsDraggingOver(null)
    setDraggingColumnId(null)

    const type = e.dataTransfer.getData('type')
    if (type === 'column') {
      const sourceColumnId = e.dataTransfer.getData('columnId')
      if (!sourceColumnId || sourceColumnId === targetColumnId) return

      const newOrder = [...columnOrder]
      const sourceIdx = newOrder.indexOf(sourceColumnId)
      const targetIdx = newOrder.indexOf(targetColumnId)
      newOrder.splice(sourceIdx, 1)
      newOrder.splice(targetIdx, 0, sourceColumnId)
      setColumnOrder(newOrder)
      return
    }

    const issueIdentifier = e.dataTransfer.getData('issueIdentifier')
    if (!issueIdentifier || !onIssueUpdate) return

    const allowedDragTransitions: Record<string, string[]> = {
      backlog: ['todo'],
      todo: ['progress'],
      progress: [],      // Auto-moves to review on completion
      review: ['done'],
      done: [],           // Terminal
    }

    // Find the issue being dragged to determine its current column
    const issue = boardIssues.find(
      (i) => (i.identifier || i.issue_identifier) === issueIdentifier
    )
    if (!issue) return

    const currentColumnId = STATE_TO_COLUMN[issue.state] || ''
    if (currentColumnId === targetColumnId) return

    // Check if the transition is allowed
    const allowed = allowedDragTransitions[currentColumnId]
    if (!allowed || !allowed.includes(targetColumnId)) return

    // For Backlog -> Todo: require description, assignee, and project
    if (currentColumnId === 'backlog' && targetColumnId === 'todo') {
      const missing: string[] = []
      if (!issue.description) missing.push('description')
      if (!issue.assignee_id || issue.assignee_id === 'Unassigned') missing.push('an assigned agent')
      if (!issue.project_id) missing.push('a project')
      if (missing.length > 0) {
        setDragValidationMsg(`Cannot move to Todo — needs ${missing.join(', ')}`)
        setTimeout(() => setDragValidationMsg(null), 4000)
        return
      }
    }

    const nextState = COLUMN_TO_STATE[targetColumnId]
    if (nextState) {
      await onIssueUpdate(issueIdentifier, { state: nextState })
    }
  }

  const enrichedIssues = boardIssues.map((issue) => {
    const issueID = issue.issue_id || issue.id || ''
    let lane: EnrichedIssue['lane'] = null
    let detail = issue.title || issue.description || 'No Title'
    let at = issue.created_at || ''

    if (snapshot) {
      const running = snapshot.running?.find((r) => r.issue_id === issueID)
      if (running) {
        lane = 'running'
        detail = running.last_message || running.last_event || detail
        at = running.last_event_at || running.started_at || at
      } else {
        const retrying = snapshot.retrying?.find((r) => r.issue_id === issueID)
        if (retrying) {
          lane = 'retrying'
          detail = retrying.error || `attempt ${retrying.attempt}`
          at = retrying.due_at || at
        }
      }
    }

    return {
      ...issue,
      issue_id: issueID,
      issue_identifier: issue.identifier || issue.issue_identifier,
      lane,
      detail,
      at,
    }
  })

  const filterItem = (item: EnrichedIssue) => {
    const stateMatch = stateFilter === 'all' || item.state === stateFilter
    const projectMatch = projectFilter === 'all' || item.project_id === projectFilter
    return stateMatch && projectMatch
  }

  const stateIs = (s: string, target: string) => s.toLowerCase() === target.toLowerCase()
  const visibleIssues = enrichedIssues.filter(filterItem)
  const backlogItems = visibleIssues.filter((i) => stateIs(i.state, 'Backlog'))
  const todoItems = visibleIssues.filter((i) => stateIs(i.state, 'Todo'))
  const inProgressItems = visibleIssues.filter((i) => stateIs(i.state, 'In Progress'))
  const reviewItems = visibleIssues.filter((i) => stateIs(i.state, 'Review'))
  const doneItemsList = visibleIssues.filter((i) => stateIs(i.state, 'Done'))

  const columns: {
    id: string
    title: string
    items: EnrichedIssue[]
    icon: React.ReactNode
    accent: string
    accentText: string
    accentTint: string
  }[] = [
    {
      id: 'backlog',
      title: 'Backlog',
      items: backlogItems,
      icon: <div className="h-2 w-2 rounded-full border-2 border-muted-foreground/50" />,
      accent: 'bg-muted-foreground/50',
      accentText: 'text-muted-foreground',
      accentTint: 'bg-muted-foreground/[0.06]',
    },
    {
      id: 'todo',
      title: 'To Do',
      items: todoItems,
      icon: <div className="h-2 w-2 rounded-full border-2 border-foreground/70" />,
      accent: 'bg-foreground/70',
      accentText: 'text-foreground',
      accentTint: 'bg-foreground/[0.04]',
    },
    {
      id: 'progress',
      title: 'In Progress',
      items: inProgressItems,
      icon: <div className="h-2 w-2 rounded-full border-2 border-violet-500/80 bg-violet-500/80" />,
      accent: 'bg-violet-500/80',
      accentText: 'text-violet-700/90 dark:text-violet-300/90',
      accentTint: 'bg-violet-500/[0.05]',
    },
    {
      id: 'review',
      title: 'Review',
      items: reviewItems,
      icon: <div className="h-2 w-2 rounded-full border-2 border-blue-600/70 bg-blue-600/70" />,
      accent: 'bg-blue-600/70',
      accentText: 'text-blue-700/90 dark:text-blue-300/85',
      accentTint: 'bg-blue-500/[0.04]',
    },
    {
      id: 'done',
      title: 'Done',
      items: doneItemsList,
      icon: <div className="h-2 w-2 rounded-full bg-emerald-600/70" />,
      accent: 'bg-emerald-600/70',
      accentText: 'text-emerald-700/90 dark:text-emerald-300/85',
      accentTint: 'bg-emerald-500/[0.04]',
    },
  ]

  const orderedColumns = columnOrder.map((id) => columns.find((column) => column.id === id)!)
  const filteredList = enrichedIssues.filter(filterItem)

  const getActionIssueRef = (item: EnrichedIssue): string => item.issue_identifier || item.issue_id || ''

  if (loadingState && enrichedIssues.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-6">
        <div className="flex items-center gap-3 border-b border-border/40 pb-4 shrink-0">
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-8 w-40 rounded-md" />
        </div>
        <div className="flex-1 grid grid-cols-5 gap-3 overflow-hidden px-4">
          {['backlog', 'todo', 'progress', 'review', 'done'].map((column) => (
            <div key={column} className="flex flex-col min-h-0 space-y-4">
              <div className="flex items-center justify-between px-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              <div className="flex-1 space-y-3 overflow-hidden p-1">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="bg-card/40 border border-border/50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <Skeleton className="h-4 w-16 rounded" />
                      <Skeleton className="h-4 w-4 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-2/3 rounded" />
                    <div className="pt-2 flex gap-2">
                      <Skeleton className="h-4 w-12 rounded-full" />
                      <Skeleton className="h-4 w-12 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleCreateClick('backlog')}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 text-[12px] font-semibold tracking-tight transition-colors"
          >
            <Plus size={13} />
            Create Task
          </button>
          {viewMode === 'list' && (
            <CustomDropdown
              className="w-40"
              value={stateFilter}
              options={[
                { label: 'All States', value: 'all', icon: <CircleDashed className="h-3 w-3" /> },
                { label: 'Backlog', value: 'Backlog', icon: <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> },
                { label: 'Todo', value: 'Todo', icon: <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> },
                { label: 'In Progress', value: 'In Progress', icon: <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> },
                { label: 'Review', value: 'Review', icon: <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> },
                { label: 'Done', value: 'Done', icon: <div className="h-1.5 w-1.5 rounded-full bg-primary" /> },
              ]}
              onChange={setStateFilter}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <CustomDropdown
              className="w-56"
              value={projectFilter}
              options={[
                { label: 'All Projects', value: 'all', icon: <FolderTree className="h-3 w-3" /> },
                ...projects.map((project) => ({ label: project.name, value: project.id, icon: <Folder className="h-3 w-3" /> })),
              ]}
              onChange={setProjectFilter}
            />
          )}
          <div className="flex items-center rounded-md bg-muted/30 p-0.5">
            <AppTooltip content="Board view">
              <button
                onClick={() => setViewMode('board')}
                className={`grid h-7 w-8 place-items-center rounded transition-colors ${viewMode === 'board' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/60 hover:text-foreground'}`}
              >
                <Layout className="h-3.5 w-3.5" />
              </button>
            </AppTooltip>
            <AppTooltip content="List view">
              <button
                onClick={() => setViewMode('list')}
                className={`grid h-7 w-8 place-items-center rounded transition-colors ${viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/60 hover:text-foreground'}`}
              >
                <Rows className="h-3.5 w-3.5" />
              </button>
            </AppTooltip>
          </div>
        </div>
      </div>

      {dragValidationMsg && (
        <div className="mx-4 mb-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] font-bold animate-in fade-in slide-in-from-top-2 duration-300">
          {dragValidationMsg}
        </div>
      )}

      {viewMode === 'board' ? (
        <div className="flex-1 grid grid-cols-5 gap-3 min-h-0 px-5 pb-5">
          {orderedColumns.map((column) => (
            <div
              key={column.id}
              className={`flex flex-col gap-2.5 transition-opacity min-h-0 ${draggingColumnId === column.id ? 'opacity-40' : ''}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={() => setIsDraggingOver(null)}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div
                className={`flex cursor-grab items-center justify-between rounded-md px-2.5 py-1.5 active:cursor-grabbing shrink-0 group/header ${column.accentTint}`}
                draggable
                onDragStart={(e) => handleColumnDragStart(e, column.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`block h-1.5 w-1.5 rounded-full ${column.accent} shadow-[0_0_0_3px_var(--background)]`} />
                  <h3 className={`text-[12.5px] font-semibold tracking-tight truncate ${column.accentText}`}>{column.title}</h3>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-background/80 text-[10px] font-bold tabular-nums ${column.accentText}`}>
                    {column.items.length}
                  </span>
                </div>
              </div>

              <div className={`relative flex-1 flex flex-col min-h-0 transition-all overflow-hidden ${
                isDraggingOver === column.id
                  ? 'surface !border-primary/50 !shadow-primary/20'
                  : 'surface'
              }`}>
                <div className={`absolute top-0 left-0 right-0 h-[3px] ${column.accent}`} />
                <OverlayScrollbarsComponent
                  element="div"
                  options={osOptions}
                  className="flex-1 flex flex-col gap-2 p-2 min-h-0"
                >
                {loadingState ? (
                  Array.from({ length: 3 }).map((_, idx) => <Skeleton key={idx} className="h-24 w-full rounded-md" />)
                ) : column.items.length === 0 ? (
                  column.id === 'backlog' ? (
                    <button
                      type="button"
                      className="w-full min-h-full flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border border-dashed border-border/50 bg-background/40 hover:border-primary/50 hover:bg-primary/[0.04] transition-all group/empty"
                      onClick={() => handleCreateClick(column.id)}
                    >
                      <div className="h-7 w-7 rounded-full bg-muted/40 grid place-items-center group-hover/empty:bg-primary/15 transition-colors">
                        <Plus className="h-3.5 w-3.5 text-muted-foreground/60 group-hover/empty:text-primary transition-colors" />
                      </div>
                      <p className="text-[11px] font-semibold text-muted-foreground/60 group-hover/empty:text-foreground transition-colors">Add task</p>
                    </button>
                  ) : (
                    <div className={`w-full min-h-full flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/40 ${column.accentTint}`}>
                      <span className={`block h-1.5 w-1.5 rounded-full ${column.accent} opacity-50`} />
                      <p className="text-[10px] font-medium tracking-wide text-muted-foreground/55">No tasks here</p>
                    </div>
                  )
                ) : (
                  column.items.map((item) => {
                    return (
                      <Card
                        key={item.issue_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, getActionIssueRef(item))}
                        className="group relative cursor-grab border border-border/50 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-px active:cursor-grabbing active:translate-y-0 rounded-lg shadow-sm"
                        onClick={() => void onInspectIssue(getActionIssueRef(item))}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-[10px] font-semibold tracking-tight text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                            {item.issue_identifier}
                          </span>
                          <div className="flex items-center gap-1">
                            {item.url && typeof item.url === 'string' && item.url.includes('github.com') && (
                              <Github size={10} className="text-muted-foreground/30" />
                            )}
                            <div
                              data-no-drag="true"
                              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {item.state === 'Todo' && item.assignee_id && item.assignee_id !== 'Unassigned' && onIssueUpdate && (
                                <AppTooltip content="Launch agent session">
                                  <button
                                    type="button"
                                    data-no-drag="true"
                                    className="p-1 rounded text-muted-foreground/60 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void onIssueUpdate(getActionIssueRef(item), { state: 'In Progress' })
                                    }}
                                  >
                                    <Play className="h-2.5 w-2.5 fill-current" />
                                  </button>
                                </AppTooltip>
                              )}
                              {item.state === 'In Progress' && onStopSession && (
                                <AppTooltip content="Stop session">
                                  <button
                                    type="button"
                                    data-no-drag="true"
                                    className="p-1 rounded text-muted-foreground/60 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void onStopSession(getActionIssueRef(item))
                                    }}
                                  >
                                    <Square className="h-2 w-2 fill-current" />
                                  </button>
                                </AppTooltip>
                              )}
                              {onIssueDelete && (
                                <AppTooltip content="Delete">
                                  <button
                                    type="button"
                                    data-no-drag="true"
                                    aria-label={`Delete task ${item.issue_identifier}`}
                                    className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeleteTaskError('')
                                      setIssueToDelete({ identifier: getActionIssueRef(item), title: item.title })
                                      setDeleteDialogOpen(true)
                                    }}
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                </AppTooltip>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[12.5px] font-semibold leading-snug text-foreground/90 group-hover:text-foreground transition-colors">
                          {item.title || item.description || item.last_message || item.error || 'No message'}
                        </p>
                        {projects.length > 1 && item.project_id && (
                          <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/60">
                            <Folder className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{projects.find(p => p.id === item.project_id)?.name}</span>
                          </span>
                        )}
                        <div className="mt-2.5 flex items-center justify-between gap-2 overflow-hidden">
                          <div data-no-drag="true" className="min-w-0">
                            <AgentSelector
                              value={item.assignee_id || ''}
                              agents={availableAgents}
                              onChange={(value) => {
                                if (onIssueUpdate) {
                                   const agentName = value.replace('agent-', '')
                                   void onIssueUpdate(getActionIssueRef(item), { assignee_id: value, provider: agentName })
                                }
                              }}
                            />
                          </div>
                          {item.session_id ? (
                            <AppTooltip content="Live session">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            </AppTooltip>
                          ) : null}
                        </div>
                      </Card>
                    )
                  })
                )}
                </OverlayScrollbarsComponent>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 rounded-xl border bg-card/50 shadow-lg overflow-hidden min-h-0 flex flex-col mx-4">
          {filteredList.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-muted-foreground/40">
              <ClipboardList className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm italic uppercase tracking-widest font-bold">No tasks match current filters</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/80 backdrop-blur text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    <th className="px-4 py-3 w-24">ID</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3 w-32">Assignee</th>
                    <th className="px-4 py-3 w-28">Status</th>
                    <th className="px-4 py-3 w-20 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredList.map((item) => (
                    <tr
                      key={item.issue_id}
                      className="group hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => void onInspectIssue(getActionIssueRef(item))}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-primary">{item.issue_identifier}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {item.title || item.detail || 'No Title'}
                          </span>
                          {item.lane === 'running' && (
                            <AppTooltip content="Live session">
                              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            </AppTooltip>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <AgentSelector
                          value={item.assignee_id || ''}
                          agents={availableAgents}
                          onChange={(value) => {
                            if (onIssueUpdate) {
                                const agentName = value.replace('agent-', '')
                                void onIssueUpdate(getActionIssueRef(item), { assignee_id: value, provider: agentName })
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 rounded-full ${item.state === 'Done' ? 'bg-primary' : item.state === 'In Progress' ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                          <span className="text-xs font-medium text-muted-foreground">{item.state}</span>
                        </div>
                      </td>
                      <td className="px-2 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.state === 'Todo' && item.assignee_id && item.assignee_id !== 'Unassigned' && onIssueUpdate && (
                            <button
                              type="button"
                              className="p-1 rounded-md text-emerald-500/60 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-95"
                              onClick={(e) => {
                                e.stopPropagation()
                                void onIssueUpdate(getActionIssueRef(item), { state: 'In Progress' })
                              }}
                            >
                              <Play className="h-3.5 w-3.5 fill-current" />
                            </button>
                          )}
                          {item.state === 'In Progress' && onStopSession && (
                            <button
                              type="button"
                              className="p-1 rounded-md text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10 transition-all active:scale-95"
                              onClick={(e) => {
                                e.stopPropagation()
                                void onStopSession(getActionIssueRef(item))
                              }}
                            >
                              <Square className="h-3 w-3 fill-current" />
                            </button>
                          )}
                          {onIssueDelete && (
                            <button
                              type="button"
                              aria-label={`Delete task ${item.issue_identifier}`}
                              className="p-1 rounded-md text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTaskError('')
                                setIssueToDelete({ identifier: getActionIssueRef(item), title: item.title })
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="h-5 w-5" />
              Delete Task
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {issueToDelete && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-mono text-primary">{issueToDelete.identifier}</p>
                {issueToDelete.title && (
                  <p className="mt-1 text-sm text-muted-foreground">{issueToDelete.title}</p>
                )}
              </div>
            )}
            {deleteTaskError ? (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {deleteTaskError}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setIssueToDelete(null)
                setDeleteTaskError('')
              }}
              disabled={deleteTaskPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (issueToDelete && onIssueDelete) {
                  setDeleteTaskPending(true)
                  setDeleteTaskError('')
                  try {
                    await onIssueDelete(issueToDelete.identifier)
                    setDeleteDialogOpen(false)
                    setIssueToDelete(null)
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to delete task'
                    setDeleteTaskError(message)
                    // Keep dialog open so the operator can retry after inline error feedback.
                  } finally {
                    setDeleteTaskPending(false)
                  }
                  return
                }
                setDeleteDialogOpen(false)
                setIssueToDelete(null)
              }}
              disabled={deleteTaskPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteTaskPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
