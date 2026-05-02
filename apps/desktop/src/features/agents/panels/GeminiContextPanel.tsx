import type { FileResourceItem } from './FileResourcePanel'
import { FileResourcePanel } from './FileResourcePanel'

interface GeminiContextPanelProps {
  items: FileResourceItem[]
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
  onCreate: () => Promise<void>
}

export function GeminiContextPanel({ items, saving, onSave, onCreate }: GeminiContextPanelProps) {
  return (
    <FileResourcePanel
      title="Context Files"
      subtitle="GEMINI.md context layers"
      emptyTitle="No context files found"
      emptyDescription="Gemini loads workspace and project context from GEMINI.md files."
      infoTitle="Gemini Context"
      infoDescription="Gemini context is file-driven. Global context establishes broad defaults, while project-level GEMINI.md files should be treated as the closest operational context for a repository."
      items={items}
      saving={saving}
      onSave={onSave}
      onCreate={() => onCreate()}
      createLabel="Create Context"
      createDescription="Create a GEMINI.md context file for the selected scope."
    />
  )
}
