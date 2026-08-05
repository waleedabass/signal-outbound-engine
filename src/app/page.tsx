import { getDashboardStats } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const maxFunnel = Math.max(1, stats.funnel[0]?.count ?? 1);
  const maxWeekly = Math.max(1, ...stats.weekly.flatMap((w) => [w.sent, w.replied]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mono text-xs uppercase tracking-wider" style={{ color: "var(--signal)" }}>
          Live pipeline
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Pipeline, not vanity sends.</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Every number below is read straight from this instance&apos;s database — zero until the
          pipeline actually runs.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border" style={{ background: "var(--line)", borderColor: "var(--line)" }}>
        <Stat label="Emails sent" value={stats.totalSent.toLocaleString()} />
        <Stat
          label="Reply rate"
          value={`${stats.replyRatePct.toFixed(1)}%`}
          note={stats.totalSent === 0 ? "no sends yet" : "vs. 3.4–5% platform avg"}
        />
        <Stat label="Interested" value={stats.interestedReplies.toLocaleString()} />
        <Stat label="Meetings booked" value={stats.meetingsBooked.toLocaleString()} />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold">Funnel</h2>
          <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--muted)" }}>
            Signal → contact → draft → sent → replied → meeting.
          </p>
          <div className="flex flex-col gap-2.5">
            {stats.funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                  {f.label}
                </div>
                <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: "var(--line-soft)" }}>
                  <div
                    className="h-full rounded-md"
                    style={{
                      width: `${Math.max(2, (f.count / maxFunnel) * 100)}%`,
                      background: "var(--text)",
                    }}
                  />
                </div>
                <div className="w-12 shrink-0 text-right mono text-xs tabular-nums">{f.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold">Sends &amp; replies by week</h2>
          <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--muted)" }}>
            ISO week buckets, most recent 8 weeks with activity.
          </p>
          {stats.weekly.length === 0 ? (
            <div className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
              No sends yet — approve a draft on the Approvals page to start.
            </div>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {stats.weekly.map((w) => (
                <div key={w.weekLabel} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="flex items-end gap-1 h-32 w-full justify-center">
                    <div
                      className="w-2.5 rounded-t"
                      style={{ height: `${Math.max(3, (w.sent / maxWeekly) * 100)}%`, background: "var(--teal)" }}
                      title={`${w.sent} sent`}
                    />
                    <div
                      className="w-2.5 rounded-t"
                      style={{ height: `${Math.max(3, (w.replied / maxWeekly) * 100)}%`, background: "var(--signal)" }}
                      title={`${w.replied} replied`}
                    />
                  </div>
                  <div className="mono text-[10px]" style={{ color: "var(--muted-2)" }}>
                    {w.weekLabel.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-4 text-xs mt-3" style={{ color: "var(--muted)" }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--teal)" }} /> sent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--signal)" }} /> replied
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="p-5 flex flex-col gap-1.5" style={{ background: "var(--panel)" }}>
      <span className="mono text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-2)" }}>
        {label}
      </span>
      <span className="mono text-2xl font-semibold tabular-nums">{value}</span>
      {note && (
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {note}
        </span>
      )}
    </div>
  );
}
