import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processInboundReply } from "@/lib/actions";

// Real inbound endpoint for Instantly's reply webhook — point a webhook at
// https://<your-deployment>/api/webhooks/instantly/reply from Instantly's
// campaign settings. Instantly's exact payload field names are configurable
// per-webhook in their v2 dashboard; this reads a few common variants
// defensively and should be pinned down exactly once a real webhook is
// wired, by logging one real payload and adjusting the field lookups below.
export async function POST(request: Request) {
  const payload = await request.json();

  const email: string | undefined = payload.lead_email ?? payload.email ?? payload.lead?.email;
  const replyText: string | undefined = payload.reply_text ?? payload.message ?? payload.body;

  if (!email || !replyText) {
    return NextResponse.json({ error: "Payload missing lead email or reply text" }, { status: 400 });
  }

  const contact = await db.contact.findFirst({ where: { email } });
  if (!contact) {
    return NextResponse.json({ error: `No contact on file for ${email}` }, { status: 404 });
  }

  const sendRecord = await db.sendRecord.findFirst({
    where: { draft: { contactId: contact.id }, status: "sent" },
    orderBy: { sentAt: "desc" },
  });
  if (!sendRecord) {
    return NextResponse.json({ error: `No sent record found for ${email}` }, { status: 404 });
  }

  const reply = await processInboundReply(sendRecord.id, replyText);
  return NextResponse.json({ ok: true, replyId: reply.id, classification: reply.classification });
}
