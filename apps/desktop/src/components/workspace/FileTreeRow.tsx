import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import type { TreeNode } from '@/store/types'

type FileTreeRowProps = {
  node: TreeNode
  isExpanded: boolean
  gitStatus?: string
  onToggle: () => void
  onClick: () => void
  style: React.CSSProperties
}

function gitStatusColor(status?: string): string {
  if (!status) return 'text-foreground'
  switch (status) {
    case 'M':
    case 'MM':
      return 'text-orange-400'
    case 'A':
    case '??':
      return 'text-green-400'
    case 'D':
      return 'text-red-400'
    default:
      return 'text-foreground'
  }
}

export function FileTreeRow({
  node,
  isExpanded,
  gitStatus,
  onToggle,
  onClick,
  style,
}: FileTreeRowProps) {
  const paddingLeft = node.depth * 16 + 8
  const isDir = node.isDirectory

  return (
    <div
      role="treeitem"
      className="flex items-center cursor-pointer select-none hover:bg-accent/50"
      style={{ ...style, height: 26, paddingLeft }}
      onClick={isDir ? onToggle : onClick}
      aria-expanded={isDir ? isExpanded : undefined}
    >
      {isDir ? (
        isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )
      ) : (
        <File className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      )}
      <span
        className={`ml-1.5 text-sm truncate ${gitStatusColor(gitStatus)}`}
      >
        {node.name}
      </span>
    </div>
  )
}
