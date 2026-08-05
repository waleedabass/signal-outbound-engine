import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Cal.com webhook — add one at cal.com/settings/developer/webhooks pointed
// at https://<your-deployment>/api/webhooks/calcom, subscribed to
// BOOKING_CREATED. If a signing secret is configured there, set
// CALCOM_WEBHOOK_SECRET to the same value to verify X-Cal-Signature-256.
export async function POST(request: Request) {
  const rawBody = await request.text();

  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (secret) {
    const signature = request.headers.get("x-cal-signature-256");
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = JSON.parse(rawBody);
  if (event.triggerEvent !== "BOOKING_CREATED") {
    return NextResponse.json({ ok: true, ignored: event.triggerEvent });
  }

  const attendeeEmail: string | undefined = event.payload?.attendees?.[0]?.email;
  const startTime: string | undefined = event.payload?.startTime;
  if (!attendeeEmail || !startTime) {
    return NextResponse.json({ error: "Payload missing attendee email or startTime" }, { status: 400 });
  }

  const contact = await db.contact.findFirst({ where: { email: attendeeEmail } });
  if (!contact) {
    return NextResponse.json({ error: `No contact on file for ${attendeeEmail}` }, { status: 404 });
  }

  const reply = await db.reply.findFirst({
    where: { sendRecord: { draft: { contactId: contact.id } } },
    orderBy: { receivedAt: "desc" },
  });
  if (!reply) {
    return NextResponse.json({ error: "No reply on file to attach this meeting to" }, { status: 404 });
  }

  const meeting = await db.meeting.upsert({
    where: { replyId: reply.id },
    create: { replyId: reply.id, contactId: contact.id, scheduledAt: new Date(startTime), bookedVia: "cal.com" },
    update: { scheduledAt: new Date(startTime) },
  });

  return NextResponse.json({ ok: true, meetingId: meeting.id });
}
