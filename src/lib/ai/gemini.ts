import type { AIProvider, ClassificationResult, DraftInput, DraftOutput } from "./types";
import { CLASSIFICATION_SYSTEM_PROMPT, DRAFTING_SYSTEM_PROMPT, draftUserPrompt } from "./types";

// Google's stable v1beta REST surface — used directly (no @google/genai SDK
// dependency) so this doesn't drift with a fast-moving SDK version. Field
// names below (generationConfig / responseMimeType / responseSchema,
// camelCase) match the Generative Language API's long-standing REST
// contract. Model id is env-overridable in case Google renames the default
// by the time you're reading this.
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

// Gemini's shared pool returns 503 "high demand" / 429 rate-limit fairly
// routinely — both are transient, not code bugs, so worth a couple of
// short retries before surfacing an error to the approval UI.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [800, 2000];

async function generateJson(
  apiKey: string,
  systemInstruction: string,
  userText: string,
  responseSchema: object
): Promise<Record<string, unknown>> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  let lastError: Error = new Error("unreachable");
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await fetch(`${BASE_URL}/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (res.ok) {
      const data = (await res.json()) as GenerateContentResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned no content.");
      return JSON.parse(text) as Record<string, unknown>;
    }

    lastError = new Error(`Gemini generateContent failed: ${res.status} ${await res.text()}`);
    if (!RETRYABLE_STATUS.has(res.status) || attempt === RETRY_DELAYS_MS.length) throw lastError;
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
  throw lastError;
}

const DRAFT_SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING", description: "Email subject line, under 8 words." },
    body: { type: "STRING", description: "The email body, 40-70 words." },
    grounded_fact: {
      type: "STRING",
      description: "The one specific fact from the signal this email is grounded in, in one sentence.",
    },
  },
  required: ["subject", "body", "grounded_fact"],
};

const CLASSIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    classification: {
      type: "STRING",
      enum: ["interested", "objection", "not_now", "unsubscribe", "unknown"],
    },
    confidence: { type: "NUMBER", description: "0-100 confidence in this classification." },
    reasoning: { type: "STRING", description: "One sentence on why." },
  },
  required: ["classification", "confidence", "reasoning"],
};

export function createGeminiProvider(apiKey: string): AIProvider {
  return {
    name: "gemini",

    async draftEmail(input: DraftInput): Promise<DraftOutput> {
      const parsed = (await generateJson(apiKey, DRAFTING_SYSTEM_PROMPT, draftUserPrompt(input), DRAFT_SCHEMA)) as {
        subject: string;
        body: string;
        grounded_fact: string;
      };
      return { subject: parsed.subject, body: parsed.body, groundedFact: parsed.grounded_fact };
    },

    async classifyReply(replyText: string): Promise<ClassificationResult> {
      const parsed = await generateJson(apiKey, CLASSIFICATION_SYSTEM_PROMPT, replyText, CLASSIFY_SCHEMA);
      return parsed as unknown as ClassificationResult;
    },
  };
}
