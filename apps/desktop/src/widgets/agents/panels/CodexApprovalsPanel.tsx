import { useEffect, useState } from 'react'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProviderPermissions } from '@/lib/orchestra-client'
import { APPROVAL_MODES } from '../constants'

interface CodexApprovalsPanelProps {
  permissions: ProviderPermissions
  saving: string | null
  onSave: (perms: ProviderPermissions) => Promise<void>
}

const SANDBOX_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'read-only', label: 'Read Only' },
  { value: 'workspace-write', label: 'Workspace Write' },
  { value: 'danger-full-access', label: 'Danger Full Access' },
]

export function CodexApprovalsPanel({ permissions, saving, onSave }: CodexApprovalsPanelProps) {
  const [mode, setMode] = useState(permissions.approval_mode)
  const [sandbox, setSandbox] = useState(permissions.sandbox ?? '')

  useEffect(() => {
    setMode(permissions.approval_mode)
    setSandbox(permissions.sandbox ?? '')
  }, [permissions])

  const isDirty = mode !== permissions.approval_mode || sandbox !== (permissions.sandbox ?? '')

  return (
    <div className="flex flex-col h-full p-4 gap-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Approvals & Sandbox</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Codex maps these settings to <code className="font-mono">approval_policy</code> and <code className="font-mono">sandbox_mode</code>.</p>
        </div>
        {isDirty ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>
            <Button size="sm" variant="ghost" onClick={() => { setMode(permissions.approval_mode); setSandbox(permissions.sandbox ?? '') }} className="h-7 text-[10px]">
              <RotateCcw size={10} className="mr-1" /> Discard
            </Button>
            <Button
              size="sm"
              onClick={() => onSave({ ...permissions, approval_mode: mode, sandbox })}
              disabled={!!saving}
              className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
            >
              {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
              Save
            </Button>
          </div>
        ) : null}
      </div>

      <section className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Approval Policy</h4>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {APPROVAL_MODES.codex.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Sandbox Mode</h4>
        <select
          value={sandbox}
          onChange={(event) => setSandbox(event.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {SANDBOX_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </section>

      <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-1">
        <p className="text-[11px] font-semibold">Scope-aware</p>
        <p className="text-[10px] text-muted-foreground/50">These controls now write to the selected global or project <code className="font-mono">.codex/config.toml</code> instead of only the global config.</p>
      </div>
    </div>
  )
}
