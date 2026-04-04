import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OpenCodePermissionsPanelProps {
  configPath: string
  configContent: string
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
}

export function OpenCodePermissionsPanel({ configPath, configContent, saving, onSave }: OpenCodePermissionsPanelProps) {
  const parsed = useMemo(() => safeParse(configContent), [configContent])
  const [defaultMode, setDefaultMode] = useState(readDefaultMode(parsed))
  const [allow, setAllow] = useState(readPermissionList(parsed, 'allow'))
  const [deny, setDeny] = useState(readPermissionList(parsed, 'deny'))
  const [ask, setAsk] = useState(readPermissionList(parsed, 'ask'))

  useEffect(() => {
    setDefaultMode(readDefaultMode(parsed))
    setAllow(readPermissionList(parsed, 'allow'))
    setDeny(readPermissionList(parsed, 'deny'))
    setAsk(readPermissionList(parsed, 'ask'))
  }, [parsed])

  const isDirty =
    defaultMode !== readDefaultMode(parsed) ||
    JSON.stringify(allow) !== JSON.stringify(readPermissionList(parsed, 'allow')) ||
    JSON.stringify(deny) !== JSON.stringify(readPermissionList(parsed, 'deny')) ||
    JSON.stringify(ask) !== JSON.stringify(readPermissionList(parsed, 'ask'))

  if (!configPath) {
    return <EmptyPanel title="No config found" description="Create OpenCode config first, then manage permission rules here." />
  }

  if (!parsed) {
    return <EmptyPanel title="Structured editing unavailable" description="This OpenCode config could not be parsed cleanly. Use the Config panel raw editor first." />
  }

  return (
    <div className="flex flex-col h-full p-4 gap-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Permissions</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">OpenCode permissions live in <code className="font-mono">opencode.json</code> under <code className="font-mono">permission</code>.</p>
        </div>
        {isDirty ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Unsaved</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDefaultMode(readDefaultMode(parsed))
                setAllow(readPermissionList(parsed, 'allow'))
                setDeny(readPermissionList(parsed, 'deny'))
                setAsk(readPermissionList(parsed, 'ask'))
              }}
              className="h-7 text-[10px]"
            >
              <RotateCcw size={10} className="mr-1" /> Discard
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(configPath, buildOpenCodeConfig(parsed, defaultMode, allow, deny, ask))}
              disabled={saving === configPath}
              className="h-7 bg-primary text-primary-foreground font-bold uppercase text-[10px] px-4 rounded-lg"
            >
              {saving === configPath ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
              Save
            </Button>
          </div>
        ) : null}
      </div>

      <Field label="Default Permission Mode">
        <select
          value={defaultMode}
          onChange={(event) => setDefaultMode(event.target.value)}
          className="w-full max-w-sm h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Rule Map</option>
          <option value="allow">allow</option>
          <option value="deny">deny</option>
          <option value="ask">ask</option>
        </select>
        <p className="text-[10px] text-muted-foreground/50 mt-1">When set, OpenCode uses a single global permission mode instead of per-tool rules.</p>
      </Field>

      <ListField label="Allow Rules" description="Tool rules that should run without prompting." items={allow} onChange={setAllow} placeholder="bash(git status)" disabled={defaultMode !== ''} />
      <ListField label="Deny Rules" description="Tool rules that should always be blocked." items={deny} onChange={setDeny} placeholder="bash(rm *)" disabled={defaultMode !== ''} />
      <ListField label="Ask Rules" description="Tool rules that should always prompt." items={ask} onChange={setAsk} placeholder="edit" disabled={defaultMode !== ''} />
    </div>
  )
}

function buildOpenCodeConfig(base: Record<string, unknown>, defaultMode: string, allow: string[], deny: string[], ask: string[]) {
  const next = structuredClone(base)
  if (defaultMode) {
    next.permission = defaultMode
    return `${JSON.stringify(next, null, 2)}\n`
  }

  const permission: Record<string, unknown> = {}
  writePermissionEntries(permission, allow, 'allow')
  writePermissionEntries(permission, deny, 'deny')
  writePermissionEntries(permission, ask, 'ask')
  next.permission = permission
  return `${JSON.stringify(next, null, 2)}\n`
}

function writePermissionEntries(target: Record<string, unknown>, entries: string[], action: 'allow' | 'deny' | 'ask') {
  for (const rule of entries) {
    const match = rule.match(/^([^()]+)\((.+)\)$/)
    if (match) {
      const tool = match[1]
      const pattern = match[2]
      const current = target[tool]
      if (typeof current !== 'object' || current === null || Array.isArray(current)) {
        target[tool] = {}
      }
      ;(target[tool] as Record<string, unknown>)[pattern] = action
      continue
    }
    target[rule] = action
  }
}

function readDefaultMode(parsed: Record<string, unknown> | null): string {
  return parsed && typeof parsed.permission === 'string' ? parsed.permission : ''
}

function readPermissionList(parsed: Record<string, unknown> | null, desired: 'allow' | 'deny' | 'ask'): string[] {
  if (!parsed || typeof parsed.permission !== 'object' || parsed.permission === null || Array.isArray(parsed.permission)) return []
  const output: string[] = []
  for (const [tool, value] of Object.entries(parsed.permission as Record<string, unknown>)) {
    if (typeof value === 'string') {
      if (value === desired) output.push(tool)
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [pattern, action] of Object.entries(value as Record<string, unknown>)) {
        if (action === desired) output.push(`${tool}(${pattern})`)
      }
    }
  }
  return output
}

function safeParse(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return null
  }
}

function Field({ label, children }: { label: string, children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</h4>
      {children}
    </section>
  )
}

function ListField({
  label, description, items, onChange, placeholder, disabled,
}: { label: string, description: string, items: string[], onChange: (items: string[]) => void, placeholder: string, disabled?: boolean }) {
  const [draft, setDraft] = useState('')
  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</h4>
        <p className="text-[10px] text-muted-foreground/50 mt-1">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length > 0 ? items.map((item) => (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => onChange(items.filter((entry) => entry !== item))}
            className="inline-flex items-center gap-1 rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-[11px] font-mono disabled:opacity-50"
          >
            {item}
          </button>
        )) : <span className="text-[10px] italic text-muted-foreground/35">None</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              const next = draft.trim()
              if (next && !items.includes(next)) {
                onChange([...items, next])
                setDraft('')
              }
            }
          }}
          placeholder={placeholder}
          className="w-full max-w-md h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            const next = draft.trim()
            if (next && !items.includes(next)) {
              onChange([...items, next])
              setDraft('')
            }
          }}
          className="h-9"
        >
          Add
        </Button>
      </div>
    </section>
  )
}

function EmptyPanel({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground/20">
      <div className="text-center space-y-2 max-w-md">
        <p className="text-sm font-bold uppercase tracking-widest">{title}</p>
        <p className="text-[10px]">{description}</p>
      </div>
    </div>
  )
}
