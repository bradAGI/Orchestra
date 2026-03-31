import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

// Track which sessions have already had their initial command sent,
// so tab switches (unmount+remount) don't re-inject the command.
const sentInitialCommands = new Set<string>()

export function clearInitialCommandTracking(sessionId: string) {
    sentInitialCommands.delete(sessionId)
}

interface TerminalViewProps {
    sessionId: string
    projectId?: string
    baseUrl: string
    apiToken?: string
    onClose?: () => void
    initialCommand?: string
    theme?: 'light' | 'dark'
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId, projectId, baseUrl, apiToken, onClose: _onClose, initialCommand, theme }) => {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (!terminalRef.current) return

        const isDark = theme === 'dark' || document.documentElement.classList.contains('dark')
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 13,
            lineHeight: 1.3,
            letterSpacing: 0,
            fontFamily: '"CaskaydiaMono Nerd Font", "CaskaydiaMono NFM", "JetBrainsMono Nerd Font Mono", Menlo, Monaco, Consolas, monospace',
            theme: {
                background: isDark ? '#0a0a0b' : '#f8fafc',
                foreground: isDark ? '#ffffff' : '#0f172a',
                cursor: isDark ? 'hsl(161, 72%, 45%)' : 'hsl(161, 72%, 38%)',
                selectionBackground: isDark ? 'rgba(161, 72%, 45%, 0.3)' : 'rgba(161, 72%, 38%, 0.2)',
                black: '#000000',
                red: '#ef4444',
                green: '#10b981',
                yellow: '#f59e0b',
                blue: '#3b82f6',
                magenta: '#8b5cf6',
                cyan: '#06b6d4',
                white: '#ffffff',
                brightBlack: '#475569',
                brightRed: '#f87171',
                brightGreen: '#34d399',
                brightYellow: '#fbbf24',
                brightBlue: '#60a5fa',
                brightMagenta: '#a78bfa',
                brightCyan: '#22d3ee',
                brightWhite: '#f1f5f9',
            }
        })

        const fitAddon = new FitAddon()
        fitAddonRef.current = fitAddon
        term.loadAddon(fitAddon)
        term.open(terminalRef.current)
        // Delay initial fit to ensure the container has its final dimensions.
        // Without this, xterm renders at a smaller size and doesn't fill the container.
        requestAnimationFrame(() => {
            try { fitAddon.fit() } catch { /* container may have zero dimensions */ }
            // Double-fit after a short delay to catch late layout shifts
            setTimeout(() => { try { fitAddon.fit() } catch {} }, 100)
        })

        xtermRef.current = term

        // WebSocket connection
        const wsUrl = new URL(baseUrl)
        wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
        wsUrl.pathname = `/api/v1/terminal/${sessionId}`
        if (projectId) wsUrl.searchParams.set('project_id', projectId)
        if (apiToken && apiToken.trim() !== '') wsUrl.searchParams.set('token', apiToken.trim())

        const ws = new WebSocket(wsUrl.toString())
        wsRef.current = ws

        ws.onopen = () => {
            term.write('\r\n\x1b[32mCONNECTED TO ORCHESTRA TERMINAL\x1b[0m\r\n')
            // Send initial size
            const { rows, cols } = term
            ws.send(JSON.stringify({ type: 'resize', rows, cols }))
            // Run initial command if provided (e.g. launching an agent)
            // Only send once per session — prevents re-injection on tab switch remount.
            if (initialCommand && !sentInitialCommands.has(sessionId)) {
                sentInitialCommands.add(sessionId)
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(initialCommand + '\n')
                    }
                }, 500)
            }
        }

        ws.onmessage = async (event) => {
            if (event.data instanceof Blob) {
                const text = await event.data.text()
                term.write(text)
            } else {
                term.write(event.data)
            }
        }

        ws.onclose = () => {
            term.write('\r\n\x1b[31mDISCONNECTED FROM BACKEND\x1b[0m\r\n')
        }

        term.onData(data => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data)
            }
        })

        const handleResize = () => {
            try {
                fitAddon.fit()
                const { rows, cols } = term
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'resize', rows, cols }))
                }
            } catch { /* intentionally empty */ }
        }

        // ResizeObserver for mosaic pane resizing
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(handleResize)
        })
        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current)
        }

        // IntersectionObserver to re-fit when terminal becomes visible again
        // (e.g. navigating away from Terminals section and back)
        const intersectionObserver = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                requestAnimationFrame(handleResize)
            }
        })
        if (terminalRef.current) {
            intersectionObserver.observe(terminalRef.current)
        }

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            resizeObserver.disconnect()
            intersectionObserver.disconnect()
            ws.close()
            term.dispose()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, projectId, baseUrl, apiToken, theme])

    return (
        <div className="w-full h-full overflow-hidden">
            <div ref={terminalRef} className="w-full h-full" />
        </div>
    )
}
