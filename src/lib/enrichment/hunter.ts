import type { EnrichedContact, EnrichmentProvider } from "./types";

// Hunter.io Domain Search — free tier includes 25 searches/month, no card
// required at signup. https://hunter.io/api-documentation/v2#domain-search
interface HunterEmail {
  value: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  confidence: number;
  seniority: string | null;
  department: string | null;
}

export function createHunterProvider(apiKey: string): EnrichmentProvider {
  return {
    name: "hunter",
    async findContact(domain, roleKeywords) {
      const url = new URL("https://api.hunter.io/v2/domain-search");
      url.searchParams.set("domain", domain);
      url.searchParams.set("api_key", apiKey);

      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Hunter domain-search failed: ${res.status} ${await res.text()}`);
      }

      const body = (await res.json()) as { data: { emails: HunterEmail[] } };
      const emails = body.data?.emails ?? [];
      if (emails.length === 0) return null;

      const keywords = roleKeywords.map((k) => k.toLowerCase());
      const match =
        emails.find((e) => e.position && keywords.some((k) => e.position!.toLowerCase().includes(k))) ??
        emails.find((e) => e.seniority === "executive") ??
        null;
      if (!match) return null;

      return {
        fullName: [match.first_name, match.last_name].filter(Boolean).join(" ") || match.value,
        title: match.position,
        email: match.value,
        confidence: match.confidence,
      } satisfies EnrichedContact;
    },
  };
}
