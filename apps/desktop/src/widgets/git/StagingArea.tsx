import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { GitStatusEntry } from '@/lib/orchestra-client'

/* ------------------------------------------------------------------ */
/*  Status badge colors                                                */
/* ------------------------------------------------------------------ */

const statusColors: Record<string, string> = {
  M: 'bg-amber-500/20 text-amber-400',
  A: 'bg-green-500/20 text-green-400',
  D: 'bg-red-500/20 text-red-400',
  R: 'bg-blue-500/20 text-blue-400',
  '?': 'bg-purple-500/20 text-purple-400',
}

function badgeClass(status: string) {
  return statusColors[status] ?? 'bg-muted/20 text-muted-foreground'
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface StagingAreaProps {
  unstaged: GitStatusEntry[]
  staged: GitStatusEntry[]
  selectedFile: string | null
  onFileSelect: (path: string, staged: boolean) => void
  onStage: (path: string) => void
  onUnstage: (path: string) => void
  onStageAll: () => void
  onUnstageAll: () => void
}

/* ------------------------------------------------------------------ */
/*  File row (sortable / draggable)                                    */
/* ------------------------------------------------------------------ */

function FileRow({
  entry,
  id,
  isStaged,
  isSelected,
  onSelect,
}: {
  entry: GitStatusEntry
  id: string
  isStaged: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isDeleted = entry.status === 'D'

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`file-row-${isStaged ? 'staged' : 'unstaged'}-${entry.path}`}
      data-selected={isSelected ? 'true' : undefined}
      className={`flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-muted/10 group ${
        isSelected ? 'border-l-2 border-blue-500 bg-blue-500/5' : ''
      }`}
      onClick={onSelect}
      {...attributes}
    >
      <span
        data-testid="status-badge"
        className={`text-[9px] font-bold uppercase w-5 text-center rounded px-1 shrink-0 ${badgeClass(entry.status)}`}
      >
        {entry.status}
      </span>
      <span
        data-file-path
        className={`flex-1 text-[11px] text-foreground truncate ${isDeleted ? 'line-through text-muted-foreground' : ''}`}
        title={entry.path}
      >
        {entry.path}
      </span>
      <span
        className="text-muted-foreground/40 cursor-grab opacity-0 group-hover:opacity-100 text-xs select-none"
        {...listeners}
      >
        ⠿
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Ghost card shown during drag                                       */
/* ------------------------------------------------------------------ */

function GhostCard({ entry }: { entry: GitStatusEntry }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-card border border-border/60 rounded shadow-lg opacity-90">
      <span
        className={`text-[9px] font-bold uppercase w-5 text-center rounded px-1 ${badgeClass(entry.status)}`}
      >
        {entry.status}
      </span>
      <span className="text-[11px] text-foreground truncate">{entry.path}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Droppable zone wrapper                                             */
/* ------------------------------------------------------------------ */

function DroppableZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className ?? ''} ${isOver ? 'ring-1 ring-primary/40' : ''}`}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function StagingArea({
  unstaged,
  staged,
  selectedFile,
  onFileSelect,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
}: StagingAreaProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const unstagedIds = unstaged.map((e) => `unstaged-${e.path}`)
  const stagedIds = staged.map((e) => `staged-${e.path}`)

  // Find the entry for the currently dragged item
  function findEntry(id: string): GitStatusEntry | undefined {
    if (id.startsWith('unstaged-')) {
      const path = id.slice('unstaged-'.length)
      return unstaged.find((e) => e.path === path)
    }
    if (id.startsWith('staged-')) {
      const path = id.slice('staged-'.length)
      return staged.find((e) => e.path === path)
    }
    return undefined
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    const fromStaged = activeIdStr.startsWith('staged-')
    const toStaged = overIdStr.startsWith('staged-') || overIdStr === 'staged-zone'
    const toUnstaged = overIdStr.startsWith('unstaged-') || overIdStr === 'unstaged-zone'

    const path = activeIdStr.replace(/^(unstaged-|staged-)/, '')

    // Cross-section drop
    if (!fromStaged && toStaged) {
      onStage(path)
    } else if (fromStaged && toUnstaged) {
      onUnstage(path)
    }
  }

  const activeEntry = activeId ? findEntry(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Unstaged section (top) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-red-500/5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">
                Unstaged
              </span>
              <span
                data-testid="unstaged-count"
                className="text-[9px] font-bold bg-red-500/20 text-red-400 rounded-full px-1.5 min-w-[18px] text-center"
              >
                {unstaged.length}
              </span>
            </div>
            {unstaged.length > 0 && (
              <button
                onClick={onStageAll}
                className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Stage All ↓
              </button>
            )}
          </div>
          <DroppableZone id="unstaged-zone" className="flex-1 overflow-y-auto">
            <SortableContext items={unstagedIds} strategy={verticalListSortingStrategy}>
              {unstaged.map((entry) => (
                <FileRow
                  key={`unstaged-${entry.path}`}
                  id={`unstaged-${entry.path}`}
                  entry={entry}
                  isStaged={false}
                  isSelected={selectedFile === entry.path}
                  onSelect={() => onFileSelect(entry.path, false)}
                />
              ))}
            </SortableContext>
            {unstaged.length === 0 && (
              <div className="px-3 py-4 text-[10px] text-muted-foreground/50 text-center">
                No unstaged changes
              </div>
            )}
          </DroppableZone>
        </div>

        {/* Staged section (bottom) */}
        <div className="flex-1 flex flex-col min-h-0 border-t border-border/30">
          <div className="flex items-center justify-between px-3 py-1.5 bg-green-500/5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">
                Staged
              </span>
              <span
                data-testid="staged-count"
                className="text-[9px] font-bold bg-green-500/20 text-green-400 rounded-full px-1.5 min-w-[18px] text-center"
              >
                {staged.length}
              </span>
            </div>
            {staged.length > 0 && (
              <button
                onClick={onUnstageAll}
                className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                ↑ Unstage All
              </button>
            )}
          </div>
          <DroppableZone id="staged-zone" className="flex-1 overflow-y-auto">
            <SortableContext items={stagedIds} strategy={verticalListSortingStrategy}>
              {staged.map((entry) => (
                <FileRow
                  key={`staged-${entry.path}`}
                  id={`staged-${entry.path}`}
                  entry={entry}
                  isStaged={true}
                  isSelected={selectedFile === entry.path}
                  onSelect={() => onFileSelect(entry.path, true)}
                />
              ))}
            </SortableContext>
            {staged.length === 0 && (
              <div className="px-3 py-4 text-[10px] text-muted-foreground/50 text-center">
                No staged changes
              </div>
            )}
          </DroppableZone>
        </div>
      </div>

      <DragOverlay>{activeEntry ? <GhostCard entry={activeEntry} /> : null}</DragOverlay>
    </DndContext>
  )
}
