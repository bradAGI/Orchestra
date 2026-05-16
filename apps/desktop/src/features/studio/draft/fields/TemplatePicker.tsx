import type { StudioDraft } from '@core/api/client'

export function TemplatePicker({
  draft,
}: {
  draft: StudioDraft
  onChange: (patch: Partial<StudioDraft>) => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="opacity-60">Template:</span>
      <span>{draft.template_name || '—'}</span>
      <button type="button" disabled className="ml-auto opacity-40 cursor-not-allowed text-xs">
        Browse (Phase 4)
      </button>
    </div>
  )
}
