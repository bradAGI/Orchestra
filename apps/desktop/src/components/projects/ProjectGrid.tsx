import React, { useState } from 'react'
import { Folder, GitBranch, History, Search, Zap, Plus, Trash2, ChevronLeft, ChevronRight, LayoutGrid, List, ArrowUpRight, Activity } from 'lucide-react'
import type { Project, ProjectStats } from '@/lib/orchestra-types'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppTooltip } from '../ui/tooltip-wrapper'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface ProjectCardProps {
    project: Project
    stats?: ProjectStats
    loading?: boolean
    onClick: (id: string) => void
    onDelete?: (project: Project) => void
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return String(n)
}

function getActivityLevel(sessions: number): { label: string; color: string; pulse: boolean } {
    if (sessions >= 20) return { label: 'High', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20', pulse: true }
    if (sessions >= 5) return { label: 'Active', color: 'text-primary bg-primary/15 border-primary/20', pulse: false }
    if (sessions >= 1) return { label: 'Low', color: 'text-amber-400 bg-amber-500/15 border-amber-500/20', pulse: false }
    return { label: 'Idle', color: 'text-muted-foreground/40 bg-muted/20 border-border/30', pulse: false }
}

const ProjectListRow: React.FC<ProjectCardProps> = ({ project, stats, loading, onClick, onDelete }) => {
    if (loading) {
        return (
            <div className="flex items-center gap-4 p-4 bg-muted/20 border border-border/40 rounded-xl animate-pulse h-16">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
            </div>
        )
    }

    const totalTokens = (stats?.total_input || 0) + (stats?.total_output || 0)
    const activity = getActivityLevel(stats?.total_sessions || 0)

    return (
        <div
            onClick={() => onClick(project.id)}
            className="group relative flex items-center gap-4 p-3 rounded-xl border border-border/40 bg-gradient-to-r from-card via-card to-muted/10 hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
        >
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <Folder className="w-5 h-5 text-primary group-hover:text-primary-foreground" strokeWidth={2} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{project.name}</h3>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono truncate block">{project.root_path}</span>
            </div>

            <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                    <span className="text-xs font-black tabular-nums">{stats?.total_sessions || 0}</span>
                    <span className="text-[8px] uppercase text-muted-foreground/40 font-bold tracking-wider ml-1">sessions</span>
                </div>
                <div className="text-right">
                    <span className="text-xs font-black tabular-nums">{formatTokens(totalTokens)}</span>
                    <span className="text-[8px] uppercase text-muted-foreground/40 font-bold tracking-wider ml-1">tokens</span>
                </div>
            </div>

            <div className="pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-red-500"
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete?.(project)
                    }}
                >
                    <Trash2 size={13} />
                </Button>
            </div>
        </div>
    )
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, stats, loading, onClick, onDelete }) => {
    if (loading) {
        return (
            <div className="h-64 bg-muted/20 border border-border/30 rounded-2xl animate-pulse p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
                <Skeleton className="h-1 w-full rounded-full" />
                <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                </div>
            </div>
        )
    }

    const totalTokens = (stats?.total_input || 0) + (stats?.total_output || 0)
    const sessions = stats?.total_sessions || 0
    const activity = getActivityLevel(sessions)
    const hasGitHub = !!project.remote_url

    return (
        <div
            onClick={() => onClick(project.id)}
            className="group relative overflow-hidden bg-gradient-to-b from-card via-card to-muted/20 border border-border/50 rounded-2xl cursor-pointer transition-all duration-500 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-0.5 flex flex-col"
        >
            {/* Hover glow overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Delete button */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 translate-y-1 group-hover:translate-y-0">
                <AppTooltip content="Remove project">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm border border-border/50 text-muted-foreground/60 hover:text-red-500 hover:border-red-500/30 shadow-sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete?.(project)
                        }}
                    >
                        <Trash2 size={12} />
                    </Button>
                </AppTooltip>
            </div>

            {/* Header */}
            <div className="px-5 pt-5 pb-4">
                <div className="flex items-start gap-3.5">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-lg shadow-primary/5">
                        <Folder className="w-6 h-6" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                        <h3 className="text-[15px] font-black tracking-tight truncate group-hover:text-primary transition-colors leading-tight">{project.name}</h3>
                        <p className="text-[10px] text-muted-foreground/40 font-mono truncate mt-1">{project.root_path}</p>
                    </div>
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-2 mt-3">
                    {hasGitHub && (
                        <Badge variant="outline" className="text-[7px] font-black uppercase tracking-widest h-4 px-1.5 text-muted-foreground/50 border-border/30">
                            <GitBranch size={8} className="mr-0.5" />
                            Git
                        </Badge>
                    )}
                </div>
            </div>

            {/* Stats row */}
            <div className="mt-auto px-4 pb-4">
                <div className="grid grid-cols-3 gap-2">
                    <div className="relative rounded-xl bg-background/50 border border-border/30 px-3 py-2.5 text-center overflow-hidden group/stat">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <History size={10} className="text-primary/50" strokeWidth={2.5} />
                        </div>
                        <p className="text-sm font-black tabular-nums leading-none">{sessions}</p>
                        <p className="text-[7px] uppercase font-bold text-muted-foreground/40 tracking-widest mt-1">Sessions</p>
                    </div>
                    <div className="relative rounded-xl bg-background/50 border border-border/30 px-3 py-2.5 text-center overflow-hidden group/stat">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Zap size={10} className="text-primary/50" strokeWidth={2.5} />
                        </div>
                        <p className="text-sm font-black tabular-nums leading-none">{formatTokens(totalTokens)}</p>
                        <p className="text-[7px] uppercase font-bold text-muted-foreground/40 tracking-widest mt-1">Tokens</p>
                    </div>
                    <div className="relative rounded-xl bg-background/50 border border-border/30 px-3 py-2.5 text-center overflow-hidden group/stat">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Activity size={10} className="text-primary/50" strokeWidth={2.5} />
                        </div>
                        <p className="text-sm font-black tabular-nums leading-none">
                            {stats?.last_active ? new Date(stats.last_active).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                        </p>
                        <p className="text-[7px] uppercase font-bold text-muted-foreground/40 tracking-widest mt-1">Last Active</p>
                    </div>
                </div>
            </div>

            {/* Bottom accent line */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
    )
}

interface ProjectGridProps {
    projects: Project[]
    stats: Record<string, ProjectStats>
    loading: boolean
    onProjectClick: (id: string) => void
    onAddProject?: () => void
    onDeleteProject?: (id: string) => void
}

const LOADING_PROJECT_PLACEHOLDER: Project = {
    id: '__loading__',
    name: 'Loading',
    root_path: '',
    remote_url: '',
}

export const ProjectGrid: React.FC<ProjectGridProps> = ({
    projects,
    stats,
    loading,
    onProjectClick,
    onAddProject,
    onDeleteProject
}) => {
    const [search, setSearch] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [currentPage, setCurrentPage] = useState(1)
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
    const ITEMS_PER_PAGE = 12

    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.root_path.toLowerCase().includes(search.toLowerCase())
    )

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const currentItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
        setCurrentPage(1)
    }

    const handleDeleteConfirm = () => {
        if (projectToDelete && onDeleteProject) {
            onDeleteProject(projectToDelete.id)
            setProjectToDelete(null)
        }
    }

    if (loading && projects.length === 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <ProjectCard key={i} project={LOADING_PROJECT_PLACEHOLDER} loading onClick={() => { }} />
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
                            onChange={handleSearchChange}
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
                        <button
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground/40 hover:text-foreground'}`}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid size={14} />
                        </button>
                        <button
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground/40 hover:text-foreground'}`}
                            onClick={() => setViewMode('list')}
                        >
                            <List size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 custom-scrollbar">
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
                ) : (
                    <div className="flex-1 flex flex-col justify-between">
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
                                {currentItems.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        stats={stats[project.id]}
                                        onClick={onProjectClick}
                                        onDelete={setProjectToDelete}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5 p-4">
                                {currentItems.map((project) => (
                                    <ProjectListRow
                                        key={project.id}
                                        project={project}
                                        stats={stats[project.id]}
                                        onClick={onProjectClick}
                                        onDelete={setProjectToDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && filtered.length > 0 && (
                <div className="flex items-center justify-between px-6 py-2.5 border-t border-border/30">
                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest tabular-nums">
                        {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-20"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`h-7 min-w-[28px] rounded-md text-[10px] font-bold transition-all ${currentPage === i + 1
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground/40 hover:text-foreground hover:bg-muted/20'
                                }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-20"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

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
