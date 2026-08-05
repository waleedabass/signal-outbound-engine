import { isRelevantJobTitle, scoreJobTitle } from "./hiringKeywords";
import type { JobPosting } from "./greenhouse";

// Lever's public postings API — no auth required for public "site" boards.
// https://github.com/lever/postings-api
interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number; // epoch ms
}

export async function fetchLeverHiringSignals(site: string): Promise<JobPosting[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`, {
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Lever site "${site}" returned ${res.status}`);
  }
  const data = (await res.json()) as LeverPosting[];

  return data
    .filter((p) => isRelevantJobTitle(p.text))
    .map((p) => ({
      externalId: `lever:${p.id}`,
      title: p.text,
      url: p.hostedUrl,
      postedAt: new Date(p.createdAt),
      score: scoreJobTitle(p.text),
    }));
}
