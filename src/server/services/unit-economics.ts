/**
 * Unit economics on /admin/brain (Shimon, Nov 26 2026): what a visitor is worth, and so the most we can pay per
 * acquired visitor and break even, overall and per traffic source (X campaign, X organic, …). Measured from people
 * with a tracked visit in the Brain window (same scope as the tiles); prices are economy assumptions (`ue*`).
 * Serving cost per visitor = this month's spend (/admin/finance) ÷ this month's visitors. Math in
 * unit-economics-rules.ts (tested).
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";
import { getEconomy } from "./config";
import { getFinance } from "./finance";
import { campaignOf, classifySource, SOURCE_LABELS, type Source } from "./acquisition-rules";
import { unitEconomics, whatIf, type UeAssumptions, type UeInputs } from "./unit-economics-rules";
import { isoDay } from "./before-after-rules";

/**
 * Serving cost per visitor, split the way it behaves: plan fees are fixed each month (they don't grow with one more
 * visitor), usage above them does. Break-even uses the usage part per visitor (this month's usage ÷ this month's
 * visitors); the fixed plans are shown as a monthly bill the visitors' margin has to cover.
 */
async function costPerVisitor(): Promise<{ perVisitor: number | null; spend: number | null; usage: number | null; fixedMonthly: number | null; visitors: number }> {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(DISTINCT COALESCE(e.user_id, d.user_id, e.device_id))::int AS n
    FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
    WHERE e.name = 'session_start' AND e.created_at >= date_trunc('month', now())
      AND COALESCE((e.props->>'bot')::boolean, false) = false`);
  const visitors = Number(r?.n ?? 0);
  try {
    const f = await getFinance();
    const fixedSoFar = f.total.fixed * (f.dayOfMonth / f.daysInMonth);
    const usage = Math.max(0, f.total.mtd - fixedSoFar);
    return { perVisitor: visitors ? usage / visitors : null, spend: f.total.mtd, usage, fixedMonthly: f.total.fixed, visitors };
  } catch {
    return { perVisitor: null, spend: null, usage: null, fixedMonthly: null, visitors };
  }
}

/** Just the prices and the serving cost (no per-person scan): for the Brain's top screen break-even per day. */
export async function ueBasics(): Promise<{ assumptions: UeAssumptions; costPerVisitor: number | null }> {
  const [e, cost] = await Promise.all([getEconomy(), costPerVisitor()]);
  return {
    assumptions: {
      ueAdCpm: e.ueAdCpm,
      ueVotesPerAd: e.ueVotesPerAd,
      ueSponsoredSharePct: e.ueSponsoredSharePct,
      ueSponsoredCpm: e.ueSponsoredCpm,
      ueSignupValue: e.ueSignupValue,
      ueLifetimeVisits: e.ueLifetimeVisits,
    },
    costPerVisitor: cost.perVisitor,
  };
}

type Person = { who: string; visits: number; days: number; first: Record<string, unknown> | null; votes: number; signed: boolean };

/** All data from economy `ueFrom` (a New York day, YYYYMMDD; default 2026-11-23, the start of real tracking) to now. */
export async function unitEconomicsStats(view: BrainView) {
  const e = await getEconomy();
  const from = isoDay(e.ueFrom);
  const days = Math.max(1, Math.ceil((Date.now() - Date.parse(`${from}T00:00:00Z`)) / 86400_000) + 1);
  const scope = await brainScope(view, days);
  const { since, ev, vt, us } = scope;
  const people = await db.execute<Person>(sql`
    WITH s AS (
      SELECT ${WHO_E} AS who, e.props, e.created_at
      FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev}
    ),
    p AS (
      SELECT who, count(*)::int AS visits, (array_agg(props ORDER BY created_at))[1] AS first,
        count(DISTINCT (created_at AT TIME ZONE 'America/New_York')::date)::int AS days
      FROM s WHERE who IS NOT NULL GROUP BY who
    ),
    vv AS (
      SELECT ${WHO_V} AS who, count(*)::int AS n FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
      WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} GROUP BY 1
    )
    SELECT p.who, p.visits, p.days, p.first, COALESCE(vv.n, 0) AS votes,
      EXISTS (SELECT 1 FROM "user" u WHERE u.id = p.who AND u.onboarded_at > ${since} AND ${us}) AS signed
    FROM p LEFT JOIN vv ON vv.who = p.who`);
  const cost = await costPerVisitor();
  const a: UeAssumptions = {
    ueAdCpm: e.ueAdCpm,
    ueVotesPerAd: e.ueVotesPerAd,
    ueSponsoredSharePct: e.ueSponsoredSharePct,
    ueSponsoredCpm: e.ueSponsoredCpm,
    ueSignupValue: e.ueSignupValue,
    ueLifetimeVisits: e.ueLifetimeVisits,
  };
  const inputs = (list: Person[]): UeInputs => ({
    visitors: list.length,
    visits: list.reduce((t, p) => t + Number(p.visits), 0),
    votes: list.reduce((t, p) => t + Number(p.votes), 0),
    signups: list.filter((p) => p.signed).length,
    costPerVisitor: cost.perVisitor,
  });
  const all: Person[] = [...people];
  const bySource = new Map<Source, Person[]>();
  // Credit each person to where they first came from (their first visit's first-touch tags win), as Sign-ups by source.
  for (const p of all) {
    const src = classifySource(p.first);
    bySource.set(src, [...(bySource.get(src) ?? []), p]);
  }
  // Ad campaigns (Nov 26, two-funnel test): people whose first visit was an ad click, split by its utm_campaign.
  const byCampaign = new Map<string, { source: Source; people: Person[]; landings: Map<string, number> }>();
  for (const p of all) {
    const c = campaignOf(p.first);
    if (!c) continue;
    const b = byCampaign.get(c) ?? { source: classifySource(p.first), people: [] as Person[], landings: new Map<string, number>() };
    b.people.push(p);
    const f = (p.first?.first && typeof p.first.first === "object" ? p.first.first : p.first) as Record<string, unknown> | null;
    const landing = typeof f?.landing === "string" ? f.landing : "";
    if (landing) b.landings.set(landing, (b.landings.get(landing) ?? 0) + 1);
    byCampaign.set(c, b);
  }
  const campaigns = [...byCampaign.entries()]
    .map(([campaign, b]) => ({
      campaign,
      label: SOURCE_LABELS[b.source],
      landing: [...b.landings.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "",
      cameBack: b.people.filter((p) => Number(p.days) >= 2).length / b.people.length,
      ...unitEconomics(inputs(b.people), a),
    }))
    .sort((x, y) => y.visitors - x.visitors);
  const order: Source[] = ["x_campaign", "x_organic", "direct", "referral", "other_campaign", "unknown"];
  return {
    campaigns,
    from,
    assumptions: a,
    cost,
    overall: unitEconomics(inputs(all), a),
    whatIf: whatIf(inputs(all), a),
    sources: order
      .filter((s) => bySource.has(s))
      .map((s) => ({ source: s, label: s === "unknown" ? "Unknown" : SOURCE_LABELS[s], ...unitEconomics(inputs(bySource.get(s)!), a) })),
  };
}
