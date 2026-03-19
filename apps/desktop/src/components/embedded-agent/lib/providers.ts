import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

/**
 * Creates an AI SDK provider instance for the given provider ID.
 * API keys are explicitly passed — never read from environment variables.
 * The `dangerouslyAllowBrowser` flag is required because we call
 * providers directly from the Electron renderer (no server proxy).
 */
export function createProvider(providerId: string, apiKey: string) {
  if (!apiKey) throw new Error(`No API key provided for ${providerId}`)

  switch (providerId) {
    case 'openrouter':
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
      })
    case 'openai':
      return createOpenAI({
        apiKey,
      })
    case 'claude':
      return createAnthropic({
        apiKey,
      })
    case 'gemini':
      return createGoogleGenerativeAI({
        apiKey,
      })
    default:
      throw new Error(`Unknown provider: ${providerId}`)
  }
}
