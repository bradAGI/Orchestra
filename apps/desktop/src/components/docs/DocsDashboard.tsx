import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
    BookOpen, FileText, ChevronRight, Search, 
    Terminal, Info, ShieldCheck, ListTree, 
    RefreshCcw, Folder, FolderOpen,
    CheckCircle2, Activity, Clock, Hash,
    ArrowUp, Menu, LayoutList, ScrollText, Code as CodeIcon
} from 'lucide-react'
import type { DocItem, BackendConfig } from '@/lib/orchestra-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchDocs, fetchDocContent } from '@/lib/orchestra-client'
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { D3ArchitectureGraph } from '../diagrams/D3ArchitectureGraph'
import { MermaidDiagram, DiagramFullscreenOverlay, DiagramErrorBoundary } from '../diagrams/MermaidDiagram'
import { AppTooltip } from '../ui/tooltip-wrapper'

interface DocsDashboardProps {
    config: BackendConfig | null
    theme?: 'light' | 'dark'
}

export const DocsDashboard: React.FC<DocsDashboardProps> = ({ config, theme }) => {
    const [docs, setDocs] = useState<DocItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPath, setSelectedPath] = useState<string | null>(null)
    const [content, setContent] = useState<string>('')
    const [contentLoading, setContentLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['plans', 'specs']))
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([])
    
    const scrollRef = useRef<OverlayScrollbarsComponentRef<'div'> | null>(null)

    const osOptions = useMemo(() => ({
        scrollbars: { autoHide: 'move' as const, theme: 'os-theme-custom' },
        overflow: { x: 'hidden' as const, y: 'scroll' as const }
    }), [])

    const loadDocs = async () => {
        if (!config) return
        setLoading(true)
        try {
            const data = await fetchDocs(config)
            setDocs(data)
            
            if (!selectedPath && data.length > 0) {
                const first = findFirstDoc(data)
                if (first) {
                    handleSelectDoc(first.path)
                }
            }
        } catch (err) {
            console.error('Failed to load documentation tree:', err)
        } finally {
            setLoading(false)
        }
    }

    const findFirstDoc = (items: DocItem[]): DocItem | null => {
        // Prefer index.md as the landing page
        const indexDoc = items.find(i => i.name === 'index.md')
        if (indexDoc) return indexDoc
        for (const item of items) {
            if (!item.is_folder) return item
            if (item.children) {
                const child = findFirstDoc(item.children)
                if (child) return child
            }
        }
        return null
    }

    useEffect(() => {
        loadDocs()
    }, [config])

    const handleSelectDoc = async (path: string) => {
        if (!config) return
        setSelectedPath(path)
        setContentLoading(true)
        try {
            const text = await fetchDocContent(config, path)
            setContent(text)
            generateToc(text)
            // Scroll to top
            if (scrollRef.current) {
                const instance = scrollRef.current.osInstance()
                if (instance) {
                    const { viewport } = instance.elements()
                    viewport.scrollTo({ top: 0, behavior: 'smooth' })
                }
            }
        } catch (err) {
            setContent('# Error\nFailed to load document content.')
        } finally {
            setContentLoading(false)
        }
    }

    // Stable refs for the memoized markdown components
    const handleSelectDocRef = useRef(handleSelectDoc)
    handleSelectDocRef.current = handleSelectDoc
    const selectedPathRef = useRef(selectedPath)
    selectedPathRef.current = selectedPath

    const markdownComponents = useMemo(() => ({
        a({href, children, ...props}: any) {
            if (href && (href.endsWith('.md') || href.includes('.md#'))) {
                const currentDir = selectedPathRef.current?.split('/').slice(0, -1).join('/') || ''
                let resolvedPath = href.split('#')[0]
                if (!resolvedPath.startsWith('/') && currentDir) {
                    resolvedPath = `${currentDir}/${resolvedPath}`
                }
                const parts = resolvedPath.split('/').filter(Boolean)
                const normalized: string[] = []
                for (const p of parts) {
                    if (p === '..') normalized.pop()
                    else if (p !== '.') normalized.push(p)
                }
                resolvedPath = normalized.join('/')
                return (
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); handleSelectDocRef.current(resolvedPath) }}
                        className="text-primary border-b border-primary/30 hover:border-primary transition-colors cursor-pointer"
                        {...props}
                    >
                        {children}
                    </a>
                )
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
        },
        pre({node, children, ...preProps}: any) {
            const codeChild = node?.children?.[0]
            if (codeChild?.type === 'element' && codeChild.tagName === 'code') {
                const cls = codeChild.properties?.className
                const langStr = Array.isArray(cls) ? cls.join(' ') : String(cls || '')
                if (langStr.includes('language-mermaid')) {
                    const text = codeChild.children
                        ?.map((c: any) => c.type === 'text' ? c.value : '')
                        .join('') || ''
                    return <DiagramErrorBoundary chart={text}><MermaidDiagram chart={text} theme={theme} /></DiagramErrorBoundary>
                }
            }
            return <pre {...preProps}>{children}</pre>
        },
        code({node, className, children, ...props}: any) {
            const match = /language-([a-zA-Z0-9-]+)/.exec(className || '')
            const isInline = node?.tagName === 'code' && !match
            if (!isInline && match) {
                if (match[1] === 'diagram-architecture') {
                    return <D3ArchitectureGraph data={String(children)} />
                }
                return (
                    <div className="my-10 rounded-3xl overflow-hidden border border-border shadow-2xl bg-card">
                        <div className="bg-muted/30 px-6 py-3 flex items-center justify-between border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-full bg-destructive/20 border border-destructive/10" />
                                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500/20 border border-amber-500/10" />
                                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/10" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{match[1]}</span>
                            </div>
                            <div className="h-5 w-5 rounded-md bg-muted/20 flex items-center justify-center border border-border">
                                <CodeIcon size={12} className="text-muted-foreground/40" />
                            </div>
                        </div>
                        <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, padding: '2rem', fontSize: '14px', background: 'transparent', lineHeight: '1.6' }}
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    </div>
                )
            }
            return (
                <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-mono text-[0.9em]" {...props}>
                    {children}
                </code>
            )
        }
    }), [theme])

    const generateToc = (markdown: string) => {
        const lines = markdown.split('\n')
        const headings: { id: string, text: string, level: number }[] = []
        lines.forEach(line => {
            const match = line.match(/^(#{1,3})\s+(.+)$/)
            if (match) {
                const level = match[1].length
                const text = match[2].trim()
                const id = text.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                headings.push({ id, text, level })
            }
        })
        setToc(headings)
    }

    const toggleFolder = (path: string) => {
        const next = new Set(expandedFolders)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        setExpandedFolders(next)
    }

    const scrollToHeading = (id: string) => {
        const element = document.getElementById(id)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const filterTree = (items: DocItem[], query: string): DocItem[] => {
        if (!query) return items
        const lowerQuery = query.toLowerCase()
        return items.reduce<DocItem[]>((acc, item) => {
            if (item.is_folder) {
                const filteredChildren = item.children ? filterTree(item.children, query) : []
                if (filteredChildren.length > 0) {
                    acc.push({ ...item, children: filteredChildren })
                }
            } else if (item.name.toLowerCase().includes(lowerQuery)) {
                acc.push(item)
            }
            return acc
        }, [])
    }

    const filteredDocs = useMemo(() => filterTree(docs, searchQuery), [docs, searchQuery])

    // Section ordering and numbering
    const sectionOrder: Record<string, number> = {
        'index.md': 0,
        'architecture': 1,
        'api': 2,
        'backend': 3,
        'frontend': 4,
        'guides': 5,
        'operations': 6,
        'enums.md': 7,
    }
    const subSectionOrder: Record<string, Record<string, number>> = {
        'architecture': { 'overview.md': 0, 'backend.md': 1, 'desktop.md': 2, 'tui.md': 3, 'data-flow.md': 4 },
        'api': { 'reference.md': 0, 'schemas.md': 1, 'sse-events.md': 2 },
        'backend': { 'orchestrator.md': 0, 'agents.md': 1, 'tracker.md': 2, 'workspace.md': 3, 'database.md': 4, 'config.md': 5, 'mcp.md': 6, 'tools.md': 7, 'telemetry.md': 8 },
        'frontend': { 'components.md': 0, 'views.md': 1, 'client.md': 2, 'state-management.md': 3, 'electron.md': 4 },
        'guides': { 'getting-started.md': 0, 'configuration.md': 1, 'development.md': 2 },
        'operations': { 'deployment.md': 0, 'docker.md': 1, 'ci-cd.md': 2 },
    }

    const getDisplayName = (item: DocItem): string => {
        if (item.name === 'index.md') return 'Orchestra Documentation'
        return item.name.replace('.md', '').replace(/[-_]/g, ' ')
    }

    const getSectionNumber = (item: DocItem): string => {
        const parentDir = item.path.includes('/') ? item.path.split('/')[0] : ''
        if (item.is_folder) {
            const num = sectionOrder[item.name]
            return num !== undefined && num > 0 ? `${num}` : ''
        }
        if (!parentDir) {
            // Root-level file
            const num = sectionOrder[item.name]
            return num !== undefined ? (num === 0 ? '' : `${num}`) : ''
        }
        // File inside a folder
        const parentNum = sectionOrder[parentDir]
        const subOrder = subSectionOrder[parentDir]
        const subNum = subOrder?.[item.name]
        if (parentNum !== undefined && subNum !== undefined) {
            return `${parentNum}.${subNum + 1}`
        }
        return ''
    }

    const sortItems = (items: DocItem[], parentDir?: string): DocItem[] => {
        return [...items].sort((a, b) => {
            // Folders before files, except index.md always first
            if (a.name === 'index.md') return -1
            if (b.name === 'index.md') return 1
            if (a.is_folder && !b.is_folder) return -1
            if (!a.is_folder && b.is_folder) return 1

            const orderMap = parentDir ? subSectionOrder[parentDir] : sectionOrder
            const aOrder = orderMap?.[a.name] ?? 999
            const bOrder = orderMap?.[b.name] ?? 999
            if (aOrder !== bOrder) return aOrder - bOrder
            return a.name.localeCompare(b.name)
        })
    }

    const renderTree = (items: DocItem[], level = 0, parentDir?: string) => {
        return sortItems(items, parentDir).map(item => {
            if (item.is_folder) {
                const isExpanded = expandedFolders.has(item.path)
                return (
                    <div key={item.path} className="space-y-0.5">
                        <button
                            onClick={() => toggleFolder(item.path)}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-muted-foreground/50 hover:bg-muted transition-all text-left group"
                            style={{ paddingLeft: `${level * 12 + 8}px` }}
                        >
                            <div className="flex items-center gap-2 flex-1 text-left">
                                {isExpanded ? <FolderOpen size={14} className="text-primary/60" /> : <Folder size={14} className="text-muted-foreground/30" />}
                                {getSectionNumber(item) && <span className="text-[10px] font-mono text-primary/50">{getSectionNumber(item)}</span>}
                                <span className="text-xs font-black uppercase tracking-widest group-hover:text-muted-foreground transition-colors">{item.name}</span>
                            </div>
                            <ChevronRight size={12} className={`transition-transform duration-200 opacity-20 ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        {isExpanded && item.children && renderTree(item.children, level + 1, item.name)}
                    </div>
                )
            }

            const isActive = selectedPath === item.path
            return (
                <button
                    key={item.path}
                    onClick={() => handleSelectDoc(item.path)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-md transition-all text-left relative group ${
                        isActive
                            ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm font-bold'
                            : 'text-muted-foreground/60 hover:bg-muted border border-transparent hover:text-foreground'
                    }`}
                    style={{ paddingLeft: `${level * 12 + 8}px` }}
                >
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-primary rounded-r-full" />}
                    <FileText size={14} className={isActive ? 'text-primary' : 'text-muted-foreground/30 group-hover:text-muted-foreground/60'} />
                    {getSectionNumber(item) && <span className="text-[10px] font-mono text-primary/40 shrink-0">{getSectionNumber(item)}</span>}
                    <span className={`flex-1 text-sm tracking-tight truncate`}>
                        {getDisplayName(item)}
                    </span>
                </button>
            )
        })
    }

    return (
        <div className="flex flex-col h-full bg-background/20 overflow-hidden">
            <DiagramFullscreenOverlay />
            <div className="flex-1 flex overflow-hidden min-h-0 relative bg-transparent">
                {/* Left Sidebar (Navigation) */}
                <div className="w-72 border-r border-border bg-muted/10 flex flex-col min-h-0 z-20 ml-3">
                    <div className="p-3 border-b border-border shrink-0 bg-muted/5">
                        <div className="flex items-center gap-2">
                            <div className="relative group flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search docs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-8 pl-9 pr-4 bg-muted/30 border-border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <AppTooltip content="Force documentation scan">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={loadDocs}
                                    disabled={loading}
                                    className="h-8 w-8 p-0 shrink-0 border border-border hover:bg-muted"
                                >
                                    <RefreshCcw size={14} className={loading ? 'animate-refresh-spin' : ''} />
                                </Button>
                            </AppTooltip>
                        </div>
                    </div>
                    <OverlayScrollbarsComponent
                        element="div"
                        options={osOptions}
                        className="flex-1"
                    >
                        <div className="p-3 space-y-1">
                            {loading && docs.length === 0 ? (
                                [1, 2, 3, 4, 5, 6, 7].map(i => <Skeleton key={i} className="h-8 w-full mb-1 rounded-lg bg-muted/30" />)
                            ) : renderTree(filteredDocs)}
                        </div>
                    </OverlayScrollbarsComponent>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-background/5 min-h-0 relative">
                    <OverlayScrollbarsComponent
                        element="div"
                        options={osOptions}
                        className="flex-1"
                        ref={scrollRef}
                    >
                        <div className="px-16 py-16 max-w-5xl mx-auto min-h-full flex flex-col text-left">
                            {contentLoading ? (
                                <div className="space-y-8 animate-pulse">
                                    <Skeleton className="h-16 w-3/4 rounded-2xl bg-muted/30" />
                                    <div className="space-y-3">
                                        <Skeleton className="h-4 w-full bg-muted/30" />
                                        <Skeleton className="h-4 w-full bg-muted/30" />
                                        <Skeleton className="h-4 w-5/6 bg-muted/30" />
                                    </div>
                                    <Skeleton className="h-96 w-full rounded-3xl bg-muted/30" />
                                </div>
                            ) : !selectedPath ? (
                                <div className="flex-1 flex flex-col items-center justify-center opacity-20 grayscale">
                                    <Terminal size={80} className="mb-6 text-primary" strokeWidth={1} />
                                    <p className="text-lg font-black uppercase tracking-[0.4em]">Initialize Wiki Stream</p>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
                                    {/* Wiki Breadcrumbs */}
                                    <div className="mb-10 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">
                                        <BookOpen size={12} />
                                        <span>Wiki</span>
                                        <ChevronRight size={10} />
                                        <span className="text-muted-foreground/60">{selectedPath.replace('.md', '').split('/').join(' / ')}</span>
                                    </div>

                                    <article className="prose prose-invert max-w-none prose-wiki">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeSlug]}
                                            components={markdownComponents}
                                        >
                                            {content}
                                        </ReactMarkdown>
                                    </article>
                                    
                                    {/* Wiki Footer */}
                                    <div className="mt-24 pt-10 border-t border-border flex flex-wrap items-center justify-between gap-6 opacity-30">
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck size={14} className="text-primary" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Verified Specs</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Auto-Synced</span>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-mono flex items-center gap-2 bg-muted/30 px-3 py-1 rounded-full border border-border">
                                            <Hash size={12} className="text-primary" />
                                            {selectedPath}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </OverlayScrollbarsComponent>

                    {/* Back to top fab */}
                    <button 
                        onClick={() => {
                            if (scrollRef.current) {
                                const instance = scrollRef.current.osInstance()
                                if (instance) {
                                    const { viewport } = instance.elements()
                                    viewport.scrollTo({ top: 0, behavior: 'smooth' })
                                }
                            }
                        }}
                        className="absolute bottom-8 right-8 h-10 w-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-2xl backdrop-blur-xl hover:bg-primary/20 transition-all z-50 group"
                    >
                        <ArrowUp size={18} className="group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                </div>

                {/* Right Sidebar (Table of Contents) */}
                <div className="w-80 border-l border-border bg-muted/10 flex flex-col min-h-0 z-20">
                    <div className="p-6 border-b border-border shrink-0 bg-muted/5">
                        <div className="flex items-center gap-2 mb-2">
                            <ScrollText size={14} className="text-primary" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-foreground/80">On this page</h2>
                        </div>
                    </div>
                    
                    <OverlayScrollbarsComponent
                        element="div"
                        options={osOptions}
                        className="flex-1"
                    >
                        <div className="p-6 text-left">
                            {toc.length === 0 ? (
                                <div className="py-10 text-center opacity-20 grayscale">
                                    <Activity size={32} className="mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-center">No Headings</p>
                                </div>
                            ) : (
                                <nav className="space-y-1">
                                    {toc.map((heading, i) => (
                                        <button
                                            key={`${heading.id}-${i}`}
                                            onClick={() => scrollToHeading(heading.id)}
                                            className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-all hover:bg-muted/50 ${
                                                heading.level === 1 ? 'font-black uppercase tracking-widest text-foreground/90' : 
                                                heading.level === 2 ? 'font-bold text-muted-foreground/80 pl-6' : 
                                                'font-medium text-muted-foreground/60 pl-10'
                                            }`}
                                        >
                                            {heading.text}
                                        </button>
                                    ))}
                                </nav>
                            )}

                        </div>
                    </OverlayScrollbarsComponent>
                </div>
            </div>
        </div>
    )
}
