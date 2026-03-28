import React, { useMemo, useState } from 'react'
import { Eye, RefreshCcw, History as HistoryIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { ChartCard } from '../ChartCard'
import type { SessionSummary } from '@/lib/orchestra-types'

type SortKey = 'updated_at' | 'tokens' | 'cost'

interface RecentSessionsTableProps {
  sessions: SessionSummary[]
  onInspectSession?: (sessionId: string) => void
  onCloneSession?: (session: SessionSummary) => void
}

export const RecentSessionsTable: React.FC<RecentSessionsTableProps> = ({
  sessions,
  onInspectSession,
  onCloneSession,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...sessions]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'updated_at') {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      } else if (sortKey === 'tokens') {
        cmp = (a.total_input + a.total_output) - (b.total_input + b.total_output)
      } else {
        // cost approximation by tokens
        cmp = (a.total_input + a.total_output) - (b.total_input + b.total_output)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [sessions, sortKey, sortDir])

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  return (
    <ChartCard title="" className="p-0">
      <div className="p-4 border-b border-border/40 flex items-center justify-between bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <HistoryIcon size={16} />
          </div>
          <h3 className="text-base font-black tracking-tight uppercase">Session Archive</h3>
        </div>
        <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-muted text-muted-foreground border-transparent px-2">
          Last {sessions.length} sessions
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/20 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 border-b border-border/40">
              <th className="px-5 py-3.5">Session ID</th>
              <th className="px-5 py-3.5">Provider</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right cursor-pointer select-none" onClick={() => handleSort('tokens')}>
                Tokens{sortIndicator('tokens')}
              </th>
              <th className="px-5 py-3.5 text-right cursor-pointer select-none" onClick={() => handleSort('cost')}>
                Est. Cost{sortIndicator('cost')}
              </th>
              <th className="px-5 py-3.5 text-right cursor-pointer select-none" onClick={() => handleSort('updated_at')}>
                Date{sortIndicator('updated_at')}
              </th>
              <th className="px-5 py-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {sorted.map((session) => {
              const totalTokens = session.total_input + session.total_output
              // Rough cost estimate: ~$3/MTok average
              const roughCost = totalTokens / 1_000_000 * 3
              return (
                <tr key={session.id} className="hover:bg-primary/[0.03] transition-all group/row">
                  <td className="px-5 py-4">
                    <span className="font-mono text-[11px] font-black text-foreground/90">
                      {session.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-bold text-foreground/70">
                      {session.provider || '--'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="outline" className="text-[9px] font-black uppercase">
                      {(session as Record<string, unknown>).status as string || 'completed'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs font-black tabular-nums">
                    {totalTokens.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-[11px] font-mono font-black text-primary tabular-nums">
                      ${roughCost.toFixed(4)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-[10px] font-bold text-muted-foreground/60 tabular-nums">
                    {new Date(session.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {onCloneSession && (
                        <AppTooltip content="Clone session">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-xl opacity-0 group-hover/row:opacity-100 transition-all hover:bg-amber-500/10"
                            onClick={() => onCloneSession(session)}
                          >
                            <RefreshCcw size={14} className="text-amber-500" strokeWidth={2.5} />
                          </Button>
                        </AppTooltip>
                      )}
                      <AppTooltip content="Inspect session">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-xl opacity-0 group-hover/row:opacity-100 transition-all hover:bg-primary/10"
                          onClick={() => onInspectSession?.(session.id)}
                        >
                          <Eye size={14} className="text-primary" strokeWidth={2.5} />
                        </Button>
                      </AppTooltip>
                    </div>
                  </td>
                </tr>
              )
            })}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic text-xs uppercase tracking-widest font-black opacity-20">
                  No historical session telemetry indexed
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
