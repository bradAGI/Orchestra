import { useState } from 'react'
import { ChevronDown, ChevronRight, Zap, Check, AlertTriangle } from 'lucide-react'
import type { ToolCallInfo, ToolResultInfo } from '../lib/types'

interface ToolFeedbackProps {
  toolCalls: ToolCallInfo[]
  toolResults: ToolResultInfo[]
}

export function ToolFeedback({ toolCalls, toolResults }: ToolFeedbackProps) {
  const [expanded, setExpanded] = useState(false)

  if (toolCalls.length === 0) return null

  const resultsByName = new Map(
    toolResults.map((r) => [r.toolName, r]),
  )
  const hasErrors = toolResults.some((r) => r.isError)

  return (
    <div className="rounded-xl border border-border/20 bg-background/30 text-[10px] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <Zap className="h-3 w-3 shrink-0 text-primary/60" />
        <span className="font-bold uppercase tracking-wider">
          {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''} used
        </span>
        {!hasErrors && toolResults.length > 0 && (
          <Check className="h-3 w-3 shrink-0 text-emerald-500" />
        )}
        {hasErrors && (
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
        )}
      </button>

      {expanded && (
        <div className="space-y-px border-t border-border/20">
          {toolCalls.map((call, i) => {
            const result = resultsByName.get(call.toolName)
            return (
              <div key={i} className="px-3 py-2 transition-colors hover:bg-muted/10">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold font-mono text-foreground/80">{call.toolName}</span>
                  {result && !result.isError && (
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-500">ok</span>
                  )}
                  {result?.isError && (
                    <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-red-500">error</span>
                  )}
                </div>
                {Object.keys(call.args).length > 0 && (
                  <pre className="mt-1 overflow-x-auto rounded-md bg-muted/20 p-1.5 font-mono text-muted-foreground/70 max-h-[60px]">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                )}
                {result && (
                  <pre
                    className={`mt-1 overflow-x-auto rounded-md p-1.5 font-mono max-h-[60px] ${
                      result.isError
                        ? 'bg-red-500/5 text-red-400'
                        : 'bg-emerald-500/5 text-emerald-400/70'
                    }`}
                  >
                    {typeof result.result === 'string'
                      ? result.result
                      : JSON.stringify(result.result, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
