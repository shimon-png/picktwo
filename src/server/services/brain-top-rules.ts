/**
 * Pure math for the Brain's top screen (Alex, Nov 28 2026, docs: "Brain dashboard cleanup plan"): each headline
 * number is compared with the average of the 7 days before it (not just yesterday, which is noisy at our volume),
 * plus a 14-day series for the sparkline. Tested in tests/unit/brain-top.test.ts.
 */

export type Kpi = {
  /** The headline value (today so far, or the newest complete day for slow metrics). */
  now: number | null;
  /** Same measure over the 7 days before the headline day (pooled, not an average of daily ratios). */
  avg: number | null;
  /** (now − avg) ÷ avg; for counts, today's pace (scaled to a full day) vs the average day. */
  change: number | null;
  /** Oldest → newest, up to 14 points ending on the headline day; null = no data that day. */
  series: (number | null)[];
  /** The New York day of each series point (YYYY-MM-DD), same order. */
  seriesDays: string[];
  /** The New York day the headline number is for (YYYY-MM-DD). */
  day: string | null;
};

const rel = (now: number | null, avg: number | null) => (now == null || avg == null || avg === 0 ? null : (now - avg) / avg);

/** A ratio per day (bounce = bounced ÷ visitors). `rows` newest first; `at` = index of the headline day. */
export function ratioKpi(rows: { day: string; num: number; den: number }[], at = 0): Kpi {
  const r = rows[at];
  if (!r) return { now: null, avg: null, change: null, series: [], seriesDays: [], day: null };
  const now = r.den ? r.num / r.den : null;
  const prior = rows.slice(at + 1, at + 8);
  const den = prior.reduce((t, x) => t + x.den, 0);
  const avg = den ? prior.reduce((t, x) => t + x.num, 0) / den : null;
  const series = rows
    .slice(at, at + 14)
    .map((x) => (x.den ? x.num / x.den : null))
    .reverse();
  const seriesDays = rows.slice(at, at + 14).map((x) => x.day).reverse();
  return { now, avg, change: rel(now, avg), series, seriesDays, day: r.day };
}

/**
 * A count per day (visitors). Today is still running, so its change is today's pace (count ÷ share of the day gone,
 * once at least an hour in) against the average of the 7 full days before.
 */
export function countKpi(rows: { day: string; n: number }[], dayFraction: number): Kpi {
  const r = rows[0];
  if (!r) return { now: null, avg: null, change: null, series: [], seriesDays: [], day: null };
  const prior = rows.slice(1, 8);
  const avg = prior.length ? prior.reduce((t, x) => t + x.n, 0) / prior.length : null;
  const pace = dayFraction >= 1 / 24 ? r.n / Math.min(1, dayFraction) : null;
  return { now: r.n, avg, change: rel(pace, avg), series: rows.slice(0, 14).map((x) => x.n).reverse(), seriesDays: rows.slice(0, 14).map((x) => x.day).reverse(), day: r.day };
}

/** A value already worked out per day (break-even per visitor), with the 7-day value worked out from pooled inputs. */
export function valueKpi(values: { day: string; v: number | null }[], avg: number | null): Kpi {
  const r = values[0];
  if (!r) return { now: null, avg: null, change: null, series: [], seriesDays: [], day: null };
  // Money can be negative, so the change is in dollars against |avg|.
  const change = r.v == null || avg == null || avg === 0 ? null : (r.v - avg) / Math.abs(avg);
  return { now: r.v, avg, change, series: values.slice(0, 14).map((x) => x.v).reverse(), seriesDays: values.slice(0, 14).map((x) => x.day).reverse(), day: r.day };
}

/** YYYY-MM-DD of a moment in New York. */
export function nyDayOf(t: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

/** Share of the New York day gone at `t` (0–1). */
export function nyDayFraction(t: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(t);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (h * 60 + m) / 1440;
}

export type FunnelCounts = { visitors: number; engaged: number; voted: number; voted3: number; gate: number; signed: number; back: number };
export type FunnelStep = { key: keyof FunnelCounts; label: string; n: number; ofVisitors: number | null; fromPrev: number | null };

const FUNNEL: [keyof FunnelCounts, string][] = [
  ["visitors", "Visitors"],
  ["engaged", "Engaged"],
  ["voted", "Voted"],
  ["voted3", "3+ votes"],
  ["gate", "Hit the wall"],
  ["signed", "Signed up"],
  ["back", "Came back"],
];

/** The funnel strip: each step's people, share of all visitors, and share of the step before. */
export function funnelSteps(c: FunnelCounts): FunnelStep[] {
  return FUNNEL.map(([key, label], i) => {
    const prev = i ? c[FUNNEL[i - 1][0]] : null;
    return { key, label, n: c[key], ofVisitors: c.visitors ? c[key] / c.visitors : null, fromPrev: prev ? c[key] / prev : null };
  });
}

export type TestArm = { label: string; people: number; value: number | null };
export type TestBadge = { label: string; tone: "early" | "win" | "flat" | "off" };

/**
 * One rule for every experiment card: off → Off; under `minPeople` in any arm or no p-value yet → Too early;
 * p < 0.05 → "<leader> ahead"; else No difference. `higherIsBetter` picks the leader on the deciding metric.
 */
export function testBadge(t: { on: boolean; arms: TestArm[]; p: number | null; higherIsBetter?: boolean }, minPeople = 300): TestBadge {
  if (!t.on) return { label: "Off", tone: "off" };
  if (t.arms.length < 2 || t.arms.some((a) => a.people < minPeople) || t.p == null) return { label: "Too early", tone: "early" };
  if (t.p >= 0.05) return { label: "No difference", tone: "flat" };
  const hi = t.higherIsBetter ?? true;
  const lead = [...t.arms].filter((a) => a.value != null).sort((a, b) => (hi ? b.value! - a.value! : a.value! - b.value!))[0];
  return { label: lead ? `${lead.label} ahead` : "Too early", tone: lead ? "win" : "early" };
}
