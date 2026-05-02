import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/dialog'
import type { ProviderFileEntry } from '@core/api/client'

interface CodexProfilesPanelProps {
  items: ProviderFileEntry[]
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
}

type ProfileSummary = {
  name: string
  model: string
  approvalPolicy: string
  sandboxMode: string
}

export function CodexProfilesPanel({ items, saving, onSave }: CodexProfilesPanelProps) {
  const config = items[0] ?? null
  const profiles = useMemo(() => extractProfiles(config?.content ?? ''), [config?.content])
  const [selectedName, setSelectedName] = useState<string | null>(profiles[0]?.name ?? null)
  const [draft, setDraft] = useState<ProfileSummary | null>(profiles[0] ?? null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')

  useEffect(() => {
    if (!selectedName && profiles.length > 0) setSelectedName(profiles[0].name)
    if (selectedName && !profiles.some(profile => profile.name === selectedName)) {
      setSelectedName(profiles[0]?.name ?? null)
    }
  }, [profiles, selectedName])

  useEffect(() => {
    const selected = profiles.find(profile => profile.name === selectedName) ?? null
    setDraft(selected)
  }, [profiles, selectedName])

  const selected = profiles.find(profile => profile.name === selectedName) ?? null
  const isDirty = JSON.stringify(draft) !== JSON.stringify(selected)

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/20">
        <div className="text-center space-y-2">
          <p className="text-sm font-bold uppercase tracking-widest">No config found</p>
          <p className="text-[10px]">Create a Codex config file before editing profiles.</p>
        </div>
      </div>
    )
  }

  const saveDraft = async () => {
    if (!draft) return
    await onSave(config.path, upsertProfile(config.content, draft))
  }

  const deleteSelected = async () => {
    if (!selected) return
    await onSave(config.path, removeProfile(config.content, selected.name))
  }

  const createProfile = async () => {
    const name = createName.trim()
    if (!name || !config) return
    const profile: ProfileSummary = { name, model: '', approvalPolicy: '', sandboxMode: '' }
    await onSave(config.path, upsertProfile(config.content, profile))
    setCreateOpen(false)
    setCreateName('')
    setSelectedName(name)
  }

  return (
    <div className="flex h-full">
      <div className="w-[220px] flex flex-col border-r border-border/30 shrink-0">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Profiles</h3>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">[profiles.*]</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {profiles.map(profile => (
            <button
              key={profile.name}
              type="button"
              onClick={() => setSelectedName(profile.name)}
              className={`w-full text-left px-2.5 py-2 rounded-md transition-colors border ${
                profile.name === selectedName
                  ? 'bg-primary/8 text-primary border-primary/20'
                  : 'text-muted-foreground hover:bg-muted/10 border-transparent'
              }`}
            >
              <div className="text-[11px] font-semibold truncate">{profile.name}</div>
              {profile.model ? <p className="text-[9px] mt-1 font-mono text-muted-foreground/40 truncate">{profile.model}</p> : null}
            </button>
          ))}
        </div>
        <div className="p-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)} className="w-full h-7 text-[10px] text-muted-foreground/50 hover:text-foreground">
            <Plus size={10} className="mr-1" /> Add Profile
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col p-4 gap-4">
        {draft ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{draft.name}</h3>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Profiles are written directly into the current Codex config file.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={deleteSelected} className="h-7 text-[10px] text-muted-foreground/50 hover:text-red-400">
                  <Trash2 size={10} />
                </Button>
                {isDirty ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(selected)} className="h-7 text-[10px]">
                      <RotateCcw size={10} className="mr-1" /> Discard
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveDraft}
                      disabled={saving === config.path}
                      className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
                    >
                      {saving === config.path ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                      Save
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <ProfileField label="Model" value={draft.model} onChange={(value) => setDraft(current => current ? { ...current, model: value } : current)} />
            <ProfileField label="Approval Policy" value={draft.approvalPolicy} onChange={(value) => setDraft(current => current ? { ...current, approvalPolicy: value } : current)} />
            <ProfileField label="Sandbox Mode" value={draft.sandboxMode} onChange={(value) => setDraft(current => current ? { ...current, sandboxMode: value } : current)} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest">No profiles found</p>
              <p className="text-[10px]">Add a profile to create a <code className="font-mono">[profiles.*]</code> block in the Codex config.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Profile</DialogTitle>
            <DialogDescription>Create a new <code className="font-mono">[profiles.*]</code> block in the current Codex config.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Profile Name</label>
            <input
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
              onKeyDown={(event) => event.key === 'Enter' && createName.trim() && createProfile()}
              placeholder="e.g. review"
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateName('') }}>Cancel</Button>
            <Button onClick={createProfile} disabled={!createName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProfileField({ label, value, onChange }: { label: string, value: string, onChange: (value: string) => void }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</h4>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full max-w-sm h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </section>
  )
}

function extractProfiles(content: string): ProfileSummary[] {
  const lines = content.split('\n')
  const profiles: ProfileSummary[] = []
  let current: ProfileSummary | null = null

  for (const line of lines) {
    const header = line.match(/^\[profiles\.([^\]]+)\]\s*$/)
    if (header) {
      if (current) profiles.push(current)
      current = { name: header[1], model: '', approvalPolicy: '', sandboxMode: '' }
      continue
    }
    if (!current) continue
    if (/^\[.*\]\s*$/.test(line)) {
      profiles.push(current)
      current = null
      continue
    }

    const scalar = line.match(/^([a-zA-Z0-9_.-]+)\s*=\s*["']?([^"'\n]+)["']?\s*$/)
    if (!scalar) continue

    if (scalar[1] === 'model') current.model = scalar[2].trim()
    if (scalar[1] === 'approval_policy') current.approvalPolicy = scalar[2].trim()
    if (scalar[1] === 'sandbox_mode') current.sandboxMode = scalar[2].trim()
  }

  if (current) profiles.push(current)
  return profiles
}

function upsertProfile(content: string, profile: ProfileSummary): string {
  const section = buildProfileSection(profile)
  const pattern = new RegExp(`\\[profiles\\.${escapeRegExp(profile.name)}\\][\\s\\S]*?(?=\\n\\[[^\\n]+\\]|$)`, 'm')
  if (pattern.test(content)) {
    return content.replace(pattern, section).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
  }
  return `${content.trimEnd()}\n\n${section}\n`
}

function removeProfile(content: string, name: string): string {
  const pattern = new RegExp(`\\n?\\[profiles\\.${escapeRegExp(name)}\\][\\s\\S]*?(?=\\n\\[[^\\n]+\\]|$)`, 'm')
  return content.replace(pattern, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

function buildProfileSection(profile: ProfileSummary): string {
  const lines = [`[profiles.${profile.name}]`]
  if (profile.model.trim()) lines.push(`model = "${profile.model.trim()}"`)
  if (profile.approvalPolicy.trim()) lines.push(`approval_policy = "${profile.approvalPolicy.trim()}"`)
  if (profile.sandboxMode.trim()) lines.push(`sandbox_mode = "${profile.sandboxMode.trim()}"`)
  return lines.join('\n')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
