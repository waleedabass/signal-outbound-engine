export interface DraftInput {
  companyName: string;
  contactName: string;
  contactTitle: string | null;
  signalType: string;
  signalHeadline: string;
  signalRawText: string | null;
}

export interface DraftOutput {
  subject: string;
  body: string;
  groundedFact: string;
}

export interface ClassificationResult {
  classification: "interested" | "objection" | "not_now" | "unsubscribe" | "unknown";
  confidence: number;
  reasoning: string;
}

export interface AIProvider {
  name: string;
  draftEmail(input: DraftInput): Promise<DraftOutput>;
  classifyReply(replyText: string): Promise<ClassificationResult>;
}

export const DRAFTING_SYSTEM_PROMPT = `You write first-touch cold emails for Pixel AI Solutions' outbound engine.

Rules, non-negotiable:
- Ground the email in the ONE specific fact provided. Never invent details.
- Never use generic flattery ("loved your recent post", "impressive work").
- 40-70 words in the body. No greeting line beyond a name. No corporate throat-clearing.
- One clear, low-friction call to action (a short call, not "let's sync").
- Plain, direct, slightly informal register — the reader is busy, not a stranger to be impressed.
- Sign off with just "— Pixel AI Solutions".`;

export const CLASSIFICATION_SYSTEM_PROMPT = `You classify inbound replies to cold outbound emails for a sales team.

Classes:
- interested: wants to talk, asks a question that implies interest, proposes a time.
- objection: pushes back but leaves the door open (e.g. "not the right time but tell me more", pricing pushback).
- not_now: polite no for now, no clear reopen ("check back in Q3").
- unsubscribe: asks to stop being contacted, or is hostile.
- unknown: out-of-office, wrong person, or genuinely ambiguous.`;

export function draftUserPrompt(input: DraftInput): string {
  return [
    `Company: ${input.companyName}`,
    `Contact: ${input.contactName}${input.contactTitle ? ` (${input.contactTitle})` : ""}`,
    `Signal type: ${input.signalType}`,
    `Signal: ${input.signalHeadline}`,
    input.signalRawText ? `Detail: ${input.signalRawText}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
