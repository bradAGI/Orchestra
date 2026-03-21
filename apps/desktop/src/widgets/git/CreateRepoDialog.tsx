import { useState } from 'react'

export interface CreateRepoDialogProps {
  projectName: string
  onCancel: () => void
  onCreate: (opts: { name: string; description: string; private: boolean }) => Promise<void>
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function CreateRepoDialog({ projectName, onCancel, onCreate }: CreateRepoDialogProps) {
  const [name, setName] = useState(toKebabCase(projectName))
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), description, private: isPrivate })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Repository creation failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-lg max-w-md w-full mx-4 border border-border/30">
        <div className="px-5 pt-5 pb-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Create GitHub Repository</h2>

          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground/70 font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full text-[11px] bg-muted/10 border border-border/40 rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground/70 font-medium">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              placeholder="Repository description (optional)"
              className="w-full text-[11px] bg-muted/10 border border-border/40 rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground/70 font-medium">Visibility</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                disabled={loading}
                className={`flex-1 text-[11px] font-medium py-1.5 rounded-md border transition-colors ${
                  isPrivate
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/10 text-muted-foreground border-border/40 hover:text-foreground'
                } disabled:opacity-50`}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                disabled={loading}
                className={`flex-1 text-[11px] font-medium py-1.5 rounded-md border transition-colors ${
                  !isPrivate
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/10 text-muted-foreground border-border/40 hover:text-foreground'
                } disabled:opacity-50`}
              >
                Public
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-red-400">{error}</p>
          )}
        </div>

        <div className="px-5 py-3 flex justify-end gap-2 border-t border-border/20 bg-muted/10 rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md shadow-sm transition-colors disabled:opacity-30"
          >
            {loading ? 'Creating...' : 'Create Repository'}
          </button>
        </div>
      </div>
    </div>
  )
}
