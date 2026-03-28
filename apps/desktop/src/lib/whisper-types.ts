/** Messages sent from the main thread to the Whisper Web Worker. */
export type WhisperWorkerRequest =
  | { type: 'transcribe'; audio: Float32Array }
  | { type: 'preload' }

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
