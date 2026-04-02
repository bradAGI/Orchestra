// apps/desktop/src/widgets/agents/ProviderHeader.tsx
import type { Project } from '@/lib/orchestra-types'
import { getAgentIcon } from '@/components/app-shell/shared/controls'
import { CustomDropdown } from '@/components/app-shell/shared/controls'
import { Folder } from 'lucide-react'
import { AppTooltip } from '@/components/ui/tooltip-wrapper'
import { PROVIDERS } from './constants'
import type { Provider, Scope } from './types'

interface ProviderHeaderProps {
  provider: Provider
  onProviderChange: (provider: Provider) => void
  scope: Scope
  projectId: string
  projects: Project[]
  onScopeChange: (scope: Scope, projectId: string) => void
}

export function ProviderHeader({
  provider, onProviderChange,
  scope, projectId, projects, onScopeChange,
}: ProviderHeaderProps) {
  const scopeOptions = [
    { label: 'Global', value: 'GLOBAL', icon: <Folder size={10} className="text-muted-foreground/50" /> },
    ...projects.map(p => ({ label: p.name, value: p.id, icon: <Folder size={10} className="text-primary/60" /> })),
  ]

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/20 bg-card/20">
      {/* Provider tabs */}
      <div className="flex items-center gap-1">
        {PROVIDERS.map(({ id, label, description }) => {
          const isSelected = provider === id
          return (
            <AppTooltip key={id} content={<div className="flex flex-col gap-0.5"><span>{label}</span><span className="text-[8px] font-bold text-muted-foreground/70 normal-case tracking-normal">{description}</span></div>} side="bottom">
              <button
                type="button"
                onClick={() => onProviderChange(id)}
                className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  isSelected
                    ? 'bg-primary/15 border border-primary/30'
                    : 'border border-transparent hover:bg-muted/30 hover:border-border/20'
                }`}
                aria-label={label}
                aria-pressed={isSelected}
              >
                {getAgentIcon(id, 18)}
              </button>
            </AppTooltip>
          )
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Scope dropdown */}
      <CustomDropdown
        className="min-w-[130px] shrink-0"
        value={scope === 'GLOBAL' ? 'GLOBAL' : projectId}
        options={scopeOptions}
        onChange={(val) => {
          if (val === 'GLOBAL') onScopeChange('GLOBAL', '')
          else onScopeChange('PROJECT', val)
        }}
        placeholder="Scope"
      />
    </div>
  )
}
