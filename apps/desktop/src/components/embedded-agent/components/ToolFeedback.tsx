import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
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

  return (
    <div className="mt-1.5 rounded border border-border/50 bg-muted/20 text-[10px]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <Wrench className="size-3 shrink-0" />
        <span>{toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''} called</span>
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-border/30 px-2 py-1.5">
          {toolCalls.map((call, i) => {
            const result = resultsByName.get(call.toolName)
            return (
              <div key={i} className="space-y-0.5">
                <div className="font-medium text-foreground">{call.toolName}</div>
                <pre className="overflow-x-auto font-mono text-muted-foreground">
                  {JSON.stringify(call.args, null, 2)}
                </pre>
                {result && (
                  <pre
                    className={`overflow-x-auto font-mono ${
                      result.isError ? 'text-destructive' : 'text-muted-foreground'
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
