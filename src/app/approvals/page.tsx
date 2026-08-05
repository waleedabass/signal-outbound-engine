import { db } from "@/lib/db";
import { approveAndSendAction, rejectDraftAction, saveDraftEditAction } from "@/lib/actions";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const drafts = await db.draft.findMany({
    where: { status: { in: ["pending_approval", "edited"] } },
    include: { contact: { include: { company: true } }, signal: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mono text-xs uppercase tracking-wider" style={{ color: "var(--signal)" }}>
          Human-in-the-loop
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Approval queue</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Nothing reaches an inbox from this system without a human approving it here first.
        </p>
      </div>

      {drafts.length === 0 && (
        <div className="panel px-6 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
          Nothing pending. Enrich a signal from the Pipeline page to generate a draft.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {drafts.map((draft) => (
          <div key={draft.id} className="panel p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-medium">
                  {draft.contact.fullName}
                  {draft.contact.title ? <span style={{ color: "var(--muted)" }}> — {draft.contact.title}</span> : null}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-2)" }}>
                  {draft.contact.company.name} · {draft.contact.email ?? "no email on file"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`chip chip-${draft.status}`}>{draft.status.replace("_", " ")}</span>
                <span className="text-xs mono" style={{ color: "var(--muted-2)" }}>
                  {timeAgo(draft.createdAt)}
                </span>
              </div>
            </div>

            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--line-soft)", color: "var(--muted)" }}>
              <span className="mono uppercase tracking-wide" style={{ color: "var(--text)" }}>
                Grounded in:{" "}
              </span>
              {draft.groundedFact}
            </div>

            <form action={saveDraftEditAction.bind(null, draft.id)} className="flex flex-col gap-2">
              <input name="subject" defaultValue={draft.subject} className="field font-medium" />
              <textarea name="body" defaultValue={draft.body} rows={4} className="field" />
              <div>
                <button type="submit" className="btn">
                  Save edit
                </button>
              </div>
            </form>

            <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: "var(--line-soft)" }}>
              <form action={approveAndSendAction.bind(null, draft.id)}>
                <button type="submit" className="btn btn-primary">
                  ✓ Approve &amp; send
                </button>
              </form>
              <form action={rejectDraftAction.bind(null, draft.id, undefined)}>
                <button type="submit" className="btn btn-danger">
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
