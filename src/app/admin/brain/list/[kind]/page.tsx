import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import type { BrainView } from "@/server/services/brain";
import { BRAIN_LISTS, brainList, type BrainListKind } from "@/server/services/brain-lists";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brain list" };

const nyTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const PLACES: Record<string, string> = { feed: "Vote deck", home: "Homepage card", discover: "Discover", search: "Search", profile: "Profile", seed: "Seed (fake)" };

function Person({ who, handle }: { who: string | null; handle: string | null }) {
  // A vote or visit can outlive its owner (deleted account): nothing to open.
  if (!who) return <span className="text-zinc-500">Deleted account</span>;
  return (
    <Link href={`/admin/journey/person/${encodeURIComponent(who)}`} className="underline-offset-2 hover:underline">
      {handle ? `@${handle}` : `Guest ·${who.slice(-5)}`}
    </Link>
  );
}

/**
 * What's behind a Brain number (Alex, Nov 24 2026). Same scope and window as the Brain page, optionally one New York
 * day (?day=YYYY-MM-DD from the Day by day table). People open their journey; battles open the live battle page.
 */
export default async function BrainListPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ days?: string; view?: string; day?: string }>;
}) {
  const { kind } = await params;
  if (!(kind in BRAIN_LISTS)) notFound();
  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const view: BrainView = sp.view === "all" ? "all" : "clean";
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;
  const me = await getCurrentUser();
  const list = await brainList(kind as BrainListKind, view, days, day, me?.id ?? null);
  const back = `/admin/brain?days=${days}${view === "all" ? "&view=all" : ""}`;
  const span = day ?? (days === 1 ? "last 24h" : `last ${days} days`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={back} className="chip !py-1 text-xs">← Brain</Link>
        <h2 className="text-[22px]">{BRAIN_LISTS[kind as BrainListKind]}</h2>
        <span className="text-sm text-zinc-500">
          {list.total} · {span} · {view === "clean" ? "Clean view" : "All data"}
          {list.rows.length < list.total && ` · showing the newest ${list.rows.length}`}
        </span>
      </div>

      <section className="card overflow-x-auto p-4">
        {list.rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing here yet.</p>
        ) : list.kind === "battles" ? (
          <>
            <p className="mb-2 text-xs text-zinc-500">
              {view === "clean" ? "Posted by real people (no seed battles, no admins)." : "Every battle, seed ones included."} Open one to vote on it
              for real; it counts like anyone else&apos;s vote.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-1 pr-2 font-normal">Battle</th>
                  <th className="py-1 pr-2 font-normal">Posted by</th>
                  <th className="py-1 pr-2 font-normal">Posted</th>
                  <th className="py-1 pr-2 text-right font-normal">Real votes</th>
                  <th className="py-1 pr-2 text-right font-normal">You</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((b) => (
                  <tr key={b.slug} className="border-t border-ink/10 align-top">
                    <td className="py-1.5 pr-2">
                      <Link href={`/b/${b.slug}`} className="underline-offset-2 hover:underline">{b.title}</Link>
                      <span className="ml-1 text-xs text-zinc-500">
                        {b.photo ? "photo" : "text"}
                        {b.status !== "OPEN" && ` · ${b.status.toLowerCase()}`}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2"><Person who={b.authorId} handle={b.handle} /></td>
                    <td className="py-1.5 pr-2 text-xs text-zinc-500">{nyTime(b.at)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{b.votes}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {b.iVoted ? (
                        <span className="text-xs text-green">voted</span>
                      ) : b.status === "OPEN" ? (
                        <Link href={`/b/${b.slug}`} className="chip chip-on !py-0.5 text-xs">Vote</Link>
                      ) : (
                        <span className="text-xs text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : list.kind === "votes" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1 pr-2 font-normal">When</th>
                <th className="py-1 pr-2 font-normal">Who</th>
                <th className="py-1 pr-2 font-normal">Battle → pick</th>
                <th className="py-1 pr-2 font-normal">Where</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((v, i) => (
                <tr key={i} className="border-t border-ink/10 align-top">
                  <td className="py-1.5 pr-2 text-xs text-zinc-500">{nyTime(v.at)}</td>
                  <td className="py-1.5 pr-2"><Person who={v.who} handle={v.handle} /></td>
                  <td className="py-1.5 pr-2">
                    <Link href={`/b/${v.slug}`} className="underline-offset-2 hover:underline">{v.title}</Link>
                    <span className="text-zinc-500"> → {v.picked}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-zinc-500">{PLACES[v.source ?? ""] ?? "Battle page / link"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : list.kind === "signups" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1 pr-2 font-normal">Person</th>
                <th className="py-1 pr-2 font-normal">Signed up</th>
                <th className="py-1 pr-2 font-normal">Profile</th>
                <th className="py-1 pr-2 text-right font-normal">Votes</th>
                <th className="py-1 pr-2 text-right font-normal">Asked Pickbot</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((u) => (
                <tr key={u.who} className="border-t border-ink/10">
                  <td className="py-1.5 pr-2"><Person who={u.who} handle={u.handle} /></td>
                  <td className="py-1.5 pr-2 text-xs text-zinc-500">{nyTime(u.at)}</td>
                  <td className="py-1.5 pr-2 text-xs text-zinc-500">{[u.sex, u.ageRange].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{u.votes}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{u.asked || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1 pr-2 font-normal">Person</th>
                <th className="py-1 pr-2 text-right font-normal">
                  {list.kind === "voters" ? "Votes" : list.kind === "visitors" ? "Visits" : list.kind === "askers" ? "Questions" : "Times"}
                </th>
                {list.kind !== "askers" && <th className="py-1 pr-2 text-right font-normal">Asked Pickbot</th>}
                <th className="py-1 pr-2 font-normal">First</th>
                <th className="py-1 pr-2 font-normal">Last</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((p) => (
                <tr key={p.who} className="border-t border-ink/10">
                  <td className="py-1.5 pr-2"><Person who={p.who} handle={p.handle} /></td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{p.n}</td>
                  {list.kind !== "askers" && <td className="py-1.5 pr-2 text-right tabular-nums">{p.asked || "—"}</td>}
                  <td className="py-1.5 pr-2 text-xs text-zinc-500">{nyTime(p.first)}</td>
                  <td className="py-1.5 pr-2 text-xs text-zinc-500">{nyTime(p.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
