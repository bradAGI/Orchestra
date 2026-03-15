import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Ansi from 'ansi-to-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Activity, AlertCircle, AlertTriangle, AppWindow, Bell, Bot, Check, CheckCircle2, ChevronDown, Circle, CircleDashed, Cpu, Eye, EyeOff, FileText, Folder, FolderTree, GitBranch, Loader2, ListChecks, MoreHorizontal, ShieldCheck, SignalHigh, SignalLow, SignalMedium, Square, Terminal, User, Users, Globe, Wrench, Clock, Search, LayoutDashboard, ListTodo, History, Ticket, Database, Settings2, Sun, Moon, Download, RefreshCcw, Info, BarChart3, Zap, Layout, Rows, Play, ChevronRight, File, ExternalLink, Plus, Trash2, Keyboard, X, TrendingUp, Code, Layers, Mic, Volume2, VolumeX } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppTooltip } from '../ui/tooltip-wrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { getWhisperClient, type WhisperStatus } from '@/lib/whisper-client'
import { TerminalView } from '@/components/terminal/TerminalView'
import {
  fetchArtifactContent,
  fetchArtifacts,
  fetchIssueDiff,
  fetchIssueLogs,
  fetchIssueHistory,
  updateIssue,
  createGitHubPR,
  type BackendConfig,
  type IssueCreatePayload,
  type IssueListItem,
  type MCPTool,
  type WorkspaceMigrationResult,
} from '@/lib/orchestra-client'
import type { SnapshotPayload, Project, ProjectStats, GlobalStats } from '@/lib/orchestra-types'
import { usePlatform } from '@/hooks/use-platform'
import { AgentSelector, CustomDropdown, ProjectSelector, getAgentIcon } from '@/components/app-shell/shared/controls'

type BackendProfile = {
  id: string
  name: string
  baseUrl: string
  apiToken: string
}

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

export function SettingsCard({
  loadingConfig,
  savingConfig,
  profilesPending,
  config,
  backendProfiles,
  activeProfileId,
  migrationPending,
  migrationFrom,
  migrationTo,
  migrationPlan,
  agentConfig,
  onMigrationFromChange,
  onMigrationToChange,
  onMigrationPlan,
  onMigrationApply,
  onSaveBackendConfig,
  onSetActiveProfile,
  onCreateProfile,
  onDeleteProfile,
  onSaveAgentConfig,
  notifSound,
  notifMuted,
  notifVolume,
  onNotifSoundChange,
  onNotifMutedChange,
  onNotifVolumeChange,
}: {
  loadingConfig: boolean
  savingConfig: boolean
  profilesPending: boolean
  config: BackendConfig | null
  backendProfiles: BackendProfile[]
  activeProfileId: string
  migrationPending: boolean
  migrationFrom: string
  migrationTo: string
  migrationPlan: WorkspaceMigrationResult | null
  agentConfig: { commands: Record<string, string>; agent_provider: string } | null
  onMigrationFromChange: (value: string) => void
  onMigrationToChange: (value: string) => void
  onMigrationPlan: () => Promise<void>
  onMigrationApply: () => Promise<void>
  onSaveBackendConfig: (nextConfig: BackendConfig) => Promise<void>
  onSetActiveProfile: (profileId: string) => Promise<void>
  onCreateProfile: (name: string) => Promise<void>
  onDeleteProfile: (profileId: string) => Promise<void>
  onSaveAgentConfig: (config: { commands: Record<string, string>; agent_provider: string }) => Promise<void>
  notifSound?: string
  notifMuted?: boolean
  notifVolume?: number
  onNotifSoundChange?: (sound: string) => void
  onNotifMutedChange?: (muted: boolean) => void
  onNotifVolumeChange?: (volume: number) => void
}) {
  const { isMac } = usePlatform()
  const [activeTab, setActiveTab] = useState<'backend' | 'agents' | 'migration' | 'shortcuts' | 'notifications'>('backend')

  const tabs = [
    { id: 'backend', label: 'Backend', tooltip: 'Configure backend profiles and API connection', icon: <Database className="h-3.5 w-3.5" /> },
    { id: 'agents', label: 'Agents', tooltip: 'Set provider commands and default runner', icon: <Zap className="h-3.5 w-3.5" /> },
    { id: 'notifications', label: 'Notifications', tooltip: 'Sound and notification preferences', icon: <Bell className="h-3.5 w-3.5" /> },
    { id: 'migration', label: 'Migration', tooltip: 'Plan and apply workspace migrations', icon: <RefreshCcw className="h-3.5 w-3.5" /> },
    { id: 'shortcuts', label: 'Shortcuts', tooltip: 'View global keyboard shortcuts', icon: <Keyboard className="h-3.5 w-3.5" /> },
  ] as const

  return (
    <Card className="group relative overflow-hidden border border-border/60 bg-gradient-to-br from-card via-card/98 to-muted/5 shadow-2xl shadow-primary/5 transition-all duration-500 flex flex-col flex-1">
      {/* Decorative premium elements */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl transition-all duration-1000 group-hover:bg-primary/10" />
      
      <CardHeader className="relative border-b border-border/40 pb-0 shrink-0 bg-muted/5 pt-4">
        <div className="flex items-center justify-between mb-4 px-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary shadow-inner">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xl font-black tracking-tighter">System Settings</CardTitle>
              <CardDescription className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                Fleet Configuration
              </CardDescription>
            </div>
          </div>
        </div>

        <div className="flex gap-1 px-2">
          {tabs.map((tab) => (
            <AppTooltip key={tab.id} content={tab.tooltip}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-t-lg ${activeTab === tab.id
                  ? 'text-primary bg-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            </AppTooltip>
          ))}
        </div>
      </CardHeader>

      <CardContent className="relative pt-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-background/30 backdrop-blur-sm px-6 flex flex-col">
        <div className="w-full flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-400">
          {activeTab === 'backend' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="group relative flex min-h-0 flex-1 flex-col rounded-2xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 p-6 shadow-sm transition-all hover:shadow-md overflow-hidden">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <BackendConfigForm
                  loadingConfig={loadingConfig}
                  savingConfig={savingConfig}
                  profilesPending={profilesPending}
                  config={config}
                  backendProfiles={backendProfiles}
                  activeProfileId={activeProfileId}
                  onSaveBackendConfig={onSaveBackendConfig}
                  onSetActiveProfile={onSetActiveProfile}
                  onCreateProfile={onCreateProfile}
                  onDeleteProfile={onDeleteProfile}
                  disabled={loadingConfig || savingConfig || profilesPending}
                />
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-6 flex-1 flex flex-col">
              {agentConfig ? (
                <div className="group relative rounded-2xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 p-6 shadow-sm transition-all hover:shadow-md overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <AgentConfigForm
                    agentConfig={agentConfig}
                    onSave={onSaveAgentConfig}
                    disabled={savingConfig || loadingConfig}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/5 py-16 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 opacity-20 mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No agent configuration loaded</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'migration' && (
            <div className="space-y-6 flex-1 flex flex-col">
              <div className="group relative rounded-2xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 p-6 shadow-sm transition-all hover:shadow-md overflow-hidden">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary/80">
                    <RefreshCcw className="h-4 w-4" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Workspace Transfer</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/20 italic">
                    Relocate issue workspaces across filesystem targets. This tool recursively copies git state, artifacts, and logs.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <WorkspaceMigrationDialog
                      migrationPending={migrationPending}
                      config={config}
                      migrationFrom={migrationFrom}
                      migrationTo={migrationTo}
                      migrationPlan={migrationPlan}
                      onMigrationFromChange={onMigrationFromChange}
                      onMigrationToChange={onMigrationToChange}
                      onMigrationPlan={onMigrationPlan}
                      onMigrationApply={onMigrationApply}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-6 pb-6 flex-1 flex flex-col">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Command Palette', desc: 'Search and navigate instantly', keys: [isMac ? '⌘' : 'Ctrl', 'K'] },
                  { label: 'Refresh Tracker', desc: 'Full state synchronization', keys: [isMac ? '⌘' : 'Ctrl', 'R'] },
                  { label: 'Toggle Sidebar', desc: 'Collapse/expand navigation', keys: [isMac ? '⌘' : 'Ctrl', '/'] },
                  { label: 'Quick Switch', desc: 'Back to operations overview', keys: [isMac ? '⌥' : 'Alt', '1'] },
                ].map((s, idx) => (
                  <div key={idx} className="group/item relative flex items-center justify-between p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 shadow-sm transition-all hover:border-primary/20 overflow-hidden">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black tracking-tight">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{s.desc}</p>
                    </div>
                    <div className="flex gap-1">
                      {s.keys.map(k => (
                        <kbd key={k} className="flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-lg bg-muted border border-border/60 text-[9px] font-black font-mono shadow-sm">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-dashed border-border/60 bg-muted/5 flex gap-3 items-start">
                <Info className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                  Custom shortcut remapping is currently in development and will be available in v1.1.0. 
                  This will include per-agent command overrides.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 pb-6">
              <div className="space-y-4">
                <div className="group relative flex items-center justify-between p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-black tracking-tight">Mute All Sounds</p>
                    <p className="text-[10px] text-muted-foreground">Disable notification sounds when agents complete</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${!notifMuted ? 'text-primary' : 'text-muted-foreground/30'}`}>On</span>
                    <button
                      onClick={() => {
                        const next = !notifMuted
                        onNotifMutedChange?.(next)
                        localStorage.setItem('orchestra_notif_muted', String(next))
                      }}
                      className={`h-8 w-14 rounded-full transition-colors ${notifMuted ? 'bg-muted' : 'bg-primary'} relative`}
                    >
                      <div className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${notifMuted ? 'left-7' : 'left-1'}`} />
                    </button>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${notifMuted ? 'text-red-400' : 'text-muted-foreground/30'}`}>Mute</span>
                  </div>
                </div>

                <div className="group relative p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 space-y-3 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black tracking-tight">Notification Sound</p>
                      <p className="text-[10px] text-muted-foreground">Sound played when an agent completes a task</p>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          const vol = notifVolume ?? 0.3
                          const sound = notifSound ?? 'chime'
                          const ctx = new AudioContext()
                          const g = ctx.createGain()
                          g.connect(ctx.destination)
                          g.gain.setValueAtTime(vol, ctx.currentTime)
                          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
                          const osc = ctx.createOscillator()
                          osc.connect(g)
                          if (sound === 'bell') {
                            osc.type = 'sine'
                            osc.frequency.setValueAtTime(1047, ctx.currentTime)
                            osc.frequency.exponentialRampToValueAtTime(523, ctx.currentTime + 0.3)
                          } else if (sound === 'pulse') {
                            osc.type = 'square'
                            osc.frequency.setValueAtTime(440, ctx.currentTime)
                            osc.frequency.setValueAtTime(440, ctx.currentTime + 0.05)
                            osc.frequency.setValueAtTime(0, ctx.currentTime + 0.1)
                            osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15)
                          } else {
                            osc.frequency.setValueAtTime(880, ctx.currentTime)
                            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
                            osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2)
                          }
                          osc.start(ctx.currentTime)
                          osc.stop(ctx.currentTime + 0.5)
                          osc.onended = () => ctx.close()
                        } catch { /* ignore */ }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      <Play size={10} />
                      Test
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { id: 'chime', label: 'Chime' },
                      { id: 'bell', label: 'Bell' },
                      { id: 'pulse', label: 'Pulse' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          onNotifSoundChange?.(s.id)
                          localStorage.setItem('orchestra_notif_sound', s.id)
                        }}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                          notifSound === s.id
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                            : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="group relative p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 space-y-3 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black tracking-tight">Volume</p>
                      <p className="text-[10px] text-muted-foreground">{Math.round((notifVolume ?? 0.3) * 100)}%</p>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={notifVolume ?? 0.3}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      onNotifVolumeChange?.(v)
                      localStorage.setItem('orchestra_notif_volume', String(v))
                    }}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="group relative p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 space-y-3 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-black tracking-tight">Browser Notifications</p>
                    <p className="text-[10px] text-muted-foreground">Desktop notification when agents complete tasks</p>
                  </div>
                  <button
                    onClick={() => {
                      if ('Notification' in window) {
                        void Notification.requestPermission()
                      }
                    }}
                    className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-all"
                  >
                    {'Notification' in window ? `Status: ${Notification.permission}` : 'Not supported'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function AgentConfigForm({
  agentConfig,
  onSave,
  disabled,
}: {
  agentConfig: { commands: Record<string, string>; agent_provider: string }
  onSave: (config: { commands: Record<string, string>; agent_provider: string }) => Promise<void>
  disabled: boolean
}) {
  const [provider, setProvider] = useState(agentConfig.agent_provider || '')
  const [commands, setCommands] = useState(agentConfig.commands || {})

  const handleCommandChange = (key: string, value: string) => {
    setCommands((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Default Runner</h4>
          </div>
          <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
            <CustomDropdown
              className="w-full"
              value={provider}
              options={Object.keys(commands).map((p) => ({ label: p, value: p, icon: getAgentIcon(p) }))}
              onChange={setProvider}
              disabled={disabled}
              placeholder="Select provider..."
            />
          </div>
        </div>

        <div className="flex items-center p-4 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-[10px] text-muted-foreground leading-relaxed italic">
            Select the primary agent provider for new task executions. This can be overridden per-task.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Runner Executables</h4>
        </div>
        <div className="grid gap-2">
          {Object.keys(commands).length === 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 p-4 border border-dashed rounded-xl">No runners configured.</p>
          ) : Object.keys(commands).map((p) => (
            <div key={p} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/40 transition-all hover:bg-muted/30">
              <span className="min-w-[100px] text-[10px] font-black uppercase tracking-widest text-primary/70">{p}</span>
              <input
                className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={commands[p]}
                onChange={(e) => handleCommandChange(p, e.target.value)}
                placeholder="Executable path or command..."
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border/40">
        <Button
          size="sm"
          onClick={() => void onSave({ agent_provider: provider, commands })}
          disabled={disabled || !provider}
          className="px-6 font-black uppercase tracking-widest text-[9px] h-9 rounded-lg"
        >
          {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Update Agent Configuration'}
        </Button>
      </div>
    </div>
  )
}

export { IssueDetailView } from '@widgets/issue-detail/IssueDetailView'

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (path: string) => Promise<void>
}) {
  const [path, setPath] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) setPath('')
  }, [open])

  const handleBrowse = async () => {
    const desktopBridge = window.orchestraDesktop
    if (desktopBridge && typeof desktopBridge.selectFolder === 'function') {
      const selected = await desktopBridge.selectFolder()
      if (selected) {
        setPath(selected)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!path.trim()) return
    setPending(true)
    try {
      await onSubmit(path.trim())
      onOpenChange(false)
    } catch (error) {
      console.error('Project creation failed', error)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border shadow-2xl">
        <DialogHeader className="border-b border-border/40 pb-4">
          <DialogTitle className="text-xl font-bold tracking-tight">Add Project</DialogTitle>
          <DialogDescription className="text-muted-foreground/70">
            Enter the absolute path to your local git repository.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">Workspace Root Path</label>
            <div className="flex gap-2">
              <input
                autoFocus
                className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                placeholder="/home/user/projects/my-app"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowse}
                className="h-11 rounded-xl border-dashed px-3 text-muted-foreground hover:text-primary hover:border-primary/50"
                tooltip="Browse filesystem"
                aria-label="Browse filesystem"
              >
                <Folder className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !path.trim()}
              className="px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
            >
              {pending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Adding...</span>
                </div>
              ) : 'Add Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  config,
  initialState,
  availableAgents,
  allTools = [],
  projects = [],
  initialProjectID = '',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: BackendConfig | null
  initialState: string
  availableAgents: string[]
  allTools?: MCPTool[]
  projects?: Project[]
  initialProjectID?: string
  onSubmit: (payload: IssueCreatePayload) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [state, setState] = useState(initialState)
  const [assignee, setAssignee] = useState('Unassigned')
  const [provider, setProvider] = useState('')
  const [disabledTools, setDisabledTools] = useState<string[]>([])
  const [projectID, setProjectID] = useState(initialProjectID || (projects.length > 0 ? projects[0].id : ''))
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [recording, setRecording] = useState(false)
  const [whisperStatus, setWhisperStatus] = useState<WhisperStatus>({ state: 'idle' })
  const transcriptionCancelledRef = useRef(false)
  const activeFieldRef = useRef<'title' | 'description'>('description')

  useEffect(() => {
    if (open) {
      setState(initialState)
      setProjectID(initialProjectID || (projects.length > 0 ? projects[0].id : ''))
      setTitle('')
      setDescription('')
      setAssignee('Unassigned')
      setProvider(availableAgents.length > 0 ? availableAgents[0] : '')
      setDisabledTools([])
      setSubmitError('')
    }
  }, [open, initialState, initialProjectID, availableAgents, projects])

  useEffect(() => {
    if (!open) {
      const client = getWhisperClient()
      if (client.recording) {
        void client.stopRecording()
      }
      transcriptionCancelledRef.current = true
      setRecording(false)
      setWhisperStatus({ state: 'idle' })
    } else {
      transcriptionCancelledRef.current = false
    }
  }, [open])

  const handleToggleTool = (name: string) => {
    setDisabledTools(prev => 
      prev.includes(name) 
        ? prev.filter(t => t !== name) 
        : [...prev, name]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setPending(true)
    setSubmitError('')
    try {
      await onSubmit({
        title,
        description,
        state,
        assignee_id: assignee,
        project_id: projectID,
        provider,
        disabled_tools: disabledTools
      })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Task creation failed'
      setSubmitError(message)
    } finally {
      setPending(false)
    }
  }

  const startRecording = async () => {
    if (recording || whisperStatus.state !== 'idle') return
    try {
      const client = getWhisperClient(setWhisperStatus)
      await client.startRecording()
      setRecording(true)
      setSubmitError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Microphone access failed'
      setSubmitError(message)
    }
  }

  const stopRecording = async () => {
    if (!recording) return
    setRecording(false)
    try {
      const client = getWhisperClient(setWhisperStatus)
      const pcm = await client.stopRecording()
      if (pcm.length === 0 || transcriptionCancelledRef.current) return
      const text = await client.transcribe(pcm)
      if (!transcriptionCancelledRef.current && text.trim()) {
        if (activeFieldRef.current === 'title') {
          setTitle((prev) => (prev.trim() ? `${prev.trimEnd()} ${text.trim()}` : text.trim()))
        } else {
          setDescription((prev) => (prev.trim() ? `${prev.trimEnd()}\n${text.trim()}` : text.trim()))
        }
      }
    } catch (error) {
      if (!transcriptionCancelledRef.current) {
        const message = error instanceof Error ? error.message : 'Transcription failed'
        setSubmitError(message)
      }
    } finally {
      if (!transcriptionCancelledRef.current) {
        setWhisperStatus({ state: 'idle' })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card border-border/30 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] p-0 overflow-hidden min-h-[55vh] max-h-[85vh] flex flex-col rounded-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full flex-1">
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pb-4 space-y-4">
            <input
              autoFocus
              className="w-full bg-transparent border-none outline-none text-xl font-bold placeholder:text-muted-foreground/20 focus:ring-0 focus:outline-none p-0 selection:bg-primary/30"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => { activeFieldRef.current = 'title' }}
              required
            />
            <textarea
              className="w-full bg-transparent border-none outline-none text-sm text-foreground/70 placeholder:text-muted-foreground/15 focus:ring-0 focus:outline-none p-0 resize-none min-h-[80px] selection:bg-primary/20 leading-relaxed"
              placeholder="Describe the task for the agent..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={() => { activeFieldRef.current = 'description' }}
            />
          </div>

          {submitError && (
            <div className="mx-6 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {submitError}
            </div>
          )}

          <div className="px-4 py-3 flex items-center justify-between bg-muted/10">
            <div className="flex items-center gap-1">
              <ProjectSelector
                value={projectID}
                projects={projects}
                onChange={setProjectID}
              />
              <div className="w-px h-4 bg-border/20 mx-1" />
              <AgentSelector
                value={assignee}
                agents={availableAgents}
                onChange={(val) => {
                  setAssignee(val)
                  const agentName = val.replace('agent-', '')
                  if (availableAgents.includes(agentName)) {
                    setProvider(agentName)
                  } else if (val === '') {
                    setProvider(availableAgents.length > 0 ? availableAgents[0] : '')
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onPointerDown={(event) => {
                  event.preventDefault()
                  void startRecording()
                }}
                onPointerUp={(event) => {
                  event.preventDefault()
                  void stopRecording()
                }}
                onPointerLeave={() => {
                  void stopRecording()
                }}
                onPointerCancel={() => {
                  void stopRecording()
                }}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault()
                    void startRecording()
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault()
                    void stopRecording()
                  }
                }}
                disabled={whisperStatus.state !== 'idle' && !recording}
                className={`h-7 px-3 text-[10px] font-bold uppercase tracking-widest touch-none ${
                  recording
                    ? 'text-red-400'
                    : whisperStatus.state !== 'idle'
                      ? 'text-amber-400'
                      : 'text-muted-foreground/50 hover:text-foreground'
                }`}
              >
                {recording ? (
                  <><Square className="h-3 w-3 mr-1" /> Release to Stop</>
                ) : whisperStatus.state === 'loading' ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading {whisperStatus.progress}%</>
                ) : whisperStatus.state === 'transcribing' ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Transcribing...</>
                ) : (
                  <><Mic className="h-3 w-3 mr-1" /> Hold to Talk</>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={pending}
                className="text-muted-foreground/40 hover:text-foreground h-7 px-3 text-[10px] font-bold uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending || !title.trim() || !projectID}
                className="h-7 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-[10px] disabled:opacity-30"
              >
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BackendConfigForm({
  loadingConfig,
  savingConfig,
  profilesPending,
  config,
  backendProfiles,
  activeProfileId,
  onSaveBackendConfig,
  onSetActiveProfile,
  onCreateProfile,
  onDeleteProfile,
  disabled,
}: {
  loadingConfig: boolean
  savingConfig: boolean
  profilesPending: boolean
  config: BackendConfig | null
  backendProfiles: BackendProfile[]
  activeProfileId: string
  onSaveBackendConfig: (nextConfig: BackendConfig) => Promise<void>
  onSetActiveProfile: (profileId: string) => Promise<void>
  onCreateProfile: (name: string) => Promise<void>
  onDeleteProfile: (profileId: string) => Promise<void>
  disabled?: boolean
}) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [newProfileName, setNewProfileName] = useState('')
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    setBaseUrl(config?.baseUrl ?? '')
    setApiToken(config?.apiToken ?? '')
  }, [config])

  const syncFromConfig = () => {
    setBaseUrl(config?.baseUrl ?? '')
    setApiToken(config?.apiToken ?? '')
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-center justify-between pb-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-wider">Connection Profiles</h3>
        </div>
      </div>

      <div className="grid flex-1 content-start gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Profile Management</h4>
          </div>
          
          <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/40">
            <label className="space-y-1.5 block">
              <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1">Active Profile</span>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <CustomDropdown
                    className="w-full"
                    value={activeProfileId}
                    options={backendProfiles.map((p) => ({ label: p.name, value: p.id, icon: <ShieldCheck className="h-3 w-3" /> }))}
                    onChange={(val) => void onSetActiveProfile(val)}
                    disabled={disabled || backendProfiles.length === 0}
                  />
                  {profilesPending && (
                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Delete"
                  className="h-9 px-3 rounded-lg border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
                  disabled={disabled || backendProfiles.length <= 1 || activeProfileId === ''}
                  onClick={(e) => {
                    e.preventDefault()
                    if (activeProfileId !== '') {
                      void onDeleteProfile(activeProfileId)
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </label>

            <label className="space-y-1.5 block pt-2 border-t border-border/20">
              <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1">New Profile</span>
              <div className="flex gap-2">
                <input
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Production, Staging, Local..."
                  disabled={disabled}
                />
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Create"
                  className="h-9 px-3 rounded-lg bg-primary/5 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                  disabled={disabled || newProfileName.trim() === ''}
                  onClick={() => {
                    void onCreateProfile(newProfileName.trim())
                    setNewProfileName('')
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SignalHigh className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Connection Parameters</h4>
          </div>

          <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/40">
            <label className="space-y-1.5 block">
              <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1">Endpoint URL</span>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                  <Globe className="h-3 w-3" />
                </div>
                <input
                  className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="http://127.0.0.1:4010"
                  disabled={disabled}
                />
              </div>
            </label>

            <label className="space-y-1.5 block">
              <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1">Access Token</span>
              <div className="relative group/token">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within/token:text-primary/60 transition-colors">
                  <ShieldCheck className="h-3 w-3" />
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-9 text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  value={apiToken}
                  onChange={(event) => setApiToken(event.target.value)}
                  placeholder="Bearer token (optional)"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-all"
                  title={showToken ? 'Hide token' : 'Reveal token'}
                >
                  {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-foreground h-9 px-4"
            onClick={syncFromConfig}
            disabled={disabled}
          >
            <RefreshCcw className="h-3 w-3 mr-2" />
            Revert
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-primary/40 px-3 border-l border-border/20">
            <Info className="h-3 w-3" />
            <span className="text-[9px] font-medium italic">Base URL changes trigger reconnect.</span>
          </div>
        </div>
        <Button 
          onClick={() => void onSaveBackendConfig({ baseUrl: baseUrl.trim(), apiToken: apiToken.trim() })} 
          disabled={disabled || baseUrl.trim() === ''}
          className="px-6 shadow-lg shadow-primary/20 font-black uppercase tracking-widest text-[9px] h-9 rounded-lg"
        >
          {savingConfig ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Backend Config'}
        </Button>
      </div>
    </div>
  )
}


function WorkspaceMigrationDialog({
  migrationPending,
  config,
  migrationFrom,
  migrationTo,
  migrationPlan,
  onMigrationFromChange,
  onMigrationToChange,
  onMigrationPlan,
  onMigrationApply,
}: {
  migrationPending: boolean
  config: BackendConfig | null
  migrationFrom: string
  migrationTo: string
  migrationPlan: WorkspaceMigrationResult | null
  onMigrationFromChange: (value: string) => void
  onMigrationToChange: (value: string) => void
  onMigrationPlan: () => Promise<void>
  onMigrationApply: () => Promise<void>
}) {
  const [confirmApply, setConfirmApply] = useState(false)

  const handleApply = () => {
    if (!confirmApply) {
      setConfirmApply(true)
      return
    }
    void onMigrationApply()
    setConfirmApply(false)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-full border bg-muted/50 px-4 text-foreground hover:bg-accent dark:text-foreground dark:hover:bg-accent">
          Workspace Migration
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workspace Migration</DialogTitle>
          <DialogDescription>Mapped to `/api/v1/workspace/migration/plan` and `/api/v1/workspace/migrate`.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-muted-foreground">From</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={migrationFrom}
              onChange={(event) => onMigrationFromChange(event.target.value)}
              placeholder="optional source path"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-muted-foreground">To</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={migrationTo}
              onChange={(event) => onMigrationToChange(event.target.value)}
              placeholder="optional target path"
            />
          </label>
          {migrationPlan ? (
            <pre className="max-h-56 overflow-auto rounded-md border border-border bg-muted/20 p-3 text-xs">{JSON.stringify(migrationPlan, null, 2)}</pre>
          ) : null}
          {confirmApply ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
              Confirm migration apply. This triggers `/api/v1/workspace/migrate`.
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmApply(false)
              void onMigrationPlan()
            }}
            disabled={migrationPending || !config}
          >
            Plan
          </Button>
          <Button onClick={handleApply} disabled={migrationPending || !config}>
            {confirmApply ? 'Confirm Apply' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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

export { KanbanBoard } from '@widgets/kanban/KanbanBoard'
export { OperationsQueueCard } from '@widgets/running/OperationsQueueCard'
