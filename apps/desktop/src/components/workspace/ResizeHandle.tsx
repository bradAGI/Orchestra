import { useRef } from 'react'

type ResizeHandleProps = {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
  className?: string
}

export function ResizeHandle({ direction, onResize, className }: ResizeHandleProps) {
  const draggingRef = useRef(false)
  const lastPosRef = useRef(0)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    lastPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const current = direction === 'horizontal' ? e.clientX : e.clientY
    const delta = current - lastPosRef.current
    lastPosRef.current = current
    onResize(delta)
  }

  const handlePointerUp = () => {
    draggingRef.current = false
  }

  const directionClass = direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'

  return (
    <div
      className={`flex-shrink-0 bg-border hover:bg-primary/30 transition-colors ${directionClass} ${className ?? ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
}
