import { useState, useRef, useCallback } from 'react'
import { Mic, Loader2 } from 'lucide-react'
import { getWhisperClient } from '@/lib/whisper-client'

interface VoiceInputProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

type VoiceState = 'idle' | 'recording' | 'processing'

export function VoiceInput({ onTranscription, disabled }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const clientRef = useRef(getWhisperClient())

  const handlePointerDown = useCallback(async () => {
    if (disabled || state !== 'idle') return
    try {
      setState('recording')
      await clientRef.current.startRecording()
    } catch (err) {
      console.error('[VoiceInput] Failed to start recording:', err)
      setState('idle')
    }
  }, [disabled, state])

  const handlePointerUp = useCallback(async () => {
    if (state !== 'recording') return
    try {
      setState('processing')
      const audio = await clientRef.current.stopRecording()
      if (audio.length > 0) {
        const text = await clientRef.current.transcribe(audio)
        if (text.trim()) {
          onTranscription(text.trim())
        }
      }
    } catch (err) {
      console.error('[VoiceInput] Transcription failed:', err)
    } finally {
      setState('idle')
    }
  }, [state, onTranscription])

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled || state === 'processing'}
      className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
        state === 'recording'
          ? 'animate-pulse bg-red-500/20 text-red-500'
          : state === 'processing'
            ? 'bg-muted/30 text-muted-foreground'
            : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/20'
      } disabled:opacity-30`}
      aria-label={
        state === 'recording'
          ? 'Recording...'
          : state === 'processing'
            ? 'Processing...'
            : 'Hold to talk'
      }
    >
      {state === 'processing' ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Mic className="size-3.5" />
      )}
    </button>
  )
}
