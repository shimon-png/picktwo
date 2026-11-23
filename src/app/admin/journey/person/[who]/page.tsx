import Link from "next/link";
import { personJourney } from "@/server/services/signup-journeys";

export const dynamic = "force-dynamic";
export const metadata = { title: "Person journey" };

const nyTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** One visitor's whole journey, opened from a step on /admin/journey (Alex, Nov 23 2026). No email, ZIP cut to 3 digits. */
export default async function PersonJourneyPage({ params }: { params: Promise<{ who: string }> }) {
  const { who } = await params;
  const j = await personJourney(decodeURIComponent(who));
  if (!j) {
    return (
      <div className="space-y-3">
        <Link href="/admin/journey" className="chip !py-1 text-xs">← Journey</Link>
        <p className="text-sm text-zinc-500">Not found (or an admin account, which is left out).</p>
      </div>
    );
  }
  const facts: [string, string | number][] = [
    ["Source", `${j.sourceLabel}${j.sourceTag ? ` · ${j.sourceTag}` : ""}`],
    ["Profile", [j.sex, j.ageRange, j.zip3 && `ZIP ${j.zip3}xx`].filter(Boolean).join(" · ") || (j.guest ? "Guest (no account)" : "—")],
    ["Signed up", j.signedUpAt ? nyTime(j.signedUpAt) : "No"],
    j.guest ? ["Votes", j.votes.length] : ["Votes before / after sign-up", `${j.votesBefore} / ${j.votesAfter}`],
    ["Days back", j.returnDays],
    ["Posts · follows", `${j.posts} · ${j.follows}`],
    ["Last seen", j.lastSeen ? nyTime(j.lastSeen) : "—"],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/journey" className="chip !py-1 text-xs">← Journey</Link>
        <h2 className="text-[22px]">{j.handle ? `@${j.handle}` : `Guest ·${decodeURIComponent(who).slice(-5)}`}</h2>
        {j.handle && (
          <Link href={`/u/${j.handle}`} className="text-xs underline">
            Public profile
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-xs text-zinc-500">{k}</div>
            <div className="text-sm font-medium">{v}</div>
          </div>
        ))}
      </div>
      <section className="card space-y-2 p-4">
        <h2 className="font-sans font-medium">Every vote, in order</h2>
        {j.votes.length === 0 ? (
          <p className="text-sm text-zinc-500">No votes.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {j.votes.map((v, i) => (
              <li key={i} className="flex gap-2 border-t border-ink/10 pt-1">
                <span className="w-28 shrink-0 text-xs text-zinc-500">{nyTime(v.at)}</span>
                {!j.guest && <span className={`w-12 shrink-0 text-xs ${v.after ? "text-green" : "text-zinc-500"}`}>{v.after ? "after" : "before"}</span>}
                <span className="min-w-0 flex-1">
                  <Link href={`/b/${v.slug}`} className="underline-offset-2 hover:underline">
                    {v.title}
                  </Link>{" "}
                  <span className="text-zinc-500">
                    → {v.picked}
                    {v.method ? ` (${v.method})` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
