import Link from "next/link";
import { commentsData, type CommentsView } from "@/server/services/comments";
import { COMMENTER_LABELS, type Commenter, type RateRow } from "@/server/services/comments-rules";
import { AGE_RANGES, SEX_OPTIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comments" };

const nyTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const pct = (x: number) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;
const sexLabel = (s: string | null) => (s ? SEX_OPTIONS.find((o) => o.id === s)?.label ?? s : "–");
const ageLabel = (a: string | null) => (a ? AGE_RANGES.find((o) => o.id === a)?.label ?? a : "–");
const KIND_TONE: Record<Commenter, string> = {
  account: "bg-green-soft text-green",
  guest: "bg-teal-soft text-teal",
  seed: "bg-amber-soft text-amber-700",
  admin: "bg-violet-soft text-violet",
};

function Kind({ k }: { k: Commenter }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${KIND_TONE[k]}`}>{COMMENTER_LABELS[k]}</span>;
}

function Person({ who, handle }: { who: string | null; handle: string | null }) {
  if (!who || who.startsWith("deleted:")) return <span className="text-zinc-500">Deleted account</span>;
  return (
    <Link href={`/admin/journey/person/${encodeURIComponent(who)}`} className="underline-offset-2 hover:underline">
      {handle ? `@${handle}` : `Guest ·${who.slice(-5)}`}
    </Link>
  );
}

function RateTable({ title, rows, note }: { title: string; rows: RateRow[]; note?: string }) {
  const best = Math.max(0, ...rows.filter((r) => r.votes >= 20).map((r) => r.rate));
  return (
    <div className="card overflow-x-auto p-3">
      <h3 className="mb-1 text-lg">{title}</h3>
      {note && <p className="mb-2 text-xs text-zinc-500">{note}</p>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="py-1 pr-3 font-normal">Group</th>
            <th className="py-1 pr-3 text-right font-normal">Votes</th>
            <th className="py-1 pr-3 text-right font-normal">With a reason</th>
            <th className="py-1 pr-3 text-right font-normal">% of votes</th>
            <th className="py-1 pr-3 text-right font-normal">People</th>
            <th className="py-1 pr-3 text-right font-normal">Wrote one</th>
            <th className="py-1 text-right font-normal">% of people</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.group} className="border-t border-zinc-200/60">
              <td className="py-1 pr-3">{r.group}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{r.votes.toLocaleString()}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{r.withReason.toLocaleString()}</td>
              <td className={`py-1 pr-3 text-right tabular-nums ${best > 0 && r.rate === best ? "font-semibold text-green" : ""}`}>{pct(r.rate)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{r.people.toLocaleString()}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{r.commenters.toLocaleString()}</td>
              <td className="py-1 text-right tabular-nums">{pct(r.peopleRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Comments = the reasons people type after voting, shown as "Top reasons" on the battle page (Alex, Nov 26 2026).
 * Every battle that has one, every person who wrote one, and who comments on what. All time.
 */
export default async function AdminComments({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view: CommentsView = sp.view === "all" ? "all" : "real";
  const { patterns: p, battles, commenters } = await commentsData(view);
  const t = p.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[22px]">Comments</h2>
        <Link href="/admin/comments" className={`chip !py-1 text-xs ${view === "real" ? "chip-on" : ""}`}>Real people</Link>
        <Link href="/admin/comments?view=all" className={`chip !py-1 text-xs ${view === "all" ? "chip-on" : ""}`}>All data (AI view)</Link>
      </div>
      <p className="text-sm text-zinc-500">
        The reasons people write after voting (&quot;Top reasons&quot; on the battle page), since launch.{" "}
        {view === "real"
          ? "Real people only: signed-in accounts with an email and guest browsers. Admins and their browsers, seed votes and made-up seed accounts are left out."
          : "Everything, including admins' tests and seed accounts; each row says who it was."}{" "}
        Until Nov 24 the battle page also offered three ready-made chips (Looks better / More practical / Just feels right); those are marked
        &quot;chip&quot; and counted apart from typed reasons. Flagged votes are left out.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Votes", t.votes.toLocaleString()],
          ["Votes with a reason", `${t.withReason.toLocaleString()} (${pct(t.votes ? t.withReason / t.votes : 0)})`],
          ["Typed / old chips", `${t.typed.toLocaleString()} / ${t.chips.toLocaleString()}`],
          ["People who wrote one", `${t.commenters.toLocaleString()} of ${t.people.toLocaleString()}`],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-xs text-zinc-500">{k}</div>
            <div className="text-xl tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <h3 className="text-[22px]">Who comments</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <RateTable title="Signed in or guest" rows={p.byKind} />
        <RateTable title="By how many votes they've cast" rows={p.byVotes} note="All votes the person ever cast, as a guest and in their account." />
        <RateTable title="By sex" rows={p.bySex} note="From the account, else the guest's about-you card." />
        <RateTable title="By age" rows={p.byAge} note="From the account, else the guest's about-you card." />
      </div>

      <h3 className="text-[22px]">On what</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <RateTable title="Text or photo battle" rows={p.byFormat} />
        <RateTable title="Seed or real-user battle" rows={p.byPoster} />
        <RateTable title="By AI theme" rows={p.byTheme} note="Most seed battles have no AI tag yet (Brain → Tag battles)." />
      </div>

      <h3 className="text-[22px]">Everyone who wrote a reason ({commenters.length})</h3>
      <div className="card overflow-x-auto p-3">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-1 pr-3 font-normal">Person</th>
              <th className="py-1 pr-3 font-normal">Who</th>
              <th className="py-1 pr-3 font-normal">Sex</th>
              <th className="py-1 pr-3 font-normal">Age</th>
              <th className="py-1 pr-3 text-right font-normal">Votes cast</th>
              <th className="py-1 pr-3 text-right font-normal">Reasons</th>
              <th className="py-1 pr-3 text-right font-normal">Battles</th>
              <th className="py-1 font-normal">Last</th>
            </tr>
          </thead>
          <tbody>
            {commenters.map((c) => (
              <tr key={c.who} className="border-t border-zinc-200/60">
                <td className="py-1 pr-3"><Person who={c.who} handle={c.handle} /></td>
                <td className="py-1 pr-3"><Kind k={c.kind} /></td>
                <td className="py-1 pr-3">{sexLabel(c.sex)}</td>
                <td className="py-1 pr-3">{ageLabel(c.age)}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{c.personVotes}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{c.comments}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{c.battles}</td>
                <td className="py-1 whitespace-nowrap text-zinc-500">{nyTime(c.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-[22px]">Every battle with a reason ({battles.length})</h3>
      {!battles.length && <p className="text-zinc-500">No reasons yet.</p>}
      <ul className="space-y-2">
        {battles.map((b) => (
          <li key={b.id} className="card space-y-2 p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <Link href={`/b/${b.slug}`} className="font-medium underline-offset-2 hover:underline">{b.title}</Link>
              <span className="text-xs text-zinc-500">
                {b.photo ? "Photo" : "Text"} · {b.seedBattle ? "Seed battle" : "Real user"}
                {b.poster ? ` · @${b.poster}` : ""} · {b.theme ?? "no AI tag"} · {b.votes} votes · {b.comments.length} reason{b.comments.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="space-y-1.5">
              {b.comments.map((c, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-zinc-200/60 pt-1.5 text-sm">
                  <span className={`rounded-full px-1.5 text-[11px] text-white ${c.side === "A" ? "bg-a" : "bg-b"}`}>{c.side}</span>
                  <span className={c.hidden ? "text-zinc-500 line-through" : ""}>{c.reason}</span>
                  {c.chip && <span className="rounded-full bg-zinc-200 px-1.5 text-[11px] text-zinc-600">chip</span>}
                  {c.hidden && <span className="text-[11px] text-zinc-500">hidden</span>}
                  <span className="text-xs text-zinc-500">
                    picked {c.picked} · <Person who={c.who} handle={c.handle} /> · {sexLabel(c.sex)} {ageLabel(c.age)} · {c.personVotes} votes
                    {c.upvotes > 0 && ` · ▲${c.upvotes}`} · {nyTime(c.at)}
                  </span>
                  {view === "all" && <Kind k={c.kind} />}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
