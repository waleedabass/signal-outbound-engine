import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, ClassificationResult, DraftInput, DraftOutput } from "./types";
import { CLASSIFICATION_SYSTEM_PROMPT, DRAFTING_SYSTEM_PROMPT, draftUserPrompt } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const DRAFT_TOOL: Anthropic.Tool = {
  name: "draft_email",
  description: "Submit the drafted cold email.",
  input_schema: {
    type: "object",
    properties: {
      subject: { type: "string", description: "Email subject line, under 8 words." },
      body: { type: "string", description: "The email body, 40-70 words." },
      grounded_fact: {
        type: "string",
        description: "The one specific fact from the signal this email is grounded in, in one sentence.",
      },
    },
    required: ["subject", "body", "grounded_fact"],
  },
};

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_reply",
  description: "Submit the classification for the inbound reply.",
  input_schema: {
    type: "object",
    properties: {
      classification: {
        type: "string",
        enum: ["interested", "objection", "not_now", "unsubscribe", "unknown"],
      },
      confidence: { type: "number", description: "0-100 confidence in this classification." },
      reasoning: { type: "string", description: "One sentence on why." },
    },
    required: ["classification", "confidence", "reasoning"],
  },
};

export function createAnthropicProvider(apiKey: string): AIProvider {
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",

    async draftEmail(input: DraftInput): Promise<DraftOutput> {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 500,
        system: `${DRAFTING_SYSTEM_PROMPT}\n- Return your answer by calling the draft_email tool exactly once.`,
        tools: [DRAFT_TOOL],
        tool_choice: { type: "tool", name: "draft_email" },
        messages: [{ role: "user", content: draftUserPrompt(input) }],
      });

      const toolUse = message.content.find((block) => block.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("Claude did not return a draft_email tool call.");
      }
      const parsed = toolUse.input as { subject: string; body: string; grounded_fact: string };
      return { subject: parsed.subject, body: parsed.body, groundedFact: parsed.grounded_fact };
    },

    async classifyReply(replyText: string): Promise<ClassificationResult> {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 300,
        system: `${CLASSIFICATION_SYSTEM_PROMPT}\n\nCall the classify_reply tool exactly once with your answer.`,
        tools: [CLASSIFY_TOOL],
        tool_choice: { type: "tool", name: "classify_reply" },
        messages: [{ role: "user", content: replyText }],
      });

      const toolUse = message.content.find((block) => block.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("Claude did not return a classify_reply tool call.");
      }
      return toolUse.input as ClassificationResult;
    },
  };
}
