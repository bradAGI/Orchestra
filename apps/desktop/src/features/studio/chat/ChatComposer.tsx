import { useState } from 'react'

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void
  disabled?: boolean
}) {
  const [text, setText] = useState('')

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="border-t border-white/10 p-3 flex gap-2 items-end">
      <textarea
        rows={2}
        className="flex-1 bg-transparent border border-white/20 rounded p-2 outline-none focus:border-white/60 resize-none text-sm"
        placeholder="Describe what you want to task out…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="px-3 py-2 bg-sky-500 text-black rounded text-sm disabled:opacity-40"
      >
        Send
      </button>
    </div>
  )
}
