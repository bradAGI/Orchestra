import type { LucideIcon } from 'lucide-react'
import type { AgentConfig } from '@/lib/orchestra-types'
import type { ProviderPermissions, ProviderModelConfig, ProviderHook } from '@/lib/orchestra-client'

export type Provider = 'claude' | 'codex' | 'gemini' | 'opencode'
export type CategoryId =
  | 'settings'
  | 'config'
  | 'instructions'
  | 'context'
  | 'agents'
  | 'skills'
  | 'hooks'
  | 'mcp'
  | 'rules'
  | 'commands'
  | 'permissions'
export type Scope = 'GLOBAL' | 'PROJECT'

export interface CategoryDef {
  id: CategoryId
  label: string
  icon: LucideIcon | string
  pinned?: boolean
}

// Legacy PanelProps for non-Claude providers
export interface PanelProps {
  items: AgentConfig[]
  selectedItem: string | null
  onSelectItem: (path: string | null) => void
  onSave: (path: string, content: string) => Promise<void>
  onDelete: (path: string) => Promise<void>
  onCreate: (name: string, content?: string) => Promise<void>
  loading: boolean
  saving: string | null
  provider: Provider
}
