import { useEffect, useState } from 'react'
import { Activity, Bell, Check, CheckCircle2, CircleDashed, Database, ExternalLink, Eye, EyeOff, Github, Globe, Info, Keyboard, Loader2, Play, Plus, RefreshCcw, Settings2, ShieldCheck, SignalHigh, Terminal, Trash2, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type BackendConfig,
  type WorkspaceMigrationResult,
  fetchUnsandboxConfig,
  saveUnsandboxConfig,
  deleteUnsandboxConfig,
  fetchUnsandboxStatus,
  fetchAgentProviderKeys,
  saveAgentProviderKey,
  type UnsandboxConfig,
  type UnsandboxStatus,
} from '@/lib/orchestra-client'
import { CHAT_PROVIDERS } from '@/components/embedded-agent/lib/types'
import { usePlatform } from '@/hooks/use-platform'
import { CustomDropdown } from '@/components/app-shell/shared/controls'

type BackendProfile = {
  id: string
  name: string
  baseUrl: string
  apiToken: string
}

export function SettingsCard({
  loadingConfig,
  savingConfig,
  profilesPending,
  config,
  backendProfiles,
  activeProfileId,
  migrationPending: _migrationPending,
  migrationFrom: _migrationFrom,
  migrationTo: _migrationTo,
  migrationPlan: _migrationPlan,
  agentConfig,
  onMigrationFromChange: _onMigrationFromChange,
  onMigrationToChange: _onMigrationToChange,
  onMigrationPlan: _onMigrationPlan,
  onMigrationApply: _onMigrationApply,
  onSaveBackendConfig,
  onSetActiveProfile,
  onCreateProfile,
  onDeleteProfile,
  onSaveAgentConfig,
  notifSound,
  notifMuted,
  notifVolume,
  onNotifSoundChange,
  onNotifMutedChange,
  onNotifVolumeChange,
  initialTab,
}: {
  loadingConfig: boolean
  savingConfig: boolean
  profilesPending: boolean
  config: BackendConfig | null
  backendProfiles: BackendProfile[]
  activeProfileId: string
  migrationPending: boolean
  migrationFrom: string
  migrationTo: string
  migrationPlan: WorkspaceMigrationResult | null
  agentConfig: { commands: Record<string, string>; agent_provider: string; max_turns: number } | null
  onMigrationFromChange: (value: string) => void
  onMigrationToChange: (value: string) => void
  onMigrationPlan: () => Promise<void>
  onMigrationApply: () => Promise<void>
  onSaveBackendConfig: (nextConfig: BackendConfig) => Promise<void>
  onSetActiveProfile: (profileId: string) => Promise<void>
  onCreateProfile: (name: string) => Promise<void>
  onDeleteProfile: (profileId: string) => Promise<void>
  onSaveAgentConfig: (config: { commands: Record<string, string>; agent_provider: string; max_turns: number }) => Promise<void>
  notifSound?: string
  notifMuted?: boolean
  notifVolume?: number
  onNotifSoundChange?: (sound: string) => void
  onNotifMutedChange?: (muted: boolean) => void
  onNotifVolumeChange?: (volume: number) => void
  initialTab?: 'backend' | 'agents' | 'integrations' | 'shortcuts' | 'notifications'
}) {
  const { isMac } = usePlatform()
  const [activeTab, setActiveTab] = useState<'backend' | 'agents' | 'integrations' | 'shortcuts' | 'notifications'>(initialTab ?? 'backend')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  const tabs = [
    { id: 'backend', label: 'Backend', tooltip: 'Configure backend profiles and API connection', icon: <Database className="h-3.5 w-3.5" /> },
    { id: 'agents', label: 'Agents', tooltip: 'Set provider commands and default runner', icon: <Zap className="h-3.5 w-3.5" /> },
    { id: 'integrations', label: 'Integrations', tooltip: 'Configure external service connections', icon: <Globe className="h-3.5 w-3.5" /> },
    { id: 'notifications', label: 'Notifications', tooltip: 'Sound and notification preferences', icon: <Bell className="h-3.5 w-3.5" /> },
{ id: 'shortcuts', label: 'Shortcuts', tooltip: 'View global keyboard shortcuts', icon: <Keyboard className="h-3.5 w-3.5" /> },
  ] as const

  return (
    <Card className="group relative overflow-hidden border border-border/60 bg-gradient-to-br from-card via-card/98 to-muted/5 shadow-2xl shadow-primary/5 transition-all duration-500 flex flex-col flex-1">
      {/* Decorative premium elements */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl transition-all duration-1000 group-hover:bg-primary/10" />

      <CardHeader className="relative border-b border-border/40 pb-0 shrink-0 bg-muted/5 pt-4">
        <div className="flex items-center justify-between mb-4 px-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary shadow-inner">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xl font-black tracking-tighter">System Settings</CardTitle>
              <CardDescription className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                Fleet Configuration
              </CardDescription>
            </div>
          </div>
          <button
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const bridge = (window as any).orchestraDesktop
              if (bridge && typeof bridge.openExternal === 'function') {
                void bridge.openExternal('https://github.com/Traves-Theberge/Orchestra')
              } else {
                window.open('https://github.com/Traves-Theberge/Orchestra', '_blank')
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-muted-foreground/50 hover:text-foreground border border-border/20 hover:border-border/40 transition-all"
          >
            <Github size={14} />
            Repo
          </button>
        </div>

        <div className="flex gap-1 px-2">
          {tabs.map((tab) => (
            <AppTooltip key={tab.id} content={tab.tooltip}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-t-lg ${activeTab === tab.id
                  ? 'text-primary bg-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            </AppTooltip>
          ))}
        </div>
      </CardHeader>

      <CardContent className="relative pt-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-background/30 backdrop-blur-sm px-6 flex flex-col">
        <div className="w-full flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-400">
          {activeTab === 'backend' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="group relative flex min-h-0 flex-1 flex-col rounded-2xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 p-6 shadow-sm transition-all hover:shadow-md overflow-hidden">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <BackendConfigForm
                  loadingConfig={loadingConfig}
                  savingConfig={savingConfig}
                  profilesPending={profilesPending}
                  config={config}
                  backendProfiles={backendProfiles}
                  activeProfileId={activeProfileId}
                  onSaveBackendConfig={onSaveBackendConfig}
                  onSetActiveProfile={onSetActiveProfile}
                  onCreateProfile={onCreateProfile}
                  onDeleteProfile={onDeleteProfile}
                  disabled={loadingConfig || savingConfig || profilesPending}
                />
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-6 flex-1 flex flex-col">
              {agentConfig ? (
                <div className="group relative rounded-2xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 p-6 shadow-sm transition-all hover:shadow-md overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <AgentConfigForm
                    agentConfig={agentConfig}
                    onSave={onSaveAgentConfig}
                    disabled={savingConfig || loadingConfig}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/5 py-16 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 opacity-20 mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No agent configuration loaded</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <EmbeddedAgentConfigForm config={config} disabled={savingConfig || loadingConfig} />
              <UnsandboxConfigForm config={config} disabled={savingConfig || loadingConfig} />
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-6 pb-6 flex-1 flex flex-col">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Command Palette', desc: 'Search and navigate instantly', keys: [isMac ? '\u2318' : 'Ctrl', 'K'] },
                  { label: 'Refresh Tracker', desc: 'Full state synchronization', keys: [isMac ? '\u2318' : 'Ctrl', 'R'] },
                  { label: 'Toggle Sidebar', desc: 'Collapse/expand navigation', keys: [isMac ? '\u2318' : 'Ctrl', '/'] },
                  { label: 'Switch Tab', desc: 'Ctrl+1 Tasks, Ctrl+2 Projects, etc.', keys: [isMac ? '\u2318' : 'Ctrl', '1-8'] },
                ].map((s, idx) => (
                  <div key={idx} className="group/item relative flex items-center justify-between p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 shadow-sm transition-all hover:border-primary/20 overflow-hidden">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black tracking-tight">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{s.desc}</p>
                    </div>
                    <div className="flex gap-1">
                      {s.keys.map(k => (
                        <kbd key={k} className="flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-lg bg-muted border border-border/60 text-[9px] font-black font-mono shadow-sm">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 pb-6">
              <div className="space-y-4">
                <div className="group relative flex items-center justify-between p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-black tracking-tight">Mute All Sounds</p>
                    <p className="text-[10px] text-muted-foreground">Disable notification sounds when agents complete</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${!notifMuted ? 'text-primary' : 'text-muted-foreground/30'}`}>On</span>
                    <button
                      onClick={() => {
                        const next = !notifMuted
                        onNotifMutedChange?.(next)
                        localStorage.setItem('orchestra_notif_muted', String(next))
                      }}
                      className={`h-8 w-14 rounded-full transition-colors ${notifMuted ? 'bg-muted' : 'bg-primary'} relative`}
                    >
                      <div className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${notifMuted ? 'left-7' : 'left-1'}`} />
                    </button>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${notifMuted ? 'text-red-400' : 'text-muted-foreground/30'}`}>Mute</span>
                  </div>
                </div>

                <div className="group relative p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 space-y-3 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black tracking-tight">Notification Sound</p>
                      <p className="text-[10px] text-muted-foreground">Sound played when an agent completes a task</p>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          const vol = notifVolume ?? 0.3
                          const sound = notifSound ?? 'chime'
                          const ctx = new AudioContext()
                          const g = ctx.createGain()
                          g.connect(ctx.destination)
                          g.gain.setValueAtTime(vol, ctx.currentTime)
                          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
                          const osc = ctx.createOscillator()
                          osc.connect(g)
                          if (sound === 'bell') {
                            osc.type = 'sine'
                            osc.frequency.setValueAtTime(1047, ctx.currentTime)
                            osc.frequency.exponentialRampToValueAtTime(523, ctx.currentTime + 0.3)
                          } else if (sound === 'pulse') {
                            osc.type = 'square'
                            osc.frequency.setValueAtTime(440, ctx.currentTime)
                            osc.frequency.setValueAtTime(440, ctx.currentTime + 0.05)
                            osc.frequency.setValueAtTime(0, ctx.currentTime + 0.1)
                            osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15)
                          } else {
                            osc.frequency.setValueAtTime(880, ctx.currentTime)
                            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
                            osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2)
                          }
                          osc.start(ctx.currentTime)
                          osc.stop(ctx.currentTime + 0.5)
                          osc.onended = () => ctx.close()
                        } catch { /* ignore */ }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      <Play size={10} />
                      Test
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { id: 'chime', label: 'Chime' },
                      { id: 'bell', label: 'Bell' },
                      { id: 'pulse', label: 'Pulse' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          onNotifSoundChange?.(s.id)
                          localStorage.setItem('orchestra_notif_sound', s.id)
                        }}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                          notifSound === s.id
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                            : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="group relative p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 space-y-3 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black tracking-tight">Volume</p>
                      <p className="text-[10px] text-muted-foreground">{Math.round((notifVolume ?? 0.3) * 100)}%</p>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={notifVolume ?? 0.3}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      onNotifVolumeChange?.(v)
                      localStorage.setItem('orchestra_notif_volume', String(v))
                    }}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="group relative p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 space-y-3 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-black tracking-tight">Browser Notifications</p>
                    <p className="text-[10px] text-muted-foreground">Desktop notification when agents complete tasks</p>
                  </div>
                  <button
                    onClick={() => {
                      if ('Notification' in window) {
                        void Notification.requestPermission()
                      }
                    }}
                    className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-all"
                  >
                    {'Notification' in window ? `Status: ${Notification.permission}` : 'Not supported'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function AgentConfigForm({
  agentConfig,
  onSave,
  disabled,
}: {
  agentConfig: { commands: Record<string, string>; agent_provider: string; max_turns: number }
  onSave: (config: { commands: Record<string, string>; agent_provider: string; max_turns: number }) => Promise<void>
  disabled: boolean
}) {
  const [provider, _setProvider] = useState(agentConfig.agent_provider || '')
  const [commands, setCommands] = useState(agentConfig.commands || {})
  const [maxTurns, setMaxTurns] = useState(agentConfig.max_turns || 10)

  const handleCommandChange = (key: string, value: string) => {
    setCommands((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Runner Executables</h4>
        </div>
        <div className="grid gap-2">
          {Object.keys(commands).length === 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 p-4 border border-dashed rounded-xl">No runners configured.</p>
          ) : Object.keys(commands).map((p) => (
            <div key={p} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/40 transition-all hover:bg-muted/30">
              <span className="min-w-[100px] text-[10px] font-black uppercase tracking-widest text-primary/70">{p}</span>
              <input
                className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={commands[p]}
                onChange={(e) => handleCommandChange(p, e.target.value)}
                placeholder="Executable path or command..."
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Max Agent Turns</h4>
        </div>
        <p className="text-[10px] text-muted-foreground">Maximum number of turns before the agent stops. Range: 1-50.</p>
        <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/20 border border-border/40">
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={maxTurns}
            onChange={(e) => setMaxTurns(Number(e.target.value))}
            disabled={disabled}
            className="flex-1 accent-primary"
          />
          <span className="min-w-[40px] text-center text-sm font-black tabular-nums text-primary">{maxTurns}</span>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border/40">
        <Button
          size="sm"
          onClick={() => void onSave({ agent_provider: provider, commands, max_turns: maxTurns })}
          disabled={disabled || !provider}
          className="px-6 font-black uppercase tracking-widest text-[9px] h-9 rounded-lg"
        >
          {disabled ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : 'Update Agent Configuration'}
        </Button>
      </div>
    </div>
  )
}

function BackendConfigForm({
  loadingConfig: _loadingConfig,
  savingConfig,
  profilesPending,
  config,
  backendProfiles,
  activeProfileId,
  onSaveBackendConfig,
  onSetActiveProfile,
  onCreateProfile,
  onDeleteProfile,
  disabled,
}: {
  loadingConfig: boolean
  savingConfig: boolean
  profilesPending: boolean
  config: BackendConfig | null
  backendProfiles: BackendProfile[]
  activeProfileId: string
  onSaveBackendConfig: (nextConfig: BackendConfig) => Promise<void>
  onSetActiveProfile: (profileId: string) => Promise<void>
  onCreateProfile: (name: string) => Promise<void>
  onDeleteProfile: (profileId: string) => Promise<void>
  disabled?: boolean
}) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [newProfileName, setNewProfileName] = useState('')
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBaseUrl(config?.baseUrl ?? '')
    setApiToken(config?.apiToken ?? '')
  }, [config])

  const syncFromConfig = () => {
    setBaseUrl(config?.baseUrl ?? '')
    setApiToken(config?.apiToken ?? '')
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-center justify-between pb-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-wider">Connection Profiles</h3>
        </div>
      </div>

      <div className="grid flex-1 content-start gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Profile Management</h4>
          </div>

          <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/40">
            <label className="space-y-1.5 block">
              <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1">Active Profile</span>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <CustomDropdown
                    className="w-full"
                    value={activeProfileId}
                    options={backendProfiles.map((p) => ({ label: p.name, value: p.id, icon: <ShieldCheck className="h-3 w-3" /> }))}
                    onChange={(val) => void onSetActiveProfile(val)}
                    disabled={disabled || backendProfiles.length === 0}
                  />
                  {profilesPending && (
                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3 w-3 animate-spin-smooth text-primary" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Delete"
                  className="h-9 px-3 rounded-lg border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
                  disabled={disabled || backendProfiles.length <= 1 || activeProfileId === ''}
                  onClick={(e) => {
                    e.preventDefault()
                    if (activeProfileId !== '') {
                      void onDeleteProfile(activeProfileId)
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </label>

            <label className="space-y-1.5 block pt-2 border-t border-border/20">
              <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1">New Profile</span>
              <div className="flex gap-2">
                <input
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Production, Staging, Local..."
                  disabled={disabled}
                />
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Create"
                  className="h-9 px-3 rounded-lg bg-primary/5 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                  disabled={disabled || newProfileName.trim() === ''}
                  onClick={() => {
                    void onCreateProfile(newProfileName.trim())
                    setNewProfileName('')
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SignalHigh className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Connection Parameters</h4>
          </div>

          <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/40">
            <label className="space-y-1.5 block">
              <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1">Endpoint URL</span>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                  <Globe className="h-3 w-3" />
                </div>
                <input
                  className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="http://127.0.0.1:4010"
                  disabled={disabled}
                />
              </div>
            </label>

            <label className="space-y-1.5 block">
              <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1">Access Token</span>
              <div className="relative group/token">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within/token:text-primary/60 transition-colors">
                  <ShieldCheck className="h-3 w-3" />
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-9 text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  value={apiToken}
                  onChange={(event) => setApiToken(event.target.value)}
                  placeholder="Bearer token (optional)"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-all"
                  title={showToken ? 'Hide token' : 'Reveal token'}
                >
                  {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-foreground h-9 px-4"
            onClick={syncFromConfig}
            disabled={disabled}
          >
            <RefreshCcw className="h-3 w-3 mr-2" />
            Revert
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-primary/40 px-3 border-l border-border/20">
            <Info className="h-3 w-3" />
            <span className="text-[9px] font-medium italic">Base URL changes trigger reconnect.</span>
          </div>
        </div>
        <Button
          onClick={() => void onSaveBackendConfig({ baseUrl: baseUrl.trim(), apiToken: apiToken.trim() })}
          disabled={disabled || baseUrl.trim() === ''}
          className="px-6 shadow-lg shadow-primary/20 font-black uppercase tracking-widest text-[9px] h-9 rounded-lg"
        >
          {savingConfig ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : 'Save Backend Config'}
        </Button>
      </div>
    </div>
  )
}

function EmbeddedAgentConfigForm({ config, disabled }: { config: BackendConfig | null; disabled: boolean }) {
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [selectedModel, setSelectedModel] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!config) return
    fetchAgentProviderKeys(config)
      .then((result) => {
        const loaded: Record<string, string> = {}
        const models: Record<string, string> = {}
        for (const [id, info] of Object.entries(result.providers)) {
          if (info.configured && info.api_key) {
            loaded[id] = info.api_key
          }
        }
        for (const p of CHAT_PROVIDERS) {
          models[p.id] = p.models[0]
        }
        setKeys(loaded)
        setSelectedModel(models)
      })
      .catch(() => {})
  }, [config])

  const handleSave = async (providerId: string) => {
    if (!config) return
    const key = editing[providerId]?.trim()
    if (!key) return
    setSaving(providerId)
    setMessage('')
    try {
      await saveAgentProviderKey(config, providerId, key)
      setKeys(prev => ({ ...prev, [providerId]: key }))
      setEditing(prev => { const n = { ...prev }; delete n[providerId]; return n })
      setMessage(`${providerId} key saved.`)
    } catch (err) {
      setMessage(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-bold">Embedded Agent</p>
            <p className="text-[10px] text-muted-foreground">Configure LLM provider API keys for the chat widget</p>
          </div>
        </div>

        <div className="space-y-3">
          {CHAT_PROVIDERS.map((provider) => {
            const hasKey = !!keys[provider.id]
            const isEditing = provider.id in editing
            return (
              <div key={provider.id} className="rounded-lg border border-border/20 bg-background/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{provider.label}</span>
                    {hasKey ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <CircleDashed className="h-3 w-3" />
                        Not set
                      </span>
                    )}
                  </div>
                  {hasKey && !isEditing && (
                    <button
                      onClick={() => setEditing(prev => ({ ...prev, [provider.id]: '' }))}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Change
                    </button>
                  )}
                </div>

                {/* Model selector */}
                {hasKey && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</label>
                    <CustomDropdown
                      className="w-full"
                      value={selectedModel[provider.id] ?? provider.models[0]}
                      options={provider.models.map(m => ({ label: m, value: m }))}
                      onChange={(v) => setSelectedModel(prev => ({ ...prev, [provider.id]: v as string }))}
                    />
                  </div>
                )}

                {/* Key input */}
                {(!hasKey || isEditing) && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">API Key</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKeys[provider.id] ? 'text' : 'password'}
                          value={editing[provider.id] ?? ''}
                          onChange={(e) => setEditing(prev => ({ ...prev, [provider.id]: e.target.value }))}
                          placeholder={provider.id === 'openrouter' ? 'sk-or-...' : provider.id === 'claude' ? 'sk-ant-...' : 'sk-...'}
                          disabled={disabled || saving === provider.id}
                          className="w-full rounded-lg border border-border/40 bg-background px-3 pr-8 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-all"
                        >
                          {showKeys[provider.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleSave(provider.id)}
                        disabled={disabled || saving === provider.id || !editing[provider.id]?.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving === provider.id ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : <Check className="h-3 w-3" />}
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {message && (
          <p className={`text-[11px] font-medium ${message.includes('failed') ? 'text-red-500' : 'text-emerald-500'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

function UnsandboxConfigForm({ config, disabled }: { config: BackendConfig | null; disabled: boolean }) {
  const [publicKey, setPublicKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [status, setStatus] = useState<UnsandboxStatus | null>(null)
  const [unsandboxConfig, setUnsandboxConfig] = useState<UnsandboxConfig | null>(null)
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)

  // Load current config on mount
  useEffect(() => {
    if (!config) return
    fetchUnsandboxConfig(config)
      .then((cfg) => {
        setUnsandboxConfig(cfg)
        if (cfg.public_key) setPublicKey(cfg.public_key)
      })
      .catch(() => {})
  }, [config])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setMessage('')
    try {
      const result = await saveUnsandboxConfig(config, publicKey, secretKey)
      setUnsandboxConfig(result)
      setSecretKey('')
      setMessage('Credentials saved.')
    } catch (err) {
      setMessage(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!config) return
    setChecking(true)
    setMessage('')
    try {
      const s = await fetchUnsandboxStatus(config)
      setStatus(s)
      if (s.valid) {
        setMessage('Connection verified.')
      } else if (s.error) {
        setMessage(`Validation failed: ${s.error}`)
      } else if (!s.configured) {
        setMessage('No credentials configured.')
      }
    } catch (err) {
      setMessage(`Test failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setChecking(false)
    }
  }

  const handleRemove = async () => {
    if (!config) return
    setSaving(true)
    setMessage('')
    try {
      await deleteUnsandboxConfig(config)
      setUnsandboxConfig(null)
      setPublicKey('')
      setSecretKey('')
      setStatus(null)
      setMessage('Credentials removed.')
    } catch (err) {
      setMessage(`Remove failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = unsandboxConfig?.configured ?? false

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold">Unsandbox</p>
              <button
                type="button"
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const bridge = (window as any).orchestraDesktop
                  if (bridge && typeof bridge.openExternal === 'function') {
                    void bridge.openExternal('https://unsandbox.com')
                  } else {
                    window.open('https://unsandbox.com', '_blank')
                  }
                }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                title="Open unsandbox.com"
              >
                unsandbox.com
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Remote code execution across 42+ languages</p>
          </div>
          <div className="flex items-center gap-2">
            {isConfigured ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configured
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <CircleDashed className="h-3.5 w-3.5" />
                Not configured
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Public Key</label>
            <input
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="pk_..."
              disabled={disabled || saving}
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Secret Key {isConfigured && <span className="text-muted-foreground/60">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={isConfigured ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'sk_...'}
                disabled={disabled || saving}
                className="w-full rounded-lg border border-border/40 bg-background px-3 pr-9 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-all"
                title={showSecret ? 'Hide key' : 'Reveal key'}
              >
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={disabled || saving || !publicKey.trim() || (!secretKey.trim() && !isConfigured)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : <Check className="h-3 w-3" />}
            Save Keys
          </button>
          <button
            onClick={handleTest}
            disabled={disabled || checking || !isConfigured}
            className="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checking ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : <ShieldCheck className="h-3 w-3" />}
            Test Connection
          </button>
          {isConfigured && (
            <button
              onClick={handleRemove}
              disabled={disabled || saving}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          )}
        </div>

        {message && (
          <p className={`text-[11px] font-medium ${message.includes('failed') || message.includes('Failed') ? 'text-red-500' : 'text-emerald-500'}`}>
            {message}
          </p>
        )}

        {status?.valid && status.key_info && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">API Key Status</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              {status.key_info.tier ? <><span className="text-muted-foreground">Tier</span><span className="font-mono">{String(status.key_info.tier)}</span></> : null}
              {status.key_info.rate_per_minute ? <><span className="text-muted-foreground">Rate</span><span className="font-mono">{String(status.key_info.rate_per_minute)}/min</span></> : null}
              {status.key_info.concurrency ? <><span className="text-muted-foreground">Concurrency</span><span className="font-mono">{String(status.key_info.concurrency)}</span></> : null}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Credentials are stored at <code className="text-[10px] font-mono bg-muted/30 px-1 rounded">~/.unsandbox/accounts.csv</code> with restricted permissions (600).
        You can also set <code className="text-[10px] font-mono bg-muted/30 px-1 rounded">UNSANDBOX_PUBLIC_KEY</code> and <code className="text-[10px] font-mono bg-muted/30 px-1 rounded">UNSANDBOX_SECRET_KEY</code> environment variables.{' '}
        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const bridge = (window as any).orchestraDesktop
            if (bridge && typeof bridge.openExternal === 'function') {
              void bridge.openExternal('https://unsandbox.com/docs')
            } else {
              window.open('https://unsandbox.com/docs', '_blank')
            }
          }}
          className="inline-flex items-center gap-0.5 text-primary hover:underline"
        >
          API docs <ExternalLink className="h-2.5 w-2.5" />
        </button>
      </p>
    </div>
  )
}
