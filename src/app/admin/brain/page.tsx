import { skipStats } from "@/server/services/skip-stats";
import Link from "next/link";
import { beforeAfterStats, getBrainStats, pinnedNumbers, type BrainView, type PinnedDay } from "@/server/services/brain";
import { change } from "@/server/services/before-after-rules";
import { unitEconomicsStats } from "@/server/services/unit-economics";
import { money, unitEconomics } from "@/server/services/unit-economics-rules";
import { tasteByGroup } from "@/server/services/taste-profiles";
import { winbackStats } from "@/server/services/winback";
import { signupSources } from "@/server/services/acquisition";
import { brainChecks } from "@/server/services/brain-checks";
import { signupJourneys } from "@/server/services/signup-journeys";
import { gateTestResults } from "@/server/services/gate-test";
import { ARM_LABELS, type GateCell } from "@/server/services/gate-test-rules";
import { LoadZipIncome, RecomputeEngagement, TagBattles } from "@/components/admin/AdminActions";
import { passiveStats, type GroupRow } from "@/server/services/passive-stats";
import { aboutStats, type ArmNumbers } from "@/server/services/about-stats";
import { profileBarStats } from "@/server/services/profile-progress";
import { pickbotStats } from "@/server/services/pickbot-stats";
import { ABOUT_QUESTIONS } from "@/lib/about";
import type { BrainListKind } from "@/server/services/brain-lists";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brain" };

const usd = (n: number, digits: number) => "$" + n.toFixed(digits);
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

type UeStats = Awaited<ReturnType<typeof unitEconomicsStats>>;

/** Unit economics: how it's calculated, with the current Config assumptions spelled out. */
function ueNote(ue: UeStats, view: BrainView) {
  const a = ue.assumptions;
  const lifetime =
    a.ueLifetimeVisits > 0
      ? `set to ${a.ueLifetimeVisits}`
      : "= measured visits per visitor (ueLifetimeVisits 0); early on this undercounts people who will come back";
  return [
    "The most we can pay to acquire a visitor and break even = what a visitor brings in minus what serving them costs.",
    `Measured from everyone who visited since ${ue.from} (all of it, whatever window is picked above; ueFrom in Config; ${view === "clean" ? "Clean" : "All data"} view): votes, visits and sign-ups, grouped by where they first came from.`,
    `Prices are assumptions in Config: ads ${money(a.ueAdCpm)} per 1,000 views, one every ${a.ueVotesPerAd} votes (ueAdCpm, ueVotesPerAd);`,
    `sponsored battles ${a.ueSponsoredSharePct}% of cards at ${money(a.ueSponsoredCpm)} per 1,000 votes (ueSponsoredSharePct, ueSponsoredCpm);`,
    `a signed-up user is worth ${money(a.ueSignupValue)} a year (ueSignupValue); lifetime visits ${lifetime}.`,
    "Serving cost = this month's usage above the fixed plan fees (/admin/finance) divided by this month's visitors; the fixed plans are a monthly bill the margin has to cover, shown below.",
  ].join(" ");
}

function ueTiles(ue: UeStats): [string, string, string][] {
  const o = ue.overall;
  const a = ue.assumptions;
  return [
    ["Break-even per visitor", money(o.breakEven), "the most to pay per visitor"],
    ["From ads", money(o.revenue.ads), `${o.lifetimeVotes.toFixed(1)} votes, 1 ad per ${a.ueVotesPerAd}`],
    ["From sponsored battles", money(o.revenue.sponsored), `${a.ueSponsoredSharePct}% of votes`],
    ["From sign-ups", money(o.revenue.signups), `${(100 * o.signupRate).toFixed(1)}% sign up × ${money(a.ueSignupValue)}`],
    [
      "Serving cost (usage)",
      ue.cost.perVisitor == null ? "—" : money(-ue.cost.perVisitor),
      ue.cost.usage == null ? "finance data unavailable" : `${money(ue.cost.usage)} usage ÷ ${ue.cost.visitors.toLocaleString()} visitors this month`,
    ],
  ];
}

/** One day of the Day by day table through the same unit economics (prices + this month's usage cost per visitor). */
function dayBreakEven(ue: UeStats, d: { visitors: number; visits: number; votes: number; signups: number }) {
  if (!d.visitors) return <span key="be">—</span>;
  const be = unitEconomics({ ...d, costPerVisitor: ue.cost.perVisitor }, ue.assumptions).breakEven;
  return (
    <span key="be" className={be > 0 ? "text-green" : "text-b"}>
      {money(be)}
    </span>
  );
}

/** Fixed plan fees vs the per-visitor margin: how many visitors a month cover them. */
function ueFixedLine(ue: UeStats): string {
  const fixed = ue.cost.fixedMonthly;
  if (fixed == null) return "";
  const be = ue.overall.breakEven;
  return be > 0
    ? `Fixed plans cost ${money(fixed)} a month; at ${money(be)} margin per visitor that takes about ${Math.ceil(fixed / be).toLocaleString()} visitors a month.`
    : `Fixed plans cost ${money(fixed)} a month; with no margin per visitor yet, visitors don't cover them.`;
}
/** "14 days", "1.5 days", "40 min", "6 h" for how much time a Before / After side covers. */
const spanLabel = (days: number) =>
  days >= 1 ? `${Math.round(days * 10) / 10} day${Math.round(days * 10) / 10 === 1 ? "" : "s"}` : days * 24 >= 1 ? `${Math.round(days * 24)} h` : `${Math.round(days * 1440)} min`;
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

const QUESTION_LABELS: Record<string, string> = {
  sex: "Sex",
  age: "Age",
  relationship: "Relationship",
  zip: "ZIP (v1 only)",
  kids: "Kids",
  education: "Education",
  housing: "Home (rent / own)",
  race: "Race / ethnicity",
  party: "Party",
  work: "Work",
};
const perVisitor = (a: ArmNumbers | { visitors: number; votes: number }) => (a.visitors ? (a.votes / a.visitors).toFixed(2) : "—");
/** Plain-language read of the no-cards group vs the cards group on votes per visitor. */
function verdict(holdout: { visitors: number; votes: number }, cards: { visitors: number; votes: number }, p: number | null) {
  if (!holdout.visitors || !cards.visitors) return "Not enough data yet";
  const h = holdout.votes / holdout.visitors;
  const c = cards.votes / cards.visitors;
  const lift = h ? (c - h) / h : 0;
  const side = `Cards ${lift >= 0 ? "+" : "−"}${Math.abs(Math.round(lift * 100))}% vs no cards`;
  if (p == null) return `${side} · not enough data yet`;
  return p < 0.05 ? `${side} · real difference (p = ${p.toFixed(3)})` : `${side} · could be chance (p = ${p.toFixed(2)})`;
}

function barVerdict(holdout: { visitors: number; votes: number }, bar: { visitors: number; votes: number }, p: number | null) {
  if (!holdout.visitors || !bar.visitors) return "Not enough data yet";
  const h = holdout.votes / holdout.visitors;
  const lift = h ? (bar.votes / bar.visitors - h) / h : 0;
  const side = `Votes per visitor with the bar ${lift >= 0 ? "+" : "−"}${Math.abs(Math.round(lift * 100))}% vs without`;
  if (p == null) return `${side} · not enough data yet`;
  return p < 0.05 ? `${side} · real difference (p = ${p.toFixed(3)})` : `${side} · could be chance (p = ${p.toFixed(2)})`;
}

/** Votes per visitor for one version, both groups together (cards + no cards). */
function sinceV2(versions: { version: string; from: string; cards: ArmNumbers; holdout: ArmNumbers }[]) {
  const v2 = versions.find((v) => v.version === "v2");
  if (!v2) return undefined;
  const v1 = versions.find((v) => v.version === "v1");
  const all = (v: typeof v2) => {
    const n = v.cards.visitors + v.holdout.visitors;
    return n ? ((v.cards.votes + v.holdout.votes) / n).toFixed(2) : "—";
  };
  const from = new Date(v2.from).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  return { now: all(v2), before: v1 ? all(v1) : "—", from: `${from} (cards v2)` };
}

/**
 * Pinned big numbers (Alex, Nov 25): today so far, yesterday underneath. Every tile opens what's behind it
 * (Alex, Nov 26): the big number opens today's list, the "Yesterday" line yesterday's. A ratio opens the people or
 * votes it's made of (votes per visitor → today's votes; % who voted → today's voters).
 */
function PinnedRow({
  today,
  yesterday,
  since,
  todayHref,
  yesterdayHref,
}: {
  today: PinnedDay;
  yesterday: PinnedDay;
  since?: { now: string; before: string; from: string };
  todayHref: (k: BrainListKind) => string;
  yesterdayHref: (k: BrainListKind) => string;
}) {
  const r = (x: number | null) => (x == null ? "—" : x.toFixed(2));
  const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
  type Item = { label: string; now: string | number; sub: string; href: string; subHref?: string };
  const day = (label: string, now: string | number, before: string | number, kind: BrainListKind): Item => ({
    label: `${label} · today`,
    now,
    sub: `Yesterday ${before}`,
    href: todayHref(kind),
    subHref: yesterdayHref(kind),
  });
  const items: Item[] = [
    day("Votes per visitor", r(today.votesPerVisitor), r(yesterday.votesPerVisitor), "votes"),
    day("% of visitors who voted", pct(today.votersPerVisitor), pct(yesterday.votersPerVisitor), "voters"),
    day("New voters", today.newVoters, yesterday.newVoters, "newvoters"),
    day("New sign-ups", today.signups, yesterday.signups, "signups"),
    day("New battles posted", today.posts, yesterday.posts, "battles"),
  ];
  // Temporary (Alex, Nov 25): votes per visitor since cards v2 went live, everyone incl. the no-cards group. Opens the v1 vs v2 table.
  if (since) items.splice(1, 0, { label: `Votes per visitor since ${since.from}`, now: since.now, sub: `Cards v1 ${since.before}`, href: "#cards-versions" });
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Pinned numbers, today">
      {items.map((it, i) => (
        // The whole card opens `href` (stretched link); the Yesterday line sits above it with its own link.
        <div key={it.label} className={`card relative p-4 transition hover:ring-1 hover:ring-accent ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
          <Link href={it.href} className="text-xs text-zinc-500 after:absolute after:inset-0 after:content-['']">
            {it.label} ›
          </Link>
          <div className="font-display text-[40px] font-semibold leading-none tabular-nums">{it.now}</div>
          {it.subHref ? (
            <Link href={it.subHref} className="relative z-10 mt-1 inline-block text-xs text-zinc-500 underline decoration-ink/20 underline-offset-2 hover:decoration-accent">
              {it.sub}
            </Link>
          ) : (
            <div className="mt-1 text-xs text-zinc-500">{it.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/** A number that opens the list behind it (only when there's something to show). */
function Num({ href, n, children }: { href: string; n: number; children?: React.ReactNode }) {
  if (!n) return <>{children ?? n}</>;
  return (
    <Link href={href} className="underline decoration-ink/20 underline-offset-2 hover:decoration-accent">
      {children ?? n}
    </Link>
  );
}

/** Deck position bucket label (skip-stats) → position range for the cards list. */
const POS_RANGE: Record<string, string> = { "1": "1-1", "2–5": "2-5", "6–10": "6-10", "11–20": "11-20", "21+": "21-99999" };
/** "Where votes were made" place label (brain.ts) → vote.source for the votes list. */
const PLACE_KEY: Record<string, string> = {
  "Vote deck": "feed",
  "Homepage card": "home",
  Discover: "discover",
  Search: "search",
  Profile: "profile",
  "Seed votes (fake, All view only)": "seed",
  "Battle page / shared link": "page",
};

function Section({ title, note, id, children }: { title: string; note?: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-4 space-y-2 p-4">
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
  const [s, taste, wb, acq, journeys, gt, ps, ab, ba, sk, ue, pins, pb, pk] = await Promise.all([
    getBrainStats(days, view),
    tasteByGroup(),
    winbackStats(),
    signupSources(Math.max(days, 30), view),
    signupJourneys(),
    gateTestResults(days),
    passiveStats(view, days),
    aboutStats(view, days),
    beforeAfterStats(view),
    skipStats(view, days),
    unitEconomicsStats(view),
    pinnedNumbers(view),
    profileBarStats(view, days),
    pickbotStats(view, days),
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
  const listHref = (kind: BrainListKind, day?: string, more?: Record<string, string>) => {
    const q = new URLSearchParams({ days: String(days) });
    if (view === "all") q.set("view", "all");
    if (day) q.set("day", day);
    for (const [k, v] of Object.entries(more ?? {})) q.set(k, v);
    return `/admin/brain/list/${kind}?${q}`;
  };
  // Every tile opens the list behind it (Alex, Nov 26). A rate or median opens the rows it's computed from.
  const tiles: [string, string | number, string][] = [
    ["Visits", n("sessions"), listHref("visitors")],
    ["Visitors (people)", n("visitors"), listHref("visitors")],
    ["Deck cards shown", n("views"), listHref("cards")],
    // Share of cards seen (person × battle) that the same person voted on.
    ["Cards seen → voted", pct(viewedVoted, viewedTotal), listHref("cards", undefined, { outcome: "voted" })],
    [view === "clean" ? "Votes by real people" : "Votes (incl. seed)", n("real_votes"), listHref("votes")],
    ["People who voted", n("voters"), listHref("voters")],
    ["Median time to pick", secs(t.median_pick_ms), listHref("votes", undefined, { place: "feed" })],
    ["Skips", n("skips"), listHref("skips")],
    // Of deck cards people decided on (voted or skipped), the share they skipped.
    ["Deck skip rate", pct(sk.total.skipped, sk.total.voted + sk.total.skipped), listHref("cards", undefined, { outcome: "skipped" })],
    ["Hit sign-up wall", n("gates"), listHref("gates")],
    ["Sign-ups", n("signups"), listHref("signups")],
    ["Vote changes", n("changed"), listHref("changes")],
    [view === "clean" ? "Battles posted by real people" : "Battles posted", n("real_battles"), listHref("battles")],
    ["Seed votes (all time, excluded)", n("seed_votes_all"), listHref("seedvotes")],
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
          ? `Clean view: real people only, counting from ${nyDate(s.cleanFrom!)} (New York time). Leaves out the fake seed votes, made-up seed accounts, admins and their browsers, and bots. Real people's votes on seed battles count; seed battles don't count as posted battles. Nothing is deleted; "All data" shows everything. Change the start date with brainCleanFrom in Config.`
          : "All data: everything we have, including the 5,000 seed votes, seed battles and admin test activity (bots still left out)."}{" "}
        Hypotheses and requests live in the repo under docs/brain/.
      </p>

      <PinnedRow
        today={pins.today}
        yesterday={pins.yesterday}
        since={sinceV2(ab.versions)}
        todayHref={(k) => listHref(k, pins.todayDay)}
        yesterdayHref={(k) => listHref(k, pins.yesterdayDay)}
      />

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

      <Section title="Day by day" note="New York days, newest first. Tap any number to see who or what is behind it. The small number is the change from the day before. Visits, votes, sign-ups and battles add up to the tiles; Visitors and Voters are people, so someone active on two days counts on both. Votes per voter = votes ÷ people who voted that day; votes per visitor = votes ÷ everyone who visited. Break-even per visitor = that day's visitors, visits, votes and sign-ups run through Unit economics (same prices and serving cost).">
        <Rows
          head={["Day", "Visitors (people)", "Visits", "Sign-ups", "Votes", "Voters (people)", "Votes per voter", "Votes per visitor", "Battles posted", "Break-even per visitor"]}
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
              dayBreakEven(ue, d),
            ];
          })}
        />
      </Section>

      <Section title={`Unit economics: what a visitor is worth · since ${ue.from}`} note={ueNote(ue, view)}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {ueTiles(ue).map(([label, value, sub], i) => (
            <div key={label} className={`rounded-xl p-3 ${i === 0 ? (ue.overall.breakEven > 0 ? "bg-green-soft" : "bg-b-soft") : "bg-surface"}`}>
              <div className="text-xs text-zinc-500">{label}</div>
              <div className={`text-lg tabular-nums ${i === 0 ? (ue.overall.breakEven > 0 ? "text-green" : "text-b") : ""}`}>{value}</div>
              <div className="text-[11px] text-zinc-500">{sub}</div>
            </div>
          ))}
        </div>
        <Rows
          head={["First came from", "Visitors", "Votes per visitor", "Visits per visitor", "Sign-up rate", "Worth per visitor", "Break-even per visitor", "Per 1,000 visitors"]}
          rows={[
            { label: <b key="all">Everyone</b>, u: ue.overall },
            ...ue.sources.map((r) => ({ label: r.visitors < 30 ? `${r.label} (few)` : r.label, u: r })),
          ].map(({ label, u }) => [
            label,
            u.visitors,
            u.votesPerVisitor.toFixed(1),
            u.visitsPerVisitor.toFixed(2),
            `${(100 * u.signupRate).toFixed(1)}%`,
            money(u.revenue.total),
            <b key="b" className={u.breakEven > 0 ? "text-green" : "text-b"}>
              {money(u.breakEven)}
            </b>,
            money(u.breakEven * 1000),
          ])}
        />
        <p className="text-xs text-zinc-500">
          What moves it (everyone): sign-up rate ×2 → {money(ue.whatIf.doubleSignupRate)}; one more visit per person → {money(ue.whatIf.oneMoreVisit)}; a
          signed-up user worth 3× → {money(ue.whatIf.signupValueX3)}. Compare with what an ad click costs on X or Meta (about $0.30–$2): break-even above
          that means paid ads pay for themselves. {ueFixedLine(ue)}
        </p>
      </Section>

      <Section
        title={`Before vs after the change · ${ba.changeDay}${ba.changeTime ? ` ${ba.changeTime}` : ""}`}
        note={`The about-you launch (cards in the deck, "people like you", one-tap sign-up, taste profile) went live on ${ba.changeDay}${ba.changeTime ? ` at ${ba.changeTime} New York time. That day is split in two rows: until ${ba.changeTime} counts as Before, from ${ba.changeTime} as After` : "; that day counts as neither side"}. Same counting as Day by day (${view === "clean" ? "Clean" : "All data"} view). Averages are per day; partial days (the split day's halves and today so far) count as that fraction of a day. While a side covers only a few hours its per-day numbers are scaled up from very little data, so they swing a lot; the ratios (votes per visitor, sign-up rate) settle sooner. To compare around a different change, set beforeAfterFrom in Config (YYYYMMDDHHmm New York time, or YYYYMMDD).`}
      >
        <Rows
          head={["Per day", `Before (${spanLabel(ba.before.span)})`, `After (${spanLabel(ba.after.span)})`, "Change"]}
          rows={(
            [
              ["Visitors", ba.before.visitors, ba.after.visitors, (x: number) => x.toFixed(1)],
              ["Votes", ba.before.votes, ba.after.votes, (x: number) => x.toFixed(1)],
              ["Voters", ba.before.voters, ba.after.voters, (x: number) => x.toFixed(1)],
              ["Sign-ups", ba.before.signups, ba.after.signups, (x: number) => x.toFixed(1)],
              ["Votes per visitor", ba.before.votesPerVisitor, ba.after.votesPerVisitor, (x: number) => x.toFixed(2)],
              ["Votes per voter", ba.before.votesPerVoter, ba.after.votesPerVoter, (x: number) => x.toFixed(2)],
              ["Sign-up rate (of visitors)", ba.before.signupRate, ba.after.signupRate, (x: number) => `${(100 * x).toFixed(1)}%`],
            ] as const
          ).map(([label, b, a, fmt]) => {
            const c = ba.after.span > 0 && ba.before.span > 0 ? change(b, a) : null;
            return [
              label,
              ba.before.span > 0 ? fmt(b) : "—",
              ba.after.span > 0 ? fmt(a) : "—",
              c == null ? "—" : <span key="c" className={c > 0 ? "text-green" : c < 0 ? "text-b" : ""}>{`${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(Math.round(c * 100))}%`}</span>,
            ];
          })}
        />
        <Rows
          head={["Day", "Period", "Visitors", "Votes", "Voters", "Votes per visitor", "Votes per voter", "Sign-ups", "Sign-up rate"]}
          rows={ba.rows.map((d) => [
            d.label,
            d.period === "launch" ? <b key="p">Launch day</b> : d.period === "after" ? <span key="p" className="text-green">After</span> : "Before",
            d.visitors,
            d.votes,
            d.voters,
            d.visitors ? (d.votes / d.visitors).toFixed(1) : "—",
            d.voters ? (d.votes / d.voters).toFixed(1) : "—",
            d.signups,
            pct(d.signups, d.visitors),
          ])}
        />
        {ba.after.span === 0 && <p className="text-xs text-zinc-500">Nothing after the change yet.</p>}
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
        note={`One-tap questions in the Vote deck, no account needed: sex after vote 2, age 4, relationship 7, kids 9, education 11, home 13, race/ethnicity 16, party 19 (race and party have "Prefer not to say", which counts as answered); with an account, work 35. Numbers in Config. ZIP is no longer asked (since cards v2): it comes from the IP. ${ab.holdoutPct}% of people never see a card, so comparing them with everyone else shows what cards cost or add.`}
      >
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-xl bg-surface p-3">
            <div className="text-xs text-zinc-500">Votes per visitor, no-cards group → sees cards (this window)</div>
            <div className="text-2xl tabular-nums">
              {perVisitor(ab.arms.holdout)} → {perVisitor(ab.arms.cards)}
            </div>
            <div className="text-xs text-zinc-500">
              {verdict(ab.arms.holdout, ab.arms.cards, ab.holdoutP)}
            </div>
          </div>
          <div className="rounded-xl bg-surface p-3">
            <div className="text-xs text-zinc-500">Card answers per visitor who sees cards (this window)</div>
            <div className="text-2xl tabular-nums">
              {ab.arms.cards.visitors ? (ab.questions.reduce((t, q) => t + q.answered, 0) / ab.arms.cards.visitors).toFixed(2) : "—"}
            </div>
            <div className="text-xs text-zinc-500">How many demographics we learn per visitor, on top of what the IP and phone give us.</div>
          </div>
        </div>
        {ab.versions.length > 0 && (
          <>
            <h3 id="cards-versions" className="scroll-mt-4 pt-2 font-sans text-sm font-medium">Cards v1 vs v2</h3>
            <p className="text-xs text-zinc-500">
              v1 = sex, age, relationship, ZIP (from {nyTime(ab.versions[0].from)}). v2 = no ZIP card; kids, education, home, race, party without
              an account (starts by itself at the first new question shown{ab.versions[1] ? `: ${nyTime(ab.versions[1].from)}` : ", not yet"}). Whole
              version, not the day window. Goal: v2 keeps or raises votes per visitor AND learns more per visitor. The no-cards rows show what
              the same days looked like without cards.
            </p>
            <Rows
              head={["Version", "Group", "Visitors", "Votes per visitor", "Voters per visitor", "Answers per visitor", "Answered 1+", "Holdout vs cards"]}
              rows={ab.versions.flatMap((v) =>
                (["cards", "holdout"] as const).map((k) => [
                  <b key="v">{v.version}</b>,
                  k === "cards" ? "Sees cards" : `No cards (${ab.holdoutPct}%)`,
                  v[k].visitors,
                  perVisitor(v[k]),
                  v[k].visitors ? (v[k].voters / v[k].visitors).toFixed(2) : "—",
                  k === "cards" ? (v[k].visitors ? (v[k].answers / v[k].visitors).toFixed(2) : "—") : "—",
                  k === "cards" ? pct(v[k].answered, v[k].visitors) : "—",
                  k === "cards" ? <span key="p" className="text-xs">{verdict(v.holdout, v.cards, v.votesP)}</span> : "",
                ]),
              )}
            />
          </>
        )}
        <Rows
          head={["Question", "Shown", "Answered", "Skipped", "Answer rate"]}
          rows={ab.questions
            .filter((r) => r.shown > 0 || ABOUT_QUESTIONS[r.id].inDeck)
            .map((r) => [QUESTION_LABELS[r.id] ?? r.id, r.shown, r.answered, r.skipped, pct(r.answered, r.shown)])}
        />
      </Section>

      <Section
        title="Pickbot"
        note={`Ask tab (docs/plans/pickbot-prd.html). ${pk.open ? "Open to every signed-in person" : "Admins only (Config pickbotOpen = 0)"}; answers by ${pk.model}; ${pk.holdoutPct}% of accounts never get it. People = distinct people who did each step in the window.`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link href={listHref("askers")} className="card block p-3 transition hover:ring-1 hover:ring-accent">
            <div className="text-xs text-zinc-500">People who asked ›</div>
            <div className="text-2xl font-medium">{pk.usage.askers}</div>
          </Link>
          <div className="card p-3">
            <div className="text-xs text-zinc-500">Questions (not follow-ups)</div>
            <div className="text-2xl font-medium">{pk.usage.questions}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-zinc-500">Questions per asker</div>
            <div className="text-2xl font-medium">{pk.usage.askers ? (pk.usage.questions / pk.usage.askers).toFixed(1) : "—"}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-zinc-500">Asked again on another day</div>
            <div className="text-2xl font-medium">{pct(pk.usage.repeat, pk.usage.askers)}</div>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Got an answer: {pk.usage.answeredPeople} of {pk.usage.askers} askers ({pct(pk.usage.answeredPeople, pk.usage.askers)}); the rest stopped at the profile cards or
          the question was off-topic. Questions are private: the Brain shows topics and counts, never the words.
        </p>
        <Rows
          head={["Day", "Askers", "Questions", "Follow-ups", "Answers", "Tailored", "👍 / 👎", "Crowd posts", "Results back", "AI cost"]}
          rows={pk.daily.map((d) => [
            d.day,
            d.askers ? (
              <Link key="a" href={listHref("askers", d.day)} className="underline decoration-ink/20 underline-offset-2 hover:decoration-accent">
                {d.askers}
              </Link>
            ) : (
              0
            ),
            d.questions,
            d.followups,
            d.answers,
            d.tailored,
            `${d.up} / ${d.down}`,
            d.crowd,
            d.results,
            usd(d.cost, 2),
          ])}
        />
        <Rows
          head={["What people ask about", "Kind", "Questions", "People"]}
          rows={pk.themes.map((t) => [t.theme.replaceAll("_", " "), t.scope.replace("_", "-"), t.questions, t.people])}
        />
        <p className="pt-2 text-sm font-medium">“Ask Pickbot” card in the Vote deck: which position works best</p>
        <p className="text-xs text-zinc-500">
          {pk.promoOn ? "On" : "Off (Config pickbotPromo = 0)"}. Each signed-in person who hasn’t asked Pickbot yet sees it once, after a stable random number of
          picks in one deck visit (never the first 3). Active = used the deck in the window; reached = got that far in one visit. The fairest
          comparison is <b>asked per active person</b>: it counts people who never got far enough too.
        </p>
        <Rows
          head={["After pick", "Active", "Reached", "Saw it", "Tapped", "Asked (7 days)", "Tap rate", "Asked / saw", "Asked / active"]}
          rows={pk.promo.map((r) => {
            const best = Math.max(...pk.promo.map((x) => (x.active >= 20 ? x.asked / x.active : 0)));
            const rate = r.active ? r.asked / r.active : 0;
            return [
              r.at,
              r.active,
              r.reached,
              r.saw,
              r.tapped,
              r.asked,
              pct(r.tapped, r.saw),
              pct(r.asked, r.saw),
              <span key="b" className={r.active >= 20 && rate === best && best > 0 ? "font-semibold text-green" : undefined}>
                {pct(r.asked, r.active)}
              </span>,
            ];
          })}
        />
        <Rows head={["Step", "People", "Times"]} rows={pk.funnel.map((f) => [f.label, f.people, f.events])} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(
            [
              ["Answers", pk.totalAnswers],
              ["AI cost", usd(pk.totalCost, 2)],
              ["Cost per answer", pk.totalAnswers ? usd(pk.totalCost / pk.totalAnswers, 3) : "—"],
              [
                "Took the better-answer offer",
                pct(pk.choice.retailor ?? 0, (pk.choice.retailor ?? 0) + (pk.funnel.find((f) => f.name === "pickbot_battles_stopped")?.events ?? 0)),
              ],
              ["👍 rate", pct(pk.ratings.reduce((t, r) => t + r.up, 0), pk.ratings.reduce((t, r) => t + r.up + r.down, 0))],
              ["Crowd agreed with Pickbot", pct(pk.agree.yes, pk.agree.yes + pk.agree.no)],
            ] as [string, React.ReactNode][]
          ).map(([k, val]) => (
            <div key={k} className="card p-3">
              <div className="text-xs text-zinc-500">{k}</div>
              <div className="text-xl font-medium">{val}</div>
            </div>
          ))}
        </div>
        <Rows
          head={["Model", "Answer type", "Answers", "Cost each", "Avg seconds"]}
          rows={pk.answers.map((a) => [a.model, a.kind, a.n, usd(a.costPer, 3), a.latencyS.toFixed(1)])}
        />
        <Rows head={["Model", "👍", "👎", "👍 rate"]} rows={pk.ratings.map((r) => [r.model, r.up, r.down, pct(r.up, r.up + r.down)])} />
        <Rows
          head={["Group (accounts)", "Visitors", "Votes", "Votes per visitor"]}
          rows={(["pickbot", "holdout"] as const).map((k) => [
            k === "pickbot" ? "Has Pickbot" : `Holdout (${pk.holdoutPct}%, no Pickbot)`,
            pk.arms[k].visitors,
            pk.arms[k].votes,
            pk.arms[k].visitors ? (pk.arms[k].votes / pk.arms[k].visitors).toFixed(2) : "—",
          ])}
        />
        <p className="text-xs text-zinc-500">{pk.holdoutP == null ? "Holdout: not enough data yet." : `Holdout difference: ${pk.holdoutP < 0.05 ? "real" : "could be chance"} (p = ${pk.holdoutP.toFixed(3)}).`}</p>
      </Section>

      <Section
        title="Profile bar test"
        note={`The bar above the Vote deck (and on You) counts toward a complete profile: ${pb.target} battles plus sex, age, relationship and ZIP. ${pb.holdoutPct}% of people (stable per account/browser) never see it. Votes are in the page window; "reached ${pb.target}" counts all their votes ever.`}
      >
        <Rows
          head={["Group", "Visitors", "Votes", "Votes per visitor", `Reached ${pb.target} votes`]}
          rows={(["bar", "holdout"] as const).map((k) => [
            k === "bar" ? "Sees the bar" : `Holdout (${pb.holdoutPct}%, no bar)`,
            pb.arms[k].visitors,
            pb.arms[k].votes,
            pb.arms[k].visitors ? (pb.arms[k].votes / pb.arms[k].visitors).toFixed(2) : "—",
            pct(pb.arms[k].reached, pb.arms[k].visitors),
          ])}
        />
        <p className="text-xs text-zinc-500">{barVerdict(pb.arms.holdout, pb.arms.bar, pb.p)}</p>
      </Section>

      <Section
        title="Visits by source"
        note="Each visit's own tags: an X ad click (twclid) or utm_source=x/twitter is the X campaign, a t.co / x.com referrer is X organic. Visits add up to the Visits tile; a person who came two ways counts under both. Tip: put utm_source on every campaign link, because apps often hide the referrer."
      >
        <Rows
          head={["Source", "People today", "People yesterday", "People", "Visits", "Top tags"]}
          rows={s.visitSources.map((r) => [
            r.label,
            <Num key="t" n={r.today} href={listHref("visitors", pins.todayDay, { source: r.source })} />,
            <Num key="y" n={r.yesterday} href={listHref("visitors", pins.yesterdayDay, { source: r.source })} />,
            <Num key="p" n={r.visitors} href={listHref("visitors", undefined, { source: r.source })} />,
            <Num key="v" n={r.visits} href={listHref("visitors", undefined, { source: r.source })} />,
            <span key="tags" className="text-xs text-zinc-500">{r.detail || "—"}</span>,
          ])}
        />
      </Section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v, to]) => (
          <Link key={k} href={to} className="card block p-3 transition hover:ring-1 hover:ring-accent">
            <div className="text-xs text-zinc-500">{k} ›</div>
            <div className="text-2xl font-medium">{v}</div>
          </Link>
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
                  <span className="text-xs text-zinc-500">{j.signedUpAt ? nyTime(j.signedUpAt) : "guest"}</span>
                  <span className={`chip !py-0.5 text-[11px] ${j.source.startsWith("x_") ? "chip-on" : ""}`}>{j.sourceLabel}</span>
                  <span className="text-xs text-zinc-500">
                    {[j.sex, j.ageRange, j.zip3 && `ZIP ${j.zip3}xx`].filter(Boolean).join(" · ") || "no profile"}
                  </span>
                  <span className="ml-auto text-xs tabular-nums">
                    votes {j.votesBefore} before / <b>{j.votesAfter} after</b> · posts {j.posts} · Pickbot {j.asks.length} · back days {j.returnDays}
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
              const kq = k === "text" || k === "photo" ? { kind: k } : undefined;
              return [
                k,
                <Num key="v" n={votesByKind(k)} href={listHref("votes", undefined, kq)} />,
                d?.views ?? 0,
                <Num key="s" n={d?.seen ?? 0} href={listHref("cards", undefined, kq)} />,
                <Num key="sv" n={d?.voted ?? 0} href={listHref("cards", undefined, { ...kq, outcome: "voted" })} />,
                pct(d?.voted ?? 0, d?.seen ?? 0),
                secs(d?.median_ms ?? null),
              ];
            }),
            [
              "Total",
              <Num key="v" n={placeTotal} href={listHref("votes")} />,
              s.byKind.reduce((a, k) => a + k.views, 0),
              <Num key="s" n={viewedTotal} href={listHref("cards")} />,
              <Num key="sv" n={viewedVoted} href={listHref("cards", undefined, { outcome: "voted" })} />,
              pct(viewedVoted, viewedTotal),
              "",
            ],
          ]}
        />
      </Section>

      <Section
        title="Voted vs skipped"
        note={`Every Vote deck card a person saw in this window (person × battle, counted once) ends one way: voted, skipped, or neither (they left, reloaded or switched tab while it was on top). Skip rate = skipped ÷ (voted + skipped). The deck uses the same signal: battles people vote on move up, ones they skip move down (economy skipWeight; the 10% engagement holdout keeps the old order).`}
      >
        <Rows
          head={["Card type", "Cards seen", "Voted", "Skipped", "Neither", "Skip rate", "Left on it"]}
          rows={[
            ...sk.byKind.map((r) => {
              const kq: Record<string, string> = r.kind === "text" || r.kind === "photo" ? { kind: r.kind } : {};
              return [
                r.kind,
                <Num key="s" n={r.seen} href={listHref("cards", undefined, kq)} />,
                <Num key="v" n={r.voted} href={listHref("cards", undefined, { ...kq, outcome: "voted" })} />,
                <Num key="k" n={r.skipped} href={listHref("cards", undefined, { ...kq, outcome: "skipped" })} />,
                <Num key="n" n={r.neither} href={listHref("cards", undefined, { ...kq, outcome: "neither" })} />,
                pct(r.skipped, r.voted + r.skipped),
                pct(r.neither, r.seen),
              ];
            }),
            [
              "Total",
              <Num key="s" n={sk.total.seen} href={listHref("cards")} />,
              <Num key="v" n={sk.total.voted} href={listHref("cards", undefined, { outcome: "voted" })} />,
              <Num key="k" n={sk.total.skipped} href={listHref("cards", undefined, { outcome: "skipped" })} />,
              <Num key="n" n={sk.total.neither} href={listHref("cards", undefined, { outcome: "neither" })} />,
              pct(sk.total.skipped, sk.total.voted + sk.total.skipped),
              pct(sk.total.neither, sk.total.seen),
            ],
          ]}
        />
      </Section>

      <Section title="Skips by deck position" note="Where in the deck load the card first appeared (1 = first card). A rising skip rate deeper in the deck means people get pickier or run into weaker battles.">
        <Rows
          head={["Position", "Cards seen", "Voted", "Skipped", "Neither", "Skip rate"]}
          rows={sk.byPos.map((r) => {
            const pq = POS_RANGE[r.bucket];
            const cell = (key: string, v: number, outcome?: string) =>
              pq ? <Num key={key} n={v} href={listHref("cards", undefined, { pos: pq, ...(outcome ? { outcome } : {}) })} /> : v;
            return [r.bucket, cell("s", r.seen), cell("v", r.voted, "voted"), cell("k", r.skipped, "skipped"), cell("n", r.neither, "neither"), pct(r.skipped, r.voted + r.skipped)];
          })}
        />
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Most skipped battles" note={`Battles seen by 5+ people in this window (${sk.battlesRated} so far), highest skip rate first. Candidates to rewrite, relaunch with a better photo, or hide.`}>
          <Rows
            head={["Battle", "Seen", "Skip rate"]}
            rows={sk.mostSkipped.map((b) => [
              battleLink(b.slug, b.title),
              <Num key="s" n={b.seen} href={listHref("cards", undefined, { battle: b.slug })} />,
              <Num key="r" n={b.skipped} href={listHref("cards", undefined, { battle: b.slug, outcome: "skipped" })}>{pct(b.skipped, b.voted + b.skipped)}</Num>,
            ])}
          />
        </Section>
        <Section title="Least skipped battles" note="Same rule, lowest skip rate first. What these have in common is what to post more of.">
          <Rows
            head={["Battle", "Seen", "Skip rate"]}
            rows={sk.leastSkipped.map((b) => [
              battleLink(b.slug, b.title),
              <Num key="s" n={b.seen} href={listHref("cards", undefined, { battle: b.slug })} />,
              <Num key="r" n={b.skipped} href={listHref("cards", undefined, { battle: b.slug, outcome: "skipped" })}>{pct(b.skipped, b.voted + b.skipped)}</Num>,
            ])}
          />
        </Section>
      </div>

      <Section title="Where votes were made" note={`Every counted vote, by the screen it was made on. The total matches the "Votes by real people" tile.`}>
        <Rows
          head={["Place", "Text", "Photo", "Total"]}
          rows={[
            ...places.map((pl) => {
              const t = placeKind(pl, "text"), ph = placeKind(pl, "photo");
              const place = PLACE_KEY[pl] ? { place: PLACE_KEY[pl] } : undefined;
              return [
                pl,
                <Num key="t" n={t} href={listHref("votes", undefined, { ...place, kind: "text" })} />,
                <Num key="p" n={ph} href={listHref("votes", undefined, { ...place, kind: "photo" })} />,
                <Num key="a" n={t + ph} href={listHref("votes", undefined, place)} />,
              ];
            }),
            [
              "Total",
              <Num key="t" n={votesByKind("text")} href={listHref("votes", undefined, { kind: "text" })} />,
              <Num key="p" n={votesByKind("photo")} href={listHref("votes", undefined, { kind: "photo" })} />,
              <Num key="a" n={placeTotal} href={listHref("votes")} />,
            ],
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
