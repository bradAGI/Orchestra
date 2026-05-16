import type { StudioDraft } from '@core/api/client'
import { AcceptanceCriteria } from './fields/AcceptanceCriteria'
import { AgentGuidance } from './fields/AgentGuidance'
import { Attachments } from './fields/Attachments'
import { BasicsFields } from './fields/BasicsFields'
import { ProviderPicker } from './fields/ProviderPicker'
import { TemplatePicker } from './fields/TemplatePicker'

export interface DraftPanelProps {
  draft: StudioDraft
  onChange: (patch: Partial<StudioDraft>) => void
  onPush: () => void
  onDiscard: () => void
  onBrowseTemplates?: () => void
  pushing?: boolean
  pushDisabledReason?: string
}

export function DraftPanel({ draft, onChange, onPush, onDiscard, onBrowseTemplates, pushing, pushDisabledReason }: DraftPanelProps) {
  return (
    <div className="h-full flex flex-col border-l border-white/10">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <h2 className="text-sm font-medium">Task draft</h2>
        <TemplatePicker draft={draft} onChange={onChange} onBrowse={onBrowseTemplates} />
        <button type="button" onClick={onDiscard} className="ml-auto text-xs opacity-60 hover:opacity-100">
          Discard
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        <BasicsFields draft={draft} onChange={onChange} />
        <AcceptanceCriteria draft={draft} onChange={onChange} />
        <Attachments draft={draft} onChange={onChange} />
        <ProviderPicker draft={draft} onChange={onChange} />
        <AgentGuidance draft={draft} onChange={onChange} />
      </div>
      <div className="px-4 py-3 border-t border-white/10 flex flex-col gap-1">
        {pushDisabledReason && <div className="text-xs text-yellow-400">{pushDisabledReason}</div>}
        <button
          type="button"
          onClick={onPush}
          disabled={pushing || !!pushDisabledReason}
          className="w-full py-2 rounded bg-sky-500 text-black font-medium hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pushing ? 'Pushing…' : '→ Push to backlog'}
        </button>
      </div>
    </div>
  )
}
