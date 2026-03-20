import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface VoiceInputProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

type VoiceState = 'idle' | 'recording' | 'processing'

export function VoiceInput({ onTranscription, disabled }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const clientRef = useRef<import('@/lib/whisper-client').WhisperClient | null>(null)

  const getClient = useCallback(async (): Promise<import('@/lib/whisper-client').WhisperClient> => {
    if (!clientRef.current) {
      const { createWhisperClient } = await import('@/lib/whisper-client')
      clientRef.current = createWhisperClient()
    }
    return clientRef.current
  }, [])

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (disabled) return

    if (state === 'idle') {
      // Start recording
      try {
        const client = await getClient()
        await client.startRecording()
        setState('recording')
      } catch (err) {
        console.error('[VoiceInput] Failed to start recording:', err)
        setState('idle')
      }
    } else if (state === 'recording') {
      // Stop recording and transcribe
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
    }
  }, [disabled, state, getClient, onTranscription])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'processing'}
      className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
        state === 'recording'
          ? 'bg-red-500/20 text-red-500'
          : state === 'processing'
            ? 'bg-muted/30 text-muted-foreground'
            : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/20'
      } disabled:opacity-30`}
      aria-label={
        state === 'recording'
          ? 'Click to stop recording'
          : state === 'processing'
            ? 'Transcribing...'
            : 'Click to record'
      }
      title={
        state === 'recording'
          ? 'Click to stop'
          : state === 'processing'
            ? 'Transcribing...'
            : 'Voice input'
      }
    >
      {state === 'processing' ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : state === 'recording' ? (
        <MicOff className="size-3.5 animate-pulse" />
      ) : (
        <Mic className="size-3.5" />
      )}
    </button>
  )
}
