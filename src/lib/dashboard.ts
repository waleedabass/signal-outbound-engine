import { db } from "@/lib/db";

export interface WeekBucket {
  weekLabel: string;
  sent: number;
  replied: number;
}

export interface DashboardStats {
  totalSignals: number;
  totalSent: number;
  totalReplies: number;
  interestedReplies: number;
  meetingsBooked: number;
  replyRatePct: number;
  funnel: { label: string; count: number }[];
  weekly: WeekBucket[];
}

function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum);
  return d.toISOString().slice(0, 10);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalSignals, totalContacts, totalDrafts, sendRecords, replies, meetingsBooked] = await Promise.all([
    db.signal.count(),
    db.contact.count(),
    db.draft.count(),
    db.sendRecord.findMany({ where: { status: "sent" }, select: { sentAt: true } }),
    db.reply.findMany({ select: { receivedAt: true, classification: true } }),
    db.meeting.count(),
  ]);

  const totalSent = sendRecords.length;
  const totalReplies = replies.length;
  const interestedReplies = replies.filter((r) => r.classification === "interested").length;
  const replyRatePct = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;

  const buckets = new Map<string, WeekBucket>();
  const ensure = (key: string): WeekBucket => {
    if (!buckets.has(key)) buckets.set(key, { weekLabel: key, sent: 0, replied: 0 });
    return buckets.get(key)!;
  };
  for (const sr of sendRecords) {
    if (sr.sentAt) ensure(weekKey(sr.sentAt)).sent++;
  }
  for (const r of replies) {
    ensure(weekKey(r.receivedAt)).replied++;
  }
  const weekly = [...buckets.values()].sort((a, b) => a.weekLabel.localeCompare(b.weekLabel)).slice(-8);

  return {
    totalSignals,
    totalSent,
    totalReplies,
    interestedReplies,
    meetingsBooked,
    replyRatePct,
    funnel: [
      { label: "Signals", count: totalSignals },
      { label: "Contacts found", count: totalContacts },
      { label: "Drafted", count: totalDrafts },
      { label: "Sent", count: totalSent },
      { label: "Replied", count: totalReplies },
      { label: "Meetings", count: meetingsBooked },
    ],
    weekly,
  };
}
