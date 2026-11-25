/**
 * Before vs after a product change on /admin/brain (Shimon, Nov 25 2026), pure. The change day itself (deploy in
 * the middle of it) counts as neither side. Tested in tests/unit/before-after.test.ts.
 */
export type Day = { day: string; visitors: number; visits: number; signups: number; votes: number; voters: number; posts: number };
export type Period = "before" | "launch" | "after";
export type Avg = { days: number; visitors: number; votes: number; voters: number; signups: number; posts: number; votesPerVisitor: number; votesPerVoter: number; signupRate: number };

export const periodOf = (day: string, changeDay: string): Period => (day < changeDay ? "before" : day === changeDay ? "launch" : "after");

/** YYYYMMDD (economy number) → "YYYY-MM-DD". */
export function isoDay(yyyymmdd: number): string {
  const s = String(Math.trunc(yyyymmdd)).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Per-day averages (totals ÷ days) plus the ratios over the whole period. */
export function average(days: Day[]): Avg {
  const n = days.length;
  const sum = (k: keyof Omit<Day, "day">) => days.reduce((t, d) => t + d[k], 0);
  const [visitors, votes, voters, signups, posts] = [sum("visitors"), sum("votes"), sum("voters"), sum("signups"), sum("posts")];
  const per = (x: number) => (n ? x / n : 0);
  return {
    days: n,
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

export function beforeAfter(daily: Day[], changeDay: string, maxBeforeDays = 14) {
  const before = daily.filter((d) => periodOf(d.day, changeDay) === "before").sort((a, b) => b.day.localeCompare(a.day)).slice(0, maxBeforeDays);
  const after = daily.filter((d) => periodOf(d.day, changeDay) === "after");
  const rows = daily
    .filter((d) => periodOf(d.day, changeDay) !== "before" || before.includes(d))
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((d) => ({ ...d, period: periodOf(d.day, changeDay) }));
  return { changeDay, rows, before: average(before), after: average(after) };
}
