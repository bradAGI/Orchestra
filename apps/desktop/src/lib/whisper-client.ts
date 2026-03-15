import type { WhisperWorkerResponse, WhisperStatus } from './whisper-types'

export type { WhisperStatus }
export type StatusCallback = (status: WhisperStatus) => void

const WORKLET_URL = new URL('./pcm-processor.worklet.ts', import.meta.url).href

export interface WhisperClient {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Float32Array>
  transcribe: (audio: Float32Array) => Promise<string>
  dispose: () => void
  readonly recording: boolean
}

export function createWhisperClient(onStatus?: StatusCallback): WhisperClient {
  let worker: Worker | null = null
  let audioCtx: AudioContext | null = null
  let workletNode: AudioWorkletNode | null = null
  let stream: MediaStream | null = null
  let isRecording = false

  function ensureWorker(): Worker {
    if (worker) return worker
    worker = new Worker(
      new URL('./whisper.worker.ts', import.meta.url),
      { type: 'module' },
    )
    return worker
  }

  async function startRecording(): Promise<void> {
    if (isRecording) return

    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)

    await audioCtx.audioWorklet.addModule(WORKLET_URL)
    workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor')
    source.connect(workletNode)
    workletNode.connect(audioCtx.destination)

    isRecording = true
  }

  async function stopRecording(): Promise<Float32Array> {
    if (!isRecording || !workletNode) {
      return new Float32Array(0)
    }

    return new Promise<Float32Array>((resolve) => {
      workletNode!.port.onmessage = (event: MessageEvent<{ pcm: Float32Array }>) => {
        resolve(event.data.pcm)
        cleanup()
      }
      workletNode!.port.postMessage({ command: 'flush' })
    })
  }

  function cleanup(): void {
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

  function transcribe(audio: Float32Array): Promise<string> {
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

  function dispose(): void {
    cleanup()
    if (worker) {
      worker.terminate()
      worker = null
    }
  }

  return {
    startRecording,
    stopRecording,
    transcribe,
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
    _singleton = createWhisperClient((s) => _statusCb?.(s))
  }
  return _singleton
}
