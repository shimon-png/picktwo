/**
 * The Brain's top screen (Alex, Nov 28 2026): six headline numbers with 14-day sparklines, and the funnel strip.
 * Same counting as the rest of the Brain (`brainScope`, `WHO_E` / `WHO_V`); bounce follows the Journey's definition
 * (no tap/scroll, one page, no deck card, no vote), per New York day. Math in brain-top-rules.ts (tested).
 * Query rules from PR 148: no per-row correlated lookups on WHO; join DISTINCT (who, day) sets instead.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { brainScope, dailyNumbers, WHO_E, WHO_V, type BrainView } from "./brain";
import { ueBasics } from "./unit-economics";
import { unitEconomics } from "./unit-economics-rules";
import { countKpi, funnelSteps, nyDayFraction, nyDayOf, ratioKpi, valueKpi, type FunnelCounts, type Kpi } from "./brain-top-rules";

const TZ = "America/New_York";
const EV_FROM = sql`analytics_event e LEFT JOIN device d ON d.id = e.device_id`;
const V_FROM = sql`vote v LEFT JOIN device dv ON dv.id = v.device_id`;
const nyDay = (col: SQL) => sql`to_char((${col} AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD')`;

export type TopNumbers = {
  visitors: Kpi;
  bounce: Kpi;
  votesPerVisitor: Kpi;
  signupRate: Kpi;
  /** Of people first seen on a day, the share back the next day; headline = the newest day whose next day is over. */
  returnD1: Kpi;
  breakEven: Kpi;
  today: string;
  signupsToday: number;
};

export async function topNumbers(view: BrainView): Promise<TopNumbers> {
  const scope = await brainScope(view, 16);
  const { since, ev, vt } = scope;
  const firstFrom = scope.cleanFrom ?? "1970-01-01T00:00:00.000Z";
  const [daily, bounce, ret, ue] = await Promise.all([
    dailyNumbers(scope),
    db.execute<{ day: string; visitors: number; bounced: number }>(sql`
      WITH s AS (
        SELECT DISTINCT ${WHO_E} AS who, ${nyDay(sql`e.created_at`)} AS day
        FROM ${EV_FROM} WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev} AND ${WHO_E} IS NOT NULL
      ),
      pv AS (
        SELECT ${WHO_E} AS who, ${nyDay(sql`e.created_at`)} AS day,
          count(*) FILTER (WHERE e.name = 'page_view')::int AS views, bool_or(e.name <> 'page_view') AS act
        FROM ${EV_FROM} WHERE e.name IN ('page_view', 'engaged', 'card_shown') AND e.created_at > ${since} AND ${ev}
        GROUP BY 1, 2
      ),
      vv AS (
        SELECT DISTINCT ${WHO_V} AS who, ${nyDay(sql`v.created_at`)} AS day
        FROM ${V_FROM} WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt}
      )
      SELECT s.day, count(*)::int AS visitors,
        count(*) FILTER (WHERE NOT (COALESCE(pv.act, false) OR COALESCE(pv.views, 0) > 1 OR vv.who IS NOT NULL))::int AS bounced
      FROM s LEFT JOIN pv ON pv.who = s.who AND pv.day = s.day LEFT JOIN vv ON vv.who = s.who AND vv.day = s.day
      GROUP BY 1`),
    db.execute<{ day: string; new_visitors: number; back: number }>(sql`
      WITH a AS (
        SELECT ${WHO_E} AS who, (e.created_at AT TIME ZONE ${TZ})::date AS d
        FROM ${EV_FROM} WHERE e.name IN ('session_start', 'page_view') AND e.created_at >= ${firstFrom} AND ${ev} AND ${WHO_E} IS NOT NULL
        GROUP BY 1, 2
      ),
      f AS (SELECT who, min(d) AS first FROM a GROUP BY 1)
      SELECT to_char(f.first, 'YYYY-MM-DD') AS day, count(*)::int AS new_visitors, count(a2.who)::int AS back
      FROM f LEFT JOIN a a2 ON a2.who = f.who AND a2.d = f.first + 1
      WHERE f.first >= (${since}::timestamptz AT TIME ZONE ${TZ})::date
      GROUP BY f.first`),
    ueBasics(),
  ]);

  const now = new Date();
  const today = nyDayOf(now);
  const rows = daily.map((d) => ({ ...d, visitors: Number(d.visitors), visits: Number(d.visits), votes: Number(d.votes), signups: Number(d.signups) }));
  const bounceBy = new Map([...bounce].map((r) => [r.day, r]));
  const retBy = new Map([...ret].map((r) => [r.day, r]));
  const be = (r: { visitors: number; visits: number; votes: number; signups: number }) =>
    r.visitors ? unitEconomics({ ...r, costPerVisitor: ue.costPerVisitor }, ue.assumptions).breakEven : null;
  const prior = rows.slice(1, 8).reduce((t, r) => ({ visitors: t.visitors + r.visitors, visits: t.visits + r.visits, votes: t.votes + r.votes, signups: t.signups + r.signups }), {
    visitors: 0,
    visits: 0,
    votes: 0,
    signups: 0,
  });
  // Next-day return: the newest cohort whose next day is over is the day before yesterday.
  const twoAgo = nyDayOf(new Date(now.getTime() - 2 * 86400_000));
  const retAt = rows.findIndex((r) => r.day <= twoAgo);
  return {
    visitors: countKpi(rows.map((r) => ({ day: r.day, n: r.visitors })), nyDayFraction(now)),
    bounce: ratioKpi(rows.map((r) => ({ day: r.day, num: Number(bounceBy.get(r.day)?.bounced ?? 0), den: Number(bounceBy.get(r.day)?.visitors ?? 0) }))),
    votesPerVisitor: ratioKpi(rows.map((r) => ({ day: r.day, num: r.votes, den: r.visitors }))),
    signupRate: ratioKpi(rows.map((r) => ({ day: r.day, num: r.signups, den: r.visitors }))),
    returnD1: ratioKpi(
      rows.map((r) => ({ day: r.day, num: Number(retBy.get(r.day)?.back ?? 0), den: Number(retBy.get(r.day)?.new_visitors ?? 0) })),
      retAt < 0 ? rows.length : retAt,
    ),
    breakEven: valueKpi(
      rows.map((r) => ({ day: r.day, v: be(r) })),
      be(prior),
    ),
    today,
    signupsToday: rows[0]?.day === today ? rows[0].signups : 0,
  };
}

/** The funnel strip for the picked window: people at each step (steps aren't strictly nested; see the labels). */
export async function funnelNumbers(view: BrainView, days: number) {
  const { since, ev, vt, us } = await brainScope(view, days);
  const [r] = await db.execute<FunnelCounts>(sql`
    WITH s AS (
      SELECT ${WHO_E} AS who, count(DISTINCT (e.created_at AT TIME ZONE ${TZ})::date)::int AS days
      FROM ${EV_FROM} WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev} AND ${WHO_E} IS NOT NULL
      GROUP BY 1
    ),
    pv AS (
      SELECT ${WHO_E} AS who, count(*) FILTER (WHERE e.name = 'page_view')::int AS views, bool_or(e.name <> 'page_view') AS act
      FROM ${EV_FROM} WHERE e.name IN ('page_view', 'engaged', 'card_shown') AND e.created_at > ${since} AND ${ev}
      GROUP BY 1
    ),
    vv AS (SELECT ${WHO_V} AS who, count(*)::int AS n FROM ${V_FROM} WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} GROUP BY 1),
    g AS (SELECT DISTINCT ${WHO_E} AS who FROM ${EV_FROM} WHERE e.name = 'signup_gate_shown' AND e.created_at > ${since} AND ${ev}),
    u AS (SELECT u.id AS who FROM "user" u WHERE u.onboarded_at > ${since} AND ${us})
    SELECT count(*)::int AS visitors,
      count(*) FILTER (WHERE COALESCE(pv.act, false) OR COALESCE(pv.views, 0) > 1 OR COALESCE(vv.n, 0) > 0)::int AS engaged,
      count(*) FILTER (WHERE vv.n > 0)::int AS voted,
      count(*) FILTER (WHERE vv.n >= 3)::int AS voted3,
      count(*) FILTER (WHERE g.who IS NOT NULL)::int AS gate,
      count(*) FILTER (WHERE u.who IS NOT NULL)::int AS signed,
      count(*) FILTER (WHERE s.days >= 2)::int AS back
    FROM s LEFT JOIN pv USING (who) LEFT JOIN vv USING (who) LEFT JOIN g USING (who) LEFT JOIN u USING (who)`);
  const c: FunnelCounts = {
    visitors: Number(r?.visitors ?? 0),
    engaged: Number(r?.engaged ?? 0),
    voted: Number(r?.voted ?? 0),
    voted3: Number(r?.voted3 ?? 0),
    gate: Number(r?.gate ?? 0),
    signed: Number(r?.signed ?? 0),
    back: Number(r?.back ?? 0),
  };
  return funnelSteps(c);
}
