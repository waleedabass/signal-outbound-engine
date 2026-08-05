// HubSpot CRM v3 Contacts API. Free tier + a private app access token
// (Settings → Integrations → Private Apps, "crm.objects.contacts.write"
// scope) is enough — no paid Sales Hub tier required for this endpoint.
export async function upsertHubSpotContact(input: {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  companyName: string;
}): Promise<void> {
  const token = process.env.HUBSPOT_API_KEY;
  if (!token) {
    console.log(`[HUBSPOT disabled — set HUBSPOT_API_KEY] would upsert ${input.email}`);
    return;
  }

  const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        email: input.email,
        firstname: input.firstName,
        lastname: input.lastName,
        jobtitle: input.jobTitle ?? undefined,
        company: input.companyName,
      },
    }),
  });

  // 409 = contact with this email already exists; not an error for an upsert-by-webhook flow.
  if (!res.ok && res.status !== 409) {
    throw new Error(`HubSpot contact upsert failed: ${res.status} ${await res.text()}`);
  }
}
