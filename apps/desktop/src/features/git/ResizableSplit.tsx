import { useState, useRef, useEffect, useCallback } from 'react'

export interface ResizableSplitProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  storageKey?: string
}

function readStoredWidth(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {
    // localStorage unavailable
  }
  return fallback
}

export function ResizableSplit({
  left,
  right,
  defaultLeftWidth = 300,
  minLeftWidth = 200,
  maxLeftWidth = 500,
  storageKey = 'git-tab-split-width',
}: ResizableSplitProps) {
  const [leftWidth, setLeftWidth] = useState(() =>
    readStoredWidth(storageKey, defaultLeftWidth),
  )
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      let newWidth = e.clientX - rect.left
      newWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth))
      setLeftWidth(newWidth)
    }

    function onMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      // persist on release
      try {
        localStorage.setItem(storageKey, String(leftWidth))
      } catch {
        // localStorage unavailable
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [minLeftWidth, maxLeftWidth, storageKey, leftWidth])

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden min-h-0">
      <div
        data-panel="left"
        className="shrink-0 overflow-auto"
        style={{ width: `${leftWidth}px` }}
      >
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        className="w-px shrink-0 bg-border/40 hover:bg-primary/40 cursor-col-resize transition-colors"
        onMouseDown={onMouseDown}
      />

      <div data-panel="right" className="flex-1 overflow-auto min-w-0">
        {right}
      </div>
    </div>
  )
}
