// SQLite has no native enum type, so the schema stores these as String.
// This file is the single source of truth for the allowed values —
// validate against it before writing, and use the label/color maps for UI.

export const SIGNAL_TYPES = [
  "hiring_post",
  "funding_round",
  "tech_change",
  "job_change",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_STATUSES = [
  "new",
  "enriching",
  "enriched",
  "drafted",
  "skipped",
] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const DRAFT_STATUSES = ["pending_approval", "approved", "rejected", "edited"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const SEND_STATUSES = ["queued", "sent", "failed"] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const REPLY_CLASSIFICATIONS = [
  "interested",
  "objection",
  "not_now",
  "unsubscribe",
  "unknown",
] as const;
export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];

export const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
  hiring_post: "Hiring post",
  funding_round: "Funding round",
  tech_change: "Tech-stack change",
  job_change: "Job change",
};

export const CLASSIFICATION_COLOR: Record<ReplyClassification, string> = {
  interested: "success",
  objection: "amber",
  not_now: "slate",
  unsubscribe: "red",
  unknown: "slate",
};
