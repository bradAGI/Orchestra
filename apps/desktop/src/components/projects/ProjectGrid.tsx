import React, { useState, useMemo, useCallback } from 'react'
import {
  Folder, GitBranch, Search, Plus, Trash2,
  Zap, History, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import type { Project, ProjectStats } from '@/lib/orchestra-types'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function relativeTime(iso: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Sortable list view
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'path' | 'sessions' | 'tokens' | 'active'
type SortDir = 'asc' | 'desc'

function SortHeader({ label, sortKey, currentKey, currentDir, onSort }: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
}) {
  const active = currentKey === sortKey
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors"
    >
      {label}
      {active ? (
        currentDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover/header:opacity-50" />
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ProjectGridProps {
  projects: Project[]
  stats: Record<string, ProjectStats>
  loading: boolean
  onProjectClick: (id: string) => void
  onAddProject?: () => void
  onDeleteProject?: (id: string) => void
}

export const ProjectGrid: React.FC<ProjectGridProps> = ({
  projects,
  stats,
  loading,
  onProjectClick,
  onAddProject,
  onDeleteProject,
}) => {
  const [search, setSearch] = useState('')
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const sorted = useMemo(() => {
    const filtered = projects.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.root_path.toLowerCase().includes(search.toLowerCase())
    )
    const dir = sortDir === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      const sa = stats[a.id]
      const sb = stats[b.id]
      switch (sortKey) {
        case 'name': return dir * a.name.localeCompare(b.name)
        case 'path': return dir * a.root_path.localeCompare(b.root_path)
        case 'sessions': return dir * ((sa?.total_sessions || 0) - (sb?.total_sessions || 0))
        case 'tokens': {
          const ta = (sa?.total_input || 0) + (sa?.total_output || 0)
          const tb = (sb?.total_input || 0) + (sb?.total_output || 0)
          return dir * (ta - tb)
        }
        case 'active': {
          const da = sa?.last_active ? new Date(sa.last_active).getTime() : 0
          const db = sb?.last_active ? new Date(sb.last_active).getTime() : 0
          return dir * (da - db)
        }
        default: return 0
      }
    })
    return filtered
  }, [projects, stats, search, sortKey, sortDir])

  const handleDeleteConfirm = () => {
    if (projectToDelete && onDeleteProject) {
      onDeleteProject(projectToDelete.id)
      setProjectToDelete(null)
    }
  }

  if (loading && projects.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg animate-pulse">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9 pr-4 h-9 bg-muted/30 border border-border/40 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-muted-foreground/30"
            />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">
            {sorted.length} project{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>

        <Button variant="default" size="sm" onClick={onAddProject} className="h-8 gap-1.5 bg-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 shadow-lg shadow-primary/20 px-3">
          <Plus size={14} />
          Add Project
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="p-6 rounded-2xl bg-muted/10 border border-border/20 mb-6">
              <Folder size={48} className="text-muted-foreground/15" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-black tracking-tight mb-1">{search ? 'No matches' : 'No Projects'}</h2>
            <p className="text-muted-foreground/40 max-w-xs text-xs">
              {search ? `Nothing matched "${search}"` : 'Add a local repository to get started.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Table header */}
            <div className="group/header flex items-center gap-3 px-4 py-2 border-b border-border/20 sticky top-0 bg-background/80 backdrop-blur-xl z-10">
              <div className="w-8" />
              <div className="flex-1 min-w-0">
                <SortHeader label="Name" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-48 hidden lg:block">
                <SortHeader label="Path" sortKey="path" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-20 text-right">
                <SortHeader label="Sessions" sortKey="sessions" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-20 text-right">
                <SortHeader label="Tokens" sortKey="tokens" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-20 text-right">
                <SortHeader label="Active" sortKey="active" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-7" />
            </div>

            {/* Rows */}
            {sorted.map((project) => {
              const s = stats[project.id]
              const totalTokens = (s?.total_input || 0) + (s?.total_output || 0)
              const hasGit = !!project.remote_url
              return (
                <div
                  key={project.id}
                  onClick={() => onProjectClick(project.id)}
                  className="group flex items-center gap-3 px-4 py-2.5 border-b border-border/10 cursor-pointer transition-colors hover:bg-muted/10"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/8 border border-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground transition-all duration-300">
                    <Folder className="w-4 h-4 text-primary group-hover:text-primary-foreground" strokeWidth={2} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">{project.name}</span>
                      {hasGit && <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground/30" />}
                    </div>
                  </div>

                  <div className="w-48 hidden lg:block">
                    <span className="text-[10px] font-mono text-muted-foreground/40 truncate block">{project.root_path}</span>
                  </div>

                  <div className="w-20 text-right">
                    <span className="text-xs font-bold tabular-nums text-muted-foreground/60">{s?.total_sessions || 0}</span>
                  </div>

                  <div className="w-20 text-right">
                    <span className="text-xs font-bold tabular-nums text-muted-foreground/60">{formatTokens(totalTokens)}</span>
                  </div>

                  <div className="w-20 text-right">
                    <span className="text-[10px] text-muted-foreground/40">{relativeTime(s?.last_active || '')}</span>
                  </div>

                  <div className="w-7 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground/30 hover:text-red-500"
                      data-testid="project-delete-btn"
                      onClick={(e) => { e.stopPropagation(); setProjectToDelete(project) }}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent className="sm:max-w-lg bg-popover border-border p-8">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="text-red-500" size={24} />
              </div>
            </div>
            <DialogTitle className="text-xl font-black text-foreground text-center">
              Remove Project
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-3 text-center text-sm leading-relaxed">
              Are you sure you want to remove <span className="text-foreground font-bold">{projectToDelete?.name}</span> from your workspace?
              <span className="block text-xs text-muted-foreground/50 mt-1">This will not delete any files on disk.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/20 border border-border/30 px-4 py-3 rounded-xl mt-4 font-mono text-xs text-muted-foreground/60 break-all">
            {projectToDelete?.root_path}
          </div>
          <DialogFooter className="mt-6 flex gap-3 sm:gap-3">
            <Button variant="ghost" onClick={() => setProjectToDelete(null)} className="flex-1 text-muted-foreground hover:text-foreground text-sm h-10">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-sm h-10">
              Remove Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
