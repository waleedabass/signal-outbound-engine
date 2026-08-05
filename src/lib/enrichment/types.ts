export interface EnrichedContact {
  fullName: string;
  title: string | null;
  email: string;
  confidence: number; // 0-100
  linkedinUrl?: string | null;
}

export interface EnrichmentProvider {
  name: string;
  // Returns the best-matching contact at `domain` for one of `roleKeywords`,
  // or null if the provider has no data / no match. Never throws for a
  // "no result" case — only for actual request failures (auth, network).
  findContact(domain: string, roleKeywords: string[]): Promise<EnrichedContact | null>;
}
