// Keyword scoring for outbound-relevant hiring signals. A company opening
// sales-development seats is a much stronger buying signal for this product
// than an unrelated opening, so titles are scored, not just matched.

const HIGH_VALUE = [
  "sdr",
  "bdr",
  "sales development",
  "business development representative",
  "outbound",
];
const MEDIUM_VALUE = ["account executive", "account manager", "revops", "revenue operations", "growth marketer"];
const LOW_VALUE = ["sales", "growth", "marketing"];

export function scoreJobTitle(title: string): number {
  const t = title.toLowerCase();
  if (HIGH_VALUE.some((k) => t.includes(k))) return 90;
  if (MEDIUM_VALUE.some((k) => t.includes(k))) return 60;
  if (LOW_VALUE.some((k) => t.includes(k))) return 30;
  return 0;
}

export function isRelevantJobTitle(title: string): boolean {
  return scoreJobTitle(title) > 0;
}
