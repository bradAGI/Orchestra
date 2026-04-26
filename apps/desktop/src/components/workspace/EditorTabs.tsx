import { useAppStore } from '@/store'

export function EditorTabs() {
  const openFiles = useAppStore((s) => s.openFiles)
  const activeFileId = useAppStore((s) => s.activeFileId)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const closeFile = useAppStore((s) => s.closeFile)

  if (openFiles.length === 0) return null

  return (
    <div className="flex items-center border-b border-border bg-background overflow-x-auto">
      {openFiles.map((file) => (
        <button
          key={file.id}
          className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border whitespace-nowrap ${
            file.id === activeFileId
              ? 'bg-background text-foreground'
              : 'bg-muted/30 text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveFile(file.id)}
        >
          {file.isDirty && (
            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
          )}
          <span>{file.relativePath.split('/').pop()}</span>
          <span
            className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-accent rounded p-0.5"
            onClick={(e) => {
              e.stopPropagation()
              closeFile(file.id)
            }}
          >
            &times;
          </span>
        </button>
      ))}
    </div>
  )
}
