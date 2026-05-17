import type { StudioDraft } from '@core/api/client'

const PROVIDERS = ['claude-code', 'codex', 'opencode', 'gemini'] as const

export function ProviderPicker({
  draft,
  onChange,
}: {
  draft: StudioDraft
  onChange: (patch: Partial<StudioDraft>) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase opacity-60">Execution provider</span>
      <select
        className="bg-transparent border border-white/20 rounded px-2 py-1 text-sm"
        value={draft.suggested_provider}
        onChange={(e) => onChange({ suggested_provider: e.target.value })}
      >
        <option value="">— orchestrator chooses —</option>
        {PROVIDERS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  )
}
