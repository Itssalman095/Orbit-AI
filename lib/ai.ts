import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

const baseURL = process.env.NEXT_PUBLIC_AI_GATEWAY_URL
const apiKey = process.env.NEXT_PUBLIC_AI_GATEWAY_KEY
if (!baseURL || !apiKey) {
  throw new Error(
    "NEXT_PUBLIC_AI_GATEWAY_URL and NEXT_PUBLIC_AI_GATEWAY_KEY must be set"
  )
}

// NVIDIA's API is OpenAI-compatible. Override with AI_MODEL to switch models.
export const nvidia = createOpenAICompatible({ name: "nvidia", baseURL, apiKey })
export const AI_MODEL_ID = process.env.AI_MODEL ?? "z-ai/glm-5.3-flash"
