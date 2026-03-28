// apps/desktop/src/widgets/agents/panels/MCPPanel.tsx
import { useState } from 'react'
import { Plus, Trash2, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { MCPServer, ProviderMCPServer } from '@/lib/orchestra-client'
import type { Provider } from '../types'

interface MCPPanelProps {
  providerServers: ProviderMCPServer[]
  orchestraServers: MCPServer[]
  onAddProvider: (name: string, command: string) => Promise<void>
  onDeleteProvider: (name: string) => Promise<void>
  onDeleteOrchestra: (name: string) => Promise<void>
  loading: boolean
  saving: string | null
  provider: Provider
}

export function MCPPanel({ providerServers, orchestraServers, onAddProvider, onDeleteProvider, onDeleteOrchestra, loading, saving, provider }: MCPPanelProps) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-[200px] w-full" /></div>
  }

  const total = providerServers.length + orchestraServers.length

  const handleAdd = async () => {
    if (!name.trim() || !command.trim()) return
    await onAddProvider(name.trim(), command.trim())
    setName('')
    setCommand('')
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div>
        <h3 className="text-sm font-bold">MCP Servers</h3>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{total} server{total !== 1 ? 's' : ''} connected</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {total === 0 && <p className="text-[10px] text-muted-foreground/20 py-4 text-center">No MCP servers configured</p>}

        {providerServers.map(s => (
          <div key={s.name} className="flex items-center gap-2 group rounded-lg border border-border/20 px-3 py-2.5">
            <Server size={12} className="text-primary/50 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{s.name}</p>
              <p className="text-[10px] text-muted-foreground/40 font-mono truncate">{s.command}</p>
            </div>
            <Badge variant="outline" className="text-[8px] font-bold uppercase shrink-0">{provider}</Badge>
            <button onClick={() => onDeleteProvider(s.name)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
              <Trash2 size={10} />
            </button>
          </div>
        ))}

        {orchestraServers.map(s => (
          <div key={s.name} className="flex items-center gap-2 group rounded-lg border border-border/20 px-3 py-2.5">
            <Server size={12} className="text-muted-foreground/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{s.name}</p>
              <p className="text-[10px] text-muted-foreground/40 font-mono truncate">{s.command}</p>
            </div>
            <Badge variant="outline" className="text-[8px] font-bold uppercase shrink-0">orchestra</Badge>
            <button onClick={() => onDeleteOrchestra(s.name)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="shrink-0 flex items-center gap-2 border-t border-border/20 pt-3">
        <input className="h-8 w-[140px] rounded-lg border border-border bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20 outline-none" value={name} onChange={e => setName(e.target.value)} placeholder="Server name" />
        <input className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none" value={command} onChange={e => setCommand(e.target.value)} placeholder="npx -y @org/server" />
        <Button size="sm" variant="outline" className="h-8 text-[9px] font-bold uppercase" disabled={!name.trim() || !command.trim() || saving === 'mcp'} onClick={handleAdd}>
          <Plus size={10} className="mr-1" /> Add
        </Button>
      </div>
    </div>
  )
}
