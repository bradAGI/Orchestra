# Whisper STT via Transformers.js — Design Spec

## Problem

The "Hold to Talk" button in the task creation dialog needs speech-to-text. The Web Speech API doesn't work in Electron (requires Google's proprietary servers and API keys baked into Chrome). Local whisper-cli requires a separate binary install. We need a zero-setup, fully offline STT solution that runs inside the Electron renderer.

## Solution

Use `@huggingface/transformers` to run Whisper Small (quantized ONNX, ~242MB) in a Web Worker. Audio is captured directly as raw PCM via an `AudioWorklet` (bypassing codec issues with `decodeAudioData`), resampled to 16kHz mono, and sent to the worker for inference. The model is downloaded once and cached via the browser's Cache API.

## Architecture

```
Main Thread (Renderer)
  ├── getUserMedia() → MediaStream
  ├── AudioContext (48kHz) → AudioWorklet (downsample to 16kHz mono)
  ├── On stop: collect Float32Array PCM buffer
  ├── postMessage(audio, [audio.buffer])  // transferable
  │
  └── whisper.worker.ts (Web Worker)
        ├── Loads @huggingface/transformers pipeline (lazy, on first use)
        ├── Model: onnx-community/whisper-small (quantized)
        ├── Runs inference, returns transcript text
        └── Stays alive to keep model warm for subsequent recordings
```

## New Files

### `src/lib/whisper-types.ts`

Shared TypeScript types for worker ↔ main thread messages.

```typescript
// Main → Worker
export type WhisperWorkerRequest = {
  type: 'transcribe'
  audio: Float32Array
}

// Worker → Main
export type WhisperWorkerResponse =
  | { type: 'status'; status: 'loading'; progress: number }
  | { type: 'status'; status: 'transcribing' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string }

// UI state
export type WhisperStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number }
  | { state: 'transcribing' }
```

### `src/lib/whisper.worker.ts`

Web Worker that owns the Transformers.js pipeline.

**Behavior:**
- Receives `WhisperWorkerRequest` messages
- On first message, loads the pipeline (reports download progress back via `WhisperWorkerResponse`)
- Runs inference and posts `{ type: 'result', text }` back
- Pipeline instance is kept alive in worker scope between transcriptions

**Worker import pattern:**
```typescript
// In whisper-client.ts — Vite's native worker import
const worker = new Worker(
  new URL('./whisper.worker.ts', import.meta.url),
  { type: 'module' }
)
```

**TypeScript config:** The worker file needs a `/// <reference lib="webworker" />` triple-slash directive at the top for correct typing of `self`, `postMessage`, etc.

### `src/lib/whisper-client.ts`

Main-thread module that manages the worker and converts audio.

**API:**
```typescript
import type { WhisperStatus } from './whisper-types'

type StatusCallback = (status: WhisperStatus) => void

function createWhisperClient(onStatus?: StatusCallback): {
  transcribe: (blob: Float32Array) => Promise<string>
  dispose: () => void
}
```

**Audio capture pipeline (raw PCM, no codec decoding):**
```
getUserMedia({ audio: true })
  → AudioContext (native sample rate, e.g. 48kHz)
  → AudioWorkletNode (downsample to 16kHz, mono, collect samples)
  → On stop: return Float32Array of 16kHz PCM
  → postMessage(audio, [audio.buffer])  // transferable to worker
```

This approach captures raw PCM directly, avoiding `decodeAudioData()` which has inconsistent webm/opus codec support across Electron builds.

**Lifecycle:**
- Worker spawned on first `transcribe()` call
- Singleton — one client shared across the app
- `dispose()` calls `worker.terminate()` (safe even during inference — WASM execution is terminated immediately)

### `src/lib/pcm-processor.worklet.ts`

AudioWorklet processor that collects raw PCM samples at 16kHz.

```typescript
// Registered as 'pcm-processor'
// Receives audio at native sample rate, downsamples to 16kHz mono
// Accumulates samples in a buffer
// On port.postMessage('stop'), sends the full Float32Array back
```

### Changes to `panels.tsx` (CreateTaskDialog)

**Remove:**
- `webSpeechRef`, `webSpeechResultRef`, `hasSpeechAPI`
- All Web Speech API code
- `SpeechRecognition` type usage

**Add:**
- Module-level `whisperClient` singleton (survives dialog open/close)
- `whisperStatus` state (`WhisperStatus`) for button label/spinner
- `AudioContext` + `AudioWorkletNode` for raw PCM capture
- `MediaStream` ref for microphone track cleanup

**Recording flow:**
1. `onPointerDown` → `getUserMedia({ audio: true })` → create `AudioContext` → connect `AudioWorkletNode` → start capturing PCM
2. `onPointerUp` → stop worklet, disconnect, `stream.getTracks().forEach(t => t.stop())` (releases mic indicator), get `Float32Array`
3. Call `whisperClient.transcribe(pcmData)`
4. Result → `setDescription(prev + transcript)`

**Cleanup on dialog close:**
- Stop any active `MediaRecorder` / AudioWorklet
- Release all `MediaStream` tracks (`stream.getTracks().forEach(t => t.stop())`)
- Discard any in-flight transcription result (don't append to description)
- Do NOT dispose the whisper client (keep model warm)

**Button states:**
- Idle → "Hold to Talk" + mic icon
- Recording → "Release to Stop" + red square icon, pulsing red dot
- Loading model → "Loading Model... 45%" + spinner
- Transcribing → "Transcribing..." + spinner
- Always enabled (Transformers.js works in all Electron/Chromium environments)

## Dependencies

**Add to `package.json`:**
- `@huggingface/transformers` — ONNX runtime + model loading + Whisper pipeline

No other dependencies needed. Transformers.js bundles its own ONNX Web Runtime (WASM).

**Vite configuration (`vite.config.ts`):**
- Add `@huggingface/transformers` to `optimizeDeps.exclude` to prevent Vite from trying to pre-bundle the WASM files
- Ensure `worker.format` is `'es'` (Vite default, but make explicit)
- The WASM files are loaded at runtime by the ONNX runtime from CDN or bundled — no special asset config needed as Transformers.js handles this internally

## Model Details

- **Model:** `onnx-community/whisper-small` (quantized)
- **Size:** ~242MB download (quantized vs ~490MB full)
- **Inference time:** ~10-15s for 10s audio on CPU
- **Caching:** Transformers.js uses the browser Cache API. Model downloads once, persists across app restarts and Electron updates. Cache is subject to Chromium storage quotas (~60% of disk by default, far above 242MB).
- **Language:** English by default, Whisper Small supports 99 languages
- **Fallback note:** If model size proves problematic, `onnx-community/whisper-tiny` (~77MB, ~3x faster, lower accuracy) can be swapped in by changing one string.

## Performance Considerations

- GPU acceleration is disabled in the Electron app (`app.disableHardwareAcceleration()`). Inference is CPU-only via ONNX WASM backend.
- The Web Worker prevents UI freezing during the 10-15s inference.
- Audio is transferred to the worker via `Transferable` to avoid copying.
- The pipeline stays loaded in worker memory — subsequent transcriptions skip model loading.
- Raw PCM capture via AudioWorklet avoids codec decoding overhead.

## Microphone Permissions

Electron with `sandbox: false` auto-grants `getUserMedia` permissions by default (no permission dialog). If this changes in future Electron versions, a `session.setPermissionRequestHandler` can be added to `electron/main.cjs` to explicitly grant `media` permission.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Microphone denied | Show "Microphone access denied" in submitError |
| Model download fails | Show error, user can retry on next hold |
| Inference fails | Show error in submitError, don't crash |
| Dialog closed during transcription | Stop mic tracks, discard result when it arrives |
| AudioWorklet not supported | Fallback: use ScriptProcessorNode (deprecated but universal) |

## What This Replaces

- All Web Speech API code in `panels.tsx`
- The `SpeechRecognition` type declarations in `global.d.ts` (can be removed)
- The backend whisper-cli integration remains available but is not used by the frontend

## Out of Scope

- Language selection UI (hardcode English, Whisper handles it)
- Audio waveform visualization
- Streaming/real-time transcription (batch only: record → stop → transcribe)
- Model size selection UI
- Re-enabling GPU acceleration
- Settings UI to pre-download the model
