import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bell,
  Check,
  CheckCircle2,
  CircleDashed,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  GitBranch,
  Globe,
  Keyboard,
  Loader2,
  Paintbrush,
  Play,
  Plus,
  RefreshCcw,
  ShieldCheck,
  SignalHigh,
  Terminal,
  Trash2,
  Type,
  Users,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  type BackendConfig,
  type WorkspaceMigrationResult,
  fetchUnsandboxConfig,
  saveUnsandboxConfig,
  deleteUnsandboxConfig,
  fetchUnsandboxStatus,
  fetchAgentProviderKeys,
  saveAgentProviderKey,
  fetchProjects,
  disconnectProjectGitHub,
  type UnsandboxConfig,
  type UnsandboxStatus,
} from '@/lib/orchestra-client'
import type { Project } from '@/lib/orchestra-types'
import { Github } from 'lucide-react'
import { CHAT_PROVIDERS } from '@/components/embedded-agent/lib/types'
import { usePlatform } from '@/hooks/use-platform'
import { CustomDropdown } from '@/components/app-shell/shared/controls'
import { useAppStore } from '@/store'
import { resolveMode } from '@/themes/applyTheme'
import type { Theme, ThemeMode } from '@/themes/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BackendProfile = {
  id: string
  name: string
  baseUrl: string
  apiToken: string
}

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'connections', label: 'Connections', icon: Database },
  { id: 'agents', label: 'Maestro', icon: Cpu },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'appearance', label: 'Appearance', icon: Paintbrush },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'editor', label: 'Editor', icon: Type },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'experimental', label: 'Experimental', icon: FlaskConical },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

// ---------------------------------------------------------------------------
// Flash animation style (injected once)
// ---------------------------------------------------------------------------

const FLASH_STYLE_ID = 'settings-flash-style'

function ensureFlashStyle() {
  if (document.getElementById(FLASH_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = FLASH_STYLE_ID
  style.textContent = `
@keyframes settings-flash {
  0%, 100% { background-color: transparent; }
  20% { background-color: hsl(var(--accent) / 0.3); }
}
.settings-section-flash {
  animation: settings-flash 900ms ease-out;
}
`
  document.head.appendChild(style)
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export function SettingsPage({
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
  agentConfig: _agentConfig,
  onMigrationFromChange: _onMigrationFromChange,
  onMigrationToChange: _onMigrationToChange,
  onMigrationPlan: _onMigrationPlan,
  onMigrationApply: _onMigrationApply,
  onSaveBackendConfig,
  onSetActiveProfile,
  onCreateProfile,
  onDeleteProfile,
  onSaveAgentConfig: _onSaveAgentConfig,
  notifSound,
  notifMuted,
  notifVolume,
  onNotifSoundChange,
  onNotifMutedChange,
  onNotifVolumeChange,
  initialTab: _initialTab,
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
  const theme = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)
  const browserHomepage = useAppStore(s => s.browserHomepage)
  const setBrowserHomepage = useAppStore(s => s.setBrowserHomepage)
  const builtinThemes = useAppStore(s => s.builtinThemes)
  const customThemes = useAppStore(s => s.customThemes)
  const activeThemeId = useAppStore(s => s.activeThemeId)
  const modeOverride = useAppStore(s => s.modeOverride)
  const setActiveTheme = useAppStore(s => s.setActiveTheme)
  const setMode = useAppStore(s => s.setMode)
  const [homepageDraft, setHomepageDraft] = useState(browserHomepage)
  useEffect(() => { setHomepageDraft(browserHomepage) }, [browserHomepage])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState<SectionId>('connections')

  useEffect(() => {
    ensureFlashStyle()
  }, [])

  // Scroll-spy: track which section is at ~40% viewport height
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const threshold = el.getBoundingClientRect().top + el.clientHeight * 0.4
        let current: SectionId = SECTIONS[0].id
        for (const section of SECTIONS) {
          const node = el.querySelector(`[data-settings-section="${section.id}"]`)
          if (node) {
            const rect = node.getBoundingClientRect()
            if (rect.top <= threshold) {
              current = section.id
            }
          }
        }
        setActiveId(current)
      })
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = useCallback((id: SectionId) => {
    const el = scrollRef.current
    if (!el) return
    const target = el.querySelector(`[data-settings-section="${id}"]`)
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })

    // Flash animation
    target.classList.remove('settings-section-flash')
    // Force reflow to restart animation
    void (target as HTMLElement).offsetWidth
    target.classList.add('settings-section-flash')
    const cleanup = () => {
      target.classList.remove('settings-section-flash')
      target.removeEventListener('animationend', cleanup)
    }
    target.addEventListener('animationend', cleanup)
  }, [])

  return (
    <div className="flex flex-1 min-h-0 min-w-0 bg-background">
      {/* Sidebar */}
      <nav className="w-[220px] shrink-0 border-r border-border/40 flex flex-col overflow-y-auto custom-scrollbar bg-background">
        <div className="px-5 pt-8 pb-6">
          <h2 className="text-[15px] font-black tracking-tight leading-none">Settings</h2>
        </div>
        <div className="flex flex-col gap-1 px-3 pb-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            const isActive = activeId === section.id
            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`group relative flex items-center gap-3 px-3 h-10 rounded-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isActive
                    ? 'bg-foreground/[0.06] text-foreground'
                    : 'text-muted-foreground/80 hover:text-foreground hover:bg-foreground/[0.03]'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-primary" />
                )}
                <Icon
                  className={`h-[15px] w-[15px] shrink-0 transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'
                  }`}
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span className="truncate text-[12.5px] font-medium tracking-tight">{section.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto pt-12 pb-24 px-12 space-y-14">
          {/* Page hero */}
          <header className="space-y-2 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">Workspace</p>
            <h1 className="text-3xl font-black tracking-tight">Settings</h1>
            <p className="text-[12px] text-muted-foreground max-w-md">
              Tune Orchestra to your workflow. Changes save automatically.
            </p>
          </header>
          {/* ── Connections ── */}
          <section data-settings-section="connections" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={Database} title="Connections" description="Backend profiles and API connection" />
            <div className="mt-4">
              <div className="rounded-2xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 p-6 shadow-sm">
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
          </section>

          {/* ── Agents ── */}
          <section data-settings-section="agents" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={Cpu} title="Maestro" description="LLM provider and embedded agent configuration" />
            <div className="mt-4 space-y-6">
              <EmbeddedAgentConfigForm config={config} disabled={savingConfig || loadingConfig} />
              <UnsandboxConfigForm config={config} disabled={savingConfig || loadingConfig} />
            </div>
          </section>

          {/* ── Git ── */}
          <section data-settings-section="git" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={GitBranch} title="Git" description="Version control and GitHub connections" />
            <div className="mt-4">
              <GitConnectionsPane config={config} />
            </div>
          </section>

          {/* ── Appearance ── */}
          <section data-settings-section="appearance" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={Paintbrush} title="Appearance" description="Theme and visual preferences" />
            <div className="mt-4 space-y-4">
              <AppearanceModePane
                modeOverride={modeOverride}
                onModeChange={(m) => {
                  setMode(m)
                  // Keep legacy `theme` slice in sync so anything still reading
                  // it gets a concrete light/dark value.
                  const resolved = m === 'auto' ? resolveMode('auto') : m
                  if (resolved !== theme) setTheme(resolved)
                }}
              />
              <ThemePresetPane
                themes={[...builtinThemes, ...customThemes]}
                activeThemeId={activeThemeId}
                modeOverride={modeOverride}
                onSelect={setActiveTheme}
              />
            </div>
          </section>

          {/* ── Terminal ── */}
          <section data-settings-section="terminal" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={Terminal} title="Terminal" description="Terminal emulator preferences" />
            <div className="mt-4">
              <PlaceholderPane text="Terminal settings coming soon" />
            </div>
          </section>

          {/* ── Browser ── */}
          <section data-settings-section="browser" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={Globe} title="Browser" description="Embedded browser preferences" />
            <div className="mt-4">
              <div className="p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20">
                <div className="space-y-0.5 mb-3">
                  <p className="text-xs font-black tracking-tight">Default Homepage</p>
                  <p className="text-[10px] text-muted-foreground">URL loaded when opening a new browser tab</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={homepageDraft}
                    onChange={(e) => setHomepageDraft(e.target.value)}
                    onBlur={() => {
                      if (homepageDraft !== browserHomepage) setBrowserHomepage(homepageDraft)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      } else if (e.key === 'Escape') {
                        setHomepageDraft(browserHomepage)
                        e.currentTarget.blur()
                      }
                    }}
                    placeholder="https://example.com or about:blank"
                    className="flex-1 px-3 py-2 rounded-lg bg-muted/20 border border-border/30 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setHomepageDraft('about:blank')
                      setBrowserHomepage('about:blank')
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Editor ── */}
          <section data-settings-section="editor" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={Type} title="Editor" description="Code editor configuration" />
            <div className="mt-4">
              <PlaceholderPane text="Editor settings coming soon" />
            </div>
          </section>

          {/* ── Notifications ── */}
          <section data-settings-section="notifications" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={Bell} title="Notifications" description="Sound and notification preferences" />
            <div className="mt-4">
              <NotificationsPane
                notifSound={notifSound}
                notifMuted={notifMuted}
                notifVolume={notifVolume}
                onNotifSoundChange={onNotifSoundChange}
                onNotifMutedChange={onNotifMutedChange}
                onNotifVolumeChange={onNotifVolumeChange}
              />
            </div>
          </section>

          {/* ── Shortcuts ── */}
          <section data-settings-section="shortcuts" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={Keyboard} title="Shortcuts" description="Keyboard shortcut reference" />
            <div className="mt-4">
              <ShortcutsPane isMac={isMac} />
            </div>
          </section>

          {/* ── Experimental ── */}
          <section data-settings-section="experimental" className="rounded-xl transition-colors duration-500 scroll-mt-4">
            <SectionHeading icon={FlaskConical} title="Experimental" description="Early-access features" />
            <div className="mt-4">
              <PlaceholderPane text="Experimental features coming soon" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function SectionHeading({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 pb-1 border-b border-border/30">
      <div className="rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 p-2 text-primary ring-1 ring-primary/15 mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <h2 className="text-base font-black tracking-tight leading-tight">{title}</h2>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function PlaceholderPane({ text }: { text: string }) {
  return (
    <div className="p-8 rounded-xl border border-dashed border-border/30 bg-gradient-to-b from-muted/5 to-transparent text-center">
      <p className="text-xs text-muted-foreground/50 font-medium tracking-wide">{text}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Appearance — Mode picker (Light / Dark / Auto)
// ---------------------------------------------------------------------------

function AppearanceModePane({
  modeOverride,
  onModeChange,
}: {
  modeOverride: ThemeMode
  onModeChange: (mode: ThemeMode) => void
}) {
  const modes: Array<{ id: ThemeMode; label: string }> = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'auto', label: 'Auto' },
  ]
  return (
    <div className="p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20">
      <div className="space-y-0.5 mb-3">
        <p className="text-xs font-black tracking-tight">Mode</p>
        <p className="text-[10px] text-muted-foreground">
          Light, dark, or follow your system. Active theme adapts to the chosen mode.
        </p>
      </div>
      <div className="flex gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              modeOverride === m.id
                ? 'bg-white text-black shadow-lg shadow-black/20'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Appearance — Theme preset picker
// ---------------------------------------------------------------------------

function ThemePresetPane({
  themes,
  activeThemeId,
  modeOverride,
  onSelect,
}: {
  themes: Theme[]
  activeThemeId: string
  modeOverride: ThemeMode
  onSelect: (id: string) => void
}) {
  const resolved: 'light' | 'dark' = modeOverride === 'auto' ? resolveMode('auto') : modeOverride
  return (
    <div className="p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20">
      <div className="space-y-0.5 mb-3">
        <p className="text-xs font-black tracking-tight">Theme</p>
        <p className="text-[10px] text-muted-foreground">
          Pick a preset. Custom themes can be created in the Theme Studio (coming soon).
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {themes.map((t) => (
          <ThemeSwatchCard
            key={t.id}
            theme={t}
            mode={resolved}
            active={t.id === activeThemeId}
            onClick={() => onSelect(t.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ThemeSwatchCard({
  theme,
  mode,
  active,
  onClick,
}: {
  theme: Theme
  mode: 'light' | 'dark'
  active: boolean
  onClick: () => void
}) {
  const roles = theme.roles[mode]
  const bg = `hsl(${roles.background})`
  const surface = `hsl(${roles.surface})`
  const surfaceRaised = `hsl(${roles.surfaceRaised})`
  const text = `hsl(${roles.text})`
  const accent = `hsl(${roles.accent})`
  const border = `hsl(${roles.border})`
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative rounded-xl overflow-hidden text-left transition-all border ${
        active
          ? 'border-white/80 ring-2 ring-white/40 shadow-lg shadow-black/20'
          : 'border-border/40 hover:border-border/70'
      }`}
      aria-pressed={active}
    >
      {/* Mini preview */}
      <div className="p-2.5 flex flex-col gap-1.5" style={{ background: bg }}>
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <div className="h-2 w-2 rounded-full opacity-60" style={{ background: text }} />
          <div className="h-2 w-2 rounded-full opacity-30" style={{ background: text }} />
        </div>
        <div
          className="h-6 rounded-md flex items-center px-1.5 gap-1"
          style={{ background: surface, border: `1px solid ${border}` }}
        >
          <div className="h-1 w-3 rounded-full opacity-80" style={{ background: text }} />
          <div className="h-1 w-5 rounded-full opacity-40" style={{ background: text }} />
        </div>
        <div
          className="h-3 rounded-sm"
          style={{ background: surfaceRaised, border: `1px solid ${border}` }}
        />
      </div>
      {/* Label */}
      <div className="px-2.5 py-2 flex items-center justify-between gap-2 bg-card/60 backdrop-blur border-t border-border/30">
        <span className="text-[11px] font-bold tracking-tight truncate">{theme.name}</span>
        {active && <Check className="h-3 w-3 text-white shrink-0" />}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Git connections pane — central view of GitHub-linked projects
// ---------------------------------------------------------------------------

function GitConnectionsPane({ config }: { config: BackendConfig | null }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!config) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchProjects(config)
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [config])

  useEffect(() => { void load() }, [load])

  const linked = projects.filter((p) => p.github_owner && p.github_repo)
  const unlinked = projects.filter((p) => !(p.github_owner && p.github_repo))

  const handleDisconnect = async (projectId: string) => {
    if (!config) return
    setPendingId(projectId)
    setError('')
    try {
      await disconnectProjectGitHub(config, projectId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed')
    } finally {
      setPendingId(null)
    }
  }

  const openOnGitHub = (owner: string, repo: string) => {
    const url = `https://github.com/${owner}/${repo}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = (window as any).orchestraDesktop
    if (bridge && typeof bridge.openExternal === 'function') {
      void bridge.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55">GitHub</span>
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground/40">{linked.length}</span>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading || !config}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium tracking-tight text-muted-foreground/80 hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-40 transition-colors"
          >
            <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <p className="text-[11.5px] text-destructive mb-3">{error}</p>
        )}

        {linked.length === 0 ? (
          <div className="px-4 py-8 rounded-lg bg-foreground/[0.02] border border-border/30 text-center">
            <Github size={20} className="mx-auto mb-2 text-muted-foreground/40" strokeWidth={1.75} />
            <p className="text-[12px] font-medium text-foreground/70">No GitHub connections</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Open a project and connect it from the Git → GitHub tab.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border/30 bg-background overflow-hidden">
            {linked.map((project, idx) => (
              <div
                key={project.id}
                className={`group relative flex items-center gap-3 px-3.5 py-2.5 hover:bg-foreground/[0.03] transition-colors ${
                  idx > 0 ? 'border-t border-border/20' : ''
                }`}
              >
                <Github size={14} className="text-muted-foreground/60 shrink-0" strokeWidth={2} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium tracking-tight text-foreground/90 truncate">
                    {project.name}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/60 truncate">
                    {project.github_owner}/{project.github_repo}
                  </div>
                </div>
                <button
                  onClick={() => openOnGitHub(project.github_owner!, project.github_repo!)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                >
                  <ExternalLink size={11} />
                  Open
                </button>
                <button
                  onClick={() => void handleDisconnect(project.id)}
                  disabled={pendingId === project.id}
                  className="inline-flex items-center h-7 px-2.5 rounded-md text-[11px] font-medium text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
                >
                  {pendingId === project.id ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {unlinked.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55">Unlinked projects</span>
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground/40">{unlinked.length}</span>
          </div>
          <div className="rounded-lg border border-border/30 bg-background overflow-hidden">
            {unlinked.map((project, idx) => (
              <div
                key={project.id}
                className={`flex items-center gap-3 px-3.5 py-2.5 ${idx > 0 ? 'border-t border-border/20' : ''}`}
              >
                <span className="w-2 h-2 rounded-full bg-muted-foreground/20 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium tracking-tight text-foreground/85 truncate">
                    {project.name}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/55 truncate">
                    {project.remote_url || project.root_path}
                  </div>
                </div>
                <span className="text-[10.5px] text-muted-foreground/50">Not connected</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2.5">
            Connect a project to GitHub from its <span className="font-medium text-foreground/80">Git → GitHub</span> tab.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notifications pane (migrated from SettingsCard)
// ---------------------------------------------------------------------------

function NotificationsPane({
  notifSound,
  notifMuted,
  notifVolume,
  onNotifSoundChange,
  onNotifMutedChange,
  onNotifVolumeChange,
}: {
  notifSound?: string
  notifMuted?: boolean
  notifVolume?: number
  onNotifSoundChange?: (sound: string) => void
  onNotifMutedChange?: (muted: boolean) => void
  onNotifVolumeChange?: (volume: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="group relative flex items-center justify-between p-4 rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/20 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="space-y-0.5">
          <p className="text-xs font-black tracking-tight">Mute All Sounds</p>
          <p className="text-[10px] text-muted-foreground">Disable notification sounds when agents complete</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${!notifMuted ? 'text-foreground' : 'text-muted-foreground/30'}`}>On</span>
          <button
            onClick={() => {
              const next = !notifMuted
              onNotifMutedChange?.(next)
              localStorage.setItem('orchestra_notif_muted', String(next))
            }}
            className={`h-8 w-14 rounded-full transition-colors ${notifMuted ? 'bg-muted' : 'bg-white'} relative`}
          >
            <div className={`absolute top-1 h-6 w-6 rounded-full ${notifMuted ? 'bg-white' : 'bg-black'} shadow transition-transform ${notifMuted ? 'left-7' : 'left-1'}`} />
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white/10 text-foreground border border-white/20 hover:bg-white/20 transition-colors"
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
                  ? 'bg-white text-black shadow-lg shadow-black/20'
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
  )
}

// ---------------------------------------------------------------------------
// Shortcuts pane (migrated from SettingsCard)
// ---------------------------------------------------------------------------

function ShortcutsPane({ isMac }: { isMac: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        { label: 'Command Palette', desc: 'Search and navigate instantly', keys: [isMac ? '⌘' : 'Ctrl', 'K'] },
        { label: 'Refresh Tracker', desc: 'Full state synchronization', keys: [isMac ? '⌘' : 'Ctrl', 'R'] },
        { label: 'Toggle Sidebar', desc: 'Collapse/expand navigation', keys: [isMac ? '⌘' : 'Ctrl', '/'] },
        { label: 'Switch Tab', desc: 'Ctrl+1 Tasks, Ctrl+2 Projects, etc.', keys: [isMac ? '⌘' : 'Ctrl', '1-8'] },
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
  )
}

// ---------------------------------------------------------------------------
// BackendConfigForm (migrated from SettingsCard)
// ---------------------------------------------------------------------------

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

  const baseUrlTrimmed = baseUrl.trim()
  const baseUrlInvalid = baseUrlTrimmed !== '' && (() => {
    try { new URL(baseUrlTrimmed); return false } catch { return true }
  })()

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pb-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-wider">Connection Profiles</h3>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
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
                    if (activeProfileId === '') return
                    const name = backendProfiles.find((p) => p.id === activeProfileId)?.name ?? activeProfileId
                    if (window.confirm(`Delete backend profile "${name}"? This cannot be undone.`)) {
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
                  className="h-9 px-3 rounded-lg bg-white/5 border-white/20 text-foreground hover:bg-white hover:text-black"
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
                  className={`h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-xs font-mono focus:ring-2 transition-all shadow-sm ${baseUrlInvalid ? 'border-destructive/60 focus:ring-destructive/20 focus:border-destructive' : 'border-border focus:ring-primary/20 focus:border-primary'}`}
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="http://127.0.0.1:4010"
                  disabled={disabled}
                  aria-invalid={baseUrlInvalid || undefined}
                />
              </div>
              {baseUrlInvalid && (
                <span className="block text-[10px] text-destructive px-1">Must be a valid absolute URL (http:// or https://)</span>
              )}
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
          onClick={() => void onSaveBackendConfig({ baseUrl: baseUrlTrimmed, apiToken: apiToken.trim() })}
          disabled={disabled || baseUrlTrimmed === '' || baseUrlInvalid}
          className="px-6 shadow-lg shadow-black/20 font-black uppercase tracking-widest text-[9px] h-9 rounded-lg"
        >
          {savingConfig ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : 'Save Backend Config'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ModelSearchDropdown (migrated from SettingsCard)
// ---------------------------------------------------------------------------

function ModelSearchDropdown({
  models,
  modelId,
  loading,
  error,
  hasKey,
  onSelect,
}: {
  models: { id: string; name: string }[]
  modelId: string
  loading: boolean
  error: string
  hasKey: boolean
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? models.filter(m =>
        m.id.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase())
      )
    : models

  const selectedModel = models.find(m => m.id === modelId)

  if (error) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</label>
        <p className="text-[11px] text-red-500">{error}</p>
      </div>
    )
  }

  if (!hasKey) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</label>
        <p className="text-[11px] text-muted-foreground/60">Enter an API key to load models</p>
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Model
          {loading && <Loader2 className="ml-1.5 inline h-2.5 w-2.5 animate-spin-smooth" />}
        </label>
        <p className="text-[11px] text-muted-foreground/60">Loading models...</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 relative">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Model
        {loading && <Loader2 className="ml-1.5 inline h-2.5 w-2.5 animate-spin-smooth" />}
        <span className="ml-2 text-muted-foreground/40 normal-case tracking-normal font-normal">{models.length} available</span>
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? search : (selectedModel?.name || modelId || '')}
          onChange={(e) => { setSearch(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setOpen(true); setSearch('') }}
          placeholder="Search models..."
          className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none"
        />
        {modelId && !open && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40">
            {models.length} models
          </span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-[240px] overflow-y-auto rounded-lg border border-border/40 bg-card shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground/60">
              No models match &ldquo;{search}&rdquo;
            </div>
          ) : (
            filtered.slice(0, 100).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelect(m.id)
                  setSearch('')
                  setOpen(false)
                }}
                className={`w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-muted/50 ${
                  m.id === modelId ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                }`}
              >
                <span className="block font-mono truncate">{m.id}</span>
                {m.name !== m.id && (
                  <span className="block text-[10px] text-muted-foreground/60 truncate">{m.name}</span>
                )}
              </button>
            ))
          )}
          {filtered.length > 100 && (
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground/40 border-t border-border/20">
              Showing first 100 of {filtered.length} — type to filter
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch('') }} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmbeddedAgentConfigForm (migrated from SettingsCard)
// ---------------------------------------------------------------------------

function EmbeddedAgentConfigForm({ config, disabled }: { config: BackendConfig | null; disabled: boolean }) {
  const savedPrefs = (() => { try { return JSON.parse(localStorage.getItem('orchestra-agent-provider-prefs') ?? '{}') } catch { return {} } })()
  const [providerId, setProviderId] = useState<string>(savedPrefs.providerId ?? CHAT_PROVIDERS[0].id)
  const [modelId, setModelId] = useState<string>(savedPrefs.modelId ?? '')
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [storedKey, setStoredKey] = useState('')

  useEffect(() => {
    if (!config) return
    fetchAgentProviderKeys(config)
      .then((result) => {
        const prefs = (() => { try { return JSON.parse(localStorage.getItem('orchestra-agent-provider-prefs') ?? '{}') } catch { return {} } })()
        const target = prefs.providerId && result.providers[prefs.providerId]?.configured
          ? prefs.providerId
          : CHAT_PROVIDERS.find(p => result.providers[p.id]?.configured)?.id
        if (target) {
          const info = result.providers[target]
          setProviderId(target)
          setHasKey(true)
          setStoredKey(info?.api_key ?? '')
          if (prefs.modelId) setModelId(prefs.modelId)
        }
      })
      .catch(() => {})
  }, [config])

  useEffect(() => {
    const key = storedKey || apiKey.trim()
    if (!key) {
      setModels([])
      setModelsError('')
      return
    }

    let cancelled = false
    setModelsLoading(true)
    setModelsError('')

    import('@/components/embedded-agent/lib/providers')
      .then(({ fetchProviderModels }) => fetchProviderModels(providerId, key))
      .then((fetched) => {
        if (cancelled) return
        setModels(fetched)
        if (fetched.length > 0) {
          setModelId((prev) => {
            if (prev && fetched.find((m: { id: string }) => m.id === prev)) return prev
            const prefs = (() => { try { return JSON.parse(localStorage.getItem('orchestra-agent-provider-prefs') ?? '{}') } catch { return {} } })()
            const match = prefs.modelId && fetched.find((m: { id: string }) => m.id === prefs.modelId)
            return match ? prefs.modelId : fetched[0].id
          })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setModels([])
        setModelsError(err instanceof Error ? err.message : 'Failed to fetch models')
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })

    return () => { cancelled = true }
  }, [providerId, storedKey, apiKey])

  const handleSave = async () => {
    if (!config || !apiKey.trim()) return
    setSaving(true)
    setMessage('')
    try {
      await saveAgentProviderKey(config, providerId, apiKey.trim())
      setHasKey(true)
      setStoredKey(apiKey.trim())
      setApiKey('')
      setMessage('API key saved.')
    } catch (err) {
      setMessage(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    const key = storedKey || apiKey.trim()
    if (!key || !modelId) return
    setTesting(true)
    setMessage('')
    try {
      const { createProvider } = await import('@/components/embedded-agent/lib/providers')
      const { generateText } = await import('ai')
      const provider = createProvider(providerId, key)
      await generateText({
        model: provider(modelId),
        prompt: 'Say "ok" and nothing else.',
      })
      setMessage('Connection verified.')
    } catch (err) {
      setMessage(`Test failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-bold">Embedded Agent</p>
          <p className="text-[10px] text-muted-foreground">Configure the LLM provider for the chat widget</p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Provider</label>
          <CustomDropdown
            className="w-full"
            value={providerId}
            options={CHAT_PROVIDERS.map(p => ({ label: p.label, value: p.id }))}
            onChange={(v) => {
              const nextProvider = v as string
              setProviderId(nextProvider)
              setModelId('')
              setModels([])
              setModelsError('')
              try { localStorage.setItem('orchestra-agent-provider-prefs', JSON.stringify({ providerId: nextProvider, modelId: '' })) } catch { /* */ }
              if (config) {
                setStoredKey('')
                setHasKey(false)
                fetchAgentProviderKeys(config)
                  .then((result) => {
                    const info = result.providers[nextProvider]
                    if (info?.configured) {
                      setHasKey(true)
                      setStoredKey(info.api_key ?? '')
                    }
                  })
                  .catch(() => {})
              } else {
                setStoredKey('')
                setHasKey(false)
              }
            }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            API Key
            {hasKey && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Configured
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? '••••••••' : (providerId === 'openrouter' ? 'sk-or-...' : providerId === 'claude' ? 'sk-ant-...' : 'sk-...')}
                disabled={disabled || saving}
                className="w-full rounded-lg border border-border/40 bg-background px-3 pr-9 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-all"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={disabled || saving || !apiKey.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : <Check className="h-3 w-3" />}
              Save
            </button>
          </div>
        </div>

        <ModelSearchDropdown
          models={models}
          modelId={modelId}
          loading={modelsLoading}
          error={modelsError}
          hasKey={hasKey || !!apiKey.trim()}
          onSelect={(id) => {
            setModelId(id)
            try { localStorage.setItem('orchestra-agent-provider-prefs', JSON.stringify({ providerId, modelId: id })) } catch { /* */ }
          }}
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={disabled || testing || !modelId || (!hasKey && !apiKey.trim())}
            className="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin-smooth" /> : <ShieldCheck className="h-3 w-3" />}
            Test Connection
          </button>
        </div>

        {message && (
          <p className={`text-[11px] font-medium ${message.includes('failed') || message.includes('Failed') ? 'text-red-500' : 'text-emerald-500'}`}>
            {message}
          </p>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Models are fetched directly from the provider API. API keys stored at <code className="text-[10px] font-mono bg-muted/30 px-1 rounded">~/.orchestra/agent-providers.json</code> (600).
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UnsandboxConfigForm (migrated from SettingsCard)
// ---------------------------------------------------------------------------

function UnsandboxConfigForm({ config, disabled }: { config: BackendConfig | null; disabled: boolean }) {
  const [publicKey, setPublicKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [status, setStatus] = useState<UnsandboxStatus | null>(null)
  const [unsandboxConfig, setUnsandboxConfig] = useState<UnsandboxConfig | null>(null)
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)

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
                placeholder={isConfigured ? '••••••••' : 'sk_...'}
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
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
