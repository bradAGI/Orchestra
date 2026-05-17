import { useState } from 'react'
import type { StudioTemplate } from '@core/api/client'

export interface TemplateLibraryProps {
  templates: StudioTemplate[]
  onApply: (name: string, vars: Record<string, string>) => void
  onSave: (name: string, content: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
  onClose: () => void
}

function yamlOf(meta: StudioTemplate['meta']): string {
  const lines = [`name: ${meta.name}`]
  if (meta.description) lines.push(`description: ${meta.description}`)
  return lines.join('\n') + '\n'
}

export function TemplateLibrary({ templates, onApply, onSave, onDelete, onClose }: TemplateLibraryProps) {
  const [selected, setSelected] = useState<StudioTemplate | null>(templates[0] ?? null)
  const [vars, setVars] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editContent, setEditContent] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-white/10 rounded w-[800px] h-[560px] flex"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="w-56 border-r border-white/10 flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-medium">Templates</h3>
            <button
              type="button"
              onClick={() => {
                setEditing(true)
                setEditName('')
                setEditContent('---\nname: \n---\n')
              }}
              className="text-xs opacity-60 hover:opacity-100"
            >
              + new
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {templates.map((t) => (
              <li key={t.meta.name}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(t)
                    setEditing(false)
                    setVars({})
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${
                    selected?.meta.name === t.meta.name ? 'bg-white/10' : ''
                  }`}
                >
                  <div>{t.meta.name}</div>
                  <div className="text-xs opacity-50 truncate">{t.meta.description}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex-1 flex flex-col">
          {editing ? (
            <div className="flex-1 flex flex-col p-3 gap-2">
              <input
                className="bg-transparent border border-white/20 rounded px-2 py-1 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="template-name"
              />
              <textarea
                className="flex-1 bg-transparent border border-white/20 rounded p-2 text-sm font-mono"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditing(false)} className="px-3 py-1 text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onSave(editName, editContent)
                    setEditing(false)
                  }}
                  className="px-3 py-1 text-sm bg-sky-500 text-black rounded"
                >
                  Save
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className="flex-1 flex flex-col p-3 gap-3 min-h-0">
              <div>
                <h2 className="text-base font-medium">{selected.meta.name}</h2>
                <p className="text-sm opacity-60">{selected.meta.description}</p>
              </div>
              {selected.meta.variables && selected.meta.variables.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs uppercase opacity-60">Variables</div>
                  {selected.meta.variables.map((v) => (
                    <label key={v.name} className="flex items-center gap-2 text-sm">
                      <span className="w-32">
                        {v.name}
                        {v.required && <span className="text-red-400">*</span>}
                      </span>
                      <input
                        className="flex-1 bg-transparent border border-white/20 rounded px-2 py-1"
                        value={vars[v.name] ?? ''}
                        onChange={(e) => setVars({ ...vars, [v.name]: e.target.value })}
                        placeholder={v.default ?? ''}
                      />
                    </label>
                  ))}
                </div>
              )}
              <pre className="flex-1 overflow-auto text-xs bg-black/30 p-2 rounded whitespace-pre-wrap">{selected.body}</pre>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => onDelete(selected.meta.name)} className="px-3 py-1 text-sm text-red-400">
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true)
                    setEditName(selected.meta.name)
                    setEditContent(`---\n${yamlOf(selected.meta)}---\n${selected.body}`)
                  }}
                  className="px-3 py-1 text-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onApply(selected.meta.name, vars)}
                  className="px-3 py-1 text-sm bg-sky-500 text-black rounded"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm opacity-60">No templates yet.</div>
          )}
        </section>
      </div>
    </div>
  )
}
