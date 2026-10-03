import OpenAI from 'openai'

// Single OpenAI client factory for the whole app. Lazy so the build never needs
// an API key, and shared so timeout/retry policy lives in one place.
let client: OpenAI | undefined

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? undefined,
      timeout: 8000,
      maxRetries: 1,
    })
  }
  return client
}
