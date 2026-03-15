# Whisper STT via Transformers.js — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Web Speech API with in-browser Whisper inference via Transformers.js, giving the "Hold to Talk" button fully offline speech-to-text in Electron.

**Architecture:** Audio is captured as raw 16kHz mono PCM via an AudioWorklet. The PCM buffer is transferred to a Web Worker running @huggingface/transformers with the Whisper Small ONNX model. The worker returns the transcript text, which is appended to the task description field.

**Tech Stack:** @huggingface/transformers, Web Workers (Vite native), AudioWorklet API, TypeScript, React

**Spec:** `docs/superpowers/specs/2026-03-15-whisper-transformers-js-stt-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/desktop/package.json` | Modify | Add `@huggingface/transformers` dependency |
| `apps/desktop/vite.config.ts` | Modify | Add `optimizeDeps.exclude` for transformers, explicit `worker.format` |
| `apps/desktop/src/lib/whisper-types.ts` | Create | Shared types for worker ↔ main thread messages and UI state |
| `apps/desktop/src/lib/whisper.worker.ts` | Create | Web Worker: loads Whisper pipeline, runs inference |
| `apps/desktop/src/lib/pcm-processor.worklet.ts` | Create | AudioWorklet: captures raw PCM at 16kHz mono |
| `apps/desktop/src/lib/whisper-client.ts` | Create | Main-thread API: manages worker, audio capture, exposes `transcribe()` |
| `apps/desktop/src/components/app-shell/panels.tsx` | Modify | Replace Web Speech API with whisper-client in CreateTaskDialog |
| `apps/desktop/src/types/global.d.ts` | Modify | Remove SpeechRecognition types (no longer needed) |

---

## Chunk 1: Foundation — Dependencies, Config, Shared Types

### Task 1: Install @huggingface/transformers

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd apps/desktop && npm install @huggingface/transformers
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/desktop && node -e "require.resolve('@huggingface/transformers')" && echo "OK"
```

Expected: `OK` (no error)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "deps(desktop): add @huggingface/transformers for in-browser Whisper STT"
```

---

### Task 2: Update Vite config for Web Workers and WASM

**Files:**
- Modify: `apps/desktop/vite.config.ts`

- [ ] **Step 1: Add optimizeDeps.exclude and worker.format**

Update `apps/desktop/vite.config.ts` to:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  // @ts-ignore
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@widgets': path.resolve(__dirname, './src/widgets'),
      '@features': path.resolve(__dirname, './src/features'),
      '@entities': path.resolve(__dirname, './src/entities'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
})
```

- [ ] **Step 2: Verify dev server still starts**

```bash
cd apps/desktop && npx vite --port 5199 &
sleep 3 && kill %1
```

Expected: Vite starts without errors.

- [ ] **Step 3: Verify typecheck still passes**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/vite.config.ts
git commit -m "build(desktop): configure Vite for Transformers.js WASM and Web Workers"
```

---

### Task 3: Create shared types (`whisper-types.ts`)

**Files:**
- Create: `apps/desktop/src/lib/whisper-types.ts`

- [ ] **Step 1: Write the types file**

Create `apps/desktop/src/lib/whisper-types.ts`:

```typescript
/** Messages sent from the main thread to the Whisper Web Worker. */
export type WhisperWorkerRequest = {
  type: 'transcribe'
  audio: Float32Array
}

/** Messages sent from the Whisper Web Worker back to the main thread. */
export type WhisperWorkerResponse =
  | { type: 'status'; status: 'loading'; progress: number }
  | { type: 'status'; status: 'transcribing' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string }

/** UI-facing state for the Hold to Talk button. */
export type WhisperStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number }
  | { state: 'transcribing' }
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/whisper-types.ts
git commit -m "feat(desktop): add shared Whisper STT worker message types"
```

---

## Chunk 2: Audio Capture — PCM Processor Worklet

### Task 4: Create the AudioWorklet processor (`pcm-processor.worklet.ts`)

**Files:**
- Create: `apps/desktop/src/lib/pcm-processor.worklet.ts`

The AudioWorklet captures raw audio from the microphone, downsamples from the native sample rate (typically 48kHz) to 16kHz mono, and accumulates samples. When it receives a `'flush'` message on its port, it sends the full PCM buffer back.

- [ ] **Step 1: Write the worklet processor**

Create `apps/desktop/src/lib/pcm-processor.worklet.ts`:

```typescript
/**
 * AudioWorklet processor that captures raw PCM audio and downsamples to 16kHz mono.
 *
 * Communication:
 *   Main → Worklet port: { command: 'flush' }  — stop collecting and send buffer
 *   Worklet port → Main: { pcm: Float32Array }  — the collected 16kHz mono samples
 */

class PCMProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array[] = []
  private stopped = false

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data?.command === 'flush') {
        this.flush()
        this.stopped = true
      }
    }
  }

  process(inputs: Float32Array[][]): boolean {
    if (this.stopped) return false

    const input = inputs[0]
    if (!input || input.length === 0) return true

    // Take first channel (mono)
    const channelData = input[0]
    if (!channelData || channelData.length === 0) return true

    // Downsample from sampleRate to 16000 Hz
    const ratio = sampleRate / 16000
    const outputLength = Math.floor(channelData.length / ratio)
    const downsampled = new Float32Array(outputLength)
    for (let i = 0; i < outputLength; i++) {
      downsampled[i] = channelData[Math.round(i * ratio)]
    }

    this.buffer.push(downsampled)
    return true
  }

  private flush(): void {
    // Concatenate all chunks into a single Float32Array
    let totalLength = 0
    for (const chunk of this.buffer) {
      totalLength += chunk.length
    }

    const pcm = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this.buffer) {
      pcm.set(chunk, offset)
      offset += chunk.length
    }

    this.buffer = []
    this.port.postMessage({ pcm }, [pcm.buffer])
  }
}

registerProcessor('pcm-processor', PCMProcessor)
```

- [ ] **Step 2: Verify the file is valid TypeScript**

The worklet runs in a separate context and is loaded via `audioContext.audioWorklet.addModule()`. It won't be typechecked by the main tsconfig (worklet globals like `AudioWorkletProcessor`, `registerProcessor`, `sampleRate` are only available in the worklet scope). This is expected — worklets are loaded as raw JS/TS by Vite.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/pcm-processor.worklet.ts
git commit -m "feat(desktop): add AudioWorklet processor for 16kHz PCM capture"
```

---

## Chunk 3: Whisper Web Worker

### Task 5: Create the Whisper inference worker (`whisper.worker.ts`)

**Files:**
- Create: `apps/desktop/src/lib/whisper.worker.ts`

This Web Worker loads the Whisper Small ONNX model via @huggingface/transformers on first use, keeps the pipeline warm, and runs inference on received PCM audio data.

- [ ] **Step 1: Write the worker**

Create `apps/desktop/src/lib/whisper.worker.ts`:

```typescript
/// <reference lib="webworker" />

import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import type { WhisperWorkerRequest, WhisperWorkerResponse } from './whisper-types'

const MODEL_ID = 'onnx-community/whisper-small'

let transcriber: AutomaticSpeechRecognitionPipeline | null = null

function post(msg: WhisperWorkerResponse): void {
  self.postMessage(msg)
}

async function ensurePipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (transcriber) return transcriber

  post({ type: 'status', status: 'loading', progress: 0 })

  transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (progress: { progress?: number }) => {
      if (typeof progress.progress === 'number') {
        post({ type: 'status', status: 'loading', progress: Math.round(progress.progress) })
      }
    },
  })

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
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd apps/desktop && npx tsc --noEmit
```

Note: The worker file uses `/// <reference lib="webworker" />` for `self` typing. If tsc complains about conflicting DOM/WebWorker libs, the triple-slash directive should resolve it. If not, the file can be excluded from the main tsconfig and have its own `tsconfig.worker.json`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/whisper.worker.ts
git commit -m "feat(desktop): add Whisper inference Web Worker with Transformers.js"
```

---

## Chunk 4: Whisper Client — Main Thread API

### Task 6: Create the whisper client module (`whisper-client.ts`)

**Files:**
- Create: `apps/desktop/src/lib/whisper-client.ts`

This module manages the Web Worker lifecycle, handles audio capture via AudioWorklet, and exposes a simple `transcribe()` API.

- [ ] **Step 1: Write the client module**

Create `apps/desktop/src/lib/whisper-client.ts`:

```typescript
import type { WhisperWorkerResponse, WhisperStatus } from './whisper-types'

export type { WhisperStatus }
export type StatusCallback = (status: WhisperStatus) => void

// URL to the worklet processor — Vite resolves this at build time
const WORKLET_URL = new URL('./pcm-processor.worklet.ts', import.meta.url).href

export interface WhisperClient {
  /** Record from the microphone, returning the captured 16kHz mono PCM. */
  startRecording: () => Promise<void>
  /** Stop recording and return the PCM buffer. */
  stopRecording: () => Promise<Float32Array>
  /** Send PCM audio to the Whisper worker and return the transcript. */
  transcribe: (audio: Float32Array) => Promise<string>
  /** Terminate the worker and release resources. */
  dispose: () => void
  /** Whether the client is currently recording. */
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
    workletNode.connect(audioCtx.destination) // required for processing to run

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

      // Transfer the buffer to avoid copying
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

// Module-level singleton — survives component remounts and dialog open/close.
// Model stays warm in worker memory for fast subsequent transcriptions.
let _singleton: WhisperClient | null = null
let _statusCb: StatusCallback | null = null

export function getWhisperClient(onStatus?: StatusCallback): WhisperClient {
  _statusCb = onStatus ?? null
  if (!_singleton) {
    _singleton = createWhisperClient((s) => _statusCb?.(s))
  }
  return _singleton
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/whisper-client.ts
git commit -m "feat(desktop): add Whisper client with AudioWorklet PCM capture and worker management"
```

---

## Chunk 5: UI Integration — Replace Web Speech API in panels.tsx

### Task 7: Replace Web Speech API with Whisper client in CreateTaskDialog

**Files:**
- Modify: `apps/desktop/src/components/app-shell/panels.tsx:787-988`
- Modify: `apps/desktop/src/types/global.d.ts`

- [ ] **Step 1: Remove Web Speech API types from global.d.ts**

In `apps/desktop/src/types/global.d.ts`, remove the `SpeechRecognition*` interfaces and the `window.SpeechRecognition` / `window.webkitSpeechRecognition` declarations. Keep the `orchestraDesktop` bridge declarations.

- [ ] **Step 2: Remove Web Speech API imports and state from panels.tsx**

In `apps/desktop/src/components/app-shell/panels.tsx`, remove:

```typescript
// Remove these state/ref declarations (~line 787-791):
const [recording, setRecording] = useState(false)
const webSpeechRef = useRef<SpeechRecognition | null>(null)
const webSpeechResultRef = useRef('')
const hasSpeechAPI = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
```

Remove the cleanup useEffect (~line 806-814):
```typescript
// Remove this entire useEffect block
useEffect(() => {
  if (!open) {
    if (webSpeechRef.current) { ... }
    ...
  }
}, [open])
```

Remove the `stopRecording` and `startRecording` functions (~line 849-900).

- [ ] **Step 3: Add Whisper client state and recording logic**

Add these imports at the top of `panels.tsx`:
```typescript
import { getWhisperClient, type WhisperStatus } from '@/lib/whisper-client'
```

Replace the removed state with:
```typescript
const [recording, setRecording] = useState(false)
const [whisperStatus, setWhisperStatus] = useState<WhisperStatus>({ state: 'idle' })
const transcriptionCancelledRef = useRef(false)
```

Add cleanup useEffect:
```typescript
useEffect(() => {
  if (!open) {
    const client = getWhisperClient()
    if (client.recording) {
      // Discard any in-flight recording
      void client.stopRecording()
    }
    transcriptionCancelledRef.current = true
    setRecording(false)
    setWhisperStatus({ state: 'idle' })
  } else {
    transcriptionCancelledRef.current = false
  }
}, [open])
```

Add new recording functions:
```typescript
const startRecording = async () => {
  if (recording || whisperStatus.state !== 'idle') return
  try {
    const client = getWhisperClient(setWhisperStatus)
    await client.startRecording()
    setRecording(true)
    setSubmitError('')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Microphone access failed'
    setSubmitError(message)
  }
}

const stopRecording = async () => {
  if (!recording) return
  setRecording(false)
  try {
    const client = getWhisperClient(setWhisperStatus)
    const pcm = await client.stopRecording()
    if (pcm.length === 0 || transcriptionCancelledRef.current) return
    const text = await client.transcribe(pcm)
    if (!transcriptionCancelledRef.current && text.trim()) {
      setDescription((prev) => (prev.trim() ? `${prev.trimEnd()}\n${text.trim()}` : text.trim()))
    }
  } catch (error) {
    if (!transcriptionCancelledRef.current) {
      const message = error instanceof Error ? error.message : 'Transcription failed'
      setSubmitError(message)
    }
  } finally {
    if (!transcriptionCancelledRef.current) {
      setWhisperStatus({ state: 'idle' })
    }
  }
}
```

- [ ] **Step 4: Update the Hold to Talk button JSX**

Replace the button's `disabled`, `className`, and label (~line 984-988):

```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  onPointerDown={(event) => {
    event.preventDefault()
    void startRecording()
  }}
  onPointerUp={(event) => {
    event.preventDefault()
    void stopRecording()
  }}
  onPointerLeave={() => {
    void stopRecording()
  }}
  onPointerCancel={() => {
    void stopRecording()
  }}
  onKeyDown={(event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      void startRecording()
    }
  }}
  onKeyUp={(event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      void stopRecording()
    }
  }}
  disabled={whisperStatus.state !== 'idle' && !recording}
  className={`h-7 px-3 text-[10px] font-bold uppercase tracking-widest touch-none ${
    recording
      ? 'text-red-400'
      : whisperStatus.state !== 'idle'
        ? 'text-amber-400'
        : 'text-muted-foreground/50 hover:text-foreground'
  }`}
>
  {recording ? (
    <><Square className="h-3 w-3 mr-1" /> Release to Stop</>
  ) : whisperStatus.state === 'loading' ? (
    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading {whisperStatus.progress}%</>
  ) : whisperStatus.state === 'transcribing' ? (
    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Transcribing...</>
  ) : (
    <><Mic className="h-3 w-3 mr-1" /> Hold to Talk</>
  )}
</Button>
```

- [ ] **Step 5: Remove unused imports**

Remove any now-unused imports from panels.tsx (e.g., `Volume2`, `VolumeX` if they were only for STT; check carefully).

Ensure `Loader2` is imported from `lucide-react` (it's likely already imported for the Create button spinner).

- [ ] **Step 6: Verify typecheck**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Verify existing tests still pass**

```bash
cd apps/desktop && npx vitest run
```

Expected: All existing tests pass (no STT tests exist yet — the existing tests cover other functionality).

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/components/app-shell/panels.tsx apps/desktop/src/types/global.d.ts
git commit -m "feat(desktop): replace Web Speech API with Transformers.js Whisper STT

Record audio via AudioWorklet, send 16kHz PCM to Whisper Web Worker,
append transcript to task description. Model downloads on first use
(~242MB, cached). Fully offline after initial download."
```

---

## Chunk 6: Manual Smoke Test

### Task 8: End-to-end manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd apps/desktop && npm run dev
```

- [ ] **Step 2: Open the Create Task dialog**

Click the "+" button or use the keyboard shortcut to open the task creation dialog.

- [ ] **Step 3: First-use test — model download**

Press and hold the "Hold to Talk" button. On first use:
- Button should show "Loading 0%" → progress increments → "Loading 100%"
- This downloads ~242MB. On a fast connection, takes 30-60 seconds.
- After download completes, button should show "Transcribing..."
- After inference (~10-15s), transcript text should appear in the description field.

- [ ] **Step 4: Second-use test — cached model**

Close and reopen the dialog. Hold the button again:
- Should NOT show "Loading..." (model is cached)
- Should go directly to "Transcribing..." after release
- Transcript appears in description field

- [ ] **Step 5: Cancellation test**

Hold the button, speak briefly, release, then immediately close the dialog:
- No crash
- When reopening, no stale text appears

- [ ] **Step 6: Error test — deny microphone**

If possible, revoke microphone permission in Electron dev tools:
- Button should show "Microphone access denied" error
- No crash

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install @huggingface/transformers | `package.json` |
| 2 | Configure Vite for WASM + Workers | `vite.config.ts` |
| 3 | Create shared message types | `src/lib/whisper-types.ts` |
| 4 | Create AudioWorklet PCM processor | `src/lib/pcm-processor.worklet.ts` |
| 5 | Create Whisper inference Web Worker | `src/lib/whisper.worker.ts` |
| 6 | Create Whisper client module | `src/lib/whisper-client.ts` |
| 7 | Integrate into CreateTaskDialog | `panels.tsx`, `global.d.ts` |
| 8 | Manual smoke test | — |
