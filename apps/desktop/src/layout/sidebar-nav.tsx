import { memo, useRef, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SidebarItem } from '@layout/types'
import { getNextSidebarIndex } from '@core/utils/navigation'
import { AppTooltip } from '@ui/tooltip-wrapper'

export function SidebarNav({
  items,
  activeSection,
  onSectionChange,
  sidebarCollapsed,
  onToggleCollapsed,
  sidebarWidth,
}: {
  items: SidebarItem[]
  activeSection: string
  onSectionChange: (section: string) => void
  sidebarCollapsed: boolean
  onToggleCollapsed: () => void
  sidebarWidth: number
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleNavKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextIndex = getNextSidebarIndex(event.key, index, items.length)
    if (nextIndex == null) {
      return
    }

    event.preventDefault()
    const target = items[nextIndex]
    if (!target) {
      return
    }
    onSectionChange(target.id)
    buttonRefs.current[nextIndex]?.focus()
  }

  return (
    <aside
      className="relative h-full bg-background border-r border-border/40 transition-all duration-200"
      style={{ width: `${sidebarWidth}px` }}
    >
      <AppTooltip
        side="right"
        content={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute left-full top-6 z-20 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full bg-muted/40 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </AppTooltip>

      <div className="flex h-full flex-col">
        <div className={`flex flex-col items-center ${sidebarCollapsed ? 'pt-4 pb-3' : 'pt-5 pb-3'}`}>
          <span className="grid shrink-0 place-items-center text-foreground">
            <AppMonogramIcon className={sidebarCollapsed ? 'h-12 w-12' : 'h-24 w-24'} />
          </span>
          {!sidebarCollapsed && (
            <span className="text-[15px] font-black tracking-tight leading-none -mt-1">Orchestra</span>
          )}
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-3 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          <nav className="flex flex-col gap-1.5" aria-label="Primary navigation">
            {items.map((item, index) => {
              const ItemIcon = item.icon
              const active = activeSection === item.id
              return (
                <AppTooltip
                  key={item.id}
                  side="right"
                  content={<NavTooltipContent label={item.label} description={item.description} />}
                >
                  <button
                    type="button"
                    ref={(node) => {
                      buttonRefs.current[index] = node
                    }}
                    onClick={() => onSectionChange(item.id)}
                    onKeyDown={handleNavKeyDown(index)}
                    aria-current={active ? 'page' : undefined}
                    data-testid={`sidebar-nav-${item.id}`}
                    className={`group relative flex w-full items-center text-left rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      sidebarCollapsed ? 'justify-center h-12 w-12 mx-auto' : 'gap-3 px-2.5 h-12'
                    } ${active
                      ? 'bg-gradient-to-r from-primary/[0.22] via-primary/[0.12] to-primary/[0.04] text-foreground shadow-[inset_0_0_0_1px] shadow-primary/20 ring-1 ring-primary/10'
                      : 'text-muted-foreground/85 hover:text-foreground hover:bg-foreground/[0.05] hover:shadow-[inset_0_0_0_1px] hover:shadow-foreground/[0.06]'
                    }`}
                  >
                    {!sidebarCollapsed && active && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary shadow-[0_0_10px] shadow-primary/70" />
                    )}
                    <span
                      className={`relative grid place-items-center shrink-0 transition-all duration-200 h-9 w-9 rounded-lg ${
                        active
                          ? 'bg-primary/20 text-primary ring-1 ring-primary/25 shadow-[0_0_12px_-2px] shadow-primary/40'
                          : 'text-muted-foreground/75 bg-foreground/[0.02] group-hover:bg-foreground/[0.06] group-hover:text-foreground ring-1 ring-transparent group-hover:ring-foreground/[0.06]'
                      }`}
                    >
                      <ItemIcon
                        className="h-[17px] w-[17px]"
                        strokeWidth={active ? 2.4 : 1.9}
                      />
                    </span>
                    {!sidebarCollapsed && (
                      <span className={`truncate text-[13px] tracking-tight transition-all ${active ? 'font-bold' : 'font-medium'}`}>
                        {item.label}
                      </span>
                    )}
                    {!sidebarCollapsed && active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/60" />
                    )}
                  </button>
                </AppTooltip>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}

const NavTooltipContent = memo(function NavTooltipContent({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground">{label}</span>
      <span className="text-[8px] font-bold text-muted-foreground/70 normal-case tracking-normal">{description}</span>
    </div>
  )
})

function AppMonogramIcon({ className }: { className?: string }) {
  return (
    <img
      src="/Orchesta.png"
      alt="Orchestra"
      className={`${className ?? ''} dark:invert`}
      aria-hidden="true"
    />
  )
}
