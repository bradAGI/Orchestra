import React, { useState, useMemo, useCallback } from 'react'
import {
  Folder, FolderOpen, GitBranch, Search, Plus, Trash2,
  ChevronRight, ChevronDown, FolderTree, List, RefreshCcw,
  ExternalLink, Zap, History, Activity, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import type { Project, ProjectStats } from '@/lib/orchestra-types'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AppTooltip } from '../ui/tooltip-wrapper'

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

function getViewMode(): 'tree' | 'list' {
  try {
    const v = localStorage.getItem('orchestra:projects:viewMode')
    return v === 'list' ? 'list' : 'tree'
  } catch { return 'tree' }
}

function saveViewMode(mode: 'tree' | 'list') {
  try { localStorage.setItem('orchestra:projects:viewMode', mode) } catch { /* */ }
}

// ---------------------------------------------------------------------------
// Folder tree builder
// ---------------------------------------------------------------------------

type TreeNode = {
  /** Segment name (directory component or project name) */
  name: string
  /** Full path up to and including this segment */
  path: string
  /** Project at this node (leaf), if any */
  project?: Project
  /** Child directories/projects */
  children: TreeNode[]
}

function buildTree(projects: Project[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] }

  for (const project of projects) {
    const parts = project.root_path.split('/').filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i]
      const fullPath = '/' + parts.slice(0, i + 1).join('/')
      let child = current.children.find(c => c.name === segment && !c.project)

      if (i === parts.length - 1) {
        // Leaf: this is the project
        current.children.push({
          name: project.name,
          path: fullPath,
          project,
          children: [],
        })
      } else {
        // Intermediate directory
        if (!child) {
          child = { name: segment, path: fullPath, children: [] }
          current.children.push(child)
        }
        current = child
      }
    }
  }

  // Sort: directories first (alphabetically), then projects (alphabetically)
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => {
      const aIsDir = !a.project && a.children.length > 0
      const bIsDir = !b.project && b.children.length > 0
      if (aIsDir && !bIsDir) return -1
      if (!aIsDir && bIsDir) return 1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sortChildren)
  }
  sortChildren(root)

  // Collapse single-child directory chains (e.g., /home/user/dev → home/user/dev)
  const collapse = (node: TreeNode): TreeNode => {
    node.children = node.children.map(collapse)
    if (!node.project && node.children.length === 1 && !node.children[0].project) {
      const child = node.children[0]
      return {
        name: node.name ? `${node.name}/${child.name}` : child.name,
        path: child.path,
        project: child.project,
        children: child.children,
      }
    }
    return node
  }

  const collapsed = collapse(root)
  return collapsed.children
}

// ---------------------------------------------------------------------------
// Tree view components
// ---------------------------------------------------------------------------

function TreeDirectory({
  node,
  stats,
  depth,
  expanded,
  onToggle,
  onProjectClick,
  onDeleteProject,
}: {
  node: TreeNode
  stats: Record<string, ProjectStats>
  depth: number
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
  onProjectClick: (id: string) => void
  onDeleteProject: (project: Project) => void
}) {
  const isOpen = expanded[node.path] ?? (depth === 0)

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/20"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
        {isOpen ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary/60" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        )}
        <span className="text-xs font-mono text-muted-foreground/70 truncate">{node.name}</span>
        <span className="text-[9px] text-muted-foreground/30 ml-auto shrink-0">
          {countProjects(node)}
        </span>
      </button>

      {isOpen && (
        <div>
          {node.children.map((child) =>
            child.project ? (
              <TreeProjectRow
                key={child.project.id}
                project={child.project}
                stats={stats[child.project.id]}
                depth={depth + 1}
                onClick={onProjectClick}
                onDelete={onDeleteProject}
              />
            ) : (
              <TreeDirectory
                key={child.path}
                node={child}
                stats={stats}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onProjectClick={onProjectClick}
                onDeleteProject={onDeleteProject}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function countProjects(node: TreeNode): number {
  if (node.project) return 1
  return node.children.reduce((sum, c) => sum + countProjects(c), 0)
}

function TreeProjectRow({
  project,
  stats,
  depth,
  onClick,
  onDelete,
}: {
  project: Project
  stats?: ProjectStats
  depth: number
  onClick: (id: string) => void
  onDelete: (project: Project) => void
}) {
  const totalTokens = (stats?.total_input || 0) + (stats?.total_output || 0)
  const hasGit = !!project.remote_url

  return (
    <div
      onClick={() => onClick(project.id)}
      className="group relative flex items-center gap-3 rounded-lg py-2 pr-3 transition-all cursor-pointer hover:bg-muted/15"
      style={{ paddingLeft: `${depth * 20 + 28}px` }}
    >
      <div className="h-8 w-8 rounded-lg bg-primary/8 border border-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground transition-all duration-300">
        <Folder className="w-4 h-4 text-primary group-hover:text-primary-foreground" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">{project.name}</span>
          {hasGit && (
            <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground/30" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-5 shrink-0 text-muted-foreground/40">
        <div className="flex items-center gap-1 text-[10px] tabular-nums">
          <History className="h-3 w-3" />
          <span className="font-bold">{stats?.total_sessions || 0}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] tabular-nums">
          <Zap className="h-3 w-3" />
          <span className="font-bold">{formatTokens(totalTokens)}</span>
        </div>
        <span className="text-[10px] w-16 text-right">{relativeTime(stats?.last_active || '')}</span>
      </div>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground/30 hover:text-red-500"
          data-testid="project-delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(project) }}
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// List view components
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

function ListView({
  projects,
  stats,
  onProjectClick,
  onDeleteProject,
}: {
  projects: Project[]
  stats: Record<string, ProjectStats>
  onProjectClick: (id: string) => void
  onDeleteProject: (project: Project) => void
}) {
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
    const arr = [...projects]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
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
    return arr
  }, [projects, stats, sortKey, sortDir])

  return (
    <div className="flex flex-col">
      {/* Table header */}
      <div className="group/header flex items-center gap-3 px-4 py-2 border-b border-border/20">
        <div className="w-8" /> {/* icon spacer */}
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
        <div className="w-7" /> {/* action spacer */}
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
                onClick={(e) => { e.stopPropagation(); onDeleteProject(project) }}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
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
  const [viewMode, setViewMode] = useState<'tree' | 'list'>(getViewMode)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() =>
    projects.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.root_path.toLowerCase().includes(search.toLowerCase())
    ), [projects, search])

  const tree = useMemo(() => buildTree(filtered), [filtered])

  const toggleExpanded = useCallback((path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }))
  }, [])

  const handleViewMode = useCallback((mode: 'tree' | 'list') => {
    setViewMode(mode)
    saveViewMode(mode)
  }, [])

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
            {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onAddProject} className="h-8 gap-1.5 bg-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 shadow-lg shadow-primary/20 px-3">
            <Plus size={14} />
            Add Project
          </Button>
          <div className="flex items-center bg-muted/20 p-0.5 rounded-lg border border-border/30">
            <AppTooltip content="Folder tree">
              <button
                className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${viewMode === 'tree' ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground/40 hover:text-foreground'}`}
                onClick={() => handleViewMode('tree')}
              >
                <FolderTree size={14} />
              </button>
            </AppTooltip>
            <AppTooltip content="List view">
              <button
                className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground/40 hover:text-foreground'}`}
                onClick={() => handleViewMode('list')}
              >
                <List size={14} />
              </button>
            </AppTooltip>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="p-6 rounded-2xl bg-muted/10 border border-border/20 mb-6">
              <Folder size={48} className="text-muted-foreground/15" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-black tracking-tight mb-1">{search ? 'No matches' : 'No Projects'}</h2>
            <p className="text-muted-foreground/40 max-w-xs text-xs">
              {search ? `Nothing matched "${search}"` : 'Add a local repository to get started.'}
            </p>
          </div>
        ) : viewMode === 'tree' ? (
          <div className="py-2 px-2">
            {tree.map((node) =>
              node.project ? (
                <TreeProjectRow
                  key={node.project.id}
                  project={node.project}
                  stats={stats[node.project.id]}
                  depth={0}
                  onClick={onProjectClick}
                  onDelete={setProjectToDelete}
                />
              ) : (
                <TreeDirectory
                  key={node.path}
                  node={node}
                  stats={stats}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleExpanded}
                  onProjectClick={onProjectClick}
                  onDeleteProject={setProjectToDelete}
                />
              )
            )}
          </div>
        ) : (
          <ListView
            projects={filtered}
            stats={stats}
            onProjectClick={onProjectClick}
            onDeleteProject={setProjectToDelete}
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent className="sm:max-w-md bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Trash2 className="text-red-500" size={18} />
              Remove Project
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2 text-left text-sm">
              Remove <span className="text-foreground font-bold">{projectToDelete?.name}</span> from your workspace?
              <div className="bg-muted/20 border border-border/30 p-2 rounded-lg mt-3 font-mono text-[10px] text-muted-foreground/60 truncate">
                {projectToDelete?.root_path}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setProjectToDelete(null)} className="text-muted-foreground hover:text-foreground text-xs">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs">
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
