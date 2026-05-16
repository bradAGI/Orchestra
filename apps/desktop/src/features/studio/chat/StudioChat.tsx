import { useEffect, useRef } from 'react'
import { ChatComposer } from './ChatComposer'
import type { ChatMessage } from './useStudioSession'

export function StudioChat({
  messages,
  onSend,
  sendDisabled,
  runner,
}: {
  messages: ChatMessage[]
  onSend: (text: string) => void
  sendDisabled?: boolean
  runner: string
}) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <h2 className="text-sm font-medium">Studio</h2>
        <span className="text-xs opacity-60">via {runner}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm opacity-60">
            Tell the agent what task you want to author. It can read your repo while it helps.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            {m.tool ? (
              <div className="inline-block text-xs bg-white/5 border border-white/10 rounded px-2 py-1">
                <span className="opacity-60">tool:</span> {m.tool.name}
              </div>
            ) : (
              <div
                className={`inline-block max-w-[80%] rounded p-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-sky-600/20' : 'bg-white/5'
                }`}
              >
                {m.text}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <ChatComposer onSend={onSend} disabled={sendDisabled} />
    </div>
  )
}
