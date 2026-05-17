import type { StudioDraft } from '@core/api/client'

export function TemplatePicker({
  draft,
  onBrowse,
}: {
  draft: StudioDraft
  onChange: (patch: Partial<StudioDraft>) => void
  onBrowse?: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="opacity-60">Template:</span>
      <span>{draft.template_name || '—'}</span>
      {onBrowse ? (
        <button type="button" onClick={onBrowse} className="ml-auto text-xs opacity-70 hover:opacity-100">
          Browse
        </button>
      ) : null}
    </div>
  )
}
