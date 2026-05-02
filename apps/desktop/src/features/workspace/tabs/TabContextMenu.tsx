import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface TabContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onCloseTab: () => void
}

export function TabContextMenu({ x, y, onClose, onCloseTab }: TabContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[180px] rounded-md border border-border bg-popover py-1 shadow-xl"
      style={{ left: x, top: y }}
      role="menu"
    >
      <MenuItem
        icon={<X size={11} />}
        label="Close"
        onClick={() => { onCloseTab(); onClose() }}
        destructive
      />
    </div>,
    document.body,
  )
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  destructive,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: React.ReactNode
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-left hover:bg-accent transition-colors ${
        destructive ? 'text-destructive hover:text-destructive' : 'text-foreground'
      }`}
      role="menuitem"
    >
      <span className="text-muted-foreground/70 shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-muted-foreground/50 shrink-0">{shortcut}</span>}
    </button>
  )
}
