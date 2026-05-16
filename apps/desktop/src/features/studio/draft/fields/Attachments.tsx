import { useState } from 'react'
import type { StudioDraft } from '@core/api/client'

export function Attachments({
  draft,
  onChange,
}: {
  draft: StudioDraft
  onChange: (patch: Partial<StudioDraft>) => void
}) {
  const [path, setPath] = useState('')
  const [url, setUrl] = useState('')

  const addFile = () => {
    const trimmed = path.trim()
    if (!trimmed) return
    onChange({ attachments: [...draft.attachments, { kind: 'file', path: trimmed }] })
    setPath('')
  }

  const addLink = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    onChange({ attachments: [...draft.attachments, { kind: 'link', url: trimmed }] })
    setUrl('')
  }

  const remove = (i: number) => {
    onChange({ attachments: draft.attachments.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase opacity-60">Attachments</div>
      <ul className="flex flex-col gap-1">
        {draft.attachments.map((a, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="opacity-60">{a.kind === 'file' ? 'file' : 'link'}</span>
            <span className="flex-1 truncate">{a.path ?? a.url}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove attachment ${i + 1}`}
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
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="File path"
        />
        <button type="button" onClick={addFile} className="px-2 py-1 text-sm bg-white/10 rounded">
          + file
        </button>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-transparent border border-white/20 rounded px-2 py-1 text-sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link URL"
        />
        <button type="button" onClick={addLink} className="px-2 py-1 text-sm bg-white/10 rounded">
          + link
        </button>
      </div>
    </div>
  )
}
