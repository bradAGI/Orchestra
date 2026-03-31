// apps/desktop/src/widgets/agents/panels/SettingsPanel.tsx
import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2, RotateCcw, Code, Settings2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface SettingsPanelProps {
  settings: Record<string, unknown>
  settingsPath: string
  settingsExists: boolean
  saving: string | null
  onSave: (settings: Record<string, unknown>) => Promise<void>
}

const MODEL_OPTIONS = [
  { value: 'sonnet', label: 'Sonnet (latest)' },
  { value: 'opus', label: 'Opus (latest)' },
  { value: 'haiku', label: 'Haiku (latest)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-opus-4-6[1m]', label: 'Claude Opus 4.6 (1M context)' },
  { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

const PERMISSION_MODE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'plan', label: 'Plan' },
  { value: 'auto', label: 'Auto' },
  { value: 'bypassPermissions', label: 'Bypass Permissions' },
]

const selectClasses =
  'h-8 bg-muted/10 rounded-lg border border-border/30 px-3 text-[11px] text-foreground focus:outline-none focus:border-primary/30 transition-colors appearance-none cursor-pointer'
const toggleTrackClasses = (on: boolean) =>
  `relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-border/30 transition-colors ${on ? 'bg-primary' : 'bg-muted/20'}`
const toggleThumbClasses = (on: boolean) =>
  `pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`

export function SettingsPanel({ settings, settingsPath, settingsExists, saving, onSave }: SettingsPanelProps) {
  const [mode, setMode] = useState<'structured' | 'raw'>('structured')
  const [local, setLocal] = useState<Record<string, unknown>>(settings)
  const [rawJson, setRawJson] = useState(() => JSON.stringify(settings, null, 2))
  const [rawError, setRawError] = useState<string | null>(null)
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')

  // Sync from parent when settings change externally
  useEffect(() => {
    setLocal(settings)
    setRawJson(JSON.stringify(settings, null, 2))
  }, [settings])

  // Sync raw JSON when switching to raw mode
  useEffect(() => {
    if (mode === 'raw') {
      setRawJson(JSON.stringify(local, null, 2))
      setRawError(null)
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = JSON.stringify(local) !== JSON.stringify(settings)
  const isRawDirty = mode === 'raw' && rawJson !== JSON.stringify(settings, null, 2)
  const showDirty = mode === 'structured' ? isDirty : isRawDirty

  const handleDiscard = useCallback(() => {
    setLocal(settings)
    setRawJson(JSON.stringify(settings, null, 2))
    setRawError(null)
  }, [settings])

  const handleSave = useCallback(async () => {
    if (mode === 'raw') {
      try {
        const parsed = JSON.parse(rawJson)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setRawError('Settings must be a JSON object')
          return
        }
        await onSave(parsed)
        setLocal(parsed)
        setRawError(null)
      } catch {
        setRawError('Invalid JSON')
      }
    } else {
      await onSave(local)
    }
  }, [mode, rawJson, local, onSave])

  const updateField = useCallback((key: string, value: unknown) => {
    setLocal(prev => ({ ...prev, [key]: value }))
  }, [])

  const removePlugin = useCallback((plugin: string) => {
    setLocal(prev => {
      const plugins = Array.isArray(prev.enabledPlugins) ? (prev.enabledPlugins as string[]).filter(p => p !== plugin) : []
      return { ...prev, enabledPlugins: plugins }
    })
  }, [])

  const envObj = (typeof local.env === 'object' && local.env !== null && !Array.isArray(local.env))
    ? local.env as Record<string, string>
    : {}

  const handleAddEnv = useCallback(() => {
    if (!newEnvKey.trim()) return
    const updated = { ...envObj, [newEnvKey.trim()]: newEnvValue }
    setLocal(prev => ({ ...prev, env: updated }))
    setNewEnvKey('')
    setNewEnvValue('')
  }, [newEnvKey, newEnvValue, envObj])

  const handleRemoveEnv = useCallback((key: string) => {
    const { [key]: _, ...rest } = envObj
    setLocal(prev => ({ ...prev, env: Object.keys(rest).length > 0 ? rest : undefined }))
  }, [envObj])

  const handleEnvValueChange = useCallback((key: string, value: string) => {
    setLocal(prev => ({ ...prev, env: { ...envObj, [key]: value } }))
  }, [envObj])

  if (!settingsExists && Object.keys(settings).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/30">
        <Settings2 size={32} />
        <p className="text-sm font-bold uppercase tracking-widest">No settings file found</p>
        <p className="text-[10px] text-muted-foreground/20">{settingsPath}</p>
        <Button
          size="sm"
          onClick={() => onSave({})}
          disabled={!!saving}
          className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg mt-2"
        >
          {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
          Create File
        </Button>
      </div>
    )
  }

  if (saving === 'loading') {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[300px] w-full" /></div>
  }

  const plugins = Array.isArray(local.enabledPlugins) ? (local.enabledPlugins as string[]) : []

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold">Settings</h3>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono truncate">{settingsPath}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMode(m => m === 'structured' ? 'raw' : 'structured')}
            className="h-7 text-[10px] gap-1.5"
          >
            {mode === 'structured' ? <Code size={10} /> : <Settings2 size={10} />}
            {mode === 'structured' ? 'Raw JSON' : 'Structured'}
          </Button>

          {showDirty && (
            <>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>
              <Button size="sm" variant="ghost" onClick={handleDiscard} className="h-7 text-[10px]">
                <RotateCcw size={10} className="mr-1" /> Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!!saving}
                className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
              >
                {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {mode === 'raw' ? (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <textarea
            value={rawJson}
            onChange={(e) => { setRawJson(e.target.value); setRawError(null) }}
            className="flex-1 min-h-0 bg-muted/10 rounded-lg border border-border/30 px-4 py-3 font-mono text-[13px] leading-6 text-foreground focus:outline-none focus:border-primary/30 resize-none transition-colors"
            spellCheck={false}
          />
          {rawError && <p className="text-[10px] text-red-400 font-mono">{rawError}</p>}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
          {/* Model & Behavior */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Model & Behavior</h4>

            {/* Model */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-[11px] text-foreground/70 shrink-0">Model</label>
              <select
                value={(local.model as string) ?? ''}
                onChange={(e) => updateField('model', e.target.value || undefined)}
                className={selectClasses + ' w-56'}
              >
                <option value="">Default</option>
                {MODEL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Permission Mode */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-[11px] text-foreground/70 shrink-0">Permission Mode</label>
              <select
                value={(local.permissionMode as string) ?? 'default'}
                onChange={(e) => updateField('permissionMode', e.target.value === 'default' ? undefined : e.target.value)}
                className={selectClasses + ' w-56'}
              >
                {PERMISSION_MODE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Always Thinking */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-[11px] text-foreground/70 shrink-0">Always Thinking</label>
              <button
                type="button"
                onClick={() => updateField('alwaysThinkingEnabled', !local.alwaysThinkingEnabled)}
                className={toggleTrackClasses(!!local.alwaysThinkingEnabled)}
              >
                <span className={toggleThumbClasses(!!local.alwaysThinkingEnabled)} />
              </button>
            </div>

            {/* Voice Enabled */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-[11px] text-foreground/70 shrink-0">Voice Input</label>
              <button
                type="button"
                onClick={() => updateField('voiceEnabled', !local.voiceEnabled)}
                className={toggleTrackClasses(!!local.voiceEnabled)}
              >
                <span className={toggleThumbClasses(!!local.voiceEnabled)} />
              </button>
            </div>
          </section>

          {/* Plugins */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Plugins</h4>
            {plugins.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/20">No plugins enabled</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {plugins.map(plugin => (
                  <span
                    key={plugin}
                    className="inline-flex items-center gap-1 rounded-md bg-muted/10 border border-border/30 px-2 py-0.5 text-[10px] font-mono text-foreground/70"
                  >
                    {plugin}
                    <button
                      onClick={() => removePlugin(plugin)}
                      className="ml-0.5 rounded hover:bg-red-500/10 hover:text-red-400 transition-colors p-0.5"
                    >
                      <X size={8} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Environment Variables */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Environment Variables</h4>

            {Object.keys(envObj).length === 0 && (
              <p className="text-[10px] text-muted-foreground/20">No environment variables set</p>
            )}

            <div className="space-y-1.5">
              {Object.entries(envObj).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 group">
                  <span className="text-[10px] font-mono font-bold text-primary/70 shrink-0 w-[140px] truncate">{key}</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleEnvValueChange(key, e.target.value)}
                    className="flex-1 h-7 bg-muted/10 rounded-lg border border-border/30 px-3 font-mono text-[11px] text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                  />
                  <button
                    onClick={() => handleRemoveEnv(key)}
                    className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add env row */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="KEY"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEnv()}
                className="w-[140px] h-7 bg-muted/10 rounded-lg border border-border/30 px-3 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/30 transition-colors"
              />
              <input
                type="text"
                placeholder="value"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEnv()}
                className="flex-1 h-7 bg-muted/10 rounded-lg border border-border/30 px-3 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/30 transition-colors"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddEnv}
                disabled={!newEnvKey.trim()}
                className="h-7 w-7 p-0 shrink-0"
              >
                <Plus size={12} />
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
