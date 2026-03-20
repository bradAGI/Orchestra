import { useState, useRef, useCallback } from 'react'
import { Mic, Loader2 } from 'lucide-react'

interface VoiceInputProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

type VoiceState = 'idle' | 'recording' | 'processing'

export function VoiceInput({ onTranscription, disabled }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const clientRef = useRef<ReturnType<typeof import('@/lib/whisper-client').getWhisperClient> | null>(null)

  const getClient = useCallback(async () => {
    if (!clientRef.current) {
      const { getWhisperClient } = await import('@/lib/whisper-client')
      clientRef.current = getWhisperClient()
    }
    return clientRef.current
  }, [])

  const handlePointerDown = useCallback(async (e: React.PointerEvent) => {
    e.preventDefault() // Prevent textarea from stealing focus
    e.stopPropagation()
    if (disabled || state !== 'idle') return
    try {
      const client = await getClient()
      await client.startRecording()
      setState('recording')
    } catch (err) {
      console.error('[VoiceInput] Failed to start recording:', err)
      setState('idle')
    }
  }, [disabled, state, getClient])

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (state !== 'recording') return
    setState('processing')
    try {
      const client = await getClient()
      const audio = await client.stopRecording()
      if (audio.length > 0) {
        const text = await client.transcribe(audio)
        if (text.trim()) {
          onTranscription(text.trim())
        }
      }
    } catch (err) {
      console.error('[VoiceInput] Transcription failed:', err)
    } finally {
      setState('idle')
    }
  }, [state, onTranscription, getClient])

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled || state === 'processing'}
      style={{ touchAction: 'none' }}
      className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
        state === 'recording'
          ? 'animate-pulse bg-red-500/20 text-red-500'
          : state === 'processing'
            ? 'bg-muted/30 text-muted-foreground'
            : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/20'
      } disabled:opacity-30`}
      aria-label={
        state === 'recording'
          ? 'Recording — release to transcribe'
          : state === 'processing'
            ? 'Transcribing...'
            : 'Hold to talk'
      }
      title={state === 'idle' ? 'Hold to talk' : undefined}
    >
      {state === 'processing' ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Mic className={`size-3.5 ${state === 'recording' ? 'scale-110' : ''} transition-transform`} />
      )}
    </button>
  )
}
