import React, { useState, useEffect, useMemo } from 'react'
import {
    ArrowLeft, Folder, Globe, ExternalLink,
    GitBranch, RefreshCcw, Trash2, Github,
    FileText, Layers, ChevronRight, File, Folder as FolderIcon, FolderOpen, AlertCircle, Search, X, Code, Database, Image
} from 'lucide-react'
import type { Project, ProjectStats, SnapshotPayload } from '@/lib/orchestra-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KanbanBoard } from '@/components/app-shell/panels'
import { GitTab } from '@/widgets/git'
import {
    fetchProjectTree,
    refreshProject,
    disconnectProjectGitHub,
    fetchProjectFileContent,
    fetchProjectGitHubIssues,
    type BackendConfig,
    type GitHubIssue,
    type IssueListItem,
    type IssueUpdatePayload,
    type ProjectTreeNode,
} from '@/lib/orchestra-client'
import { AppTooltip } from '../ui/tooltip-wrapper'
import { Skeleton } from '@/components/ui/skeleton'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

interface ProjectDetailViewProps {
    project: Project
    stats?: ProjectStats
    config: BackendConfig | null
    snapshot: SnapshotPayload | null
    boardIssues: IssueListItem[]
    availableAgents: string[]
    loadingState: boolean
    onBack: () => void
    onInspectIssue: (id: string) => Promise<void>
    onJumpToTerminal?: (id: string) => void
    onIssueUpdate: (id: string, updates: IssueUpdatePayload) => Promise<void>
    onIssueDelete?: (id: string) => Promise<void>
    onStopSession?: (id: string) => Promise<void>
    onCreateIssue: (state: string) => void
    onDeleteProject: (id: string) => Promise<void>
    onRefreshProjects: () => Promise<void>
}

type ProjectTab = 'overview' | 'files' | 'git'

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
    project,
    stats,
    config,
    snapshot,
    boardIssues,
    availableAgents,
    loadingState,
    onBack,
    onInspectIssue,
    onJumpToTerminal,
    onIssueUpdate,
    onIssueDelete,
    onStopSession,
    onCreateIssue,
    onDeleteProject,
    onRefreshProjects,
}) => {
    const [activeTab, setActiveTab] = useState<ProjectTab>('overview')
    const [fileTree, setFileTree] = useState<ProjectTreeNode[]>([])
    const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({})
    const [folderLoadPending, setFolderLoadPending] = useState<Record<string, boolean>>({})
    const [fileQuery, setFileQuery] = useState('')
    const [focusedPath, setFocusedPath] = useState<string | null>(null)
    const [showHiddenFiles, setShowHiddenFiles] = useState(false)
    const [selectedFile, setSelectedFile] = useState<string | null>(null)
    const [fileContent, setFileContent] = useState<string | null>(null)
    const [contentLoading, setContentLoading] = useState(false)
    const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
    const [gitStatus, setGitStatus] = useState<GitStatusEntry[]>([])
    const [loadingTab, setLoadingTab] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [githubDisconnectPending, setGitHubDisconnectPending] = useState(false)
    const [githubActionError, setGitHubActionError] = useState('')
    const [tabError, setTabError] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deletePending, setDeletePending] = useState(false)
    const [deleteError, setDeleteError] = useState('')
    const [githubIssues, setGithubIssues] = useState<GitHubIssue[]>([])
    const refreshTimersRef = React.useRef<number[]>([])

    useEffect(() => {
        return () => {
            refreshTimersRef.current.forEach(id => window.clearTimeout(id))
            refreshTimersRef.current = []
        }
    }, [])

    // Fetch GitHub issues on mount (for backlog in overview)
    useEffect(() => {
        if (!config || !project.github_token) return
        fetchProjectGitHubIssues(config, project.id, 'open')
            .then(setGithubIssues)
            .catch(() => setGithubIssues([]))
    }, [config, project.id, project.github_token])

    // Poll GitHub issues every 60s when viewing overview
    useEffect(() => {
        if (!config || !project.github_token) return
        if (activeTab !== 'overview') return
        const interval = setInterval(() => {
            fetchProjectGitHubIssues(config, project.id, 'open')
                .then(setGithubIssues)
                .catch(() => {})
        }, 60000)
        return () => clearInterval(interval)
    }, [config, project.id, project.github_token, activeTab])

    useEffect(() => {
        setFileQuery('')
        setExpandedPaths({})
        setFocusedPath(null)
        setSelectedFile(null)
        setFileContent(null)
    }, [project.id])

    useEffect(() => {
        // Clear errors and stale data when switching tabs
        setTabError(null)

        if (!config || !project.id) return
        if (activeTab === 'overview') return
        if (!pathExists) return

        const loadTabData = async () => {
            setLoadingTab(true)
            try {
                if (activeTab === 'files') {
                    const tree = await fetchProjectTree(config, project.id)
                    setFileTree(tree)
                    setExpandedPaths({})
                    setFocusedPath(null)
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                setTabError(msg)
                console.error('[ProjectDetailView] Failed to load tab data:', err)
            } finally {
                setLoadingTab(false)
            }
        }

        void loadTabData()
    }, [activeTab, config, project.id])

    const handleRefresh = async () => {
        if (!config) return
        setRefreshing(true)
        try {
            await refreshProject(config, project.id)
            if (activeTab === 'files') {
                const tree = await fetchProjectTree(config, project.id)
                setFileTree(tree)
                setExpandedPaths({})
                setFocusedPath(null)
            }
        } finally {
            setRefreshing(false)
        }
    }

    const openExternalTarget = async (url: string) => {
        const desktopBridge = window.orchestraDesktop
        if (desktopBridge && typeof desktopBridge.openExternal === 'function') {
            await desktopBridge.openExternal(url)
            return
        }
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const scheduleProjectRefreshAfterGitHubAuth = () => {
        const delays = [2000, 4000, 7000, 11000]
        for (const delay of delays) {
            const id = window.setTimeout(() => {
                void onRefreshProjects()
            }, delay)
            refreshTimersRef.current.push(id)
        }
    }

    const handleConnectGitHub = async () => {
        if (!config || !project.id) return
        setGitHubActionError('')
        const loginUrl = `${config.baseUrl}/api/v1/github/login?project_id=${project.id}`
        try {
            await openExternalTarget(loginUrl)
            scheduleProjectRefreshAfterGitHubAuth()
        } catch (err) {
            console.error('Failed to launch GitHub authentication:', err)
            setGitHubActionError(err instanceof Error ? err.message : 'Failed to start GitHub authentication')
        }
    }

    const handleDisconnectGitHub = async () => {
        if (!config || !project.id) return
        setGitHubActionError('')
        setGitHubDisconnectPending(true)
        try {
            await disconnectProjectGitHub(config, project.id)
            await onRefreshProjects()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to disconnect GitHub'
            setGitHubActionError(message)
        } finally {
            setGitHubDisconnectPending(false)
        }
    }

    const handleOpenProjectFolder = async () => {
        const desktopBridge = window.orchestraDesktop
        const fileUrl = `file://${encodeURI(project.root_path)}`

        try {
            if (desktopBridge && typeof desktopBridge.openPath === 'function') {
                await desktopBridge.openPath(project.root_path)
                return
            }
            if (desktopBridge && typeof desktopBridge.openExternal === 'function') {
                await desktopBridge.openExternal(fileUrl)
                return
            }
            window.open(fileUrl, '_blank', 'noopener,noreferrer')
        } catch (err) {
            console.error('Failed to open project folder:', err)
        }
    }

    const handleLoadFolderChildren = async (path: string): Promise<ProjectTreeNode[]> => {
        if (!config) return []
        setFolderLoadPending((prev) => ({ ...prev, [path]: true }))
        try {
            return await fetchProjectTree(config, project.id, path)
        } catch (err) {
            console.error('Failed to expand folder:', err)
            return []
        } finally {
            setFolderLoadPending((prev) => ({ ...prev, [path]: false }))
        }
    }

    const handleFileClick = async (path: string) => {
        if (!config) return
        setSelectedFile(path)
        setFocusedPath(path)
        setContentLoading(true)
        setFileContent(null)
        try {
            const content = await fetchProjectFileContent(config, project.id, path)
            setFileContent(content)
        } catch (err) {
            console.error('Failed to load file content:', err)
            setFileContent('Error: Could not load file content.')
        } finally {
            setContentLoading(false)
        }
    }

    const toggleFolder = async (node: ProjectTreeNode) => {
        const path = node.path
        const shouldOpen = !expandedPaths[path]
        if (shouldOpen && (!node.children || node.children.length === 0)) {
            const children = await handleLoadFolderChildren(path)
            setFileTree((prev) => injectTreeChildren(prev, path, children))
        }
        setExpandedPaths((prev) => ({ ...prev, [path]: shouldOpen }))
        setFocusedPath(path)
    }

    const handleNodeAction = async (node: ProjectTreeNode) => {
        if (node.is_dir) {
            await toggleFolder(node)
            return
        }
        await handleFileClick(node.path)
    }

    const filteredTree = useMemo(() => {
        return filterTreeNodes(fileTree, fileQuery, showHiddenFiles)
    }, [fileTree, fileQuery, showHiddenFiles])

    const visibleTreeNodes = useMemo(() => {
        return flattenVisibleTree(filteredTree, expandedPaths)
    }, [filteredTree, expandedPaths])

    const handleTreeKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (visibleTreeNodes.length === 0) return

        const currentPath = focusedPath || selectedFile || visibleTreeNodes[0]?.node.path || null
        const currentIndex = currentPath
            ? Math.max(visibleTreeNodes.findIndex((entry) => entry.node.path === currentPath), 0)
            : 0
        const current = visibleTreeNodes[currentIndex]
        if (!current) return

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            const next = visibleTreeNodes[Math.min(currentIndex + 1, visibleTreeNodes.length - 1)]
            if (next) setFocusedPath(next.node.path)
            return
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            const prev = visibleTreeNodes[Math.max(currentIndex - 1, 0)]
            if (prev) setFocusedPath(prev.node.path)
            return
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault()
            if (current.node.is_dir) {
                if (!expandedPaths[current.node.path]) {
                    await toggleFolder(current.node)
                } else {
                    const next = visibleTreeNodes[currentIndex + 1]
                    if (next) setFocusedPath(next.node.path)
                }
            }
            return
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault()
            if (current.node.is_dir && expandedPaths[current.node.path]) {
                setExpandedPaths((prev) => ({ ...prev, [current.node.path]: false }))
                return
            }
            if (current.parentPath) {
                setFocusedPath(current.parentPath)
            }
            return
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            await handleNodeAction(current.node)
        }
    }

    const pathExists = project.path_exists !== false
    const tabs = [
        { id: 'overview', label: 'Overview', icon: <Layers size={14} />, needsPath: false },
        { id: 'files', label: 'Files', icon: <FileText size={14} />, needsPath: true },
        { id: 'git', label: 'Git', icon: <GitBranch size={14} />, needsPath: true },
    ] as const

    const osOptions = useMemo(() => ({
        scrollbars: { autoHide: 'move' as const, theme: 'os-theme-custom' },
        overflow: { x: 'hidden' as const, y: 'scroll' as const }
    }), [])

    const handleDelete = async () => {
        setDeletePending(true)
        setDeleteError('')
        try {
            await onDeleteProject(project.id)
            setIsDeleteDialogOpen(false)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to remove project'
            setDeleteError(message)
        } finally {
            setDeletePending(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background/20 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col px-8 pt-4 border-b border-border/40 bg-background/40 backdrop-blur-xl sticky top-0 z-20 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onBack}
                            className="h-8 text-muted-foreground hover:text-foreground gap-1.5 -ml-2"
                        >
                            <ArrowLeft size={14} />
                            Back
                        </Button>
                        <div className="h-4 w-px bg-border/50" />
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                            <Folder size={16} />
                        </div>
                        <div className="flex min-w-0 items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold tracking-tight truncate max-w-[220px] lg:max-w-none">{project.name}</h1>
                            {project.remote_url && (
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1 h-5 px-1.5 cursor-default">
                                    <GitBranch size={10} />
                                    Git Managed
                                </Badge>
                            )}
                            {project.github_token ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1 h-5 px-1.5 cursor-default">
                                    <Github size={10} />
                                    {project.github_owner}/{project.github_repo}
                                </Badge>
                            ) : (
                                project.github_owner && (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 h-5 px-1.5 cursor-default">
                                        <Github size={10} />
                                        {project.github_owner}/{project.github_repo}
                                    </Badge>
                                )
                            )}
                            <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/70 font-mono">
                                <span className="truncate max-w-[240px] lg:max-w-[420px]">{project.root_path}</span>
                                <AppTooltip content="Open project folder">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                                        onClick={() => void handleOpenProjectFolder()}
                                        aria-label="Open project folder"
                                    >
                                        <ExternalLink size={12} />
                                    </Button>
                                </AppTooltip>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <AppTooltip content="Force metadata and filesystem sync">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
                            </Button>
                        </AppTooltip>

                        {project.github_token ? (
                            <AppTooltip content="Disconnect GitHub for this project">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 h-8 px-3 text-xs border-green-500/20 text-green-500 hover:bg-green-500/10"
                                    onClick={() => void handleDisconnectGitHub()}
                                    disabled={githubDisconnectPending}
                                >
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                    <Github size={14} />
                                    {githubDisconnectPending ? 'Disconnecting...' : 'Disconnect GitHub'}
                                </Button>
                            </AppTooltip>
                        ) : (
                            <AppTooltip content="Authenticate with GitHub to enable PR creation">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                                    onClick={() => void handleConnectGitHub()}
                                >
                                    <Github size={14} />
                                    Connect GitHub
                                </Button>
                            </AppTooltip>
                        )}

                        {project.remote_url && (
                            <AppTooltip content="Open git repository in your default browser">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 h-8 px-3 text-xs border-border/60"
                                    onClick={() => void openExternalTarget(project.remote_url)}
                                >
                                    <Globe size={14} />
                                    Git Repo
                                </Button>
                            </AppTooltip>
                        )}

                        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <AppTooltip content="Remove project from workspace">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10 border-red-500/20"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </AppTooltip>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-popover border-border shadow-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                                        <Trash2 className="text-red-500" size={20} />
                                        Remove Project
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground pt-2">
                                        Are you sure you want to remove <span className="text-foreground font-bold">{project.name}</span> from your workspace?
                                        <br /><br />
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Project Path</span>
                                        <div className="bg-muted/30 border border-border p-2 rounded mt-1 font-mono text-[10px] text-muted-foreground truncate">
                                            {project.root_path}
                                        </div>
                                    </DialogDescription>
                                </DialogHeader>
                                {deleteError ? (
                                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                                        {deleteError}
                                    </div>
                                ) : null}
                                <DialogFooter className="mt-6">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setIsDeleteDialogOpen(false)}
                                        className="text-muted-foreground hover:text-foreground"
                                        disabled={deletePending}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDelete}
                                        className="bg-red-600 hover:bg-red-500 text-white font-bold"
                                        disabled={deletePending}
                                    >
                                        {deletePending ? 'Removing...' : 'Remove Project'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                {githubActionError ? (
                    <p className="pb-3 text-[10px] text-red-400">{githubActionError}</p>
                ) : null}

                {/* Tabs */}
                <div className="flex gap-1">
                    {tabs.map((tab) => {
                        const disabled = tab.needsPath && !pathExists
                        return (
                            <AppTooltip key={tab.id} content={disabled ? `${tab.label} unavailable — project path not found on disk` : `View project ${tab.label}`}>
                                <button
                                    onClick={() => !disabled && setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                                        disabled
                                            ? 'border-transparent text-muted-foreground/30 cursor-not-allowed'
                                            : activeTab === tab.id
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            </AppTooltip>
                        )
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 flex flex-col p-4 overflow-y-auto custom-scrollbar">
                    {activeTab === 'overview' && (
                        <div className="flex-1 flex flex-col">
                            {!pathExists && (
                                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-400 text-xs">
                                    <AlertCircle size={14} className="shrink-0" />
                                    <span>Path not found: <span className="font-mono">{project.root_path}</span> — Files, Git, Terminal unavailable</span>
                                </div>
                            )}
                            {/* Board */}
                            <div className="group relative bg-gradient-to-b from-card via-card to-muted/20 rounded-xl border border-border/30 p-6 backdrop-blur-sm flex-1 flex flex-col overflow-hidden">
                                <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <KanbanBoard
                                    loadingState={loadingState}
                                    snapshot={snapshot}
                                    boardIssues={(() => {
                                        const local = boardIssues.filter(i => i.project_id === project.id)
                                        const localTitles = new Set(local.map(i => i.title))
                                        const ghBacklog: IssueListItem[] = githubIssues
                                            .filter(gh => !localTitles.has(gh.title))
                                            .map(gh => ({
                                                id: `github-${gh.number}`, issue_id: `github-${gh.number}`,
                                                identifier: `GH-${gh.number}`, issue_identifier: `GH-${gh.number}`,
                                                title: gh.title, description: gh.body, state: 'Backlog',
                                                project_id: project.id, url: gh.html_url,
                                            }))
                                        return [...local, ...ghBacklog]
                                    })()}
                                    projects={[project]}
                                    availableAgents={availableAgents}
                                    onInspectIssue={onInspectIssue}
                                    onJumpToTerminal={onJumpToTerminal}
                                    onIssueUpdate={onIssueUpdate}
                                    onIssueDelete={onIssueDelete}
                                    onStopSession={onStopSession}
                                    onCreateIssue={onCreateIssue}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'files' && (
                        <div className="flex-1 flex flex-col min-h-0">
                            {tabError ? (
                                <div className="flex flex-col items-center justify-center py-20 text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl">
                                    <AlertCircle size={48} className="mb-4" />
                                    <p className="text-sm font-bold uppercase tracking-widest">Loading Failed</p>
                                    <p className="text-xs mt-2 font-mono">{tabError}</p>
                                </div>
                            ) : loadingTab ? (
                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                                </div>
                            ) : (
                                <div className="flex-1 flex gap-4 min-h-0 text-left">
                                    {/* File Tree */}
                                    <div className="w-1/3 bg-card/50 border border-border/30 rounded-xl overflow-hidden shadow-inner flex flex-col min-w-[260px]">
                                        <div className="p-2 border-b border-border/40 bg-muted/10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center justify-between gap-2">
                                            <span>Files</span>
                                            <div className="flex items-center gap-1 text-[9px] normal-case tracking-normal font-medium">
                                                <span className="opacity-60">{visibleTreeNodes.length} items</span>
                                                <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                                            </div>
                                        </div>
                                        <div className="p-2 border-b border-border/30 bg-background/40 space-y-2">
                                            <div className="relative">
                                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                                                <input
                                                    type="text"
                                                    value={fileQuery}
                                                    onChange={(event) => setFileQuery(event.target.value)}
                                                    placeholder="Search files or paths"
                                                    className="h-8 w-full rounded-md border border-border/40 bg-background/70 pl-7 pr-7 text-xs outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50"
                                                />
                                                {fileQuery ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFileQuery('')}
                                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground"
                                                        aria-label="Clear file search"
                                                    >
                                                        <X size={11} />
                                                    </button>
                                                ) : null}
                                            </div>
                                            <div className="flex items-center justify-between gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-[10px] uppercase tracking-wider font-bold"
                                                    onClick={() => setExpandedPaths({})}
                                                >
                                                    Collapse All
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`h-7 px-2 text-[10px] uppercase tracking-wider font-bold ${showHiddenFiles ? 'text-primary' : 'text-muted-foreground'}`}
                                                    onClick={() => setShowHiddenFiles((prev) => !prev)}
                                                >
                                                    Dotfiles: {showHiddenFiles ? 'On' : 'Off'}
                                                </Button>
                                            </div>
                                            <p className="text-[9px] text-muted-foreground/60">Keyboard: arrows to navigate, enter to open.</p>
                                        </div>
                                        <div
                                            className="flex-1 overflow-auto custom-scrollbar text-left focus:outline-none"
                                            tabIndex={0}
                                            onKeyDown={(event) => { void handleTreeKeyDown(event) }}
                                            onFocus={() => {
                                                if (!focusedPath && visibleTreeNodes[0]) {
                                                    setFocusedPath(visibleTreeNodes[0].node.path)
                                                }
                                            }}
                                        >
                                            {filteredTree.length > 0 ? (
                                                <FileTree
                                                    items={filteredTree}
                                                    expandedPaths={expandedPaths}
                                                    loadingPaths={folderLoadPending}
                                                    onToggle={toggleFolder}
                                                    onFileClick={(path) => { void handleFileClick(path) }}
                                                    activeFile={selectedFile}
                                                    focusedPath={focusedPath}
                                                />
                                            ) : (
                                                <div className="px-3 py-6 text-[11px] text-muted-foreground/70">
                                                    No files match this filter.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                     {/* Content Viewer */}
                                     <div className="group relative flex-1 bg-gradient-to-b from-card via-card to-muted/20 border border-border/30 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                                         <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                         <div className="p-2 border-b border-border/40 bg-muted/10 flex items-center justify-between">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <File size={12} className="text-primary/60 shrink-0" />
                                                 <span className="text-[10px] font-mono text-muted-foreground truncate">{selectedFile || 'No file selected'}</span>
                                            </div>
                                            {contentLoading && <RefreshCcw size={12} className="text-primary animate-spin" />}
                                        </div>
                                        <div className="flex-1 overflow-auto custom-scrollbar text-left">
                                            {selectedFile ? (
                                                fileContent !== null ? (
                                                    <pre className="m-0 min-h-full overflow-x-auto p-6 font-mono text-xs leading-6 text-foreground/90">
                                                        {fileContent}
                                                    </pre>
                                                ) : (
                                                    <div className="h-full flex items-center justify-center opacity-20 italic text-sm">Loading content...</div>
                                                )
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-muted-foreground/30 text-sm">
                                                    Select a file to view
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'git' && (
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Sub-tabs */}
                            <div className="flex items-center border-b border-border/30 shrink-0 mb-4">
                                {[
                                    { id: 'commits', label: 'Commits' },
                                    { id: 'issues', label: 'Issues' },
                                    { id: 'prs', label: 'Pull Requests' },
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setGitSubTab(tab.id as 'commits' | 'issues' | 'prs')}
                                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
                                            gitSubTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground/40 hover:text-muted-foreground'
                                        }`}>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Commits sub-tab */}
                            {gitSubTab === 'commits' && (
                                <div className="flex-1 overflow-auto custom-scrollbar space-y-6">
                                    {/* Branch selector */}
                                    <div className="flex items-center gap-3">
                                        <CustomDropdown
                                            className="w-48"
                                            value={selectedBranch}
                                            options={branches.branches.map(b => ({ label: b, value: b }))}
                                            onChange={setSelectedBranch}
                                        />
                                    </div>

                                    {tabError ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl">
                                            <AlertCircle size={48} className="mb-4" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Git Loading Failed</p>
                                            <p className="text-xs mt-2 font-mono">{tabError}</p>
                                        </div>
                                    ) : loadingTab ? (
                                        <div className="space-y-4">
                                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                                        </div>
                                    ) : (
                                        <div className="space-y-8 pb-8">
                                             {/* Git Operations Bar */}
                                             <div className="flex items-center gap-2 bg-card/40 border border-border/30 rounded-xl p-2 backdrop-blur-md sticky top-0 z-10">
                                                    <AppTooltip content="Stage and commit all workspace changes">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2 h-8 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                                            onClick={() => setShowCommitDialog(true)}
                                                            disabled={gitPending}
                                                        >
                                                            <History size={14} />
                                                            Commit
                                                        </Button>
                                                    </AppTooltip>
                                                    <AppTooltip content="Push local commits to origin">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2 h-8"
                                                            onClick={() => handleGitAction('push')}
                                                            disabled={gitPending}
                                                        >
                                                            <Globe size={14} />
                                                            Push
                                                        </Button>
                                                    </AppTooltip>
                                                    <AppTooltip content="Pull latest changes from remote branch">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2 h-8"
                                                            onClick={() => handleGitAction('pull')}
                                                            disabled={gitPending}
                                                        >
                                                            <RefreshCcw size={14} className={gitPending ? 'animate-spin' : ''} />
                                                            Pull
                                                        </Button>
                                                    </AppTooltip>
                                            </div>

                                            {showCommitDialog && (
                                                 <div className="p-3 bg-popover border border-border/30 rounded-xl shadow-lg text-left">
                                                     <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Commit Message</p>
                                                     <textarea
                                                         className="w-full bg-background/50 border border-border/30 rounded-lg p-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors mb-3 resize-none"
                                                        placeholder="Describe your changes..."
                                                        rows={2}
                                                        value={commitMessage}
                                                        onChange={(e) => setCommitMessage(e.target.value)}
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowCommitDialog(false)}>Cancel</Button>
                                                        <Button size="sm" className="h-8 text-xs" onClick={() => handleGitAction('commit')} disabled={!commitMessage.trim() || gitPending}>Commit</Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Uncommitted Changes */}
                                            {gitStatus.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between px-1">
                                                        <div className="flex items-center gap-2 text-left">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Uncommitted Changes ({gitStatus.length})</h3>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 text-[9px] uppercase tracking-widest font-bold text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10 gap-1.5"
                                                            onClick={() => handleViewDiff()}
                                                        >
                                                            <FileText size={10} />
                                                            View Full Diff
                                                        </Button>
                                                    </div>
                                                     <div className="bg-amber-500/[0.03] border border-border/30 rounded-xl p-2 text-left">
                                                        {gitStatus.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex items-center justify-between p-2 hover:bg-amber-500/5 rounded-lg transition-colors group text-left cursor-pointer"
                                                                onClick={() => handleViewDiff()}
                                                            >
                                                                <div className="flex items-center gap-3 overflow-hidden text-left">
                                                                    <div className={`text-[10px] font-mono font-bold w-6 h-5 flex items-center justify-center rounded ${
                                                                        item.status === 'M' ? 'bg-blue-500/20 text-blue-400' :
                                                                        item.status === '??' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                        'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                        {item.status}
                                                                    </div>
                                                                    <span className="text-xs font-mono truncate text-muted-foreground group-hover:text-foreground transition-colors">{item.path}</span>
                                                                </div>
                                                                <ChevronRight size={12} className="text-muted-foreground/20 group-hover:text-amber-500/40 transition-colors" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Commit History */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 px-1 text-left">
                                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Commit History</h3>
                                                </div>
                                                {gitHistory.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center">
                                                        <GitBranch size={48} className="mb-4 mx-auto" />
                                                        <p className="text-sm font-bold uppercase tracking-widest text-center">No Git History Available</p>
                                                    </div>
                                                ) : (
                                                    gitHistory.map((commit, idx) => {
                                                        const dateStr = /^\d+$/.test(commit.date)
                                                            ? new Date(parseInt(commit.date) * 1000).toLocaleString()
                                                            : new Date(commit.date).toLocaleString();

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className="border border-border/30 rounded-xl px-3 py-2.5 flex gap-3 items-center group hover:border-primary/30 transition-colors text-left cursor-pointer"
                                                                onClick={() => handleViewDiff(commit.hash)}
                                                            >
                                                                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                                    {commit.author?.slice(0, 2).toUpperCase() || '??'}
                                                                </div>
                                                                <div className="flex-1 min-w-0 text-left">
                                                                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{commit.message}</p>
                                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                                        <span className="font-bold text-primary/70">{commit.author}</span>
                                                                        <span className="opacity-40">·</span>
                                                                        <span>{dateStr}</span>
                                                                    </div>
                                                                </div>
                                                                <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{commit.hash?.slice(0, 7)}</span>
                                                                <ChevronRight size={14} className="text-muted-foreground/20 group-hover:text-primary transition-colors shrink-0" />
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Issues sub-tab */}
                            {gitSubTab === 'issues' && (
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    {!project.github_token ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/20">
                                            <Github size={32} className="mb-3" />
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Connect GitHub to view issues</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Filter + Create bar */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1">
                                                    {(['open', 'closed', 'all'] as const).map(state => (
                                                        <button key={state} onClick={() => setGhIssueFilter(state)}
                                                            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${ghIssueFilter === state ? 'bg-primary/10 text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}>
                                                            {state}
                                                        </button>
                                                    ))}
                                                </div>
                                                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" onClick={() => setCreateIssueOpen(true)}>
                                                    <Plus size={12} /> New Issue
                                                </Button>
                                            </div>

                                            {/* Issue list */}
                                            <div className="border border-border/30 rounded-xl overflow-hidden">
                                                {githubIssues.length === 0 ? (
                                                    <div className="py-12 text-center text-muted-foreground/20 text-[10px] font-bold uppercase tracking-[0.2em]">No issues</div>
                                                ) : githubIssues.map(issue => (
                                                    <div key={issue.number}>
                                                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 cursor-pointer border-b border-border/10"
                                                             onClick={() => setExpandedIssue(expandedIssue === issue.number ? null : issue.number)}>
                                                            <div className={`h-2 w-2 rounded-full ${issue.state === 'open' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                            <span className="font-mono text-[10px] text-muted-foreground/40">#{issue.number}</span>
                                                            <span className="text-sm font-medium flex-1 truncate">{issue.title}</span>
                                                            {issue.labels?.map(l => (
                                                                <span key={l.name} className="px-1.5 py-0.5 rounded text-[8px] bg-muted/30 text-muted-foreground/50">{l.name}</span>
                                                            ))}
                                                            <ChevronRight size={12} className={`text-muted-foreground/30 transition-transform ${expandedIssue === issue.number ? 'rotate-90' : ''}`} />
                                                        </div>
                                                        {expandedIssue === issue.number && (
                                                            <div className="px-4 py-4 bg-muted/5 border-b border-border/10 space-y-3">
                                                                <p className="text-sm text-foreground/60 whitespace-pre-wrap">{issue.body || 'No description'}</p>
                                                                <div className="flex gap-2">
                                                                    <Button variant="outline" size="sm" className="h-6 text-[9px]"
                                                                        onClick={async () => {
                                                                            if (!config) return
                                                                            try {
                                                                                await updateProjectGitHubIssue(config, project.id, issue.number, { state: issue.state === 'open' ? 'closed' : 'open' })
                                                                                const issues = await fetchProjectGitHubIssues(config, project.id, ghIssueFilter)
                                                                                setGithubIssues(issues)
                                                                            } catch {}
                                                                        }}>
                                                                        {issue.state === 'open' ? 'Close' : 'Reopen'}
                                                                    </Button>
                                                                    <Button variant="outline" size="sm" className="h-6 text-[9px]"
                                                                        onClick={() => onCreateIssue('Backlog')}>
                                                                        Import to Board
                                                                    </Button>
                                                                    <a href={issue.html_url} target="_blank" rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 px-2 h-6 rounded border border-border/30 text-[9px] text-muted-foreground hover:text-primary">
                                                                        <ExternalLink size={10} /> View on GitHub
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Create Issue Dialog */}
                                            {createIssueOpen && (
                                                <div className="p-4 border border-border/30 rounded-xl bg-card/60 space-y-3">
                                                    <input className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground/20"
                                                        placeholder="Issue title..." value={newIssueTitle} onChange={e => setNewIssueTitle(e.target.value)} />
                                                    <textarea className="w-full bg-transparent text-sm outline-none resize-none min-h-[60px] placeholder:text-muted-foreground/15"
                                                        placeholder="Description..." value={newIssueBody} onChange={e => setNewIssueBody(e.target.value)} />
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => { setCreateIssueOpen(false); setNewIssueTitle(''); setNewIssueBody('') }}>Cancel</Button>
                                                        <Button size="sm" className="h-7 text-[10px]" disabled={!newIssueTitle.trim() || ghSubmitting}
                                                            onClick={async () => {
                                                                if (!config) return
                                                                setGhSubmitting(true)
                                                                try {
                                                                    await createProjectGitHubIssue(config, project.id, { title: newIssueTitle, body: newIssueBody })
                                                                    setCreateIssueOpen(false); setNewIssueTitle(''); setNewIssueBody('')
                                                                    const issues = await fetchProjectGitHubIssues(config, project.id, ghIssueFilter)
                                                                    setGithubIssues(issues)
                                                                } finally { setGhSubmitting(false) }
                                                            }}>Create</Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PRs sub-tab */}
                            {gitSubTab === 'prs' && (
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    {!project.github_token ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/20">
                                            <Github size={32} className="mb-3" />
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Connect GitHub to view PRs</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-end">
                                                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" onClick={() => setCreatePROpen(true)}>
                                                    <Plus size={12} /> New PR
                                                </Button>
                                            </div>

                                            <div className="border border-border/30 rounded-xl overflow-hidden">
                                                {ghPulls.length === 0 ? (
                                                    <div className="py-12 text-center text-muted-foreground/20 text-[10px] font-bold uppercase tracking-[0.2em]">No pull requests</div>
                                                ) : ghPulls.map(pr => (
                                                    <div key={pr.number}>
                                                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 cursor-pointer border-b border-border/10"
                                                             onClick={async () => {
                                                                 if (expandedPR === pr.number) { setExpandedPR(null); return }
                                                                 setExpandedPR(pr.number)
                                                                 setPrDiffLoading(true)
                                                                 try {
                                                                     const diff = await fetchProjectGitHubPullDiff(config!, project.id, pr.number)
                                                                     setPrDiff(diff)
                                                                 } catch { setPrDiff('Failed to load diff') }
                                                                 finally { setPrDiffLoading(false) }
                                                             }}>
                                                            <div className={`h-2 w-2 rounded-full ${pr.state === 'open' ? 'bg-emerald-500' : pr.merged_at ? 'bg-purple-500' : 'bg-red-500'}`} />
                                                            <span className="font-mono text-[10px] text-muted-foreground/40">#{pr.number}</span>
                                                            <span className="text-sm font-medium flex-1 truncate">{pr.title}</span>
                                                            <span className="text-[9px] text-muted-foreground/30 font-mono">{pr.head.ref} &rarr; {pr.base.ref}</span>
                                                            <ChevronRight size={12} className={`text-muted-foreground/30 transition-transform ${expandedPR === pr.number ? 'rotate-90' : ''}`} />
                                                        </div>
                                                        {expandedPR === pr.number && (
                                                            <div className="border-b border-border/10">
                                                                {pr.body && <p className="px-4 py-3 text-sm text-foreground/60 whitespace-pre-wrap bg-muted/5">{pr.body}</p>}
                                                                <div className="px-4 py-2 flex gap-2 bg-muted/5">
                                                                    <a href={pr.html_url} target="_blank" rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 px-2 h-6 rounded border border-border/30 text-[9px] text-muted-foreground hover:text-primary">
                                                                        <ExternalLink size={10} /> View on GitHub
                                                                    </a>
                                                                </div>
                                                                <div className="bg-[#0d1117] overflow-auto max-h-[400px]">
                                                                    {prDiffLoading ? (
                                                                        <div className="py-8 text-center"><Loader2 className="h-4 w-4 animate-spin text-primary/30 mx-auto" /></div>
                                                                    ) : (
                                                                        <Prism language="diff" style={oneDark} customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '11px' }} showLineNumbers={false}>
                                                                            {prDiff}
                                                                        </Prism>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Create PR Dialog */}
                                            {createPROpen && (
                                                <div className="p-4 border border-border/30 rounded-xl bg-card/60 space-y-3">
                                                    <input className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground/20"
                                                        placeholder="PR title..." value={newPRTitle} onChange={e => setNewPRTitle(e.target.value)} />
                                                    <textarea className="w-full bg-transparent text-sm outline-none resize-none min-h-[60px] placeholder:text-muted-foreground/15"
                                                        placeholder="Description..." value={newPRBody} onChange={e => setNewPRBody(e.target.value)} />
                                                    <div className="flex gap-3">
                                                        <div className="flex-1">
                                                            <label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/30 mb-1 block">Head</label>
                                                            <CustomDropdown className="w-full" value={newPRHead || selectedBranch}
                                                                options={branches.branches.map(b => ({ label: b, value: b }))}
                                                                onChange={setNewPRHead} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/30 mb-1 block">Base</label>
                                                            <CustomDropdown className="w-full" value={newPRBase}
                                                                options={branches.branches.map(b => ({ label: b, value: b }))}
                                                                onChange={setNewPRBase} />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => { setCreatePROpen(false); setNewPRTitle(''); setNewPRBody('') }}>Cancel</Button>
                                                        <Button size="sm" className="h-7 text-[10px]" disabled={!newPRTitle.trim() || ghSubmitting}
                                                            onClick={async () => {
                                                                if (!config) return
                                                                setGhSubmitting(true)
                                                                try {
                                                                    await createProjectGitHubPull(config, project.id, { title: newPRTitle, body: newPRBody, head: newPRHead || selectedBranch, base: newPRBase })
                                                                    setCreatePROpen(false); setNewPRTitle(''); setNewPRBody('')
                                                                    const pulls = await fetchProjectGitHubPulls(config, project.id)
                                                                    setGhPulls(pulls)
                                                                } finally { setGhSubmitting(false) }
                                                            }}>Create PR</Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* Git Diff Modal */}
            <Dialog open={isDiffModalOpen} onOpenChange={setIsDiffModalOpen}>
                <DialogContent className="max-w-[98vw] w-[98vw] h-[96vh] max-h-[96vh] flex flex-col p-0 bg-popover border-border gap-0 overflow-hidden shadow-2xl">
                    {/* Modal Header */}
                    <div className="p-5 border-b border-border/40 bg-muted/30 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                                <History size={20} />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                                    {selectedCommitInfo?.message || 'Git Inspector'}
                                </DialogTitle>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 uppercase tracking-widest font-black">
                                    <span className="text-primary/70">{selectedCommitInfo?.author || 'Unknown'}</span>
                                    <span>•</span>
                                    <span>{selectedCommitInfo?.date ? (
                                        /^\d+$/.test(selectedCommitInfo.date) 
                                            ? new Date(parseInt(selectedCommitInfo.date) * 1000).toLocaleString()
                                            : new Date(selectedCommitInfo.date).toLocaleString()
                                    ) : 'N/A'}</span>
                                    {selectedCommitInfo?.hash && (
                                        <>
                                            <span>•</span>
                                             <span className="font-mono text-muted-foreground/80">{selectedCommitInfo.hash}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 h-6 px-2">
                                {diffFiles.length} {diffFiles.length === 1 ? 'File' : 'Files'} Changed
                            </Badge>
                        </div>
                    </div>
                    
                     {/* Modal Content - Two Pane */}
                    <div className="flex-1 flex min-h-0 bg-background/40 relative">
                        {diffLoading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-background/60 backdrop-blur-sm">
                                <RefreshCcw size={32} className="text-primary animate-spin" />
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 animate-pulse">Reconstructing Changes</p>
                            </div>
                        ) : diffFiles.length > 0 ? (
                            <>
                                {/* Left Pane: File List */}
                                <div className="w-72 border-r border-border/40 bg-card/40 flex flex-col shrink-0">
                                    <div className="p-3 border-b border-border/40 bg-muted/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                        Affected Files
                                    </div>
                                    <OverlayScrollbarsComponent 
                                        element="div"
                                        options={{ scrollbars: { autoHide: 'move', theme: 'os-theme-light' } }}
                                        className="flex-1"
                                    >
                                        <div className="p-2 space-y-1">
                                            {diffFiles.map(file => (
                                                 <button
                                                    key={file.path}
                                                    onClick={() => setActiveDiffFile(file.path)}
                                                    className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center gap-3 group ${
                                                        activeDiffFile === file.path 
                                                            ? 'bg-primary/10 text-primary border border-primary/20 font-bold' 
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/10 border border-transparent'
                                                    }`}
                                                >
                                                    <File size={14} className={activeDiffFile === file.path ? 'text-primary' : 'text-muted-foreground/40 group-hover:text-muted-foreground/60'} />
                                                    <span className="truncate">{file.path}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </OverlayScrollbarsComponent>
                                </div>

                                {/* Right Pane: Diff View */}
                                <div className="flex-1 min-w-0 bg-muted/5">
                                    <OverlayScrollbarsComponent 
                                        element="div" 
                                        options={{ scrollbars: { autoHide: 'move', theme: 'os-theme-light' } }}
                                        className="h-full"
                                    >
                                        <div className="p-6">
                                            <div className="mb-4 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FileText size={16} className="text-primary/60" />
                                                    <span className="text-sm font-mono text-muted-foreground/80 font-bold">{activeDiffFile}</span>
                                                </div>
                                            </div>
                                            <div className="rounded-xl overflow-hidden border border-border/40 bg-card/40">
                                                <Prism
                                                    language="diff"
                                                    style={oneDark}
                                                    customStyle={{ 
                                                        margin: 0, 
                                                        padding: '1.5rem', 
                                                        background: 'transparent', 
                                                        fontSize: '12px',
                                                        lineHeight: '1.7'
                                                    }}
                                                    showLineNumbers={false}
                                                >
                                                    {diffFiles.find(f => f.path === activeDiffFile)?.content || ''}
                                                </Prism>
                                            </div>
                                        </div>
                                    </OverlayScrollbarsComponent>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-30 grayscale">
                                <GitBranch size={64} className="text-muted-foreground/40 mb-2" />
                                <div className="text-center">
                                     <p className="text-lg font-bold uppercase tracking-[0.2em]">Zero Delta</p>
                                     <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mt-1">No file modifications detected in this view</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <DialogFooter className="p-4 border-t border-border/40 bg-muted/30 shrink-0">
                        <Button variant="ghost" onClick={() => setIsDiffModalOpen(false)} className="text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-[10px]">
                            Dismiss Inspector
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

type VisibleTreeEntry = {
    node: ProjectTreeNode
    level: number
    parentPath: string | null
}

function injectTreeChildren(nodes: ProjectTreeNode[], targetPath: string, children: ProjectTreeNode[]): ProjectTreeNode[] {
    return nodes.map((node) => {
        if (node.path === targetPath) {
            return { ...node, children }
        }
        if (node.children && node.children.length > 0) {
            return { ...node, children: injectTreeChildren(node.children, targetPath, children) }
        }
        return node
    })
}

function filterTreeNodes(nodes: ProjectTreeNode[], query: string, showHidden: boolean): ProjectTreeNode[] {
    const normalized = query.trim().toLowerCase()

    return nodes
        .filter((node) => showHidden || !node.name.startsWith('.'))
        .flatMap((node) => {
            const filteredChildren = node.children ? filterTreeNodes(node.children, query, showHidden) : []
            const matches = normalized.length === 0
                || node.name.toLowerCase().includes(normalized)
                || node.path.toLowerCase().includes(normalized)

            if (node.is_dir) {
                if (matches || filteredChildren.length > 0 || normalized.length === 0) {
                    return [{ ...node, children: filteredChildren }]
                }
                return []
            }

            return matches ? [node] : []
        })
}

function flattenVisibleTree(nodes: ProjectTreeNode[], expandedPaths: Record<string, boolean>, level = 0, parentPath: string | null = null): VisibleTreeEntry[] {
    const flattened: VisibleTreeEntry[] = []

    for (const node of nodes) {
        flattened.push({ node, level, parentPath })
        const isOpen = !!expandedPaths[node.path]
        if (node.is_dir && isOpen && node.children && node.children.length > 0) {
            flattened.push(...flattenVisibleTree(node.children, expandedPaths, level + 1, node.path))
        }
    }

    return flattened
}

function getTreeNodeIcon(node: ProjectTreeNode, isOpen: boolean) {
    if (node.is_dir) {
        return isOpen
            ? <FolderOpen size={16} className="text-primary" />
            : <FolderIcon size={16} className="text-primary/60" />
    }

    const ext = node.name.split('.').pop()?.toLowerCase() || ''
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'rb', 'php'].includes(ext)) {
        return <Code size={15} className="text-sky-400/80" />
    }
    if (['json', 'yaml', 'yml', 'toml', 'ini', 'env'].includes(ext)) {
        return <Database size={15} className="text-emerald-400/80" />
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
        return <Image size={15} className="text-purple-400/80" />
    }
    if (['md', 'txt', 'log'].includes(ext)) {
        return <FileText size={15} className="text-amber-300/80" />
    }
    return <File size={15} className="text-muted-foreground/70" />
}

function FileTree({
    items,
    level = 0,
    expandedPaths,
    loadingPaths,
    onToggle,
    onFileClick,
    activeFile,
    focusedPath,
}: {
    items: ProjectTreeNode[]
    level?: number
    expandedPaths: Record<string, boolean>
    loadingPaths: Record<string, boolean>
    onToggle: (node: ProjectTreeNode) => void | Promise<void>
    onFileClick?: (path: string) => void
    activeFile?: string | null
    focusedPath?: string | null
}) {
    return (
        <div className="divide-y divide-border/10 pb-2">
            {items.map((item, idx) => (
                <FileTreeNode
                    key={`${item.path}-${idx}`}
                    item={item}
                    level={level}
                    expandedPaths={expandedPaths}
                    loadingPaths={loadingPaths}
                    onToggle={onToggle}
                    onFileClick={onFileClick}
                    activeFile={activeFile}
                    focusedPath={focusedPath}
                />
            ))}
        </div>
    )
}

function FileTreeNode({
    item,
    level,
    expandedPaths,
    loadingPaths,
    onToggle,
    onFileClick,
    activeFile,
    focusedPath,
}: {
    item: ProjectTreeNode
    level: number
    expandedPaths: Record<string, boolean>
    loadingPaths: Record<string, boolean>
    onToggle: (node: ProjectTreeNode) => void | Promise<void>
    onFileClick?: (path: string) => void
    activeFile?: string | null
    focusedPath?: string | null
}) {
    const hasChildren = item.is_dir
    const isActive = activeFile === item.path
    const isFocused = focusedPath === item.path
    const isOpen = !!expandedPaths[item.path]
    const loading = !!loadingPaths[item.path]
    const children = item.children || []

    const handleToggle = async () => {
        if (item.is_dir) {
            await onToggle(item)
        } else if (onFileClick) {
            onFileClick(item.path)
        }
    }

    return (
        <>
            <div
                style={{ paddingLeft: `${level * 14 + 10}px` }}
                className={`py-1.5 pr-2 flex items-center gap-2 group cursor-pointer transition-colors border-l-2 ${
                    isActive
                        ? 'bg-primary/10 text-primary border-primary/60'
                        : isFocused
                            ? 'bg-muted/40 text-foreground border-border/60'
                            : 'hover:bg-muted/20 border-transparent'
                }`}
                onClick={handleToggle}
            >
                {item.is_dir ? (
                    <>
                        {loading ? (
                            <RefreshCcw size={13} className="text-primary/50 animate-spin" />
                        ) : (
                            <ChevronRight
                                size={13}
                                className={`text-muted-foreground/50 transition-all duration-200 ${isOpen ? 'rotate-90 text-primary/70' : ''}`}
                            />
                        )}
                        {getTreeNodeIcon(item, isOpen)}
                        <span className="text-xs font-medium truncate">{item.name}</span>
                    </>
                ) : (
                    <>
                        <div className="w-[13px]" />
                        {getTreeNodeIcon(item, false)}
                        <span className={`text-xs truncate transition-colors ${isActive ? 'font-semibold text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>{item.name}</span>
                    </>
                )}
            </div>
            {isOpen && hasChildren && children.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <FileTree
                        items={children}
                        level={level + 1}
                        expandedPaths={expandedPaths}
                        loadingPaths={loadingPaths}
                        onToggle={onToggle}
                        onFileClick={onFileClick}
                        activeFile={activeFile}
                        focusedPath={focusedPath}
                    />
                </div>
            )}
            {isOpen && hasChildren && children.length === 0 && !loading && (
                <div style={{ paddingLeft: `${(level + 1) * 14 + 10}px` }} className="py-2 opacity-50 italic text-[10px]">
                    Empty directory
                </div>
            )}
        </>
    )
}
