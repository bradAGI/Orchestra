// apps/desktop/src/widgets/agents/ProviderHeader.tsx
import type { ProviderPermissions, ProviderModelConfig } from '@/lib/orchestra-client'
import type { Project } from '@/lib/orchestra-types'
import { CustomDropdown } from '@/components/app-shell/shared/controls'
import { Folder } from 'lucide-react'
import { MODELS_BY_PROVIDER, EFFORT_LEVELS } from './constants'
import type { Provider, Scope } from './types'

interface ProviderHeaderProps {
  provider: Provider
  modelConfig: ProviderModelConfig
  permissions: ProviderPermissions
  scope: Scope
  projectId: string
  projects: Project[]
  onModelChange: (model: ProviderModelConfig) => void
  onPermissionsChange: (perms: ProviderPermissions) => void
  onScopeChange: (scope: Scope, projectId: string) => void
}

export function ProviderHeader({
  provider, modelConfig, permissions, scope, projectId, projects,
  onModelChange, onPermissionsChange, onScopeChange,
}: ProviderHeaderProps) {
  const models = MODELS_BY_PROVIDER[provider] ?? []
  const efforts = EFFORT_LEVELS[provider] ?? []

  const scopeOptions = [
    { label: 'Global', value: 'GLOBAL', icon: <Folder size={10} className="text-muted-foreground/50" /> },
    ...projects.map(p => ({ label: p.name, value: p.id, icon: <Folder size={10} className="text-primary/60" /> })),
  ]

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border/20 bg-card/20">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 shrink-0">Model</label>
        <CustomDropdown
          className="min-w-[140px]"
          value={modelConfig.model}
          options={models}
          onChange={(val) => onModelChange({ ...modelConfig, model: val })}
          placeholder="Select model"
        />

        {efforts.length > 0 && (
          <>
            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 shrink-0 ml-2">Effort</label>
            <div className="flex items-center gap-0.5">
              {efforts.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onModelChange({ ...modelConfig, effort: level })}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                    modelConfig.effort === level
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 border border-transparent'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </>
        )}


      </div>

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
