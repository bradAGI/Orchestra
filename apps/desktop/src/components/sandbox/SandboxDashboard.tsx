import { useEffect, useState } from 'react'
import { Loader2, Play, Terminal, Globe, Trash2, RefreshCcw } from 'lucide-react'
import { CustomDropdown } from '@/components/app-shell/shared/controls'
import type { BackendConfig } from '@/lib/orchestra-client'
import {
  executeUnsandbox,
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

export function SandboxDashboard({ config }: { config: BackendConfig | null }) {
  const [language, setLanguage] = useState('bash')
  const [network, setNetwork] = useState('semitrusted')
  const [code, setCode] = useState('')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<UnsandboxExecuteResult | null>(null)
  const [execError, setExecError] = useState('')

  const [status, setStatus] = useState<UnsandboxStatus | null>(null)
  const [sessions, setSessions] = useState<UnsandboxSession[]>([])
  const [services, setServices] = useState<UnsandboxService[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  useEffect(() => {
    if (!config) return
    fetchUnsandboxStatus(config).then(setStatus).catch(() => {})
    refreshResources()
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

  const handleExecute = async () => {
    if (!config || !code.trim()) return
    setExecuting(true)
    setResult(null)
    setExecError('')
    try {
      const res = await executeUnsandbox(config, language, code, network)
      setResult(res)
    } catch (err) {
      setExecError(err instanceof Error ? err.message : String(err))
    } finally {
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
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-bold">Unsandbox</h2>
            <p className="text-[10px] text-muted-foreground">Remote code execution</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Connected</span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
              {status?.error || 'Not configured'}
            </span>
          )}
        </div>
      </div>

      {/* Execute panel */}
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
            disabled={executing || !code.trim() || !isConfigured}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Execute
          </button>
          <span className="text-[10px] text-muted-foreground">
            {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter
          </span>
        </div>
      </div>

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

      {/* Sessions & Services */}
      <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Resources</p>
          <button
            onClick={refreshResources}
            disabled={loadingSessions}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={`h-3 w-3 ${loadingSessions ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

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
