import { memo, useMemo, useRef, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import type { SidebarItem } from '@/components/app-shell/types'
import { getNextSidebarIndex } from '@/lib/navigation'
import { AppTooltip } from '../ui/tooltip-wrapper'

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

  const osOptions = useMemo(() => ({
    scrollbars: { autoHide: 'move' as const, theme: 'os-theme-custom' },
    overflow: { x: 'hidden' as const, y: 'scroll' as const }
  }), [])

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

        <OverlayScrollbarsComponent
          element="div"
          options={osOptions}
          className={`flex-1 min-h-0 pt-4 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}
        >
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
                    className={`group relative flex w-full items-center text-left rounded-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      sidebarCollapsed ? 'justify-center h-11 w-11 mx-auto' : 'gap-3 px-3 h-11'
                    } ${active
                      ? 'bg-foreground/[0.06] text-foreground'
                      : 'text-muted-foreground/80 hover:text-foreground hover:bg-foreground/[0.03]'
                    }`}
                  >
                    {!sidebarCollapsed && active && (
                      <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-primary" />
                    )}
                    <ItemIcon className={`h-[17px] w-[17px] shrink-0 transition-colors ${active ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'}`} strokeWidth={active ? 2.25 : 1.75} />
                    {!sidebarCollapsed && (
                      <span className="truncate text-[13px] font-medium tracking-tight">{item.label}</span>
                    )}
                  </button>
                </AppTooltip>
              )
            })}
          </nav>
        </OverlayScrollbarsComponent>
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
