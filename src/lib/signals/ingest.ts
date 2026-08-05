import { db } from "@/lib/db";
import { fetchGreenhouseHiringSignals } from "./greenhouse";
import { fetchLeverHiringSignals } from "./lever";
import { fetchFundingSignals, guessDomain } from "./fundingRss";

export interface IngestResult {
  companiesScanned: number;
  signalsFound: number;
  signalsCreated: number;
  errors: { company: string; message: string }[];
}

// Idempotent: re-running never duplicates a signal already stored for the
// same company + source URL, so this is safe to run on a schedule.
export async function runSignalScan(): Promise<IngestResult> {
  const result: IngestResult = { companiesScanned: 0, signalsFound: 0, signalsCreated: 0, errors: [] };

  const companies = await db.company.findMany({ where: { monitored: true } });

  for (const company of companies) {
    if (!company.careersProvider || !company.careersSlug) continue;
    result.companiesScanned++;

    try {
      const postings =
        company.careersProvider === "greenhouse"
          ? await fetchGreenhouseHiringSignals(company.careersSlug)
          : company.careersProvider === "lever"
            ? await fetchLeverHiringSignals(company.careersSlug)
            : [];

      for (const posting of postings) {
        result.signalsFound++;
        const created = await upsertSignal({
          companyId: company.id,
          type: "hiring_post",
          sourceName: company.careersProvider,
          sourceUrl: posting.url,
          headline: `Posted "${posting.title}"`,
          rawText: posting.title,
          score: posting.score,
          detectedAt: posting.postedAt,
        });
        if (created) result.signalsCreated++;
      }
    } catch (err) {
      result.errors.push({ company: company.name, message: (err as Error).message });
    }
  }

  // Funding signals aren't tied to a single monitored company ahead of
  // time — the feed itself tells us which companies just raised.
  try {
    const fundingSignals = await fetchFundingSignals();
    for (const fs of fundingSignals) {
      result.signalsFound++;
      const company = await db.company.upsert({
        where: { name_domain: { name: fs.companyName, domain: guessDomain(fs.companyName) } },
        create: { name: fs.companyName, domain: guessDomain(fs.companyName), monitored: false },
        update: {},
      });
      const created = await upsertSignal({
        companyId: company.id,
        type: "funding_round",
        sourceName: "funding_rss",
        sourceUrl: fs.url,
        headline: fs.headline,
        rawText: `${fs.companyName} raised ${fs.amount}`,
        score: 80,
        detectedAt: fs.publishedAt,
      });
      if (created) result.signalsCreated++;
    }
  } catch (err) {
    result.errors.push({ company: "funding_rss", message: (err as Error).message });
  }

  return result;
}

async function upsertSignal(input: {
  companyId: string;
  type: string;
  sourceName: string;
  sourceUrl: string;
  headline: string;
  rawText: string;
  score: number;
  detectedAt: Date;
}): Promise<boolean> {
  const existing = await db.signal.findFirst({
    where: { companyId: input.companyId, sourceUrl: input.sourceUrl },
  });
  if (existing) return false;

  await db.signal.create({ data: input });
  return true;
}
