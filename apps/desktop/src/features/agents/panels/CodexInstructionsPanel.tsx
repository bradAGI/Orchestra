import type { FileResourceItem } from './FileResourcePanel'
import { FileResourcePanel } from './FileResourcePanel'

interface CodexInstructionsPanelProps {
  items: FileResourceItem[]
  saving: string | null
  onSave: (path: string, content: string) => Promise<void>
  onCreate: () => Promise<void>
}

export function CodexInstructionsPanel({ items, saving, onSave, onCreate }: CodexInstructionsPanelProps) {
  return (
    <FileResourcePanel
      title="Instruction Stack"
      subtitle="AGENTS.md and AGENTS.override.md"
      emptyTitle="No instruction files found"
      emptyDescription="Codex instructions are discovered from AGENTS.md files in global and project scope."
      infoTitle="Codex Instruction Order"
      infoDescription="Codex uses stacked instruction files. Project-level instructions are more specific than global ones, and override files should be treated as the highest-precedence layer."
      items={items}
      saving={saving}
      onSave={onSave}
      onCreate={() => onCreate()}
      createLabel="Create Instructions"
      createDescription="Create the default Codex AGENTS.md file for the selected scope."
    />
  )
}
