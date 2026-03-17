import { useMemo, type ReactNode } from 'react'
import { BarChart3, ChevronRight, Cpu, Folder, FolderTree, Layout, Plus, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { IssueListItem } from '@/lib/orchestra-client'
import type { SnapshotPayload, Project, ProjectStats, GlobalStats } from '@/lib/orchestra-types'

function IconButton({ icon, title, onClick, className = '' }: { icon: ReactNode; title: string; onClick?: () => void; className?: string }) {
  return (
    <AppTooltip content={title}>
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        className={`grid h-8 w-8 place-items-center rounded-lg bg-transparent text-muted-foreground transition hover:bg-muted hover:text-foreground ${className}`}
      >
        {icon}
      </button>
    </AppTooltip>
  )
}

/**
 * Main operations hub dashboard showing fleet metrics, active projects,
 * and runtime event streams. Serves as the landing page for the app.
 */
export function DashboardOverview({
  projects,
  issues,
  stats,
  snapshot,
  warehouseStats,
  onProjectClick,
  onJumpToTerminal,
  onCreateTask,
}: {
  projects: Project[]
  issues: IssueListItem[]
  stats: Record<string, ProjectStats>
  snapshot: SnapshotPayload | null
  warehouseStats: GlobalStats | null
  onProjectClick: (id: string) => void
  onJumpToTerminal?: (identifier: string) => void
  onCreateTask?: () => void
}) {
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      // 1. Check for active sessions in snapshot
      // Map running issue IDs to their project IDs using the issues list
      const activeProjectIds = new Set(
        snapshot?.running
          ?.map((running) => issues.find((issue) => (issue.id === running.issue_id || issue.issue_id === running.issue_id))?.project_id)
          .filter(Boolean)
      )

      const aActive = activeProjectIds.has(a.id)
      const bActive = activeProjectIds.has(b.id)
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1

      // 2. Next by priority stats
      const aStats = stats[a.id]
      const bStats = stats[b.id]
      if (aStats && bStats) {
        if (aStats.total_sessions > bStats.total_sessions) return -1
        if (aStats.total_sessions < bStats.total_sessions) return 1
      }
      return a.name.localeCompare(b.name)
    })
  }, [projects, stats, snapshot, issues])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black tracking-tighter">Operations Hub</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Fleet Monitoring & Command</p>
        </div>
        <div className="flex gap-2">
          {onCreateTask && (
            <Button
              size="sm"
              onClick={onCreateTask}
              className="h-8 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-[10px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Task
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
          <MetricCard
            title="Active Agents"
            value={snapshot?.running?.length.toString() || '0'}
            hint={`${snapshot?.counts?.running || 0} tasks currently executing across fleet`}
            icon={<Cpu className="h-4 w-4" />}
          />
          <MetricCard
            title="Total Throughput"
            value={warehouseStats?.total_tokens?.toString() || '0'}
            hint="Cumulative tasks finalized since epoch"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <MetricCard
            title="Project Load"
            value={projects.length.toString()}
            hint="Repositories managed by this control plane"
            icon={<FolderTree className="h-4 w-4" />}
          />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Layout className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest">Active Projects</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sortedProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onProjectClick(project.id)}
                  className="group relative p-6 rounded-3xl border border-border/60 bg-gradient-to-b from-card via-card to-muted/20 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 cursor-pointer overflow-hidden"
                >
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-black tracking-tight text-lg">{project.name}</h4>
                        <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]">{project.root_path}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-3 rounded-2xl bg-muted/30 border border-border/20">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">In Progress</p>
                        <p className="text-xl font-black tabular-nums">{stats[project.id]?.total_sessions || 0}</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-muted/30 border border-border/20">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Completed</p>
                        <p className="text-xl font-black tabular-nums">{((stats[project.id]?.total_input || 0) + (stats[project.id]?.total_output || 0)).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest">Runtime Events</h3>
            </div>
            <div className="h-full min-h-[400px]">
              <div className="text-center text-muted-foreground/30 py-8 text-xs">Events will appear here</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * A styled metric card displaying a single KPI with title, large value, hint text, and an icon.
 * Used in the dashboard overview for fleet-level statistics.
 */
export function MetricCard({ title, value, hint, icon }: { title: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <Card className="group relative overflow-hidden border border-border/60 bg-gradient-to-br from-card via-card/95 to-muted/20 shadow-lg shadow-primary/5 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 hover:-translate-y-1">
      {/* Subtle glowing overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Premium corner element */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rotate-12 rounded-3xl border border-primary/10 bg-primary/5 shadow-inner transition-all duration-700 group-hover:rotate-0 group-hover:scale-125 group-hover:bg-primary/10" />

      <CardHeader className="relative p-5 pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/40 shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
            {title}
          </CardDescription>
          <div className="rounded-xl bg-muted/50 p-2 text-primary/70 transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:rotate-3">
            {icon}
          </div>
        </div>
        <CardTitle className="mt-2 text-4xl font-black tracking-tighter tabular-nums transition-all duration-500 group-hover:translate-x-1 group-hover:text-primary">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative px-5 pb-5 pt-0">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
          <p className="text-[11px] text-muted-foreground/80 font-medium leading-tight transition-colors duration-500 group-hover:text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}
