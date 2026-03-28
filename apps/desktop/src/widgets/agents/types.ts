import type { AgentConfig } from '@/lib/orchestra-types'
import type { ProviderPermissions, ProviderModelConfig, ProviderHook } from '@/lib/orchestra-client'

export type Provider = 'claude' | 'codex' | 'gemini' | 'opencode'
export type CategoryId = 'instructions' | 'skills' | 'hooks' | 'mcp' | 'rules' | 'agents'
export type Scope = 'GLOBAL' | 'PROJECT'

export interface CategoryDef {
  id: CategoryId
  label: string
  icon: string
  pinned?: boolean
}

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
