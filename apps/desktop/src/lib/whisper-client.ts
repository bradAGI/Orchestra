import type { BackendConfig } from '@/lib/orchestra-client'
import type { WhisperWorkerResponse, WhisperStatus } from './whisper-types'

export type { WhisperStatus }
export type StatusCallback = (status: WhisperStatus) => void

const WORKLET_URL = new URL('./pcm-processor.worklet.ts', import.meta.url).href

const TRANSCRIPTION_TIMEOUT_MS = 30_000

export interface WhisperClient {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Float32Array>
  transcribe: (audio: Float32Array) => Promise<string>
  preload: () => void
  dispose: () => void
  readonly recording: boolean
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

/** Backend config for STT fallback — set before first use via setWhisperBackendConfig(). */
let _backendConfig: BackendConfig | null = null

export function setWhisperBackendConfig(config: BackendConfig | null): void {
  _backendConfig = config
}

/**
 * Creates a "smart" Whisper client that:
 * 1. Checks if the backend STT endpoint is available
 * 2. If available, records WebM blobs and sends them to the backend
 * 3. Otherwise, falls back to local Web Worker inference
 */
function createSmartWhisperClient(onStatus?: StatusCallback): WhisperClient {
  let worker: Worker | null = null
  let audioCtx: AudioContext | null = null
  let workletNode: AudioWorkletNode | null = null
  let mediaRecorder: MediaRecorder | null = null
  let mediaChunks: Blob[] = []
  let stream: MediaStream | null = null
  let isRecording = false
  let useBackend = false
  let backendChecked = false
  const canUseWorker = typeof Worker !== 'undefined'

  function ensureWorker(): Worker {
    if (!canUseWorker) {
      throw new Error('Web Worker is not available in this environment')
    }
    if (worker) return worker
    worker = new Worker(
      new URL('./whisper.worker.ts', import.meta.url),
      { type: 'module' },
    )
    return worker
  }

  async function checkBackend(): Promise<void> {
    if (backendChecked) return
    backendChecked = true
    if (!_backendConfig) return
    try {
      const { fetchSTTHealth } = await import('@/lib/orchestra-client')
      const health = await fetchSTTHealth(_backendConfig)
      useBackend = health.ready === true
    } catch {
      useBackend = false
    }
  }

  function preload(): void {
    // Kick off backend check
    void checkBackend()
    // Also warm up the local worker pipeline
    if (!canUseWorker) return
    const w = ensureWorker()
    w.postMessage({ type: 'preload' })
  }

  async function startRecording(): Promise<void> {
    if (isRecording) return

    await checkBackend()

    stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    if (useBackend) {
      // Backend path: record as WebM blob via MediaRecorder
      mediaChunks = []
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) mediaChunks.push(e.data)
      }
      mediaRecorder.start()
    } else {
      // Local path: use AudioWorklet for PCM capture
      audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      await audioCtx.audioWorklet.addModule(WORKLET_URL)
      workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor')
      source.connect(workletNode)
      workletNode.connect(audioCtx.destination)
    }

    isRecording = true
  }

  async function stopRecording(): Promise<Float32Array> {
    if (!isRecording) return new Float32Array(0)

    if (useBackend && mediaRecorder) {
      // Backend path: stop MediaRecorder and collect the blob
      return new Promise<Float32Array>((resolve) => {
        mediaRecorder!.onstop = () => {
          const blob = new Blob(mediaChunks, { type: mediaRecorder!.mimeType })
          // Store blob for later transcription — we encode it as a Float32Array wrapper
          // but actually we'll handle the blob in transcribe() via a side channel
          ;(stopRecording as unknown as Record<string, Blob>).__lastBlob = blob
          cleanupStream()
          resolve(new Float32Array(0)) // PCM not needed for backend path
        }
        mediaRecorder!.stop()
      })
    }

    // Local path
    if (!workletNode) {
      cleanupLocal()
      return new Float32Array(0)
    }

    return new Promise<Float32Array>((resolve) => {
      workletNode!.port.onmessage = (event: MessageEvent<{ pcm: Float32Array }>) => {
        resolve(event.data.pcm)
        cleanupLocal()
      }
      workletNode!.port.postMessage({ command: 'flush' })
    })
  }

  function cleanupStream(): void {
    isRecording = false
    if (mediaRecorder) {
      mediaRecorder = null
      mediaChunks = []
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
  }

  function cleanupLocal(): void {
    isRecording = false
    if (workletNode) {
      workletNode.disconnect()
      workletNode = null
    }
    if (audioCtx) {
      void audioCtx.close()
      audioCtx = null
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
  }

  async function transcribeViaBackend(): Promise<string> {
    const blob = (stopRecording as unknown as Record<string, Blob>).__lastBlob
    if (!blob || !_backendConfig) throw new Error('No audio blob or backend config')

    onStatus?.({ state: 'transcribing' })

    const { transcribeAudio } = await import('@/lib/orchestra-client')
    const result = await transcribeAudio(_backendConfig, blob)
    return result.text
  }

  function transcribeViaWorker(audio: Float32Array): Promise<string> {
    const w = ensureWorker()

    return new Promise<string>((resolve, reject) => {
      w.onmessage = (event: MessageEvent<WhisperWorkerResponse>) => {
        const msg = event.data
        switch (msg.type) {
          case 'status':
            onStatus?.(
              msg.status === 'loading'
                ? { state: 'loading', progress: msg.progress }
                : { state: 'transcribing' },
            )
            break
          case 'result':
            onStatus?.({ state: 'idle' })
            resolve(msg.text)
            break
          case 'error':
            onStatus?.({ state: 'idle' })
            reject(new Error(msg.message))
            break
        }
      }

      w.postMessage({ type: 'transcribe', audio }, [audio.buffer])
    })
  }

  async function transcribe(audio: Float32Array): Promise<string> {
    try {
      if (useBackend) {
        return await withTimeout(
          transcribeViaBackend(),
          TRANSCRIPTION_TIMEOUT_MS,
          'Backend STT transcription',
        )
      }
    } catch (err) {
      console.warn('[WhisperClient] Backend STT failed, falling back to local:', err)
      // Fall through to local if backend fails
      if (audio.length === 0) {
        throw new Error('Backend STT failed and no PCM audio available for local fallback')
      }
    }

    return withTimeout(
      transcribeViaWorker(audio),
      TRANSCRIPTION_TIMEOUT_MS,
      'Local Whisper transcription',
    )
  }

  function dispose(): void {
    cleanupStream()
    cleanupLocal()
    if (worker) {
      worker.terminate()
      worker = null
    }
  }

  return {
    startRecording,
    stopRecording,
    transcribe,
    preload,
    dispose,
    get recording() {
      return isRecording
    },
  }
}

let _singleton: WhisperClient | null = null
let _statusCb: StatusCallback | null = null

export function getWhisperClient(onStatus?: StatusCallback): WhisperClient {
  _statusCb = onStatus ?? null
  if (!_singleton) {
    _singleton = createSmartWhisperClient((s) => _statusCb?.(s))
    _singleton.preload()
  }
  return _singleton
}

/** @deprecated Use getWhisperClient() instead — kept for backwards compatibility. */
export function createWhisperClient(onStatus?: StatusCallback): WhisperClient {
  return createSmartWhisperClient(onStatus)
}
