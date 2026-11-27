/**
 * Before vs after a product change on /admin/brain (Shimon, Nov 25 2026), pure. Tested in
 * tests/unit/before-after.test.ts.
 *
 * The change is economy `beforeAfterFrom`: a New York day (YYYYMMDD) or, better, the minute it went live
 * (YYYYMMDDHHmm, New York time). With a minute, the change day is split into two rows: the part before it counts as
 * Before and the rest as After. Partial days (those halves, and today so far) count as that fraction of a day in
 * the per-day averages. With only a day, the change day counts as neither side.
 */
export type Day = { day: string; visitors: number; visits: number; signups: number; votes: number; voters: number; posts: number };
export type Period = "before" | "launch" | "after";
/** One table row: a day or part of one. `weight` = how much of a day it covers (1 = a full day). */
export type BaRow = Day & { label: string; period: Period; weight: number };
export type Avg = { days: number; /** Exact days covered (partial days as fractions); 0 = nothing. */ span: number; visitors: number; votes: number; voters: number; signups: number; posts: number; votesPerVisitor: number; votesPerVoter: number; signupRate: number };

export const periodOf = (day: string, changeDay: string): Period => (day < changeDay ? "before" : day === changeDay ? "launch" : "after");

/** beforeAfterFrom → the New York day and, when given, the time ("HH:MM"). Accepts YYYYMMDD or YYYYMMDDHHmm. */
export function parseChange(n: number): { day: string; time: string | null } {
  const s = String(Math.trunc(n));
  const day = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return { day, time: s.length >= 12 ? `${s.slice(8, 10)}:${s.slice(10, 12)}` : null };
}

/** YYYYMMDD (or YYYYMMDDHHmm) → "YYYY-MM-DD". */
export const isoDay = (n: number) => parseChange(n).day;

/** Per-day averages (totals ÷ days covered, partial days counted as fractions) plus the ratios over the period. */
export function average(rows: (Day & { weight?: number })[]): Avg {
  const w = rows.reduce((t, d) => t + (d.weight ?? 1), 0);
  const sum = (k: keyof Omit<Day, "day">) => rows.reduce((t, d) => t + d[k], 0);
  const [visitors, votes, voters, signups, posts] = [sum("visitors"), sum("votes"), sum("voters"), sum("signups"), sum("posts")];
  const per = (x: number) => (w > 0 ? x / w : 0);
  return {
    days: Math.round(w * 10) / 10,
    span: w,
    visitors: per(visitors),
    votes: per(votes),
    voters: per(voters),
    signups: per(signups),
    posts: per(posts),
    votesPerVisitor: visitors ? votes / visitors : 0,
    votesPerVoter: voters ? votes / voters : 0,
    signupRate: visitors ? signups / visitors : 0,
  };
}

/** After vs before as a share of before (0.25 = +25%); null when there's nothing before to compare with. */
export const change = (before: number, after: number) => (before > 0 ? (after - before) / before : null);

/** Newest first; within a split day the After part sits above the Before part. */
const order = (r: BaRow) => `${r.day}|${r.period === "after" ? 2 : r.period === "launch" ? 1 : 0}`;

/** Table rows + the two averages. Keeps the `maxBeforeDays` most recent Before rows. */
export function summarize(rows: BaRow[], maxBeforeDays = 14) {
  const sorted = [...rows].sort((a, b) => order(b).localeCompare(order(a)));
  const before = sorted.filter((r) => r.period === "before").slice(0, maxBeforeDays);
  const after = sorted.filter((r) => r.period === "after");
  return {
    rows: sorted.filter((r) => r.period !== "before" || before.includes(r)),
    before: average(before),
    after: average(after),
  };
}

/** Day-only mode (no go-live minute): every day is a full row; the change day is "launch" and counts as neither. */
export function beforeAfter(daily: Day[], changeDay: string, maxBeforeDays = 14) {
  const rows: BaRow[] = daily.map((d) => ({ ...d, label: d.day, period: periodOf(d.day, changeDay), weight: 1 }));
  return { changeDay, ...summarize(rows, maxBeforeDays) };
}
