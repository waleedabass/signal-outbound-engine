import { db } from "@/lib/db";
import { runScanAction, enrichAndDraftAction } from "@/lib/actions";
import { SIGNAL_TYPE_LABEL, type SignalType } from "@/lib/enums";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const signals = await db.signal.findMany({
    include: { company: true, enrichmentAttempts: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { detectedAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="mono text-xs uppercase tracking-wider" style={{ color: "var(--signal)" }}>
            Signal intake
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Pipeline</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Real hiring signals (Greenhouse/Lever) and funding-round mentions, pulled live — no
            paid data account required for this stage.
          </p>
        </div>
        <form action={runScanAction}>
          <button type="submit" className="btn btn-primary">
            ↻ Scan for signals
          </button>
        </form>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left mono text-xs uppercase tracking-wide" style={{ color: "var(--muted-2)" }}>
                <th className="px-5 py-3 font-normal">Signal</th>
                <th className="px-5 py-3 font-normal">Company</th>
                <th className="px-5 py-3 font-normal">Type</th>
                <th className="px-5 py-3 font-normal">Score</th>
                <th className="px-5 py-3 font-normal">Detected</th>
                <th className="px-5 py-3 font-normal">Status</th>
                <th className="px-5 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
                    No signals yet. Add a monitored company (see README seed script) and run a scan.
                  </td>
                </tr>
              )}
              {signals.map((signal) => {
                const lastAttempt = signal.enrichmentAttempts[0];
                return (
                  <tr key={signal.id} className="border-t" style={{ borderColor: "var(--line-soft)" }}>
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="font-medium">{signal.headline}</div>
                      {signal.status === "skipped" && lastAttempt && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--muted-2)" }}>
                          {lastAttempt.summary}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--muted)" }}>
                      {signal.company.name}
                    </td>
                    <td className="px-5 py-3.5 mono text-xs" style={{ color: "var(--muted)" }}>
                      {SIGNAL_TYPE_LABEL[signal.type as SignalType] ?? signal.type}
                    </td>
                    <td className="px-5 py-3.5 mono tabular-nums">{signal.score}</td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--muted)" }}>
                      {timeAgo(signal.detectedAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`chip chip-${signal.status}`}>{signal.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {(signal.status === "new" || signal.status === "enriched") && (
                        <form action={enrichAndDraftAction.bind(null, signal.id)}>
                          <button type="submit" className="btn">
                            {signal.status === "enriched" ? "Draft →" : "Enrich & draft →"}
                          </button>
                        </form>
                      )}
                      {signal.status === "drafted" && (
                        <a href="/approvals" className="btn">
                          Review draft →
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
