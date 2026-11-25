import Link from "next/link";
import { getBrainStats, type BrainView } from "@/server/services/brain";
import { tasteByGroup } from "@/server/services/taste-profiles";
import { winbackStats } from "@/server/services/winback";
import { signupSources } from "@/server/services/acquisition";
import { brainChecks } from "@/server/services/brain-checks";
import { signupJourneys } from "@/server/services/signup-journeys";
import { gateTestResults } from "@/server/services/gate-test";
import { ARM_LABELS, type GateCell } from "@/server/services/gate-test-rules";
import { LoadZipIncome, RecomputeEngagement, TagBattles } from "@/components/admin/AdminActions";
import { passiveStats, type GroupRow } from "@/server/services/passive-stats";
import { aboutStats } from "@/server/services/about-stats";
import type { BrainListKind } from "@/server/services/brain-lists";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brain" };

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");
const pctN = (x: number) => `${(100 * x).toFixed(1)}%`;
const gateRow = (day: React.ReactNode, group: string, c: GateCell): React.ReactNode[] => [
  day,
  group,
  c.visitors,
  c.votes,
  c.avgVotes.toFixed(2),
  `${c.reachedGate} (${pct(c.reachedGate, c.visitors)})`,
  c.signups,
  pctN(c.signupRate),
];
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

const ratio = (n: number, d: number) => (d ? n / d : null);

/** "4.2 +0.8": an average with its change from the day before. */
function Ratio({ now, prev }: { now: number | null; prev?: number | null }) {
  if (now == null) return <>—</>;
  const d = prev == null ? 0 : Math.round((now - prev) * 10) / 10;
  return (
    <>
      {now.toFixed(1)}
      {d !== 0 && <span className={`ml-1 text-[11px] ${d > 0 ? "text-green" : "text-b"}`}>{d > 0 ? `+${d.toFixed(1)}` : `−${(-d).toFixed(1)}`}</span>}
    </>
  );
}

export default async function BrainPage({ searchParams }: { searchParams: Promise<{ days?: string; view?: string }> }) {
  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const view: BrainView = sp.view === "all" ? "all" : "clean";
  const href = (o: { days?: number; view?: BrainView }) => `/admin/brain?days=${o.days ?? days}${(o.view ?? view) === "all" ? "&view=all" : ""}`;
  const [s, taste, wb, acq, journeys, gt, ps, ab] = await Promise.all([
    getBrainStats(days, view),
    tasteByGroup(),
    winbackStats(),
    signupSources(Math.max(days, 30), view),
    signupJourneys(),
    gateTestResults(days),
    passiveStats(view, days),
    aboutStats(view, days),
  ]);
  const t = s.tiles;
  const n = (k: string) => Number(t[k] ?? 0);
  const viewedTotal = s.byKind.reduce((a, k) => a + k.seen, 0);
  const viewedVoted = s.byKind.reduce((a, k) => a + k.voted, 0);
  const placeKind = (pl: string, k: string) => s.votePlaces.filter((r) => r.place === pl && r.kind === k).reduce((a, r) => a + r.n, 0);
  const votesByKind = (k: string) => s.votePlaces.filter((r) => r.kind === k).reduce((a, r) => a + r.n, 0);
  const placeTotal = s.votePlaces.reduce((a, r) => a + r.n, 0);
  const places = [...new Set(s.votePlaces.map((r) => r.place))];
  const kinds = [...new Set(["text", "photo", ...s.byKind.map((k) => k.kind ?? "?")])];
  const checks = brainChecks({
    visits: n("sessions"),
    visitors: n("visitors"),
    votes: n("real_votes"),
    voters: n("voters"),
    signups: n("signups"),
    battles: n("real_battles"),
    daily: s.daily,
    visitSources: s.visitSources,
    byKind: s.byKind,
    votePlaces: s.votePlaces,
    rawSources: s.sources,
    signupSourcesTotal: acq.days === days ? acq.total.signups : undefined,
  });
  const failed = checks.filter((c) => !c.ok);
  // Third item = the list behind the number (/admin/brain/list/[kind]); everything with one is clickable.
  const tiles: [string, string | number, BrainListKind?][] = [
    ["Visits", n("sessions"), "visitors"],
    ["Visitors (people)", n("visitors"), "visitors"],
    ["Deck cards shown", n("views")],
    // Share of cards seen (person × battle) that the same person voted on.
    ["Cards seen → voted", pct(viewedVoted, viewedTotal)],
    [view === "clean" ? "Votes by real people" : "Votes (incl. seed)", n("real_votes"), "votes"],
    ["People who voted", n("voters"), "voters"],
    ["Median time to pick", secs(t.median_pick_ms)],
    ["Skips", n("skips")],
    ["Hit sign-up wall", n("gates"), "gates"],
    ["Sign-ups", n("signups"), "signups"],
    ["Vote changes", n("changed")],
    [view === "clean" ? "Battles posted by real people" : "Battles posted", n("real_battles"), "battles"],
    ["Seed votes (all time, excluded)", n("seed_votes_all")],
  ];
  const listHref = (kind: BrainListKind, day?: string) =>
    `/admin/brain/list/${kind}?days=${days}${view === "all" ? "&view=all" : ""}${day ? `&day=${day}` : ""}`;

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
          ? `Clean view: real people only, counting from ${nyDate(s.cleanFrom!)} (New York time). Leaves out the fake seed votes, made-up seed accounts, admins and their browsers, and bots. Real people's votes on seed battles count; seed battles don't count as posted battles. Nothing is deleted; "All data" shows everything. Change the start date with brainCleanFrom in Config.`
          : "All data: everything we have, including the 5,000 seed votes, seed battles and admin test activity (bots still left out)."}{" "}
        Hypotheses and requests live in the repo under docs/brain/.
      </p>

      <div className={`card p-3 text-sm ${failed.length ? "ring-1 ring-b" : ""}`}>
        {failed.length === 0 ? (
          <span>
            <span className="text-green">✓</span> All {checks.length} number checks pass: the tables below add up to the tiles.
          </span>
        ) : (
          <>
            <div className="font-medium text-b">{failed.length} number check{failed.length > 1 ? "s" : ""} failed. Tell Claude; something is counting wrong.</div>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {failed.map((c, i) => (
                <li key={i}>
                  {c.rule}: {c.detail}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Section title="Day by day" note="New York days, newest first. Tap any number to see who or what is behind it. The small number is the change from the day before. Visits, votes, sign-ups and battles add up to the tiles; Visitors and Voters are people, so someone active on two days counts on both. Votes per voter = votes ÷ people who voted that day; votes per visitor = votes ÷ everyone who visited.">
        <Rows
          head={["Day", "Visitors (people)", "Visits", "Sign-ups", "Votes", "Voters (people)", "Votes per voter", "Votes per visitor", "Battles posted"]}
          rows={s.daily.map((d, i) => {
            const prev = s.daily[i + 1];
            const cell = (kind: BrainListKind, now: number, before: number | undefined) =>
              now > 0 ? (
                <Link key={kind + now} href={listHref(kind, d.day)} className="underline decoration-ink/20 underline-offset-2 hover:decoration-accent">
                  <Delta now={now} prev={before} />
                </Link>
              ) : (
                <Delta key={kind} now={now} prev={before} />
              );
            return [
              d.day,
              cell("visitors", d.visitors, prev?.visitors),
              cell("visitors", d.visits, prev?.visits),
              cell("signups", d.signups, prev?.signups),
              cell("votes", d.votes, prev?.votes),
              cell("voters", d.voters, prev?.voters),
              <Ratio key="vpv" now={ratio(d.votes, d.voters)} prev={prev && ratio(prev.votes, prev.voters)} />,
              <Ratio key="vpvis" now={ratio(d.votes, d.visitors)} prev={prev && ratio(prev.votes, prev.visitors)} />,
              cell("battles", d.posts, prev?.posts),
            ];
          })}
        />
      </Section>

      <Section
        title="Sign-up gate test (A/B)"
        note={`Every new signed-out browser is put in a group at random and stays there. A (control): after ${gt.limit} free votes, a sign-up wall they can't skip. B: a sign-up dialog they can close and keep voting; it shows again every ${gt.every} votes. ${gt.pct}% go to B (gateTestPct in Config; 0 stops the test, everyone gets A). Rows are by the day the browser was first seen (New York). Votes count everything that browser did since, as a guest and in the account it signed up to; seed votes, bots and admins left out. Reached the gate = saw the wall or dialog at least once.`}
      >
        {gt.startedAt ? (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {(
                [
                  ["Sign-up rate, A → B", `${pctN(gt.total.control.signupRate)} → ${pctN(gt.total.soft.signupRate)}`, gt.signupLift, gt.signupP],
                  ["Avg votes per visitor, A → B", `${gt.total.control.avgVotes.toFixed(1)} → ${gt.total.soft.avgVotes.toFixed(1)}`, gt.votesLift, gt.votesP],
                ] as const
              ).map(([label, value, lift, p]) => (
                <div key={label} className="rounded-xl bg-surface p-3 md:col-span-2">
                  <div className="text-xs text-zinc-500">{label}</div>
                  <div className="text-lg tabular-nums">{value}</div>
                  <div className="text-xs text-zinc-500">
                    {lift == null ? "Not enough data yet" : `B is ${lift >= 0 ? "+" : "−"}${Math.abs(Math.round(lift * 100))}% vs A · `}
                    {p == null ? "" : p < 0.05 ? <span className="text-green">real difference (p = {p.toFixed(3)})</span> : `could be chance (p = ${p.toFixed(2)})`}
                  </div>
                </div>
              ))}
            </div>
            <Rows
              head={["Day", "Group", "Visitors", "Votes", "Avg votes per visitor", "Reached the gate", "Sign-ups", "Sign-up rate"]}
              rows={[
                ...(["control", "soft"] as const).map((arm) => gateRow(<b key="t">All days</b>, ARM_LABELS[arm], gt.total[arm])),
                ...gt.daily.flatMap((d) => (["control", "soft"] as const).map((arm) => gateRow(d.day, ARM_LABELS[arm], d[arm]))),
              ]}
            />
            <p className="text-xs text-zinc-500">
              Test started {nyTime(gt.startedAt)}. Judge it on the All days rows once each group has a few hundred visitors; a green
              &quot;real difference&quot; means p &lt; 0.05. Newer days have had less time to vote and sign up, so compare A and B on the same day,
              not one day with another.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">{gt.pct > 0 ? "Running: no signed-out visitors yet." : "Off (gateTestPct is 0 in Config)."}</p>
        )}
      </Section>

      <Section
        title="Who visitors are (no questions asked)"
        note={`People who visited in this window, from signals every browser sends: state from the IP address (Vercel's geolocation, metro-level), iPhone vs Android, phone price tier (iPhone screen size; Android model), the app they opened us in, and an income band estimated from their ZIP area's Census median income (typed ZIP, else the IP guess) nudged by phone tier. Estimates for groups, never shown to anyone. Collected from Nov 25; older visitors show as unknown.`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["State (IP)", ps.region.slice(0, 12)],
              ["Platform", ps.platform],
              ["Phone tier", ps.tier],
              ["Opened in", ps.inApp],
              ["Est. income band", ps.income],
            ] as [string, GroupRow[]][]
          ).map(([label, rows]) => (
            <div key={label}>
              <Rows
                head={[label, "People", "Voted", "Signed up"]}
                rows={rows.map((r) => [r.key, r.visitors, `${r.voted} (${pct(r.voted, r.visitors)})`, `${r.signedUp} (${pct(r.signedUp, r.visitors)})`])}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{ps.zipIncomeRows ? `Census income loaded for ${ps.zipIncomeRows.toLocaleString()} ZIP areas.` : "Census income isn't loaded yet (the daily job loads it; or tap the button)."}</span>
          <LoadZipIncome rows={ps.zipIncomeRows} />
        </div>
      </Section>

      <Section
        title="About-you cards"
        note={`One-tap questions in the Vote deck (sex after vote 2, age 4, relationship 7, ZIP 12; with an account: kids 20, home 25, work 35; numbers in Config). ${ab.holdoutPct}% of people never see a card, so the second table shows what cards cost or add in votes per visitor.`}
      >
        <Rows
          head={["Question", "Shown", "Answered", "Skipped", "Answer rate"]}
          rows={ab.questions.map((r) => [r.id === "zip" ? "ZIP" : r.id[0].toUpperCase() + r.id.slice(1), r.shown, r.answered, r.skipped, pct(r.answered, r.shown)])}
        />
        <Rows
          head={["Group", "Visitors", "Votes", "Votes per visitor"]}
          rows={(["cards", "holdout"] as const).map((k) => [
            k === "cards" ? "Sees cards" : `Holdout (${ab.holdoutPct}%, no cards)`,
            ab.arms[k].visitors,
            ab.arms[k].votes,
            ab.arms[k].visitors ? (ab.arms[k].votes / ab.arms[k].visitors).toFixed(2) : "—",
          ])}
        />
      </Section>

      <Section
        title="Visits by source"
        note="Each visit's own tags: an X ad click (twclid) or utm_source=x/twitter is the X campaign, a t.co / x.com referrer is X organic. Visits add up to the Visits tile; a person who came two ways counts under both. Tip: put utm_source on every campaign link, because apps often hide the referrer."
      >
        <Rows
          head={["Source", "People today", "People yesterday", "People", "Visits", "Top tags"]}
          rows={s.visitSources.map((r) => [r.label, r.today, r.yesterday, r.visitors, r.visits, <span key="t" className="text-xs text-zinc-500">{r.detail || "—"}</span>])}
        />
      </Section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v, list]) =>
          list ? (
            <Link key={k} href={listHref(list)} className="card block p-3 transition hover:ring-1 hover:ring-accent">
              <div className="text-xs text-zinc-500">{k} ›</div>
              <div className="text-2xl font-medium">{v}</div>
            </Link>
          ) : (
            <div key={k} className="card p-3">
              <div className="text-xs text-zinc-500">{k}</div>
              <div className="text-2xl font-medium">{v}</div>
            </div>
          ),
        )}
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
                  <span className="text-xs text-zinc-500">{j.signedUpAt ? nyTime(j.signedUpAt) : "guest"}</span>
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
                    First visit tag: {j.sourceTag || "none"} · follows {j.follows} · last seen {j.lastSeen ? nyTime(j.lastSeen) : "—"} ·{" "}
                    <Link href={`/admin/journey/person/${encodeURIComponent(j.who)}`} className="text-accent underline-offset-2 hover:underline">
                      Full journey ›
                    </Link>
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
        title={`Sign-ups by source · last ${acq.days} days${view === "clean" ? " (from the clean start date)" : ""}`}
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
        note="Share of a battle's real voters who came back 1–3 days later (next day counts most). All-time score from real votes only (seed votes never count), so seed battles can rank too. Updates live when a voter returns, plus a full recount daily. Needs 3+ voters with a day to come back."
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
        note="Each battle is tagged by AI when posted: theme, stakes, and what picking each side suggests about the voter. Battles posted by real people only (seed battles aren't AI-tagged). Votes and views are for the selected window."
      >
        <div><TagBattles remaining={s.untagged} /></div>
        <Rows
          head={["Theme", "Battles", "Votes", "Vote rate", "Avg score"]}
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
          head={["Stakes", "Battles", "Votes", "Vote rate", "Avg score"]}
          rows={s.byStakes.map((r) => [r.tag, r.battles, r.real_votes, pct(r.voted_views, r.views), r.score == null ? "—" : Math.round(r.score * 100)])}
        />
      </Section>

      <Section
        title="Text vs photo"
        note={`All votes = every vote counted in the "Votes by real people" tile (${n("real_votes")}), from any place, so this column adds up to the tile. The other columns are the Vote deck only: Times shown counts every display, Cards seen counts each person × battle once, and Seen → voted counts the cards that person then voted on. Votes made on the homepage card, a battle page or Discover have no deck view, so they're in All votes but not in Seen → voted (see "Where votes were made").`}
      >
        <Rows
          head={["Card type", "All votes", "Times shown", "Cards seen", "Seen → voted", "Vote rate", "Median pick"]}
          rows={[
            ...kinds.map((k) => {
              const d = s.byKind.find((r) => (r.kind ?? "?") === k);
              return [k, votesByKind(k), d?.views ?? 0, d?.seen ?? 0, d?.voted ?? 0, pct(d?.voted ?? 0, d?.seen ?? 0), secs(d?.median_ms ?? null)];
            }),
            ["Total", placeTotal, s.byKind.reduce((a, k) => a + k.views, 0), viewedTotal, viewedVoted, pct(viewedVoted, viewedTotal), ""],
          ]}
        />
      </Section>

      <Section title="Where votes were made" note={`Every counted vote, by the screen it was made on. The total matches the "Votes by real people" tile.`}>
        <Rows
          head={["Place", "Text", "Photo", "Total"]}
          rows={[
            ...places.map((pl) => {
              const t = placeKind(pl, "text"), ph = placeKind(pl, "photo");
              return [pl, t, ph, t + ph];
            }),
            ["Total", votesByKind("text"), votesByKind("photo"), placeTotal],
          ]}
        />
      </Section>

      <Section title="Raw source tags" note="utm_source, else the referring site, else direct. These are people, not votes: Visitors who came that way, and how many of them voted at least once.">
        <Rows head={["Source", "Visits", "Visitors (people)", "People who voted", "Voter rate"]} rows={s.sources.map((r) => [r.source, r.sessions, r.visitors, r.voters, pct(r.voters, r.visitors)])} />
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

      <Section title="Next-day return" note="People first seen in this window on that day (New York time) who visited again the next day. The last day can't have returns yet.">
        <Rows head={["First seen", "New visitors", "Back next day", "Rate"]} rows={s.retention.map((r) => [r.day, r.new_visitors, r.back_d1, pct(r.back_d1, r.new_visitors)])} />
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="How deep people go" note="Deck cards shown, by position in the deck (adds up to the Deck cards shown tile).">
          <Rows head={["Position", "Times shown"]} rows={s.depth.map((d) => [d.bucket, d.views])} />
        </Section>
        <Section title="How people pick" note="Every vote, by how it was made (tap, swipe, key), from the vote log.">
          <Rows head={["Method", "Votes"]} rows={s.methods.map((m) => [m.method, m.n])} />
        </Section>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Closest to 50/50" note={view === "clean" ? "10+ real votes since the clean start date." : "All time, 10+ votes incl. seed."}>
          <Rows head={["Battle", "A", "B"]} rows={s.closest.map((b) => [battleLink(b.slug, b.title), pct(b.a, b.total), pct(b.b, b.total)])} />
        </Section>
        <Section title="Most one-sided" note={view === "clean" ? "10+ real votes since the clean start date." : "All time, 10+ votes incl. seed."}>
          <Rows head={["Battle", "A", "B"]} rows={s.lopsided.map((b) => [battleLink(b.slug, b.title), pct(b.a, b.total), pct(b.b, b.total)])} />
        </Section>
      </div>
    </div>
  );
}
