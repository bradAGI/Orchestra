import { useState } from 'react'
import type { StudioDraft } from '@core/api/client'

export function AcceptanceCriteria({
  draft,
  onChange,
}: {
  draft: StudioDraft
  onChange: (patch: Partial<StudioDraft>) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onChange({ acceptance_criteria: [...draft.acceptance_criteria, trimmed] })
    setInput('')
  }

  const remove = (i: number) => {
    onChange({ acceptance_criteria: draft.acceptance_criteria.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase opacity-60">Acceptance criteria</div>
      <ul className="flex flex-col gap-1">
        {draft.acceptance_criteria.map((c, i) => (
          <li key={i} className="flex items-start gap-2 group">
            <input type="checkbox" disabled className="mt-1" />
            <span className="flex-1">{c}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove criterion ${i + 1}`}
              className="opacity-60 hover:opacity-100 text-xs"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-transparent border border-white/20 rounded px-2 py-1 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder="Add criterion…"
        />
        <button type="button" onClick={add} className="px-2 py-1 text-sm bg-white/10 rounded">
          Add
        </button>
      </div>
    </div>
  )
}
