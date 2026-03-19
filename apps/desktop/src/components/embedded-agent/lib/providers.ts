import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export function createProvider(providerId: string, apiKey: string) {
  switch (providerId) {
    case 'openrouter':
      return createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })
    case 'openai':
      return createOpenAI({ apiKey })
    case 'claude':
      return createAnthropic({ apiKey })
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })
    default:
      throw new Error(`Unknown provider: ${providerId}`)
  }
}
