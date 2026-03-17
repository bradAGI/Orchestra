import * as Tooltip from '@radix-ui/react-tooltip'
import { type ReactNode } from 'react'

/** Root tooltip provider that wraps the app and configures the global delay duration. */
export function AppTooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delayDuration={100}>{children}</Tooltip.Provider>
}

/**
 * Styled tooltip wrapper using Radix UI primitives. Renders a small popover
 * with uppercase tracking on hover/focus of the trigger element.
 */
export function AppTooltip({ children, content, side = 'top' }: { children: ReactNode; content: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={5}
          className="z-[150] select-none rounded-lg bg-popover border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest leading-none text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 !opacity-100 block"
          style={{ backgroundColor: 'hsl(var(--popover))' }}
        >
          <div className="relative z-10">{content}</div>
          <Tooltip.Arrow className="fill-popover" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
