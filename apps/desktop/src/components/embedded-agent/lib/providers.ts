import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

/**
 * Creates an AI SDK provider instance for the given provider ID.
 * API keys are explicitly passed — never read from environment variables.
 */
export function createProvider(providerId: string, apiKey: string) {
  if (!apiKey) throw new Error(`No API key provided for ${providerId}`)

  switch (providerId) {
    case 'openrouter': {
      // OpenRouter only supports Chat Completions API, not the Responses API
      const or = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })
      return (modelId: string) => or.chat(modelId)
    }
    case 'openai': {
      // Use chat() for broad compatibility (Responses API is newer and not all models support it)
      const oai = createOpenAI({ apiKey })
      return (modelId: string) => oai.chat(modelId)
    }
    case 'claude':
      return createAnthropic({ apiKey })
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })
    default:
      throw new Error(`Unknown provider: ${providerId}`)
  }
}

export type ModelInfo = {
  id: string
  name: string
}

// Anthropic has no list-models API — these are the known chat models
const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
]

/**
 * Fetches available models from the provider's API.
 * Falls back to a static list if the API is unavailable.
 */
export async function fetchProviderModels(providerId: string, apiKey: string): Promise<ModelInfo[]> {
  if (!apiKey) return []

  try {
    switch (providerId) {
      case 'openai':
        return await fetchOpenAIModels('https://api.openai.com/v1/models', apiKey)
      case 'openrouter':
        return await fetchOpenRouterModels()
      case 'claude':
        return ANTHROPIC_MODELS
      case 'gemini':
        return await fetchGeminiModels(apiKey)
      default:
        return []
    }
  } catch (err) {
    throw new Error(`Failed to fetch models for ${providerId}: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
  }
}

async function fetchOpenAIModels(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (res.status === 401) throw new Error('Invalid API key — check your key and try again')
  if (res.status === 403) throw new Error('API key does not have permission to list models')
  if (!res.ok) throw new Error(`Provider returned ${res.status}`)
  const data = await res.json() as { data: { id: string; owned_by?: string }[] }
  return data.data
    .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o'))
    .filter((m) => !m.id.includes('instruct') && !m.id.includes('realtime') && !m.id.includes('audio') && !m.id.includes('tts') && !m.id.includes('dall-e') && !m.id.includes('whisper') && !m.id.includes('embedding'))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, name: m.id }))
}

async function fetchOpenRouterModels(): Promise<ModelInfo[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (res.status === 401) throw new Error('Invalid API key — check your key and try again')
  if (res.status === 403) throw new Error('API key does not have permission to list models')
  if (!res.ok) throw new Error(`Provider returned ${res.status}`)
  const data = await res.json() as { data: { id: string; name: string; supported_parameters?: string[] }[] }
  return data.data
    .filter((m) => m.supported_parameters?.includes('tools'))
    .map((m) => ({ id: m.id, name: m.name || m.id }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  if (res.status === 401) throw new Error('Invalid API key — check your key and try again')
  if (res.status === 403) throw new Error('API key does not have permission to list models')
  if (!res.ok) throw new Error(`Provider returned ${res.status}`)
  const data = await res.json() as { models: { name: string; displayName: string; supportedGenerationMethods?: string[] }[] }
  return data.models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({
      id: m.name.replace('models/', ''),
      name: m.displayName || m.name.replace('models/', ''),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

