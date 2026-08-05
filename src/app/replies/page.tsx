import { db } from "@/lib/db";
import { simulateReplyAction, bookMeetingAction } from "@/lib/actions";
import { timeAgo, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RepliesPage() {
  const [awaitingReply, replies] = await Promise.all([
    db.sendRecord.findMany({
      where: { status: "sent", replies: { none: {} } },
      include: { draft: { include: { contact: { include: { company: true } } } } },
      orderBy: { sentAt: "desc" },
    }),
    db.reply.findMany({
      include: {
        sendRecord: { include: { draft: { include: { contact: { include: { company: true } } } } } },
        meeting: true,
      },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mono text-xs uppercase tracking-wider" style={{ color: "var(--signal)" }}>
          Reply routing
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Replies</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          A real Instantly webhook lands on <code className="mono">/api/webhooks/instantly/reply</code>{" "}
          and runs the same classify → route → notify path as the simulator below.
        </p>
      </div>

      {awaitingReply.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            Sent, awaiting a reply — simulate one to test routing
          </h2>
          {awaitingReply.map((sr) => (
            <div key={sr.id} className="panel p-4 flex flex-col gap-3">
              <div className="text-sm">
                <span className="font-medium">{sr.draft.contact.fullName}</span>{" "}
                <span style={{ color: "var(--muted)" }}>
                  ({sr.draft.contact.company.name}) · sent {sr.sentAt ? timeAgo(sr.sentAt) : "—"} via {sr.provider}
                </span>
              </div>
              <form action={simulateReplyAction.bind(null, sr.id)} className="flex gap-2 flex-wrap">
                <input
                  name="replyText"
                  placeholder='e.g. "Actually yes, can we grab 15 min this week?"'
                  className="field flex-1 min-w-64"
                />
                <button type="submit" className="btn">
                  Simulate reply →
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          Classified replies
        </h2>
        {replies.length === 0 && (
          <div className="panel px-6 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
            No replies yet.
          </div>
        )}
        {replies.map((reply) => {
          const contact = reply.sendRecord.draft.contact;
          return (
            <div key={reply.id} className="panel p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span className="font-medium">{contact.fullName}</span>{" "}
                  <span style={{ color: "var(--muted)" }}>({contact.company.name})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`chip chip-${reply.classification}`}>{reply.classification}</span>
                  <span className="text-xs mono" style={{ color: "var(--muted-2)" }}>
                    {reply.confidence?.toFixed(0)}% · {timeAgo(reply.receivedAt)}
                  </span>
                </div>
              </div>
              <div className="text-sm italic px-3 py-2 rounded-lg" style={{ background: "var(--line-soft)" }}>
                “{reply.rawText}”
              </div>
              {reply.classification === "interested" && !reply.meeting && (
                <form action={bookMeetingAction.bind(null, reply.id)} className="flex gap-2 items-center flex-wrap">
                  <input type="datetime-local" name="scheduledAt" required className="field w-auto" />
                  <button type="submit" className="btn btn-primary">
                    Book meeting
                  </button>
                </form>
              )}
              {reply.meeting && (
                <div className="text-xs mono" style={{ color: "var(--success)" }}>
                  ✓ Meeting booked for {formatDateTime(reply.meeting.scheduledAt)}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
