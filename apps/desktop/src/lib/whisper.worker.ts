/// <reference lib="webworker" />

import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import type { WhisperWorkerRequest, WhisperWorkerResponse } from './whisper-types'

const MODEL_ID = 'onnx-community/whisper-tiny'

let transcriber: AutomaticSpeechRecognitionPipeline | null = null

function post(msg: WhisperWorkerResponse): void {
  self.postMessage(msg)
}

async function detectDevice(): Promise<'webgpu' | 'wasm'> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
    if (gpu) {
      const adapter = await gpu.requestAdapter()
      if (adapter) return 'webgpu'
    }
  } catch {
    // WebGPU not available
  }
  return 'wasm'
}

async function ensurePipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (transcriber) return transcriber

  post({ type: 'status', status: 'loading', progress: 0 })

  const device = await detectDevice()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transcriber = (await (pipeline as any)('automatic-speech-recognition', MODEL_ID, {
    dtype: device === 'webgpu' ? 'fp32' : 'q8',
    device,
    progress_callback: (progress: Record<string, unknown>) => {
      if (typeof progress.progress === 'number') {
        post({ type: 'status', status: 'loading', progress: Math.round(progress.progress) })
      }
    },
  })) as AutomaticSpeechRecognitionPipeline

  return transcriber
}

self.onmessage = async (event: MessageEvent<WhisperWorkerRequest>) => {
  const { type, audio } = event.data
  if (type !== 'transcribe') return

  try {
    const pipe = await ensurePipeline()
    post({ type: 'status', status: 'transcribing' })

    const result = await pipe(audio, {
      language: 'en',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    })

    const text = Array.isArray(result) ? result.map((r) => r.text).join(' ') : result.text
    post({ type: 'result', text: text.trim() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Whisper inference failed'
    post({ type: 'error', message })
  }
}
