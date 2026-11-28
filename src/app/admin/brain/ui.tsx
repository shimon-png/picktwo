/** Shared building blocks for /admin/brain and its tabs. */
import Link from "next/link";
import type { BrainView } from "@/server/services/brain";
import type { BrainListKind } from "@/server/services/brain-lists";
import type { GateCell } from "@/server/services/gate-test-rules";
import type { ArmNumbers } from "@/server/services/about-stats";
import type { unitEconomicsStats } from "@/server/services/unit-economics";
import { money, unitEconomics, type UeAssumptions } from "@/server/services/unit-economics-rules";

export type TabProps = { days: number; view: BrainView };

export const usd = (n: number, digits: number) => "$" + n.toFixed(digits);
export const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");
export const pctN = (x: number) => `${(100 * x).toFixed(1)}%`;
export const pctOf = (x: number | null) => (x == null ? "—" : `${Math.round(100 * x)}%`);
export const secs = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);
/** "14 days", "1.5 days", "40 min", "6 h" for how much time a Before / After side covers. */
export const spanLabel = (days: number) =>
  days >= 1 ? `${Math.round(days * 10) / 10} day${Math.round(days * 10) / 10 === 1 ? "" : "s"}` : days * 24 >= 1 ? `${Math.round(days * 24)} h` : `${Math.round(days * 1440)} min`;
export const ratio = (n: number, d: number) => (d ? n / d : null);
export const nyTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const nyDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

/** Every number with a list behind it opens /admin/brain/list/[kind] in the same window and view. */
export function makeListHref(days: number, view: BrainView) {
  return (kind: BrainListKind, day?: string, more?: Record<string, string>) => {
    const q = new URLSearchParams({ days: String(days) });
    if (view === "all") q.set("view", "all");
    if (day) q.set("day", day);
    for (const [k, v] of Object.entries(more ?? {})) q.set(k, v);
    return `/admin/brain/list/${kind}?${q}`;
  };
}

/**
 * A card with a title and a grey note. `collapsed` = secondary detail behind a tap (Alex, Nov 28: hide, don't delete).
 */
export function Section({ title, note, id, collapsed, children }: { title: React.ReactNode; note?: string; id?: string; collapsed?: boolean; children: React.ReactNode }) {
  if (collapsed) {
    return (
      <details id={id} className="card group scroll-mt-16 p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-sans font-medium">
          <span className="mr-auto">{title}</span>
          <span className="text-xs font-normal text-accent group-open:hidden">Show ›</span>
          <span className="hidden text-xs font-normal text-accent group-open:inline">Hide</span>
        </summary>
        <div className="mt-2 space-y-2">
          {note && <p className="text-xs text-zinc-500">{note}</p>}
          {children}
        </div>
      </details>
    );
  }
  return (
    <section id={id} className="card scroll-mt-16 space-y-2 p-4">
      <h2 className="font-sans font-medium">{title}</h2>
      {note && <p className="text-xs text-zinc-500">{note}</p>}
      {children}
    </section>
  );
}

/** "Show more" inside a section. */
export function ShowMore({ label = "Show more", children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className="group space-y-2">
      <summary className="cursor-pointer list-none text-sm text-accent">
        <span className="group-open:hidden">{label} ›</span>
        <span className="hidden group-open:inline">Show less</span>
      </summary>
      <div className="space-y-3 pt-2">{children}</div>
    </details>
  );
}

export function Rows({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
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

/** A number that opens the list behind it (only when there's something to show). */
export function Num({ href, n, children }: { href: string; n: number; children?: React.ReactNode }) {
  if (!n) return <>{children ?? n}</>;
  return (
    <Link href={href} className="underline decoration-ink/20 underline-offset-2 hover:decoration-accent">
      {children ?? n}
    </Link>
  );
}

export const battleLink = (slug: string, title: string) => (
  <Link href={`/b/${slug}`} className="line-clamp-2 underline-offset-2 hover:underline">{title}</Link>
);

/** "+12" / "−3" next to a number: change vs the day before. */
export function Delta({ now, prev }: { now: number; prev: number | undefined }) {
  if (prev === undefined) return <>{now}</>;
  const d = now - prev;
  return (
    <>
      {now}
      {d !== 0 && <span className={`ml-1 text-[11px] ${d > 0 ? "text-green" : "text-b"}`}>{d > 0 ? `+${d}` : `−${-d}`}</span>}
    </>
  );
}

/** "4.2 +0.8": an average with its change from the day before. */
export function Ratio({ now, prev }: { now: number | null; prev?: number | null }) {
  if (now == null) return <>—</>;
  const d = prev == null ? 0 : Math.round((now - prev) * 10) / 10;
  return (
    <>
      {now.toFixed(1)}
      {d !== 0 && <span className={`ml-1 text-[11px] ${d > 0 ? "text-green" : "text-b"}`}>{d > 0 ? `+${d.toFixed(1)}` : `−${(-d).toFixed(1)}`}</span>}
    </>
  );
}

/** Deck position bucket label (skip-stats) → position range for the cards list. */
export const POS_RANGE: Record<string, string> = { "1": "1-1", "2–5": "2-5", "6–10": "6-10", "11–20": "11-20", "21+": "21-99999" };
/** "Where votes were made" place label (brain.ts) → vote.source for the votes list. */
export const PLACE_KEY: Record<string, string> = {
  "Vote deck": "feed",
  "Homepage card": "home",
  Discover: "discover",
  Search: "search",
  Profile: "profile",
  "People like you are asking": "asking",
  "Seed votes (fake, All view only)": "seed",
  "Battle page / shared link": "page",
};

export const gateRow = (day: React.ReactNode, group: string, c: GateCell): React.ReactNode[] => [
  day,
  group,
  c.visitors,
  c.votes,
  c.avgVotes.toFixed(2),
  `${c.reachedGate} (${pct(c.reachedGate, c.visitors)})`,
  c.signups,
  pctN(c.signupRate),
];

export const QUESTION_LABELS: Record<string, string> = {
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
export const perVisitor = (a: ArmNumbers | { visitors: number; votes: number }) => (a.visitors ? (a.votes / a.visitors).toFixed(2) : "—");

/** Plain-language read of the no-cards group vs the cards group on votes per visitor. */
export function verdict(holdout: { visitors: number; votes: number }, cards: { visitors: number; votes: number }, p: number | null) {
  if (!holdout.visitors || !cards.visitors) return "Not enough data yet";
  const h = holdout.votes / holdout.visitors;
  const c = cards.votes / cards.visitors;
  const lift = h ? (c - h) / h : 0;
  const side = `Cards ${lift >= 0 ? "+" : "−"}${Math.abs(Math.round(lift * 100))}% vs no cards`;
  if (p == null) return `${side} · not enough data yet`;
  return p < 0.05 ? `${side} · real difference (p = ${p.toFixed(3)})` : `${side} · could be chance (p = ${p.toFixed(2)})`;
}

export function barVerdict(holdout: { visitors: number; votes: number }, bar: { visitors: number; votes: number }, p: number | null) {
  if (!holdout.visitors || !bar.visitors) return "Not enough data yet";
  const h = holdout.votes / holdout.visitors;
  const lift = h ? (bar.votes / bar.visitors - h) / h : 0;
  const side = `Votes per visitor with the bar ${lift >= 0 ? "+" : "−"}${Math.abs(Math.round(lift * 100))}% vs without`;
  if (p == null) return `${side} · not enough data yet`;
  return p < 0.05 ? `${side} · real difference (p = ${p.toFixed(3)})` : `${side} · could be chance (p = ${p.toFixed(2)})`;
}

export type UeStats = Awaited<ReturnType<typeof unitEconomicsStats>>;

/** Unit economics: how it's calculated, with the current Config assumptions spelled out. */
export function ueNote(ue: UeStats, view: BrainView) {
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

export function ueTiles(ue: UeStats): [string, string, string][] {
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
export function dayBreakEven(ue: { assumptions: UeAssumptions; costPerVisitor: number | null }, d: { visitors: number; visits: number; votes: number; signups: number }) {
  if (!d.visitors) return <span key="be">—</span>;
  const be = unitEconomics({ ...d, costPerVisitor: ue.costPerVisitor }, ue.assumptions).breakEven;
  return (
    <span key="be" className={be > 0 ? "text-green" : "text-b"}>
      {money(be)}
    </span>
  );
}

/** Fixed plan fees vs the per-visitor margin: how many visitors a month cover them. */
export function ueFixedLine(ue: UeStats): string {
  const fixed = ue.cost.fixedMonthly;
  if (fixed == null) return "";
  const be = ue.overall.breakEven;
  return be > 0
    ? `Fixed plans cost ${money(fixed)} a month; at ${money(be)} margin per visitor that takes about ${Math.ceil(fixed / be).toLocaleString()} visitors a month.`
    : `Fixed plans cost ${money(fixed)} a month; with no margin per visitor yet, visitors don't cover them.`;
}
