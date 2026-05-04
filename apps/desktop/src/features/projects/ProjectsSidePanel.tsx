import type { Project } from '@core/api/types'
import { FolderOpen, Folder } from 'lucide-react'

interface Props {
  projects: Project[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ProjectsSidePanel({ projects, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full py-3">
      <div className="px-3 pb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Projects</p>
        <span className="text-[10px] tabular-nums text-muted-foreground/40">{projects.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {projects.length === 0 && (
          <p className="text-[11.5px] text-muted-foreground/50 px-2 py-3">No projects yet</p>
        )}
        {projects.map((p) => {
          const active = p.id === selectedId
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-left transition-colors relative ${
                active
                  ? 'bg-foreground/[0.08] text-foreground'
                  : 'text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.04]'
              }`}
            >
              {active && <span className="absolute left-0 w-[2px] h-5 rounded-r-full bg-primary" />}
              {active
                ? <FolderOpen size={14} strokeWidth={2.2} className="text-primary shrink-0" />
                : <Folder size={14} strokeWidth={1.8} className="shrink-0" />
              }
              <span className={`text-[12.5px] truncate ${active ? 'font-semibold' : 'font-medium'}`}>{p.name}</span>
              {p.issue_source_type && (
                <span className="ml-auto text-[10px] font-mono text-muted-foreground/40 shrink-0">{p.issue_source_type}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
