import { sql } from "drizzle-orm";
import { db } from "../db";
import { brainScope, type BrainView } from "./brain";
import { classifySource, SOURCE_LABELS, type Source } from "./acquisition-rules";

/**
 * Customer journey for /admin/journey (Alex, Nov 23 2026): one row per visitor (an account, or a browser not linked
 * to one) in the window, using the Brain's Clean / All data scope. Source = their first visit in the window.
 */
export type Visitor = { who: string; source: Source; votes: number; days: number; signedUp: boolean; posted: boolean; cards: number };

export async function journeyData(view: BrainView, days: number) {
  const scope = await brainScope(view, days);
  const { since, ev, vt } = scope;
  const TZ = "America/New_York";
  const rows = await db.execute<{ who: string; props: Record<string, unknown> | null; votes: number; days: number; signed: boolean; posted: boolean; cards: number }>(sql`
    WITH s AS (
      SELECT COALESCE(e.user_id, d.user_id, e.device_id) AS who, e.props, e.created_at
      FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev}
    ),
    f AS (SELECT DISTINCT ON (who) who, props FROM s WHERE who IS NOT NULL ORDER BY who, created_at),
    dd AS (SELECT who, count(DISTINCT (created_at AT TIME ZONE ${TZ})::date)::int AS days FROM s GROUP BY who),
    vv AS (
      SELECT COALESCE(v.user_id, dv.user_id, v.device_id) AS who, count(*)::int AS n
      FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
      WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} GROUP BY 1
    ),
    cc AS (
      SELECT COALESCE(e.user_id, d.user_id, e.device_id) AS who, count(*)::int AS n
      FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${ev} GROUP BY 1
    )
    SELECT f.who, f.props, COALESCE(vv.n, 0) AS votes, COALESCE(dd.days, 1) AS days, COALESCE(cc.n, 0) AS cards,
      (u.onboarded_at IS NOT NULL AND u.onboarded_at > ${since} AND u.email IS NOT NULL) AS signed,
      EXISTS (SELECT 1 FROM battle b WHERE b.author_id = f.who AND b.created_at > ${since}) AS posted
    FROM f LEFT JOIN vv USING (who) LEFT JOIN dd USING (who) LEFT JOIN cc USING (who)
    LEFT JOIN "user" u ON u.id = f.who
    LIMIT 200000`);
  const visitors: Visitor[] = rows.map((r) => ({
    who: r.who,
    source: classifySource(r.props),
    votes: r.votes,
    days: r.days,
    signedUp: r.signed,
    posted: r.posted,
    cards: r.cards,
  }));

  // What people vote on, split by whether they came back on another day: card type and AI theme.
  const returners = visitors.filter((v) => v.days >= 2).map((v) => v.who);
  const voteMix = await db.execute<{ kind: string; theme: string | null; back: boolean; n: number }>(sql`
    SELECT CASE WHEN count(o.image_url) = 2 THEN 'photo' WHEN count(o.image_url) = 0 THEN 'text' ELSE 'mixed' END AS kind,
      b.tags->'brain'->>'theme' AS theme,
      COALESCE(v.user_id, dv.user_id, v.device_id) IN (${returners.length ? sql.join(returners.map((w) => sql`${w}`), sql`, `) : sql`''`}) AS back,
      1 AS n
    FROM vote v LEFT JOIN device dv ON dv.id = v.device_id JOIN battle b ON b.id = v.battle_id
    LEFT JOIN "option" o ON o.battle_id = b.id
    WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt}
    GROUP BY v.id, b.id, dv.user_id
    LIMIT 200000`);
  const mix = (key: "kind" | "theme") => {
    const m = new Map<string, { back: number; gone: number }>();
    for (const r of voteMix) {
      const k = (r[key] as string | null) ?? "untagged";
      const e = m.get(k) ?? { back: 0, gone: 0 };
      if (r.back) e.back++;
      else e.gone++;
      m.set(k, e);
    }
    const tb = [...m.values()].reduce((a, e) => a + e.back, 0);
    const tg = [...m.values()].reduce((a, e) => a + e.gone, 0);
    return [...m.entries()]
      .map(([label, e]) => ({ label, back: e.back, gone: e.gone, backShare: tb ? e.back / tb : 0, goneShare: tg ? e.gone / tg : 0 }))
      .sort((a, b) => b.back + b.gone - (a.back + a.gone));
  };

  return { scope, visitors, byKind: mix("kind"), byTheme: mix("theme"), sourceLabels: SOURCE_LABELS };
}

/** Median of a list (0 for empty). */
export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
