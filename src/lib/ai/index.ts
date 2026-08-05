import type { AIProvider } from "./types";
import { createAnthropicProvider } from "./anthropic";
import { createGeminiProvider } from "./gemini";

// AI_PROVIDER picks explicitly ("anthropic" | "gemini"); unset auto-detects
// from whichever key is present, preferring Anthropic if both are set.
// Gemini has a genuinely free tier (no card required) via aistudio.google.com
// — the easier zero-cost path for anyone cloning this open-source.
export function getAIProvider(): AIProvider {
  const requested = process.env.AI_PROVIDER?.toLowerCase();

  if (requested === "gemini") return requireGemini();
  if (requested === "anthropic") return requireAnthropic();

  if (process.env.ANTHROPIC_API_KEY) return requireAnthropic();
  if (process.env.GEMINI_API_KEY) return requireGemini();

  throw new Error(
    "No AI provider configured — set ANTHROPIC_API_KEY or GEMINI_API_KEY (see .env.example)."
  );
}

function requireAnthropic(): AIProvider {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.");
  }
  return createAnthropicProvider(process.env.ANTHROPIC_API_KEY);
}

function requireGemini(): AIProvider {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("AI_PROVIDER=gemini but GEMINI_API_KEY is not set.");
  }
  return createGeminiProvider(process.env.GEMINI_API_KEY);
}

export type { AIProvider, DraftInput, DraftOutput, ClassificationResult } from "./types";
