// apps/desktop/src/widgets/agents/ProviderTabs.tsx
import React from 'react'
import { getAgentIcon } from '@layout/shared/controls'
import { AppTooltip } from '@ui/tooltip-wrapper'
import { PROVIDERS } from './constants'
import type { Provider } from './types'

interface ProviderTabsProps {
  selected: Provider
  configuredSet: Set<Provider>
  onSelect: (provider: Provider) => void
}

export function ProviderTabs({ selected, configuredSet, onSelect }: ProviderTabsProps) {
  return (
    <div className="flex flex-col items-center gap-1 w-12 shrink-0 border-r border-border/20 bg-card/20 py-3">
      {PROVIDERS.map(({ id, label, description }) => {
        const isSelected = selected === id
        const isConfigured = configuredSet.has(id)

        return (
          <AppTooltip key={id} content={<div className="flex flex-col gap-0.5"><span>{label}</span><span className="text-[8px] font-bold text-muted-foreground/70 normal-case tracking-normal">{description}</span></div>} side="right">
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                isSelected
                  ? 'bg-primary/15 border border-primary/30'
                  : 'border border-transparent hover:bg-muted/30 hover:border-border/20'
              }`}
              aria-label={label}
              aria-pressed={isSelected}
            >
              {getAgentIcon(id, 18)}
              <span
                className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                  isConfigured ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                }`}
              />
            </button>
          </AppTooltip>
        )
      })}
    </div>
  )
}
