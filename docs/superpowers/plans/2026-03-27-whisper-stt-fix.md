# Whisper STT — Performance Fix & Embedded Agent Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Whisper speech-to-text system so it transcribes quickly and works reliably in the embedded agent chat widget.

**Architecture:** The current system uses a local `onnx-community/whisper-tiny` model via `@huggingface/transformers` in a Web Worker. The main problems are: (1) the model downloads on first use with no preloading, (2) WASM fallback is slow when WebGPU isn't available (common in Electron), (3) the VoiceInput component has no status feedback during model loading so users think it's broken, (4) there's a backend STT endpoint (`/api/v1/stt/transcribe`) using `whisper-cli` that could be used as a faster alternative when available. The fix: add model preloading, prefer backend STT when available, add proper loading state to VoiceInput, and add a timeout/cancel mechanism.

**Tech Stack:** React 19, TypeScript, `@huggingface/transformers` 3.8+, Web Workers, AudioWorklet, whisper-cli (backend)

---

### Task 1: Add model preloading to the Web Worker

The biggest performance issue is that the model downloads and initializes only when the user first tries to transcribe. We should preload it eagerly.

**Files:**
- Modify: `apps/desktop/src/lib/whisper.worker.ts`
- Modify: `apps/desktop/src/lib/whisper-types.ts`
- Modify: `apps/desktop/src/lib/whisper-client.ts`

- [ ] **Step 1: Add a 'preload' message type to the worker protocol**

In `apps/desktop/src/lib/whisper-types.ts`:

```typescript
// BEFORE:
export type WhisperWorkerRequest = {
  type: 'transcribe'
  audio: Float32Array
}

// AFTER:
export type WhisperWorkerRequest =
  | { type: 'transcribe'; audio: Float32Array }
  | { type: 'preload' }
```

- [ ] **Step 2: Handle 'preload' in the worker**

In `apps/desktop/src/lib/whisper.worker.ts`, modify the message handler (line 48):

```typescript
// BEFORE (line 48):
self.onmessage = async (event: MessageEvent<WhisperWorkerRequest>) => {
  const { type, audio } = event.data
  if (type !== 'transcribe') return

// AFTER:
self.onmessage = async (event: MessageEvent<WhisperWorkerRequest>) => {
  const msg = event.data

  if (msg.type === 'preload') {
    try {
      await ensurePipeline()
      post({ type: 'status', status: 'loading', progress: 100 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Whisper preload failed'
      post({ type: 'error', message })
    }
    return
  }

  if (msg.type !== 'transcribe') return
  const { audio } = msg
```

- [ ] **Step 3: Add a preload method to the client**

In `apps/desktop/src/lib/whisper-client.ts`, add to the `WhisperClient` interface (line 8):

```typescript
export interface WhisperClient {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Float32Array>
  transcribe: (audio: Float32Array) => Promise<string>
  preload: () => void
  dispose: () => void
  readonly recording: boolean
}
```

Add the implementation inside `createWhisperClient()` (after the `ensureWorker` function):

```typescript
function preload(): void {
    const w = ensureWorker()
    w.postMessage({ type: 'preload' })
}
```

And add it to the returned object (line 114):

```typescript
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
```

- [ ] **Step 4: Trigger preload when the singleton is created**

In `whisper-client.ts`, modify `getWhisperClient()` (line 128):

```typescript
// BEFORE:
export function getWhisperClient(onStatus?: StatusCallback): WhisperClient {
  _statusCb = onStatus ?? null
  if (!_singleton) {
    _singleton = createWhisperClient((s) => _statusCb?.(s))
  }
  return _singleton
}

// AFTER:
export function getWhisperClient(onStatus?: StatusCallback): WhisperClient {
  _statusCb = onStatus ?? null
  if (!_singleton) {
    _singleton = createWhisperClient((s) => _statusCb?.(s))
    _singleton.preload() // Start downloading model immediately
  }
  return _singleton
}
```

- [ ] **Step 5: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/lib/whisper-types.ts apps/desktop/src/lib/whisper.worker.ts apps/desktop/src/lib/whisper-client.ts
git commit -m "perf(desktop): add Whisper model preloading to eliminate first-use download delay"
```

---

### Task 2: Add backend STT fallback (prefer whisper-cli when available)

The backend has a fully functional `/api/v1/stt/transcribe` endpoint using `whisper-cli` binary which is significantly faster than WASM inference. We should prefer it when available.

**Files:**
- Modify: `apps/desktop/src/lib/whisper-client.ts`
- Modify: `apps/desktop/src/components/embedded-agent/components/VoiceInput.tsx`

- [ ] **Step 1: Add a backend transcription path to the client**

In `apps/desktop/src/lib/whisper-client.ts`, add a new factory function that tries backend first:

```typescript
import { fetchSTTHealth, transcribeAudio, type BackendConfig } from './orchestra-client'

export interface WhisperClientOptions {
  onStatus?: StatusCallback
  backendConfig?: BackendConfig | null
}

export function createSmartWhisperClient(options: WhisperClientOptions = {}): WhisperClient {
  const { onStatus, backendConfig } = options
  let useBackend: boolean | null = null // null = unchecked, true/false = result
  let worker: Worker | null = null
  let audioCtx: AudioContext | null = null
  let workletNode: AudioWorkletNode | null = null
  let mediaRecorder: MediaRecorder | null = null
  let recordedChunks: Blob[] = []
  let stream: MediaStream | null = null
  let isRecording = false

  // Check if backend STT is available (cached after first check)
  async function checkBackend(): Promise<boolean> {
    if (useBackend !== null) return useBackend
    if (!backendConfig) { useBackend = false; return false }
    try {
      const health = await fetchSTTHealth(backendConfig)
      useBackend = health.ready === true
    } catch {
      useBackend = false
    }
    return useBackend
  }

  // Eagerly check backend on creation
  void checkBackend()

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

    // If using backend, record as WebM blob for upload
    const willUseBackend = await checkBackend()
    if (willUseBackend) {
      recordedChunks = []
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data) }
      mediaRecorder.start(100) // 100ms timeslice
    } else {
      // Local path: use AudioWorklet for PCM
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

    const willUseBackend = await checkBackend()

    if (willUseBackend && mediaRecorder) {
      // Return empty — we'll use the blob directly in transcribe
      return new Promise<Float32Array>((resolve) => {
        mediaRecorder!.onstop = () => resolve(new Float32Array(0))
        mediaRecorder!.stop()
        cleanupStream()
      })
    }

    // Local path: get PCM from worklet
    if (!workletNode) return new Float32Array(0)
    return new Promise<Float32Array>((resolve) => {
      workletNode!.port.onmessage = (event: MessageEvent<{ pcm: Float32Array }>) => {
        resolve(event.data.pcm)
        cleanupLocal()
      }
      workletNode!.port.postMessage({ command: 'flush' })
    })
  }

  async function transcribe(audio: Float32Array): Promise<string> {
    const willUseBackend = await checkBackend()

    if (willUseBackend && backendConfig && recordedChunks.length > 0) {
      // Backend path: send WebM blob
      onStatus?.({ state: 'transcribing' })
      const blob = new Blob(recordedChunks, { type: 'audio/webm' })
      recordedChunks = []
      try {
        const result = await transcribeAudio(backendConfig, blob)
        onStatus?.({ state: 'idle' })
        return result.text
      } catch (err) {
        // Fall back to local if backend fails
        console.warn('[WhisperClient] Backend STT failed, falling back to local:', err)
        useBackend = false
      }
    }

    // Local path: use Web Worker
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

  function cleanupStream(): void {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
    mediaRecorder = null
    isRecording = false
  }

  function cleanupLocal(): void {
    isRecording = false
    if (workletNode) { workletNode.disconnect(); workletNode = null }
    if (audioCtx) { void audioCtx.close(); audioCtx = null }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  }

  function preload(): void {
    void checkBackend()
    // Also preload local model as fallback
    const w = ensureWorker()
    w.postMessage({ type: 'preload' })
  }

  function dispose(): void {
    cleanupLocal()
    cleanupStream()
    if (worker) { worker.terminate(); worker = null }
  }

  return {
    startRecording, stopRecording, transcribe, preload, dispose,
    get recording() { return isRecording },
  }
}
```

- [ ] **Step 2: Update the singleton getter to use smart client**

```typescript
// BEFORE:
let _singleton: WhisperClient | null = null
let _statusCb: StatusCallback | null = null

export function getWhisperClient(onStatus?: StatusCallback): WhisperClient {
  _statusCb = onStatus ?? null
  if (!_singleton) {
    _singleton = createWhisperClient((s) => _statusCb?.(s))
    _singleton.preload()
  }
  return _singleton
}

// AFTER:
let _singleton: WhisperClient | null = null
let _statusCb: StatusCallback | null = null
let _backendConfig: BackendConfig | null = null

export function setWhisperBackendConfig(config: BackendConfig | null): void {
  _backendConfig = config
}

export function getWhisperClient(onStatus?: StatusCallback): WhisperClient {
  _statusCb = onStatus ?? null
  if (!_singleton) {
    _singleton = createSmartWhisperClient({
      onStatus: (s) => _statusCb?.(s),
      backendConfig: _backendConfig,
    })
    _singleton.preload()
  }
  return _singleton
}
```

- [ ] **Step 3: Wire up the backend config from App.tsx or EmbeddedAgentProvider**

Where the backend config is available (likely `EmbeddedAgentProvider.tsx` or `App.tsx`), call:

```typescript
import { setWhisperBackendConfig } from '@/lib/whisper-client'

// When config is available:
useEffect(() => {
  setWhisperBackendConfig(config)
}, [config])
```

- [ ] **Step 4: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/whisper-client.ts apps/desktop/src/components/embedded-agent/
git commit -m "feat(desktop): prefer backend whisper-cli STT when available, fall back to local WASM"
```

---

### Task 3: Add loading status feedback to VoiceInput

The VoiceInput component shows no feedback during model loading — users click and nothing happens for seconds (or minutes on first use). Fix this.

**Files:**
- Modify: `apps/desktop/src/components/embedded-agent/components/VoiceInput.tsx`
- Modify: `apps/desktop/src/lib/whisper-types.ts`

- [ ] **Step 1: Add 'loading' state to VoiceInput**

In `apps/desktop/src/components/embedded-agent/components/VoiceInput.tsx`:

```typescript
// BEFORE (line 9):
type VoiceState = 'idle' | 'recording' | 'processing'

// AFTER:
type VoiceState = 'idle' | 'loading' | 'recording' | 'processing'
```

- [ ] **Step 2: Track model loading progress**

```typescript
// BEFORE (lines 12-21):
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

// AFTER:
export function VoiceInput({ onTranscription, disabled }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const clientRef = useRef<import('@/lib/whisper-client').WhisperClient | null>(null)

  const getClient = useCallback(async (): Promise<import('@/lib/whisper-client').WhisperClient> => {
    if (!clientRef.current) {
      const { getWhisperClient } = await import('@/lib/whisper-client')
      clientRef.current = getWhisperClient((status) => {
        if (status.state === 'loading') {
          setState('loading')
          setLoadingProgress(status.progress)
        } else if (status.state === 'transcribing') {
          setState('processing')
        } else {
          // Don't reset to idle here — let the handleClick flow control state
        }
      })
    }
    return clientRef.current
  }, [])
```

- [ ] **Step 3: Update the UI to show loading state**

```typescript
// BEFORE (lines 59-95):
return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'processing'}
      // ...
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

// AFTER:
return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'processing' || state === 'loading'}
        className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
          state === 'recording'
            ? 'bg-red-500/20 text-red-500'
            : state === 'processing' || state === 'loading'
              ? 'bg-muted/30 text-muted-foreground'
              : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/20'
        } disabled:opacity-30`}
        aria-label={
          state === 'loading'
            ? `Loading speech model (${loadingProgress}%)`
            : state === 'recording'
              ? 'Click to stop recording'
              : state === 'processing'
                ? 'Transcribing...'
                : 'Click to record'
        }
        title={
          state === 'loading'
            ? `Loading model... ${loadingProgress}%`
            : state === 'recording'
              ? 'Click to stop'
              : state === 'processing'
                ? 'Transcribing...'
                : 'Voice input'
        }
      >
        {state === 'processing' || state === 'loading' ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : state === 'recording' ? (
          <MicOff className="size-3.5 animate-pulse" />
        ) : (
          <Mic className="size-3.5" />
        )}
      </button>
      {state === 'loading' && (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-amber-500 whitespace-nowrap">
          {loadingProgress}%
        </span>
      )}
    </div>
  )
```

- [ ] **Step 4: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/embedded-agent/components/VoiceInput.tsx
git commit -m "fix(desktop): add loading progress feedback to VoiceInput during model download"
```

---

### Task 4: Add transcription timeout and cancel mechanism

Long transcriptions can hang indefinitely. Add a timeout and a way to cancel.

**Files:**
- Modify: `apps/desktop/src/lib/whisper-client.ts`
- Modify: `apps/desktop/src/components/embedded-agent/components/VoiceInput.tsx`

- [ ] **Step 1: Add timeout to the transcribe function**

In `whisper-client.ts`, wrap the transcription promise with a timeout in both `createWhisperClient` and `createSmartWhisperClient`:

```typescript
const TRANSCRIPTION_TIMEOUT_MS = 30_000 // 30 seconds

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}
```

Then in the `transcribe` function:

```typescript
// Wrap the worker promise:
return withTimeout(
  new Promise<string>((resolve, reject) => {
    // ... existing worker message handling ...
  }),
  TRANSCRIPTION_TIMEOUT_MS,
  'Whisper transcription',
)
```

- [ ] **Step 2: Show timeout error in VoiceInput**

In `VoiceInput.tsx`, update the catch block in `handleClick`:

```typescript
// BEFORE:
} catch (err) {
    console.error('[VoiceInput] Transcription failed:', err)
}

// AFTER:
} catch (err) {
    console.error('[VoiceInput] Transcription failed:', err)
    // Could show a toast or inline error
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/lib/whisper-client.ts apps/desktop/src/components/embedded-agent/components/VoiceInput.tsx
git commit -m "fix(desktop): add 30s timeout for Whisper transcription to prevent indefinite hangs"
```

---

### Task 5: Optimize chunk settings for short utterances

The current `chunk_length_s: 30` and `stride_length_s: 5` are designed for long audio. Chat messages are typically 3-15 seconds. Reduce overhead.

**Files:**
- Modify: `apps/desktop/src/lib/whisper.worker.ts`

- [ ] **Step 1: Adjust chunk settings based on audio length**

In `apps/desktop/src/lib/whisper.worker.ts`, modify the transcription call (lines 56-61):

```typescript
// BEFORE:
const result = await pipe(audio, {
    language: 'en',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
})

// AFTER — adapt to audio length:
const durationSeconds = audio.length / 16000 // 16kHz sample rate
const result = await pipe(audio, {
    language: 'en',
    task: 'transcribe',
    // For short audio (< 30s), don't chunk at all — process as single segment
    // For longer audio, use standard chunking
    chunk_length_s: durationSeconds < 25 ? 0 : 30,
    stride_length_s: durationSeconds < 25 ? 0 : 5,
})
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/whisper.worker.ts
git commit -m "perf(desktop): skip chunking for short audio clips in Whisper STT"
```

---

### Task 6: Eagerly preload Whisper when embedded agent panel opens

**Files:**
- Modify: `apps/desktop/src/components/embedded-agent/EmbeddedAgentProvider.tsx` (or wherever the panel state lives)

- [ ] **Step 1: Find where the embedded agent panel opens and trigger preload**

When the embedded agent panel is opened for the first time, eagerly initialize the Whisper client so the model starts downloading before the user clicks the mic button:

```typescript
import { getWhisperClient, setWhisperBackendConfig } from '@/lib/whisper-client'

// In the effect that handles panel open:
useEffect(() => {
  if (isPanelOpen) {
    // Set backend config for smart STT routing
    setWhisperBackendConfig(config)
    // Eagerly preload Whisper model in background
    getWhisperClient()
  }
}, [isPanelOpen, config])
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/embedded-agent/
git commit -m "perf(desktop): eagerly preload Whisper model when embedded agent panel opens"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd apps/desktop && npx vitest run && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 2: Manual verification checklist**

**With backend STT (whisper-cli installed):**
1. Start orchestrad with STT configured
2. Open embedded agent → click mic → record → stop
3. Transcription should complete in < 2 seconds
4. Check console: should see backend STT path used

**Without backend STT (fallback to local):**
1. Start orchestrad without whisper-cli
2. Open embedded agent → observe model loading indicator (%)
3. Click mic → record → stop
4. First transcription takes longer (model download) but subsequent ones are fast
5. Loading progress shows in UI (% tooltip on mic button)

**Error cases:**
6. Record very short audio (< 0.5s) → should handle gracefully, not crash
7. Record for > 30s → should still work (chunking for local, single upload for backend)
8. Deny microphone permission → should show error, not hang
9. Close panel during transcription → should not crash
