import type { SendInput, SendProvider, SendResult } from "./types";

// Instantly v2 API. Auth is a Bearer token (v1's body-based api_key was
// retired when v1 was deprecated). Base URL and auth confirmed against
// developer.instantly.ai; the exact lead-payload field names below should be
// double-checked against the live interactive docs before a real send, since
// Instantly's docs site is JS-rendered and this couldn't be scraped 1:1.
//
// Integration model: Instantly campaigns are template + merge-variable
// based, but every email out of this pipeline is already fully written by
// Claude and human-approved — there's nothing left to template. So the
// target campaign's first sequence step should contain ONLY the merge
// fields `{{subject}}` / `{{icebreaker}}`, and this client supplies the
// full drafted subject/body as those two custom variables per lead.
const BASE_URL = "https://api.instantly.ai/api/v2";

export function createInstantlyProvider(apiKey: string, campaignId: string): SendProvider {
  return {
    name: "instantly",
    async send(input: SendInput): Promise<SendResult> {
      const res = await fetch(`${BASE_URL}/leads`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign: campaignId,
          email: input.toEmail,
          first_name: input.firstName,
          last_name: input.lastName,
          skip_if_in_campaign: true,
          custom_variables: {
            subject: input.subject,
            icebreaker: input.body,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Instantly send failed: ${res.status} ${await res.text()}`);
      }

      const data = (await res.json()) as { id?: string };
      return { provider: "instantly", externalId: data.id ?? null, mailbox: null };
    },
  };
}
