import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Moon, Search, Settings2, Sun, Download, AlertTriangle, RefreshCcw } from 'lucide-react'
import { AppTooltip } from '@ui/tooltip-wrapper'
import { periodFilters } from '@layout/types'
import { usePlatform } from '@/hooks/use-platform'
import type { IssueListItem } from '@core/api/client'

export function TopBar({
  sectionLabel: _sectionLabel,
  sectionTitle,
  theme,
  setTheme,
  activePeriod: _activePeriod,
  setActivePeriod: _setActivePeriod,
  refreshPending,
  configReady: _configReady,
  onOpenSettings,
  onRefresh,
  onSearch,
  onResultClick,
  statusMessage,
  errorMessage,
  generatedAt,
  usePolling,
  onDownloadDiagnostics,
  onTogglePolling,
  flush,
}: {
  sectionLabel: string
  sectionTitle: string
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  activePeriod: (typeof periodFilters)[number]
  setActivePeriod: (period: (typeof periodFilters)[number]) => void
  refreshPending: boolean
  configReady: boolean
  onOpenSettings: () => void
  onRefresh: () => Promise<void>
  onSearch?: (query: string) => Promise<IssueListItem[]>
  onResultClick?: (issueIdentifier: string) => void
  statusMessage?: string
  errorMessage?: string
  generatedAt?: string
  usePolling?: boolean
  onDownloadDiagnostics?: () => void
  onTogglePolling?: () => void
  flush?: boolean
}) {
  const { isMac } = usePlatform()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<IssueListItem[]>([])
  const [searchPending, setSearchPending] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        searchRef.current && !searchRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2 && onSearch) {
        setSearchPending(true)
        try {
          const results = await onSearch(searchQuery)
          setSearchResults(results)
          setShowResults(true)
        } catch {
          setSearchResults([])
        } finally {
          setSearchPending(false)
        }
      } else {
        setSearchResults([])
        setShowResults(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, onSearch])

  return (
    <div className={flush ? 'space-y-2' : 'mb-4 space-y-2'}>
      <header className="flex h-14 w-full items-center justify-between bg-background/80 px-4 backdrop-blur-xl transition-all duration-300">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="shrink-0 flex flex-col justify-center">
            <h1 className="text-base font-black tracking-tight text-foreground leading-none">{sectionTitle}</h1>
            <div className="flex items-center gap-2 mt-1">
              {generatedAt && (
                <AppTooltip content="Snapshot timestamp">
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {generatedAt}
                  </span>
                </AppTooltip>
              )}
            </div>
          </div>

          <div className="flex-1 flex items-center px-4 overflow-hidden min-w-0">
            {errorMessage && (
              <div className="flex items-center gap-2.5 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-red-500 animate-in fade-in slide-in-from-left-2 duration-500 shadow-sm truncate" role="alert" aria-live="assertive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="truncate tracking-tight">{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <div className="relative group" ref={searchRef}>
            <div
              className="flex h-8 min-w-[220px] items-center gap-2 rounded-xl bg-muted/30 px-3 text-muted-foreground border border-border/50 shadow-inner transition-all duration-300 focus-within:bg-background focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10"
              role="search"
            >
              {searchPending ? <Loader2 className="h-3.5 w-3.5 animate-spin-smooth text-primary" /> : <Search className="h-3.5 w-3.5 group-focus-within:text-primary transition-colors" />}
              <input
                ref={searchInputRef}
                type="text"
                className="w-full bg-transparent text-[11px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim().length >= 2 && setShowResults(true)}
              />
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-muted border border-border/50 px-1.5 font-mono text-[9px] font-black text-muted-foreground/60 shadow-sm uppercase">
                <span className="text-[10px]">{isMac ? '⌘' : 'Ctrl'}</span>K
              </kbd>
            </div>

            {showResults && searchResults.length > 0 && createPortal(
              <div
                ref={dropdownRef}
                className="fixed overflow-hidden rounded-xl border border-border text-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                style={{
                  backgroundColor: 'hsl(160, 10%, 9%)',
                  top: (searchRef.current?.getBoundingClientRect().bottom ?? 50) + 4,
                  left: searchRef.current?.getBoundingClientRect().left ?? 0,
                  width: searchRef.current?.getBoundingClientRect().width ?? 340,
                  zIndex: 99999,
                }}
              >
                <div className="px-3 py-2 border-b border-border/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="max-h-[300px] overflow-auto py-1">
                  {searchResults.map((result, idx) => (
                    <button
                      key={result.id ?? result.issue_id ?? result.identifier ?? result.issue_identifier ?? `result-${idx}`}
                      className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-border/30 last:border-0"
                      onClick={() => {
                        const issueIdentifier = result.identifier ?? result.issue_identifier
                        if (issueIdentifier) {
                          onResultClick?.(issueIdentifier)
                        }
                        setShowResults(false)
                        setSearchQuery('')
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-primary">{result.identifier ?? result.issue_identifier ?? 'n/a'}</span>
                        <span className="truncate text-xs font-medium text-foreground">{result.title ?? 'Untitled issue'}</span>
                      </div>
                      <span className="truncate text-[10px] text-muted-foreground/60">{result.state}</span>
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>

          <div className="flex items-center gap-1 border-l border-border/50 pl-2 ml-1">
            {onDownloadDiagnostics && (
              <IconButton icon={<Download className="h-3.5 w-3.5" />} title="System Diagnostics" onClick={onDownloadDiagnostics} />
            )}
            <IconButton icon={<Settings2 className="h-3.5 w-3.5" />} title="Control Plane Settings" onClick={onOpenSettings} />
            <IconButton
              icon={theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            />
            <IconButton
              icon={refreshPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin-smooth" />
                : <RefreshCcw className="h-3.5 w-3.5" />}
              title={refreshPending ? 'Syncing…' : 'Refresh'}
              onClick={onRefresh}
            />
          </div>
        </div>
      </header>
    </div>
  )
}

function IconButton({ icon, title, onClick }: { icon: ReactNode; title: string; onClick?: () => void }) {
  return (
    <AppTooltip content={title}>
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        className="grid h-7 w-7 place-items-center rounded-md bg-transparent text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        {icon}
      </button>
    </AppTooltip>
  )
}
