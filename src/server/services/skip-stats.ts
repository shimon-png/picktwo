import { sql } from "drizzle-orm";
import { db } from "../db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";

/**
 * Skips on /admin/brain (Shimon, Nov 25 2026). Every Vote deck card a person saw in the window (person × battle,
 * from `card_shown`, counted once) ends one of three ways: they voted on it, skipped it, or did neither (left the
 * app, reloaded, or switched tab while it was on top). Same Clean / All scope as the rest of the Brain.
 * The deck uses the same vote-vs-skip signal to rank battles (`skipFactor` in ranking.ts, economy `skipWeight`).
 */
export type Outcome = { seen: number; voted: number; skipped: number; neither: number };
export type SkipBattle = Outcome & { slug: string; title: string; kind: string };

export async function skipStats(view: BrainView, days: number) {
  const scope = await brainScope(view, days);
  const { since, ev, vt, st } = scope;

  const base = sql`
    WITH c AS (
      SELECT e.props->>'battleId' AS battle_id, ${WHO_E} AS who, max(e.props->>'kind') AS kind,
        min(CASE WHEN e.props->>'pos' ~ '^[0-9]+$' THEN (e.props->>'pos')::int END) AS pos
      FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${ev} AND e.props ? 'battleId'
      GROUP BY 1, 2
    ), o AS (
      SELECT c.*,
        EXISTS (SELECT 1 FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
          WHERE v.battle_id = c.battle_id AND v.created_at > ${since} AND NOT v.flagged AND ${vt} AND ${WHO_V} = c.who) AS voted,
        EXISTS (SELECT 1 FROM skip s LEFT JOIN device ds ON ds.id = s.device_id
          WHERE s.battle_id = c.battle_id AND s.created_at > ${since} AND ${st} AND COALESCE(s.user_id, ds.user_id, s.device_id) = c.who) AS skipped
      FROM c
    )`;
  const counts = sql`count(*)::int AS seen, count(*) FILTER (WHERE voted)::int AS voted,
    count(*) FILTER (WHERE skipped AND NOT voted)::int AS skipped, count(*) FILTER (WHERE NOT voted AND NOT skipped)::int AS neither`;

  const [byKind, byPos, perBattle] = await Promise.all([
    db.execute<Outcome & { kind: string }>(sql`${base} SELECT COALESCE(kind, '?') AS kind, ${counts} FROM o GROUP BY 1 ORDER BY 2 DESC`),
    db.execute<Outcome & { bucket: string }>(sql`${base}
      SELECT CASE WHEN pos IS NULL THEN 'unknown' WHEN pos = 1 THEN '1' WHEN pos <= 5 THEN '2–5' WHEN pos <= 10 THEN '6–10'
          WHEN pos <= 20 THEN '11–20' ELSE '21+' END AS bucket, ${counts}, COALESCE(min(pos), 100000) AS ord
      FROM o GROUP BY 1 ORDER BY ord`),
    db.execute<SkipBattle>(sql`${base}
      SELECT b.slug, b.title, COALESCE(max(o.kind), '?') AS kind, ${counts}
      FROM o JOIN battle b ON b.id = o.battle_id
      GROUP BY b.id HAVING count(*) >= 5`),
  ]);

  const rate = (r: Outcome) => (r.voted + r.skipped ? r.skipped / (r.voted + r.skipped) : 0);
  const sorted = [...perBattle].sort((a, b) => rate(b) - rate(a) || b.seen - a.seen);
  const total = byKind.reduce<Outcome>(
    (a, r) => ({ seen: a.seen + r.seen, voted: a.voted + r.voted, skipped: a.skipped + r.skipped, neither: a.neither + r.neither }),
    { seen: 0, voted: 0, skipped: 0, neither: 0 },
  );
  return {
    total,
    byKind: [...byKind],
    byPos: [...byPos],
    mostSkipped: sorted.slice(0, 10),
    leastSkipped: sorted.slice(Math.max(10, sorted.length - 10)).reverse(),
    battlesRated: perBattle.length,
  };
}
