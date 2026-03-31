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
      className="relative h-full border-r border-border bg-card shadow-[10px_0_40px_rgba(0,0,0,0.04)] transition-all duration-300 dark:border-border dark:bg-card dark:shadow-[10px_0_40px_rgba(0,0,0,0.2)]"
      style={{ width: `${sidebarWidth}px` }}
    >
      <AppTooltip 
        side="right" 
        content={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute left-full top-6 z-20 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:bg-muted dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </AppTooltip>

      <div className="flex h-full flex-col">
        <div className="mb-1 flex justify-center pt-2">
          <div className="flex flex-col items-center">
            <span className="grid h-28 w-28 shrink-0 place-items-center text-foreground">
              <AppMonogramIcon className="h-24 w-24" />
            </span>
            {!sidebarCollapsed ? (
              <div className="min-w-0 -mt-3">
                <p className="truncate text-xl font-black uppercase tracking-[0.15em] text-foreground dark:text-muted-foreground leading-none">Orchestra</p>
              </div>
            ) : null}
          </div>
        </div>

        <OverlayScrollbarsComponent
          element="div"
          options={osOptions}
          className="flex-1 px-2 pt-6 min-h-0"
        >
          <nav className="space-y-1.5" aria-label="Primary navigation">
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
                    className={`group relative flex w-full items-center gap-3.5 rounded-xl border text-left transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-2 py-4' : 'px-4 py-4'
                      } ${active
                        ? 'border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]'
                        : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                  >
                    {active ? <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" /> : null}
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all duration-300 ${
                      active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                    }`}>
                      <ItemIcon className="h-4 w-4" />
                    </span>
                    {!sidebarCollapsed ? (
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-base font-bold tracking-tight ${active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>{item.label}</span>
                        <span className="block truncate text-xs text-muted-foreground/60 leading-tight font-medium">{item.description}</span>
                      </span>
                    ) : null}
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
