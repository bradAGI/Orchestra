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
} from "@/components/ui/dialog"

/** Convert git SSH URLs to HTTPS so browsers can open them. */
function sshToHttps(url: string): string {
    if (url.startsWith('git@')) {
        // git@github.com:owner/repo.git → https://github.com/owner/repo
        return url.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '')
    }
    return url.replace(/\.git$/, '')
}

/** Props for the {@link ProjectDetailView} component. */
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
    const [loadingTab, setLoadingTab] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [githubPending, setGithubPending] = useState(false)
    const [githubError, setGithubError] = useState('')
    const [tabError, setTabError] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deletePending, setDeletePending] = useState(false)
    const [deleteError, setDeleteError] = useState('')
    const [githubIssues, setGithubIssues] = useState<GitHubIssue[]>([])

    const pathExists = project.path_exists !== false
    const isGitHub = !!project.github_owner && !!project.github_repo
    const isConnected = !!project.github_token

    // Fetch GitHub issues on mount
    useEffect(() => {
        if (!config || !isConnected) return
        fetchProjectGitHubIssues(config, project.id, 'open')
            .then((data) => setGithubIssues(data?.issues ?? []))
            .catch(() => setGithubIssues([]))
    }, [config, project.id, isConnected])

    // Poll GitHub issues every 60s on overview tab
    useEffect(() => {
        if (!config || !isConnected || activeTab !== 'overview') return
        const interval = setInterval(() => {
            fetchProjectGitHubIssues(config, project.id, 'open')
                .then((data) => setGithubIssues(data?.issues ?? []))
                .catch(() => {})
        }, 60000)
        return () => clearInterval(interval)
    }, [config, project.id, isConnected, activeTab])

    // Reset state on project change
    useEffect(() => {
        setFileQuery('')
        setExpandedPaths({})
        setFocusedPath(null)
        setSelectedFile(null)
        setFileContent(null)
        setGithubError('')
    }, [project.id])

    // Load tab data
    useEffect(() => {
        setTabError(null)
        if (!config || !project.id || activeTab === 'overview' || !pathExists) return
        const load = async () => {
            setLoadingTab(true)
            try {
                if (activeTab === 'files') {
                    const tree = await fetchProjectTree(config, project.id)
                    setFileTree(tree)
                    setExpandedPaths({})
                    setFocusedPath(null)
                }
            } catch (err) {
                setTabError(err instanceof Error ? err.message : String(err))
            } finally {
                setLoadingTab(false)
            }
        }
        void load()
    }, [activeTab, config, project.id, pathExists])

    const handleRefresh = async () => {
        if (!config) return
        setRefreshing(true)
        try {
            await refreshProject(config, project.id)
            await onRefreshProjects()
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

    const openExternal = async (url: string) => {
        const bridge = window.orchestraDesktop
        if (bridge?.openExternal) {
            await bridge.openExternal(url)
            return
        }
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const handleConnectGitHub = async () => {
        if (!config || !project.id) return
        setGithubError('')
        setGithubPending(true)
        try {
            const loginUrl = `${config.baseUrl}/api/v1/github/login?project_id=${project.id}`
            await openExternal(loginUrl)
            // SSE GITHUB_CONNECTED event will trigger project refresh automatically
        } catch (err) {
            setGithubError(err instanceof Error ? err.message : 'Failed to start GitHub authentication')
        } finally {
            setGithubPending(false)
        }
    }

    const handleDisconnectGitHub = async () => {
        if (!config || !project.id) return
        if (!window.confirm(`Disconnect GitHub from ${project.github_owner}/${project.github_repo}?`)) return
        setGithubError('')
        setGithubPending(true)
        try {
            await disconnectProjectGitHub(config, project.id)
            // SSE GITHUB_DISCONNECTED event will trigger project refresh automatically
        } catch (err) {
            setGithubError(err instanceof Error ? err.message : 'Failed to disconnect GitHub')
        } finally {
            setGithubPending(false)
        }
    }

    const handleOpenFolder = async () => {
        const bridge = window.orchestraDesktop
        try {
            if (bridge?.openPath) { await bridge.openPath(project.root_path); return }
            if (bridge?.openExternal) { await bridge.openExternal(`file://${encodeURI(project.root_path)}`); return }
            window.open(`file://${encodeURI(project.root_path)}`, '_blank', 'noopener,noreferrer')
        } catch (err) {
            console.error('Failed to open project folder:', err)
        }
    }

    const handleDelete = async () => {
        setDeletePending(true)
        setDeleteError('')
        try {
            await onDeleteProject(project.id)
            setIsDeleteDialogOpen(false)
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'Failed to remove project')
        } finally {
            setDeletePending(false)
        }
    }

    // File tree handlers
    const handleLoadFolderChildren = async (path: string): Promise<ProjectTreeNode[]> => {
        if (!config) return []
        setFolderLoadPending((prev) => ({ ...prev, [path]: true }))
        try { return await fetchProjectTree(config, project.id, path) }
        catch { return [] }
        finally { setFolderLoadPending((prev) => ({ ...prev, [path]: false })) }
    }

    const handleFileClick = async (path: string) => {
        if (!config) return
        setSelectedFile(path)
        setFocusedPath(path)
        setContentLoading(true)
        setFileContent(null)
        try {
            setFileContent(await fetchProjectFileContent(config, project.id, path))
        } catch {
            setFileContent('Error: Could not load file content.')
        } finally {
            setContentLoading(false)
        }
    }

    const toggleFolder = async (node: ProjectTreeNode) => {
        const shouldOpen = !expandedPaths[node.path]
        if (shouldOpen && (!node.children || node.children.length === 0)) {
            const children = await handleLoadFolderChildren(node.path)
            setFileTree((prev) => injectTreeChildren(prev, node.path, children))
        }
        setExpandedPaths((prev) => ({ ...prev, [node.path]: shouldOpen }))
        setFocusedPath(node.path)
    }

    const filteredTree = useMemo(() => filterTreeNodes(fileTree, fileQuery, showHiddenFiles), [fileTree, fileQuery, showHiddenFiles])
    const visibleTreeNodes = useMemo(() => flattenVisibleTree(filteredTree, expandedPaths), [filteredTree, expandedPaths])

    const handleTreeKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (visibleTreeNodes.length === 0) return
        const currentPath = focusedPath || selectedFile || visibleTreeNodes[0]?.node.path || null
        const currentIndex = currentPath ? Math.max(visibleTreeNodes.findIndex((entry) => entry.node.path === currentPath), 0) : 0
        const current = visibleTreeNodes[currentIndex]
        if (!current) return

        if (event.key === 'ArrowDown') { event.preventDefault(); const next = visibleTreeNodes[Math.min(currentIndex + 1, visibleTreeNodes.length - 1)]; if (next) setFocusedPath(next.node.path); return }
        if (event.key === 'ArrowUp') { event.preventDefault(); const prev = visibleTreeNodes[Math.max(currentIndex - 1, 0)]; if (prev) setFocusedPath(prev.node.path); return }
        if (event.key === 'ArrowRight') {
            event.preventDefault()
            if (current.node.is_dir) {
                if (!expandedPaths[current.node.path]) { await toggleFolder(current.node) }
                else { const next = visibleTreeNodes[currentIndex + 1]; if (next) setFocusedPath(next.node.path) }
            }
            return
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault()
            if (current.node.is_dir && expandedPaths[current.node.path]) { setExpandedPaths((prev) => ({ ...prev, [current.node.path]: false })); return }
            if (current.parentPath) setFocusedPath(current.parentPath)
            return
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (current.node.is_dir) await toggleFolder(current.node)
            else await handleFileClick(current.node.path)
        }
    }

    const tabs = [
        { id: 'overview' as const, label: 'Tasks', icon: <Layers size={14} />, needsPath: false },
        { id: 'files' as const, label: 'Files', icon: <FileText size={14} />, needsPath: true },
        { id: 'git' as const, label: 'Git', icon: <GitBranch size={14} />, needsPath: true },
    ]

    return (
        <div className="flex flex-col h-full bg-background/20 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-xl sticky top-0 z-20">
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-1.5">
                    {/* Back */}
                    <Button variant="ghost" onClick={onBack} className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1 shrink-0 text-xs font-medium">
                        <ArrowLeft size={15} /> Back
                    </Button>

                    {/* Divider */}
                    <div className="h-4 w-px bg-border/40 shrink-0" />

                    {/* Project name */}
                    <h1 className="text-sm font-semibold tracking-tight truncate shrink-0">{project.name}</h1>

                    {/* Path */}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/40 font-mono min-w-0 truncate">
                        <span className="truncate">{project.root_path}</span>
                        <AppTooltip content="Open folder">
                            <button onClick={() => void handleOpenFolder()} className="p-0.5 hover:text-primary transition-colors shrink-0">
                                <ExternalLink size={10} />
                            </button>
                        </AppTooltip>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* GitHub status */}
                    {isConnected ? (
                        <>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1 h-5 px-2 text-[10px] font-semibold shrink-0">
                                <Github size={10} />
                                {project.github_owner}/{project.github_repo}
                            </Badge>
                            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 gap-1 shrink-0"
                                onClick={() => void handleDisconnectGitHub()} disabled={githubPending}>
                                Disconnect
                            </Button>
                        </>
                    ) : isGitHub ? (
                        <>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 gap-1 h-5 px-2 text-[10px] font-semibold shrink-0">
                                <Github size={10} />
                                {project.github_owner}/{project.github_repo}
                            </Badge>
                            <Button variant="default" size="sm" className="h-5 px-2 text-[10px] gap-1 shadow-sm font-semibold shrink-0"
                                onClick={() => void handleConnectGitHub()} disabled={githubPending}>
                                <Github size={10} />
                                {githubPending ? 'Connecting...' : 'Connect'}
                            </Button>
                        </>
                    ) : project.remote_url ? (
                        <Badge variant="outline" className="bg-muted/30 text-muted-foreground border-border/30 gap-1 h-5 px-2 text-[10px] font-semibold shrink-0">
                            <GitBranch size={10} /> Git
                        </Badge>
                    ) : null}

                    {/* Divider */}
                    <div className="h-4 w-px bg-border/40 shrink-0" />

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <AppTooltip content="Refresh project">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground" onClick={handleRefresh} disabled={refreshing}>
                                <RefreshCcw size={13} className={refreshing ? 'animate-refresh-spin' : ''} />
                            </Button>
                        </AppTooltip>
                        {project.remote_url && (
                            <AppTooltip content="Open repository in browser">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                                    onClick={() => void openExternal(sshToHttps(project.remote_url))}>
                                    <Globe size={13} />
                                </Button>
                            </AppTooltip>
                        )}
                        <AppTooltip content="Remove project">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-red-400"
                                onClick={() => setIsDeleteDialogOpen(true)}>
                                <Trash2 size={13} />
                            </Button>
                        </AppTooltip>
                    </div>
                </div>

                {/* Error banner */}
                {githubError && (
                    <div className="mx-4 mb-1.5 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-[11px] text-red-500 dark:text-red-400 flex items-center justify-between">
                        <span>{githubError}</span>
                        <button onClick={() => setGithubError('')} className="ml-2 hover:text-red-300"><X size={12} /></button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-0 px-4 border-t border-border/20">
                    {tabs.map((tab) => {
                        const disabled = tab.needsPath && !pathExists
                        return (
                            <button key={tab.id}
                                onClick={() => !disabled && setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${
                                    disabled ? 'border-transparent text-muted-foreground/20 cursor-not-allowed'
                                    : activeTab === tab.id ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground/50 hover:text-foreground'
                                }`}>
                                {tab.icon} {tab.label}
                            </button>
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
                                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-400 text-xs">
                                    <AlertCircle size={14} className="shrink-0" />
                                    Path not found: <span className="font-mono">{project.root_path}</span>
                                </div>
                            )}
                            <div className="flex-1 flex flex-col overflow-hidden rounded-lg border border-border/30 bg-card/50">
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
                                <div className="flex flex-col items-center justify-center py-20 text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg">
                                    <AlertCircle size={36} className="mb-3" />
                                    <p className="text-sm font-semibold">Failed to load files</p>
                                    <p className="text-xs mt-1 font-mono opacity-60">{tabError}</p>
                                </div>
                            ) : loadingTab ? (
                                <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                            ) : (
                                <div className="flex-1 flex gap-3 min-h-0">
                                    {/* File tree */}
                                    <div className="w-1/3 min-w-[240px] bg-card/50 border border-border/30 rounded-lg overflow-hidden flex flex-col">
                                        <div className="p-2 border-b border-border/30 space-y-1.5">
                                            <div className="relative">
                                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                                <input type="text" value={fileQuery} onChange={(e) => setFileQuery(e.target.value)}
                                                    placeholder="Search files..." className="h-7 w-full rounded border border-border/40 bg-background/60 pl-7 pr-7 text-xs outline-none focus:border-primary/50" />
                                                {fileQuery && <button onClick={() => setFileQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground/50 hover:text-foreground"><X size={11} /></button>}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <button onClick={() => setExpandedPaths({})} className="text-[10px] text-muted-foreground hover:text-foreground">Collapse all</button>
                                                <button onClick={() => setShowHiddenFiles(p => !p)} className={`text-[10px] ${showHiddenFiles ? 'text-primary' : 'text-muted-foreground'} hover:text-foreground`}>
                                                    Dotfiles {showHiddenFiles ? 'on' : 'off'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-auto custom-scrollbar focus:outline-none" tabIndex={0}
                                            onKeyDown={(e) => { void handleTreeKeyDown(e) }}
                                            onFocus={() => { if (!focusedPath && visibleTreeNodes[0]) setFocusedPath(visibleTreeNodes[0].node.path) }}>
                                            {filteredTree.length > 0 ? (
                                                <FileTree items={filteredTree} expandedPaths={expandedPaths} loadingPaths={folderLoadPending}
                                                    onToggle={toggleFolder} onFileClick={(p) => { void handleFileClick(p) }}
                                                    activeFile={selectedFile} focusedPath={focusedPath} />
                                            ) : (
                                                <div className="px-3 py-6 text-[11px] text-muted-foreground/50">No files match.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* File content */}
                                    <div className="flex-1 bg-card/50 border border-border/30 rounded-lg overflow-hidden flex flex-col">
                                        <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2 min-h-[36px]">
                                            <File size={12} className="text-primary/50 shrink-0" />
                                            <span className="text-[11px] font-mono text-muted-foreground truncate">{selectedFile || 'No file selected'}</span>
                                            {contentLoading && <RefreshCcw size={11} className="text-primary animate-refresh-spin ml-auto" />}
                                        </div>
                                        <div className="flex-1 overflow-auto custom-scrollbar">
                                            {selectedFile ? (
                                                fileContent !== null ? (
                                                    <pre className="m-0 p-4 font-mono text-xs leading-6 text-foreground/90 overflow-x-auto">{fileContent}</pre>
                                                ) : <div className="flex items-center justify-center h-full text-sm opacity-20">Loading...</div>
                                            ) : <div className="flex items-center justify-center h-full text-muted-foreground/25 text-sm">Select a file</div>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'git' && (
                        <section className="flex-1 flex flex-col min-h-0">
                            <GitTab project={project} config={config} />
                        </section>
                    )}
                </div>
            </div>

            {/* Delete dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md bg-popover border-border p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-center">Remove Project</DialogTitle>
                        <DialogDescription className="text-center text-sm pt-2">
                            Remove <span className="font-semibold text-foreground">{project.name}</span> from your workspace?
                            <span className="block text-xs text-muted-foreground/50 mt-1">Files on disk will not be deleted.</span>
                        </DialogDescription>
                    </DialogHeader>
                    {deleteError && (
                        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 mt-2">{deleteError}</div>
                    )}
                    <DialogFooter className="mt-4 flex gap-2 sm:gap-2">
                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="flex-1 h-9" disabled={deletePending}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} className="flex-1 h-9 font-semibold" disabled={deletePending}>
                            {deletePending ? 'Removing...' : 'Remove'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}


// --- File tree helpers (kept in same file for co-location) ---

type VisibleTreeEntry = { node: ProjectTreeNode; level: number; parentPath: string | null }

function injectTreeChildren(nodes: ProjectTreeNode[], targetPath: string, children: ProjectTreeNode[]): ProjectTreeNode[] {
    return nodes.map((node) => {
        if (node.path === targetPath) return { ...node, children }
        if (node.children?.length) return { ...node, children: injectTreeChildren(node.children, targetPath, children) }
        return node
    })
}

function filterTreeNodes(nodes: ProjectTreeNode[], query: string, showHidden: boolean): ProjectTreeNode[] {
    const q = query.trim().toLowerCase()
    return nodes
        .filter((n) => showHidden || !n.name.startsWith('.'))
        .flatMap((n) => {
            const kids = n.children ? filterTreeNodes(n.children, query, showHidden) : []
            const match = !q || n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)
            if (n.is_dir) return (match || kids.length || !q) ? [{ ...n, children: kids }] : []
            return match ? [n] : []
        })
}

function flattenVisibleTree(nodes: ProjectTreeNode[], expanded: Record<string, boolean>, level = 0, parent: string | null = null): VisibleTreeEntry[] {
    const out: VisibleTreeEntry[] = []
    for (const node of nodes) {
        out.push({ node, level, parentPath: parent })
        if (node.is_dir && expanded[node.path] && node.children?.length)
            out.push(...flattenVisibleTree(node.children, expanded, level + 1, node.path))
    }
    return out
}

function getNodeIcon(node: ProjectTreeNode, isOpen: boolean) {
    if (node.is_dir) return isOpen ? <FolderOpen size={15} className="text-primary" /> : <FolderIcon size={15} className="text-primary/50" />
    const ext = node.name.split('.').pop()?.toLowerCase() || ''
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'rb', 'php'].includes(ext)) return <Code size={14} className="text-sky-400/70" />
    if (['json', 'yaml', 'yml', 'toml', 'ini', 'env'].includes(ext)) return <Database size={14} className="text-emerald-400/70" />
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return <Image size={14} className="text-purple-400/70" />
    if (['md', 'txt', 'log'].includes(ext)) return <FileText size={14} className="text-amber-300/70" />
    return <File size={14} className="text-muted-foreground/50" />
}

function FileTree({ items, level = 0, expandedPaths, loadingPaths, onToggle, onFileClick, activeFile, focusedPath }: {
    items: ProjectTreeNode[]; level?: number; expandedPaths: Record<string, boolean>; loadingPaths: Record<string, boolean>
    onToggle: (n: ProjectTreeNode) => void | Promise<void>; onFileClick?: (p: string) => void; activeFile?: string | null; focusedPath?: string | null
}) {
    return (
        <div>{items.map((item, i) => {
            const isOpen = !!expandedPaths[item.path]
            const isActive = activeFile === item.path
            const isFocused = focusedPath === item.path
            const loading = !!loadingPaths[item.path]
            return (
                <React.Fragment key={`${item.path}-${i}`}>
                    <div style={{ paddingLeft: `${level * 14 + 8}px` }}
                        className={`py-1 pr-2 flex items-center gap-1.5 cursor-pointer transition-colors text-xs ${
                            isActive ? 'bg-primary/10 text-primary' : isFocused ? 'bg-muted/30 text-foreground' : 'hover:bg-muted/15'}`}
                        onClick={() => item.is_dir ? void onToggle(item) : onFileClick?.(item.path)}>
                        {item.is_dir ? (
                            loading ? <RefreshCcw size={12} className="text-primary/40 animate-refresh-spin" />
                            : <ChevronRight size={12} className={`text-muted-foreground/40 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        ) : <div className="w-3" />}
                        {getNodeIcon(item, isOpen)}
                        <span className="truncate">{item.name}</span>
                    </div>
                    {isOpen && item.children?.length ? (
                        <FileTree items={item.children} level={level + 1} expandedPaths={expandedPaths} loadingPaths={loadingPaths}
                            onToggle={onToggle} onFileClick={onFileClick} activeFile={activeFile} focusedPath={focusedPath} />
                    ) : null}
                    {isOpen && item.is_dir && !item.children?.length && !loading && (
                        <div style={{ paddingLeft: `${(level + 1) * 14 + 8}px` }} className="py-1.5 text-[10px] text-muted-foreground/30 italic">Empty</div>
                    )}
                </React.Fragment>
            )
        })}</div>
    )
}
