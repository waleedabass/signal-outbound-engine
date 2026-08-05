import { db } from "@/lib/db";
import type { EnrichmentProvider } from "./types";
import { createHunterProvider } from "./hunter";

// Waterfall = try cheapest/free sources first, only pay for the expensive
// ones (Clay, Apollo) on a miss. Add providers to this array in the order
// they should be tried — Hunter's free tier makes it a sensible first rung.
function buildProviderChain(): EnrichmentProvider[] {
  const chain: EnrichmentProvider[] = [];
  if (process.env.HUNTER_API_KEY) {
    chain.push(createHunterProvider(process.env.HUNTER_API_KEY));
  }
  // Slot in Apollo/Clay here later, behind the same EnrichmentProvider interface:
  // if (process.env.APOLLO_API_KEY) chain.push(createApolloProvider(...));
  return chain;
}

const ROLE_KEYWORDS_BY_SIGNAL: Record<string, string[]> = {
  hiring_post: ["vp sales", "head of sales", "sales director", "director of sales", "cro", "chief revenue"],
  funding_round: ["ceo", "founder", "vp sales", "head of sales"],
  tech_change: ["vp sales", "revops", "revenue operations", "sales operations"],
  job_change: ["vp sales", "head of sales", "sales director"],
};

export async function enrichSignal(signalId: string): Promise<{ contactId: string } | { skipped: true; reason: string }> {
  const signal = await db.signal.findUniqueOrThrow({
    where: { id: signalId },
    include: { company: true },
  });

  await db.signal.update({ where: { id: signalId }, data: { status: "enriching" } });

  const domain = signal.company.domain;
  if (!domain) {
    await db.signal.update({ where: { id: signalId }, data: { status: "skipped" } });
    return { skipped: true, reason: "Company has no domain to enrich against." };
  }

  const roleKeywords = ROLE_KEYWORDS_BY_SIGNAL[signal.type] ?? ["vp sales", "head of sales"];
  const chain = buildProviderChain();

  if (chain.length === 0) {
    await db.signal.update({ where: { id: signalId }, data: { status: "new" } });
    return { skipped: true, reason: "No enrichment provider configured (set HUNTER_API_KEY)." };
  }

  for (const provider of chain) {
    let result;
    let succeeded = false;
    let summary: string;
    try {
      result = await provider.findContact(domain, roleKeywords);
      succeeded = result !== null;
      summary = result ? `Matched ${result.fullName} (${result.title ?? "no title"})` : "No matching contact found";
    } catch (err) {
      summary = `Error: ${(err as Error).message}`;
    }

    await db.enrichmentAttempt.create({
      data: {
        signalId,
        provider: provider.name,
        query: domain,
        succeeded,
        summary,
      },
    });

    if (succeeded && result) {
      const contact = await db.contact.create({
        data: {
          companyId: signal.companyId,
          enrichedFromSignalId: signalId,
          fullName: result.fullName,
          title: result.title,
          email: result.email,
          emailStatus: result.confidence >= 80 ? "verified" : "guessed",
          linkedinUrl: result.linkedinUrl ?? null,
          provider: provider.name,
        },
      });
      await db.signal.update({ where: { id: signalId }, data: { status: "enriched" } });
      return { contactId: contact.id };
    }
  }

  await db.signal.update({ where: { id: signalId }, data: { status: "skipped" } });
  return { skipped: true, reason: "All providers in the waterfall missed." };
}
