import { getFinance, type ProviderRow } from "@/server/services/finance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance" };

const usd = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-2xl tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function Status({ r }: { r: ProviderRow }) {
  const l = r.live;
  if (l.state === "live") return <span className="whitespace-nowrap rounded-full bg-green-soft px-2 py-0.5 text-[11px] text-green">Live</span>;
  if (l.state === "error") return <span className="whitespace-nowrap rounded-full bg-pink-soft px-2 py-0.5 text-[11px] text-pink">Error</span>;
  if (l.state === "connect") return <span className="whitespace-nowrap rounded-full bg-amber-soft px-2 py-0.5 text-[11px] text-amber">Connect</span>;
  return <span className="whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[11px] text-zinc-500">List</span>;
}

export default async function FinancePage() {
  const f = await getFinance();
  const asOf = new Date(f.asOf).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  const paid = f.rows.filter((r) => r.projected > 0 || r.live.state !== "none");
  const free = f.rows.filter((r) => !paid.includes(r));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="mr-auto text-[22px]">Finance</h2>
        <span className="text-xs text-zinc-500">
          {f.month} · day {f.dayOfMonth} of {f.daysInMonth} · {f.liveCount}/{f.liveTotal} providers live · refreshed every 15 min · {asOf} ET
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Spent this month" value={usd(f.total.mtd)} sub="month to date" />
        <Tile label="Projected month end" value={usd(f.total.projected)} sub="at the current pace" />
        <Tile label="Fixed plans" value={usd(f.total.fixed)} sub="per month, before usage" />
        <Tile label="Run rate per year" value={usd(f.total.projected * 12, 0)} sub="projected × 12" />
      </div>

      <section className="card p-4">
        <h3 className="mb-2 font-sans font-medium">By provider</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1 pr-2 font-normal">Service</th>
                <th className="py-1 pr-2 font-normal">Plan</th>
                <th className="py-1 pr-2 text-right font-normal">This month</th>
                <th className="py-1 pr-2 text-right font-normal">Projected</th>
                <th className="py-1 text-right font-normal">Source</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((r) => (
                <tr key={r.id} className="border-t border-ink/10 align-top">
                  <td className="py-2 pr-2">
                    <div className="font-medium">
                      {r.billingUrl ? (
                        <a href={r.billingUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{r.name}</a>
                      ) : (
                        r.name
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">{r.role}</div>
                    {r.live.state === "live" && r.live.detail.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
                        {r.live.detail.slice(0, 6).map((d) => (
                          <li key={d.name} className="flex justify-between gap-3">
                            <span>{d.name}</span>
                            <span className="tabular-nums">{usd(d.cost)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.live.state === "live" && r.live.note && <div className="mt-1 text-[11px] text-zinc-500">{r.live.note}</div>}
                    {r.live.state !== "live" && r.note && <div className="mt-1 text-[11px] text-zinc-500">{r.note}</div>}
                    {r.live.state === "connect" && (
                      <div className="mt-1 text-[11px] text-amber">Add {r.live.missing.join(" + ")} in Vercel to see real spend.</div>
                    )}
                    {r.live.state === "error" && <div className="mt-1 text-[11px] text-pink">{r.live.message}</div>}
                  </td>
                  <td className="py-2 pr-2 text-xs">{r.plan}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{usd(r.mtd)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{usd(r.projected)}</td>
                  <td className="py-2 text-right"><Status r={r} /></td>
                </tr>
              ))}
              <tr className="border-t-2 border-ink/20 font-medium">
                <td className="py-2 pr-2" colSpan={2}>Total</td>
                <td className="py-2 pr-2 text-right tabular-nums">{usd(f.total.mtd)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{usd(f.total.projected)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {free.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            Free, no bill: {free.map((r) => `${r.name} (${r.role.toLowerCase()})`).join(" · ")}.
          </p>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <h3 className="font-sans font-medium">Unit costs this month</h3>
        <p className="text-xs text-zinc-500">Spend so far divided by real activity so far (seed votes and seed battles left out).</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Real voters" value={f.counts.voters.toLocaleString()} sub={`${f.counts.votes.toLocaleString()} votes`} />
          <Tile label="Cost per voter" value={usd(f.unit.perVoter)} />
          <Tile label="Cost per 1,000 votes" value={usd(f.unit.perThousandVotes)} />
          <Tile label="Cost per sign-up" value={usd(f.unit.perSignup)} sub={`${f.counts.signups.toLocaleString()} sign-ups`} />
        </div>
      </section>

      {f.toConnect.length > 0 && (
        <section className="card space-y-2 p-4">
          <h3 className="font-sans font-medium">Turn on live numbers</h3>
          <p className="text-xs text-zinc-500">
            Add these in Vercel → Project → Settings → Environment Variables (Production), then redeploy. Read-only keys are enough.
            Steps for each are in <code>docs/architecture.md</code>.
          </p>
          <ul className="list-disc pl-5 text-sm">
            {f.toConnect.map((k) => (
              <li key={k}><code>{k}</code></li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-zinc-500">
        Not counted here: ad spend, Apple Developer ($99/yr once the iOS app starts), and the tools we build with. Projections are a
        straight line from month-to-date usage; fixed fees count in full. Plan prices live in <code>services/finance-rules.ts</code>.
      </p>
    </div>
  );
}
