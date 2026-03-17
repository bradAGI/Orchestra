import * as React from 'react'

/** Lightweight scroll area wrapper (simplified from Radix ScrollArea). */
export function ScrollArea({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}
