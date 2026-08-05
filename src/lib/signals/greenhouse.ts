import { isRelevantJobTitle, scoreJobTitle } from "./hiringKeywords";

// Greenhouse's public job board API — no auth required for public boards.
// https://developers.greenhouse.io/job-board.html
interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  departments?: { name: string }[];
}

export interface JobPosting {
  externalId: string;
  title: string;
  url: string;
  postedAt: Date;
  score: number;
}

export async function fetchGreenhouseHiringSignals(boardToken: string): Promise<JobPosting[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=false`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Greenhouse board "${boardToken}" returned ${res.status}`);
  }
  const data = (await res.json()) as { jobs: GreenhouseJob[] };

  return data.jobs
    .filter((job) => isRelevantJobTitle(job.title))
    .map((job) => ({
      externalId: `greenhouse:${job.id}`,
      title: job.title,
      url: job.absolute_url,
      postedAt: new Date(job.updated_at),
      score: scoreJobTitle(job.title),
    }));
}
