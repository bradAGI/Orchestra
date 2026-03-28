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

    // Downsample from sampleRate to 16000 Hz using linear interpolation
    const ratio = sampleRate / 16000
    const outputLength = Math.floor(channelData.length / ratio)
    const downsampled = new Float32Array(outputLength)
    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i * ratio
      const lo = Math.floor(srcIdx)
      const hi = Math.min(lo + 1, channelData.length - 1)
      const frac = srcIdx - lo
      downsampled[i] = channelData[lo] * (1 - frac) + channelData[hi] * frac
    }

    this.buffer.push(downsampled)
    return true
  }

  private flush(): void {
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
