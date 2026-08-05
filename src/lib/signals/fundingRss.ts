import Parser from "rss-parser";

// Public RSS is free to poll and needs no account. Funding announcements are
// a strong buying signal (see the demo gallery: "usually the first hire after
// a round like this is outbound infra"). Swap FUNDING_RSS_URL for any feed —
// a paid Crunchbase/PitchBook feed will have cleaner structured data.
const DEFAULT_FEED_URL = "https://techcrunch.com/tag/funding/feed/";

const ROUND_PATTERN =
  /^(.*?)\s+(?:raises|lands|closes|secures|nabs|bags)\s+\$?([\d.,]+\s?(?:million|billion|M|B))/i;

export interface FundingSignal {
  externalId: string;
  companyName: string;
  amount: string;
  headline: string;
  url: string;
  publishedAt: Date;
}

export async function fetchFundingSignals(feedUrl: string = DEFAULT_FEED_URL): Promise<FundingSignal[]> {
  const parser = new Parser();
  const feed = await parser.parseURL(feedUrl);

  const signals: FundingSignal[] = [];
  for (const item of feed.items ?? []) {
    const title = item.title ?? "";
    const match = ROUND_PATTERN.exec(title);
    if (!match) continue;

    signals.push({
      externalId: item.guid ?? item.link ?? title,
      companyName: match[1].trim(),
      amount: match[2].trim(),
      headline: title,
      url: item.link ?? feedUrl,
      publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
    });
  }
  return signals;
}

// Funding-round companies rarely come with a known domain from an RSS title.
// This is a heuristic first guess a human corrects in the UI — not a lookup.
export function guessDomain(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "");
  return `${slug}.com`;
}
