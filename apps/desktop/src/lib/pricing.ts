// ---------------------------------------------------------------------------
// Per-model pricing table (USD per million tokens)
// ---------------------------------------------------------------------------

const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-4': { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-sonnet-4': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-3.5': { input: 0.8, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
}

/**
 * Estimate cost in USD given token counts and an optional model name.
 * Falls back to claude-sonnet-4 pricing when the model is not found.
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model = 'claude-sonnet-4',
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4']
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  )
}
