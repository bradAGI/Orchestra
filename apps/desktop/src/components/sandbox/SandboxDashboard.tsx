import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Clock, Loader2, Play, Terminal, Globe, RefreshCcw, KeyRound, Settings2, Trash2, Zap } from 'lucide-react'
import { CustomDropdown } from '@/components/app-shell/shared/controls'
import { Button } from '@/components/ui/button'
import type { BackendConfig } from '@/lib/orchestra-client'
import {
  fetchUnsandboxSessions,
  fetchUnsandboxServices,
  fetchUnsandboxStatus,
  type UnsandboxExecuteResult,
  type UnsandboxSession,
  type UnsandboxService,
  type UnsandboxStatus,
} from '@/lib/orchestra-client'

const LANGUAGES = [
  'bash',
  'python',
  'javascript',
  'typescript',
  'ruby',
  'go',
  'rust',
  'c',
  'cpp',
  'java',
  'php',
  'perl',
  'lua',
  'r',
  'elixir',
  'haskell',
  'swift',
]

const NETWORKS = ['semitrusted', 'zerotrust']

const MAX_HISTORY = 50

interface HistoryEntry {
  id: string
  ts: string
  language: string
  network: string
  code: string
  status: string
  output: string
  error: string
  job_id: string
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem('sandbox:history') || '[]') } catch { return [] }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem('sandbox:history', JSON.stringify(entries.slice(0, MAX_HISTORY)))
}

export function SandboxDashboard({ config, onOpenSettings }: { config: BackendConfig | null; onOpenSettings?: () => void }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('sandbox:language') || 'bash')
  const [network, setNetwork] = useState(() => localStorage.getItem('sandbox:network') || 'semitrusted')
  const [code, setCode] = useState(() => localStorage.getItem('sandbox:code') || '')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<UnsandboxExecuteResult | null>(null)
  const [execError, setExecError] = useState('')
  const [progressStatus, setProgressStatus] = useState('')
  const [currentJobId, setCurrentJobId] = useState('')
  const [currentJobStatus, setCurrentJobStatus] = useState('')
  const [sessionLog, setSessionLog] = useState<Array<{ type: string; message: string; ts: string }>>([])
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [expandedHistoryId, setExpandedHistoryId] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<UnsandboxStatus | null>(null)
  const [sessions, setSessions] = useState<UnsandboxSession[]>([])
  const [services, setServices] = useState<UnsandboxService[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  // Spin state: lets the refresh icon finish its current rotation before stopping
  const [spinning, setSpinning] = useState(false)
  const wantsStop = useRef(false)

  useEffect(() => {
    if (loadingSessions) {
      wantsStop.current = false
      setSpinning(true)
    } else {
      wantsStop.current = true
    }
  }, [loadingSessions])

  const handleAnimationIteration = useCallback(() => {
    if (wantsStop.current) {
      setSpinning(false)
    }
  }, [])

  useEffect(() => { localStorage.setItem('sandbox:language', language) }, [language])
  useEffect(() => { localStorage.setItem('sandbox:network', network) }, [network])
  useEffect(() => { localStorage.setItem('sandbox:code', code) }, [code])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessionLog])

  useEffect(() => {
    if (!config) return
    fetchUnsandboxStatus(config).then(setStatus).catch(() => {})
    refreshResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const refreshResources = async () => {
    if (!config) return
    setLoadingSessions(true)
    try {
      const [sessResp, svcResp] = await Promise.all([
        fetchUnsandboxSessions(config).catch(() => ({ sessions: [] })),
        fetchUnsandboxServices(config).catch(() => ({ services: [] })),
      ])
      setSessions(sessResp.sessions || [])
      setServices(svcResp.services || [])
    } finally {
      setLoadingSessions(false)
    }
  }

  const addToHistory = (entry: Omit<HistoryEntry, 'id' | 'ts'>) => {
    const newEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      ...entry,
    }
    setHistory((prev) => {
      const next = [newEntry, ...prev].slice(0, MAX_HISTORY)
      saveHistory(next)
      return next
    })
  }

  const handleExecute = async () => {
    if (!config || !code.trim()) return
    setExecuting(true)
    setResult(null)
    setExecError('')
    setProgressStatus('')
    setCurrentJobId('')
    setCurrentJobStatus('')
    setSessionLog([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.apiToken.trim()) headers.Authorization = `Bearer ${config.apiToken.trim()}`

      // Step 1: Submit — returns immediately with job_id
      const submitUrl = new URL('/api/v1/unsandbox/execute', config.baseUrl)
      const submitResp = await fetch(submitUrl.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ language, code, network: network || 'semitrusted' }),
        signal: controller.signal,
      })

      if (!submitResp.ok) {
        const text = await submitResp.text()
        setExecError(`HTTP ${submitResp.status}: ${text}`)
        return
      }

      const submitData = await submitResp.json()
      const jobId = submitData.job_id
      if (!jobId) {
        // Completed synchronously
        const res = { status: submitData.status || 'completed', output: submitData.output || '', error: submitData.error || '', job_id: '' }
        setResult(res)
        addToHistory({ language, network, code, ...res })
        return
      }

      setCurrentJobId(jobId)
      setCurrentJobStatus('pending')
      setProgressStatus(`${jobId.slice(0, 12)} pending...`)

      // Step 2: Poll until done
      const pollUrl = new URL(`/api/v1/unsandbox/jobs/${jobId}`, config.baseUrl)
      while (!controller.signal.aborted) {
        await new Promise((r) => setTimeout(r, 2000))
        if (controller.signal.aborted) break

        const pollResp = await fetch(pollUrl.toString(), { headers, signal: controller.signal })
        if (!pollResp.ok) {
          setExecError(`Poll failed: HTTP ${pollResp.status}`)
          setCurrentJobStatus('failed')
          return
        }

        const job = await pollResp.json()
        const status = job.status || 'unknown'

        if (status === 'completed' || status === 'failed') {
          setCurrentJobStatus(status)
          const res = { status, output: job.output || '', error: job.error || '', job_id: jobId }
          setResult(res)
          addToHistory({ language, network, code, ...res })
          setProgressStatus('')
          refreshResources()
          return
        }

        setCurrentJobStatus(status)
        setProgressStatus(`${status}... (${jobId.slice(0, 12)})`)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setExecError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      abortRef.current = null
      setExecuting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleExecute()
    }
  }

  const isConfigured = status?.configured && status?.valid

  if (!config) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No backend connected.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-bold">Sandbox</h2>
            <p className="text-[10px] text-muted-foreground">Remote code execution</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/30 border border-border/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Not configured
            </span>
          )}
        </div>
      </div>

      {/* Unconfigured empty state */}
      {!isConfigured && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/20 bg-muted/5 p-10">
          <div className="rounded-full bg-muted/20 p-4">
            <KeyRound className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-medium text-foreground/80">Unsandbox credentials required</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Add your API keys in Settings to enable remote code execution across 42+ languages.
            </p>
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Settings2 className="h-3 w-3" />
              Open Integration Settings
            </button>
          )}
        </div>
      )}

      {/* Execute panel */}
      {isConfigured && (
        <>
          <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="space-y-1 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Language</label>
                <CustomDropdown
                  className="w-full"
                  value={language}
                  options={LANGUAGES.map((l) => ({ label: l, value: l }))}
                  onChange={setLanguage}
                />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Network</label>
                <CustomDropdown
                  className="w-full"
                  value={network}
                  options={NETWORKS.map((n) => ({ label: n, value: n }))}
                  onChange={setNetwork}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Code</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={language === 'bash' ? 'echo "hello from unsandbox"' : `print("hello from unsandbox")`}
                rows={8}
                className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none resize-y"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExecute}
                disabled={executing || !code.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {executing ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : <Play className="h-3 w-3" />}
                Execute
              </button>
              <span className="text-[10px] text-muted-foreground">
                {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter
              </span>
            </div>
          </div>

          {/* Progress */}
          {executing && progressStatus && (
            <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-muted/10 px-4 py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin-smooth text-primary" />
              <span className="text-xs font-mono text-muted-foreground">{progressStatus}</span>
            </div>
          )}

          {/* Session Log (JSONL snoop) */}
          {sessionLog.length > 0 && (
            <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Session Activity ({sessionLog.length})
              </p>
              <div className="max-h-[300px] overflow-auto space-y-1 scroll-smooth">
                {sessionLog.map((entry, i) => (
                  <div key={i} className="flex gap-2 text-[11px] font-mono">
                    <span className="text-muted-foreground shrink-0">{entry.ts}</span>
                    <span className={`shrink-0 font-bold uppercase tracking-wider ${
                      entry.type === 'assistant' ? 'text-primary' :
                      entry.type === 'result' ? 'text-emerald-500' :
                      'text-muted-foreground'
                    }`}>
                      {entry.type.slice(0, 8).padEnd(8)}
                    </span>
                    <span className="text-foreground/80 break-all">{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Result */}
          {(result || execError) && (
            <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Output</p>
                {result && (
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className={`font-bold uppercase ${result.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {result.status}
                    </span>
                    {result.job_id && (
                      <span className="font-mono text-muted-foreground">{result.job_id}</span>
                    )}
                  </div>
                )}
              </div>
              {execError && (
                <pre className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm font-mono text-red-500 whitespace-pre-wrap overflow-auto max-h-[300px]">
                  {execError}
                </pre>
              )}
              {result?.output && (
                <pre className="rounded-lg bg-background border border-border/20 p-3 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-[400px]">
                  {result.output}
                </pre>
              )}
              {result?.error && (
                <pre className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm font-mono text-red-500 whitespace-pre-wrap overflow-auto max-h-[200px]">
                  {result.error}
                </pre>
              )}
            </div>
          )}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              History ({history.length})
            </p>
            <button
              onClick={() => { setHistory([]); saveHistory([]) }}
              className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
              title="Clear history"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {history.map((entry) => (
              <div key={entry.id} className="rounded-lg bg-background/50 border border-border/10 text-[11px]">
                <button
                  onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? '' : entry.id)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-left hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {expandedHistoryId === entry.id
                      ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">
                      {new Date(entry.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-muted-foreground shrink-0">{entry.language}</span>
                    <span className="font-mono truncate text-foreground/70">{entry.code.slice(0, 60)}</span>
                  </div>
                  <span className={`font-bold uppercase tracking-wider shrink-0 ml-2 ${
                    entry.status === 'completed' ? 'text-emerald-500' :
                    entry.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {entry.status}
                  </span>
                </button>
                {expandedHistoryId === entry.id && (
                  <div className="px-3 pb-2 space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setCode(entry.code); setLanguage(entry.language); setNetwork(entry.network) }}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Load into editor
                      </button>
                      {entry.job_id && (
                        <span className="text-[10px] font-mono text-muted-foreground">{entry.job_id}</span>
                      )}
                    </div>
                    <pre className="rounded-lg bg-muted/20 border border-border/10 p-2 text-[10px] font-mono whitespace-pre-wrap overflow-auto max-h-[120px]">
                      {entry.code}
                    </pre>
                    {entry.output && (
                      <pre className="rounded-lg bg-background border border-border/10 p-2 text-[10px] font-mono whitespace-pre-wrap overflow-auto max-h-[200px]">
                        {entry.output}
                      </pre>
                    )}
                    {entry.error && (
                      <pre className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-[10px] font-mono text-red-500 whitespace-pre-wrap overflow-auto max-h-[100px]">
                        {entry.error}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions & Services */}
      <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Resources</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshResources}
            disabled={loadingSessions}
            className="h-8 w-8 p-0 shrink-0 border border-border hover:bg-muted"
          >
            <RefreshCcw
              size={14}
              className={spinning ? 'animate-refresh-spin' : ''}
              onAnimationIteration={handleAnimationIteration}
            />
          </Button>
        </div>

        {currentJobId && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">Current Job</p>
            <div className="flex items-center justify-between rounded-lg bg-background/50 border border-border/10 px-3 py-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <Zap className={`h-3 w-3 ${currentJobStatus === 'running' || currentJobStatus === 'pending' ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                <span className="font-mono">{currentJobId.slice(0, 12)}</span>
                <span className="text-muted-foreground">{language}</span>
              </div>
              <span className={`font-bold uppercase tracking-wider ${
                currentJobStatus === 'completed' ? 'text-emerald-500' :
                currentJobStatus === 'failed' ? 'text-red-500' :
                currentJobStatus === 'running' ? 'text-primary' :
                'text-amber-500'
              }`}>
                {currentJobStatus}
              </span>
            </div>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">Sessions ({sessions.length})</p>
            <div className="space-y-1">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-background/50 border border-border/10 px-3 py-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{s.id.slice(0, 12)}</span>
                    <span className="text-muted-foreground">{s.language}</span>
                  </div>
                  <span className={`font-bold uppercase tracking-wider ${s.status === 'active' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {services.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">Services ({services.length})</p>
            <div className="space-y-1">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-background/50 border border-border/10 px-3 py-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{s.id.slice(0, 12)}</span>
                  </div>
                  <span className={`font-bold uppercase tracking-wider ${s.status === 'active' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && services.length === 0 && !loadingSessions && (
          <p className="text-[11px] text-muted-foreground">No active sessions or services.</p>
        )}
      </div>
    </div>
  )
}
