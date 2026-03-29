import React, { useState, useEffect } from 'react'
import { Mosaic, MosaicWindow, MosaicNode } from 'react-mosaic-component'
import { TerminalView, clearInitialCommandTracking } from './TerminalView'
import { Plus, X, Terminal as TerminalIcon, Columns2, Square, Zap } from 'lucide-react'

import 'react-mosaic-component/react-mosaic-component.css'
import './multiplexer.css'

export type TerminalNode = {
    id: string
    title: string
    projectId?: string
    initialCommand?: string
}

type ViewMode = 'tabs' | 'split'

const agentCommands = [
    { id: 'claude', label: 'Claude', cmd: 'claude', color: 'text-orange-400' },
    { id: 'codex', label: 'Codex', cmd: 'codex', color: 'text-emerald-400' },
    { id: 'gemini', label: 'Gemini', cmd: 'gemini', color: 'text-blue-400' },
    { id: 'opencode', label: 'OpenCode', cmd: 'opencode', color: 'text-purple-400' },
]

interface TerminalMultiplexerProps {
    activeTerminals: TerminalNode[]
    baseUrl: string
    apiToken?: string
    projects?: { id: string; name: string }[]
    onCloseTerminal: (id: string) => void
    onAddTerminal?: (projectId?: string) => void
    onAddAgentTerminal?: (id: string, title: string, command: string, projectId: string) => void
    theme?: 'light' | 'dark'
}

export const TerminalMultiplexer: React.FC<TerminalMultiplexerProps> = ({
    activeTerminals,
    baseUrl,
    apiToken,
    projects,
    onCloseTerminal,
    onAddTerminal,
    onAddAgentTerminal,
    theme
}) => {
    const [currentNode, setCurrentNode] = useState<MosaicNode<string> | null>(null)
    const [activeTabId, setActiveTabId] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<ViewMode>('tabs')
    const [selectedProjectId, setSelectedProjectId] = useState<string>('')

    const getIdsFromNode = (node: MosaicNode<string>): string[] => {
        if (typeof node === 'string') return [node]
        return [...getIdsFromNode(node.first), ...getIdsFromNode(node.second)]
    }

    // Keep activeTabId in sync with active terminals
    useEffect(() => {
        if (activeTerminals.length === 0) {
            setActiveTabId(null)
            return
        }
        if (!activeTabId || !activeTerminals.some(t => t.id === activeTabId)) {
            setActiveTabId(activeTerminals[0].id)
        }
    }, [activeTerminals, activeTabId])

    // Update mosaic layout when terminals change (for split mode)
    useEffect(() => {
        if (activeTerminals.length === 0) {
            setCurrentNode(null)
            return
        }

        const ids = activeTerminals.map(t => t.id)

        const buildBalancedTree = (nodeIds: string[], direction: 'row' | 'column' = 'row'): MosaicNode<string> => {
            if (nodeIds.length === 1) return nodeIds[0]
            const half = Math.ceil(nodeIds.length / 2)
            return {
                direction,
                first: buildBalancedTree(nodeIds.slice(0, half), direction === 'row' ? 'column' : 'row'),
                second: buildBalancedTree(nodeIds.slice(half), direction === 'row' ? 'column' : 'row')
            }
        }

        const currentIds = currentNode ? getIdsFromNode(currentNode).sort().join(',') : ''
        const activeIds = ids.slice().sort().join(',')

        if (currentIds !== activeIds) {
            setCurrentNode(buildBalancedTree(ids))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTerminals])

    if (activeTerminals.length === 0) {
        return (
            <div className="w-full h-full bg-background overflow-hidden terminal-multiplexer flex flex-col">
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/20 space-y-6">
                    <div className="relative">
                        <TerminalIcon size={80} className="animate-pulse" strokeWidth={1} />
                        <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
                    </div>
                    <div className="text-center space-y-3 relative z-10">
                        <p className="text-sm font-black uppercase tracking-[0.3em]">No Active Terminals</p>
                        <p className="text-[10px] font-medium uppercase tracking-widest opacity-60">Deploy an agent or open a project shell to begin</p>
                        {onAddTerminal && (
                            <button
                                onClick={() => onAddTerminal(selectedProjectId || undefined)}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-xs font-bold"
                            >
                                <Plus size={14} />
                                Open Terminal
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full h-full bg-background overflow-hidden terminal-multiplexer flex flex-col">
            {/* Toolbar */}
            <div className="shrink-0 bg-card/50 border-b border-border">
                {/* Top row: tabs + view toggle */}
                <div className="flex items-center h-9">
                    <div className="flex-1 flex items-center overflow-x-auto min-w-0">
                        {activeTerminals.map((term) => {
                            const isActive = viewMode === 'tabs' && activeTabId === term.id
                            return (
                                <button
                                    key={term.id}
                                    className={`group flex items-center gap-2 px-3 h-9 cursor-pointer transition-all relative shrink-0 ${
                                        isActive
                                            ? 'bg-background text-foreground'
                                            : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30'
                                    }`}
                                    onClick={() => {
                                        setActiveTabId(term.id)
                                        if (viewMode !== 'tabs') setViewMode('tabs')
                                    }}
                                >
                                    {isActive && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                                    )}
                                    <TerminalIcon size={11} className={isActive ? 'text-primary' : 'text-muted-foreground/30'} />
                                    <span className="text-[11px] font-semibold truncate max-w-[120px]">{term.title}</span>
                                    <span
                                        role="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            clearInitialCommandTracking(term.id)
                                            onCloseTerminal(term.id)
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/20 hover:text-destructive rounded transition-all ml-0.5"
                                    >
                                        <X size={10} />
                                    </span>
                                </button>
                            )
                        })}
                        {onAddTerminal && (
                            <button
                                onClick={() => onAddTerminal(selectedProjectId || undefined)}
                                className="flex items-center justify-center h-9 px-2.5 text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/30 transition-all shrink-0"
                                title="New shell"
                            >
                                <Plus size={14} />
                            </button>
                        )}
                    </div>
                    {/* View mode toggle */}
                    <div className="flex items-center gap-0.5 px-2 border-l border-border/50 shrink-0">
                        <button
                            onClick={() => setViewMode('tabs')}
                            className={`p-1.5 rounded transition-all ${viewMode === 'tabs' ? 'text-primary bg-primary/10' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                            title="Tab view"
                        >
                            <Square size={12} />
                        </button>
                        <button
                            onClick={() => setViewMode('split')}
                            className={`p-1.5 rounded transition-all ${viewMode === 'split' ? 'text-primary bg-primary/10' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                            title="Split view"
                        >
                            <Columns2 size={12} />
                        </button>
                    </div>
                </div>
                {/* Bottom row: agent quick-launch */}
                {onAddAgentTerminal && (
                    <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border/30 bg-muted/20">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Zap size={10} className="text-muted-foreground/40" />
                            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">Launch</span>
                        </div>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="px-2 py-1 rounded-lg text-[11px] bg-card border border-border/40 text-foreground outline-none max-w-[160px] truncate"
                        >
                            <option value="">Project...</option>
                            {projects?.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="h-3 w-px bg-border/50" />
                        <div className="flex items-center gap-1">
                            {agentCommands.map((agent) => (
                                <button
                                    key={agent.id}
                                    disabled={!selectedProjectId}
                                    onClick={() => onAddAgentTerminal(
                                        `${agent.id}-${Date.now()}`,
                                        agent.label,
                                        agent.cmd,
                                        selectedProjectId
                                    )}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                                        !selectedProjectId
                                            ? 'opacity-25 cursor-not-allowed border-transparent text-muted-foreground'
                                            : `${agent.color} border-current/10 opacity-70 hover:opacity-100 hover:bg-current/5`
                                    }`}
                                >
                                    {agent.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Content area */}
            <div className="flex-1 min-h-0">
                {viewMode === 'tabs' ? (
                    // Render ALL terminals, hide inactive with CSS to prevent unmount/remount
                    activeTerminals.map((term) => (
                        <div
                            key={term.id}
                            className="w-full h-full px-3"
                            style={{ display: activeTabId === term.id ? 'block' : 'none' }}
                        >
                            <TerminalView
                                sessionId={term.id}
                                projectId={term.projectId}
                                baseUrl={baseUrl}
                                apiToken={apiToken}
                                initialCommand={term.initialCommand}
                                theme={theme}
                            />
                        </div>
                    ))
                ) : (
                    // Split mosaic view
                    <Mosaic<string>
                        renderTile={(id, path) => {
                            const term = activeTerminals.find(t => t.id === id)
                            return (
                                <MosaicWindow<string>
                                    path={path}
                                    title={term?.title || id}
                                    toolbarControls={
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    clearInitialCommandTracking(id)
                                                    onCloseTerminal(id)
                                                }}
                                                className="p-1 hover:bg-destructive/20 text-muted-foreground/60 hover:text-destructive transition-colors rounded"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    }
                                >
                                    <TerminalView
                                        sessionId={id}
                                        projectId={term?.projectId}
                                        baseUrl={baseUrl}
                                        apiToken={apiToken}
                                        initialCommand={term?.initialCommand}
                                        theme={theme}
                                    />
                                </MosaicWindow>
                            )
                        }}
                        value={currentNode}
                        onChange={setCurrentNode}
                        className="flex-1"
                    />
                )}
            </div>
        </div>
    )
}
