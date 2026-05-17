import type { StudioDraft } from '@core/api/client'

export function BasicsFields({
  draft,
  onChange,
}: {
  draft: StudioDraft
  onChange: (patch: Partial<StudioDraft>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase opacity-60">Title</span>
        <input
          className="bg-transparent border-b border-white/20 px-1 py-1 outline-none focus:border-white/60"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="What needs to happen?"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase opacity-60">Description</span>
        <textarea
          rows={6}
          className="bg-transparent border border-white/20 rounded p-2 outline-none focus:border-white/60 resize-y"
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe the task in markdown"
        />
      </label>
    </div>
  )
}
