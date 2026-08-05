"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runSignalScan } from "@/lib/signals/ingest";
import { enrichSignal } from "@/lib/enrichment/waterfall";
import { getAIProvider } from "@/lib/ai";
import { getSendProvider } from "@/lib/sending";
import { postToSlack } from "@/lib/notify/slack";
import { upsertHubSpotContact } from "@/lib/crm/hubspot";

export async function runScanAction(): Promise<void> {
  await runSignalScan();
  revalidatePath("/pipeline");
  revalidatePath("/");
}

export async function enrichAndDraftAction(signalId: string): Promise<void> {
  const signal = await db.signal.findUniqueOrThrow({ where: { id: signalId }, include: { company: true } });

  // If enrichment already succeeded on a prior attempt (e.g. drafting failed
  // last time), reuse that contact instead of re-running — and re-paying
  // for — the waterfall.
  let contact = signal.status === "enriched"
    ? await db.contact.findFirst({ where: { enrichedFromSignalId: signalId }, orderBy: { createdAt: "desc" } })
    : null;

  if (!contact) {
    const enrichment = await enrichSignal(signalId);
    if ("skipped" in enrichment) {
      revalidatePath("/pipeline");
      return;
    }
    contact = await db.contact.findUniqueOrThrow({ where: { id: enrichment.contactId } });
  }

  // Real suppression enforcement, not just a label on a Reply row — a
  // contact who unsubscribed must never get drafted-to again, regardless
  // of how many future signals mention their company.
  if (contact.email) {
    const suppressed = await db.suppression.findUnique({ where: { email: contact.email } });
    if (suppressed) {
      await db.enrichmentAttempt.create({
        data: {
          signalId,
          provider: "suppression_check",
          query: contact.email,
          succeeded: false,
          summary: `${contact.email} is suppressed (${suppressed.reason}, ${suppressed.createdAt.toISOString().slice(0, 10)}) — draft blocked.`,
        },
      });
      await db.signal.update({ where: { id: signalId }, data: { status: "skipped" } });
      revalidatePath("/pipeline");
      return;
    }
  }

  const ai = getAIProvider();
  const draft = await ai.draftEmail({
    companyName: signal.company.name,
    contactName: contact.fullName,
    contactTitle: contact.title,
    signalType: signal.type,
    signalHeadline: signal.headline,
    signalRawText: signal.rawText,
  });

  await db.draft.create({
    data: {
      signalId,
      contactId: contact.id,
      subject: draft.subject,
      body: draft.body,
      groundedFact: draft.groundedFact,
      model: ai.name,
    },
  });
  await db.signal.update({ where: { id: signalId }, data: { status: "drafted" } });

  revalidatePath("/pipeline");
  revalidatePath("/approvals");
}

export async function saveDraftEditAction(draftId: string, formData: FormData) {
  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  await db.draft.update({
    where: { id: draftId },
    data: { subject, body, status: "edited" },
  });
  revalidatePath("/approvals");
}

export async function rejectDraftAction(draftId: string, reviewerNote?: string) {
  await db.draft.update({
    where: { id: draftId },
    data: { status: "rejected", reviewedAt: new Date(), reviewerNote },
  });
  revalidatePath("/approvals");
}

export async function approveAndSendAction(draftId: string): Promise<void> {
  const draft = await db.draft.findUniqueOrThrow({
    where: { id: draftId },
    include: { contact: true },
  });

  await db.draft.update({ where: { id: draftId }, data: { status: "approved", reviewedAt: new Date() } });

  if (!draft.contact.email) {
    throw new Error("Contact has no email on file — cannot send.");
  }

  const provider = getSendProvider();
  const [firstName, ...rest] = draft.contact.fullName.split(" ");

  try {
    const result = await provider.send({
      toEmail: draft.contact.email,
      firstName,
      lastName: rest.join(" "),
      subject: draft.subject,
      body: draft.body,
    });
    await db.sendRecord.create({
      data: {
        draftId,
        provider: result.provider,
        externalId: result.externalId,
        mailbox: result.mailbox,
        status: "sent",
        sentAt: new Date(),
      },
    });
  } catch (err) {
    await db.sendRecord.create({
      data: { draftId, provider: provider.name, status: "failed" },
    });
    throw err;
  }

  revalidatePath("/approvals");
  revalidatePath("/");
}

// Manual reply simulation for local testing before a real inbox/webhook is
// wired up — runs the exact same classify → route → notify path a real
// inbound webhook would trigger. See /api/webhooks/instantly/reply for that.
export async function simulateReplyAction(sendRecordId: string, formData: FormData): Promise<void> {
  const rawText = String(formData.get("replyText") ?? "");
  await processInboundReply(sendRecordId, rawText);
  revalidatePath("/replies");
  revalidatePath("/");
}

export async function processInboundReply(sendRecordId: string, rawText: string) {
  const classification = await getAIProvider().classifyReply(rawText);

  const routedTo: string =
    classification.classification === "interested"
      ? "slack"
      : classification.classification === "objection"
        ? "human_queue"
        : classification.classification === "unsubscribe"
          ? "suppressed"
          : "human_queue";

  const reply = await db.reply.create({
    data: {
      sendRecordId,
      rawText,
      classification: classification.classification,
      confidence: classification.confidence,
      routedTo,
    },
  });

  if (classification.classification === "interested" || classification.classification === "unsubscribe") {
    const sendRecord = await db.sendRecord.findUniqueOrThrow({
      where: { id: sendRecordId },
      include: { draft: { include: { contact: { include: { company: true } } } } },
    });
    const contact = sendRecord.draft.contact;

    if (classification.classification === "unsubscribe") {
      if (contact.email) {
        await db.suppression.upsert({
          where: { email: contact.email },
          create: { email: contact.email, reason: "unsubscribe" },
          update: {},
        });
      }
    } else {
      await postToSlack(
        `:large_green_circle: *Interested reply* from *${contact.fullName}* (${contact.company.name})\n> ${rawText}`
      );
      await upsertHubSpotContact({
        email: contact.email ?? "",
        firstName: contact.fullName.split(" ")[0],
        lastName: contact.fullName.split(" ").slice(1).join(" "),
        jobTitle: contact.title,
        companyName: contact.company.name,
      });
    }
  }

  return reply;
}

export async function bookMeetingAction(replyId: string, formData: FormData) {
  const scheduledAtISO = String(formData.get("scheduledAt") ?? "");
  const reply = await db.reply.findUniqueOrThrow({
    where: { id: replyId },
    include: { sendRecord: { include: { draft: true } } },
  });

  await db.meeting.create({
    data: {
      replyId,
      contactId: reply.sendRecord.draft.contactId,
      scheduledAt: new Date(scheduledAtISO),
      bookedVia: "cal.com (manual)",
    },
  });

  revalidatePath("/replies");
  revalidatePath("/");
}
