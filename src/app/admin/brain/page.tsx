import Link from "next/link";
import { getBrainStats, type BrainView } from "@/server/services/brain";
import { tasteByGroup } from "@/server/services/taste-profiles";
import { winbackStats } from "@/server/services/winback";
import { signupSources } from "@/server/services/acquisition";
import { signupJourneys } from "@/server/services/signup-journeys";
import { RecomputeEngagement, TagBattles } from "@/components/admin/AdminActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brain" };

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");
const secs = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-sans font-medium">{title}</h2>
      {note && <p className="text-xs text-zinc-500">{note}</p>}
      {children}
    </section>
  );
}

function Rows({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="text-sm text-zinc-500">No data yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500">
            {head.map((h, i) => (
              <th key={h} className={`py-1 pr-2 font-normal ${i ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-ink/10">
              {r.map((c, j) => (
                <td key={j} className={`py-1.5 pr-2 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const battleLink = (slug: string, title: string) => (
  <Link href={`/b/${slug}`} className="line-clamp-2 underline-offset-2 hover:underline">{title}</Link>
);

const nyTime = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const nyDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

/** "+12" / "−3" next to a number: change vs the day before. */
function Delta({ now, prev }: { now: number; prev: number | undefined }) {
  if (prev === undefined) return <>{now}</>;
  const d = now - prev;
  return (
    <>
      {now}
      {d !== 0 && <span className={`ml-1 text-[11px] ${d > 0 ? "text-green" : "text-b"}`}>{d > 0 ? `+${d}` : `−${-d}`}</span>}
    </>
  );
}

export default async function BrainPage({ searchParams }: { searchParams: Promise<{ days?: string; view?: string }> }) {
  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const view: BrainView = sp.view === "all" ? "all" : "clean";
  const href = (o: { days?: number; view?: BrainView }) => `/admin/brain?days=${o.days ?? days}${(o.view ?? view) === "all" ? "&view=all" : ""}`;
  const [s, taste, wb, acq, journeys] = await Promise.all([getBrainStats(days, view), tasteByGroup(), winbackStats(), signupSources(Math.max(days, 30)), signupJourneys()]);
  const t = s.tiles;
  const n = (k: string) => Number(t[k] ?? 0);
  const viewedTotal = s.byKind.reduce((a, k) => a + k.views, 0);
  const viewedVoted = s.byKind.reduce((a, k) => a + k.voted, 0);
  const tiles: [string, string | number][] = [
    ["Visits", n("sessions")],
    ["Visitors", n("visitors")],
    ["Cards viewed", n("views")],
    // Share of logged card views that the same person voted on. (Not deck votes ÷ views: votes from browsers
    // still running the old app, which logs no views, made that go over 100%.)
    ["Cards viewed → voted", pct(viewedVoted, viewedTotal)],
    [view === "clean" ? "Real votes" : "Votes (incl. seed)", n("real_votes")],
    ["Median time to pick", secs(t.median_pick_ms)],
    ["Skips", n("skips")],
    ["Hit sign-up wall", n("gates")],
    ["Sign-ups", n("signups")],
    ["Vote changes", n("changed")],
    [view === "clean" ? "Real battles posted" : "Battles posted", n("real_battles")],
    ["Seed votes (all time, excluded)", n("seed_votes_all")],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[22px]">Brain</h2>
        {(["clean", "all"] as const).map((v) => (
          <Link key={v} href={href({ view: v })} className={`chip !py-1 text-xs ${v === view ? "chip-on" : ""}`}>
            {v === "clean" ? "Clean" : "All data (AI view)"}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-ink/15" aria-hidden />
        {[1, 7, 30].map((d) => (
          <Link key={d} href={href({ days: d })} className={`chip !py-1 text-xs ${d === days ? "chip-on" : ""}`}>
            {d === 1 ? "24h" : `${d} days`}
          </Link>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        {view === "clean"
          ? `Clean view: real people only, counting from ${nyDate(s.cleanFrom!)} (New York time). Leaves out seed votes and seed battles, made-up seed accounts, admins and their browsers, and bots. Nothing is deleted; "All data" shows everything. Change the start date with brainCleanFrom in Config.`
          : "All data: everything we have, including the 5,000 seed votes, seed battles and admin test activity (bots still left out)."}{" "}
        Hypotheses and requests live in the repo under docs/brain/.
      </p>

      <Section title="Day by day" note="New York days, newest first. The small number is the change from the day before.">
        <Rows
          head={["Day", "Visitors", "Visits", "Sign-ups", "Votes", "Voters", "Battles posted"]}
          rows={s.daily.map((d, i) => {
            const prev = s.daily[i + 1];
            return [
              d.day,
              <Delta key="a" now={d.visitors} prev={prev?.visitors} />,
              <Delta key="b" now={d.visits} prev={prev?.visits} />,
              <Delta key="c" now={d.signups} prev={prev?.signups} />,
              <Delta key="d" now={d.votes} prev={prev?.votes} />,
              <Delta key="e" now={d.voters} prev={prev?.voters} />,
              <Delta key="f" now={d.posts} prev={prev?.posts} />,
            ];
          })}
        />
      </Section>

      <Section
        title="Visits by source"
        note="Each visit's own tags: an X ad click (twclid) or utm_source=x/twitter is the X campaign, a t.co / x.com referrer is X organic. Tip: put utm_source on every campaign link, because apps often hide the referrer."
      >
        <Rows
          head={["Source", "Visitors today", "Yesterday", "Visitors", "Visits", "Top tags"]}
          rows={s.visitSources.map((r) => [r.label, r.today, r.yesterday, r.visitors, r.visits, <span key="t" className="text-xs text-zinc-500">{r.detail || "—"}</span>])}
        />
      </Section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-xs text-zinc-500">{k}</div>
            <div className="text-2xl font-medium">{v}</div>
          </div>
        ))}
      </div>

      <Section
        title="New sign-ups, one by one"
        note="Real accounts since the clean start date, newest first (admins left out, no emails, ZIP cut to 3 digits). Source is their first visit. Tap a row to see every vote, before and after signing up. Back days = later New York days they visited again."
      >
        {journeys.length === 0 ? (
          <p className="text-sm text-zinc-500">No sign-ups yet.</p>
        ) : (
          <div className="divide-y divide-ink/10">
            {journeys.map((j) => (
              <details key={`${j.handle}-${j.signedUpAt}`} className="py-2">
                <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">@{j.handle ?? "?"}</span>
                  <span className="text-xs text-zinc-500">{nyTime(j.signedUpAt)}</span>
                  <span className={`chip !py-0.5 text-[11px] ${j.source.startsWith("x_") ? "chip-on" : ""}`}>{j.sourceLabel}</span>
                  <span className="text-xs text-zinc-500">
                    {[j.sex, j.ageRange, j.zip3 && `ZIP ${j.zip3}xx`].filter(Boolean).join(" · ") || "no profile"}
                  </span>
                  <span className="ml-auto text-xs tabular-nums">
                    votes {j.votesBefore} before / <b>{j.votesAfter} after</b> · posts {j.posts} · back days {j.returnDays}
                  </span>
                </summary>
                <div className="mt-2 space-y-1 pl-1 text-xs">
                  <p className="text-zinc-500">
                    First visit tag: {j.sourceTag || "none"} · follows {j.follows} · last seen {j.lastSeen ? nyTime(j.lastSeen) : "—"}
                  </p>
                  {j.votes.length === 0 ? (
                    <p className="text-zinc-500">No votes.</p>
                  ) : (
                    <ol className="space-y-0.5">
                      {j.votes.map((v, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="w-28 shrink-0 text-zinc-500">{nyTime(v.at)}</span>
                          <span className={`w-12 shrink-0 ${v.after ? "text-green" : "text-zinc-500"}`}>{v.after ? "after" : "before"}</span>
                          <span className="min-w-0 flex-1">
                            {battleLink(v.slug, v.title)} <span className="text-zinc-500">→ {v.picked}{v.method ? ` (${v.method})` : ""}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`Sign-ups by source · last ${acq.days} days`}
        note={`Where each new account first came from (their first visit, incl. visits before signing up). X campaign = an X ad click (twclid) or utm_source=x/twitter; X organic = a link from t.co / x.com. Engaged = voted on ${acq.minVoteDays}+ different days, or posted a battle, within ${acq.windowDays} days of signing up. "Engaged (full ${acq.windowDays}d)" only counts people who signed up at least ${acq.windowDays} days ago, so sources are compared fairly. The X pixel fires a sign-up conversion for every new account.`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ["Sign-ups", acq.total.signups],
              ["Engaged so far", `${acq.total.engaged} (${pct(acq.total.engaged, acq.total.signups)})`],
              [`Engaged users (all, 30d)`, acq.overall.engaged30],
              ["Active voters (7d)", acq.overall.active7],
              ["Accounts (all time)", acq.overall.accounts],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface p-2.5">
              <div className="text-xs text-zinc-500">{k}</div>
              <div className="text-xl font-medium">{v}</div>
            </div>
          ))}
        </div>
        <Rows
          head={["Source", "Sign-ups", "Share", "Engaged", "Engaged %", `Engaged (full ${acq.windowDays}d)`, "Avg votes", "Posted", "Active 7d"]}
          rows={acq.rows.map((r) => [
            <span key={r.source} className={r.source === "x_campaign" ? "font-medium" : undefined}>{r.label}</span>,
            r.signups,
            pct(r.signups, acq.total.signups),
            r.engaged,
            pct(r.engaged, r.signups),
            r.matured ? `${pct(r.engagedMatured, r.matured)} of ${r.matured}` : "—",
            r.avgVotes.toFixed(1),
            `${Math.round(r.postedPct * 100)}%`,
            r.active7,
          ])}
        />
      </Section>

      <Section
        title="Engagement score (Shimon)"
        note="Share of a battle's real voters who came back 1–3 days later (next day counts most). Updates live when a voter returns, plus a full recount daily. Needs 3+ voters with a day to come back."
      >
        <div><RecomputeEngagement /></div>
        <Rows
          head={["Battle", "Score", "Voters", "Came back", "Type"]}
          rows={s.topEngaging.map((b) => [
            battleLink(b.slug, b.title),
            Math.round(b.score * 100),
            b.voters,
            Number(b.returns).toFixed(1),
            `${b.kind}${b.seed ? " · seed" : ""}`,
          ])}
        />
      </Section>

      <Section
        title="By theme (AI tags)"
        note="Each battle is tagged by AI when posted: theme, stakes, and what picking each side suggests about the voter. Real votes are all-time; views are for the selected window."
      >
        <div><TagBattles remaining={s.untagged} /></div>
        <Rows
          head={["Theme", "Battles", "Real votes", "Vote rate", "Avg score"]}
          rows={s.byTheme.map((r) => [r.tag.replace(/_/g, " "), r.battles, r.real_votes, pct(r.voted_views, r.views), r.score == null ? "—" : Math.round(r.score * 100)])}
        />
      </Section>

      <Section
        title="What groups lean toward (taste profiles)"
        note={`From picks on AI-tagged battles by ${taste.people} signed-in people with data consent on (${taste.picks} picks). Groups only, shown once they have ${taste.minGroup}+ people. "1.6×" = this trait shows up 1.6 times as often in the group's picks as in everyone's.`}
      >
        <Rows
          head={["Group", "People", "Leans toward"]}
          rows={taste.groups.map((g) => [
            g.group,
            g.people,
            g.leans.length ? g.leans.map((l) => `${l.trait.replace(/_/g, " ")} ${l.lift.toFixed(1)}×`).join(", ") : "No clear lean yet",
          ])}
        />
      </Section>

      <Section title="By stakes" note="Small (snack, nail colour), medium (event outfit, gadget), big (house, job, proposal).">
        <Rows
          head={["Stakes", "Battles", "Real votes", "Vote rate", "Avg score"]}
          rows={s.byStakes.map((r) => [r.tag, r.battles, r.real_votes, pct(r.voted_views, r.views), r.score == null ? "—" : Math.round(r.score * 100)])}
        />
      </Section>

      <Section title="Text vs photo" note="Views in the Vote deck, and how many turned into a vote by the same person.">
        <Rows head={["Card type", "Views", "Voted", "Vote rate", "Median pick"]} rows={s.byKind.map((k) => [k.kind ?? "?", k.views, k.voted, pct(k.voted, k.views), secs(k.median_ms)])} />
      </Section>

      <Section title="Raw source tags" note="utm_source, else the referring site, else direct, and how many of those visitors voted.">
        <Rows head={["Source", "Visits", "Visitors", "Voted", "Voter rate"]} rows={s.sources.map((r) => [r.source, r.sessions, r.visitors, r.voters, pct(r.voters, r.visitors)])} />
      </Section>

      <Section
        title="Win-back emails"
        note={`${wb.enabled ? "On" : "Off (economy setting winbackEmails = 1 turns it on)"}. ${wb.lapsingNow} people are drifting away right now. ${wb.holdoutPct}% of them get no email so we can compare. Last 30 days:`}
      >
        <Rows
          head={["Group", "People", "Voted within 3 days", "Rate"]}
          rows={wb.arms.map((r) => [r.arm === "email" ? "Got the email" : "No email (holdout)", r.people, r.back3, pct(r.back3, r.people)])}
        />
      </Section>

      <Section title="Next-day return" note="People first seen that day (New York time) who visited again the next day.">
        <Rows head={["First seen", "New visitors", "Back next day", "Rate"]} rows={s.retention.map((r) => [r.day, r.new_visitors, r.back_d1, pct(r.back_d1, r.new_visitors)])} />
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="How deep people go" note="Cards viewed by position in the deck.">
          <Rows head={["Position", "Views"]} rows={s.depth.map((d) => [d.bucket, d.views])} />
        </Section>
        <Section title="How people pick">
          <Rows head={["Method", "Votes"]} rows={s.methods.map((m) => [m.method, m.n])} />
        </Section>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Closest to 50/50" note="All time, 10+ real votes.">
          <Rows head={["Battle", "A", "B"]} rows={s.closest.map((b) => [battleLink(b.slug, b.title), pct(b.a, b.total), pct(b.b, b.total)])} />
        </Section>
        <Section title="Most one-sided" note="All time, 10+ real votes.">
          <Rows head={["Battle", "A", "B"]} rows={s.lopsided.map((b) => [battleLink(b.slug, b.title), pct(b.a, b.total), pct(b.b, b.total)])} />
        </Section>
      </div>
    </div>
  );
}
