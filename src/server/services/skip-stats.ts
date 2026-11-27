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

  // One pass (Nov 27 speed-up): the per-card "did they vote / skip" used to be two correlated EXISTS per card
  // (on COALESCE(...) = who, which no index can serve) and the whole CTE ran three times. Now the window's
  // votes and skips are each reduced to distinct (battle, person) pairs once and hash-joined, and one query
  // returns counts per battle × kind × position bucket that are summed here.
  const rows = await db.execute<Outcome & { battle_id: string; kind: string | null; bucket: string; ord: number }>(sql`
    WITH c AS (
      SELECT e.props->>'battleId' AS battle_id, ${WHO_E} AS who, max(e.props->>'kind') AS kind,
        min(CASE WHEN e.props->>'pos' ~ '^[0-9]+$' THEN (e.props->>'pos')::int END) AS pos
      FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${ev} AND e.props ? 'battleId'
      GROUP BY 1, 2
    ), vv AS (
      SELECT DISTINCT v.battle_id, ${WHO_V} AS who FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
      WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt}
    ), ss AS (
      SELECT DISTINCT s.battle_id, COALESCE(s.user_id, ds.user_id, s.device_id) AS who FROM skip s LEFT JOIN device ds ON ds.id = s.device_id
      WHERE s.created_at > ${since} AND ${st}
    ), o AS (
      SELECT c.battle_id, c.kind, c.pos, vv.who IS NOT NULL AS voted, ss.who IS NOT NULL AS skipped
      FROM c LEFT JOIN vv ON vv.battle_id = c.battle_id AND vv.who = c.who
        LEFT JOIN ss ON ss.battle_id = c.battle_id AND ss.who = c.who
    )
    SELECT battle_id, kind,
      CASE WHEN pos IS NULL THEN 'unknown' WHEN pos = 1 THEN '1' WHEN pos <= 5 THEN '2–5' WHEN pos <= 10 THEN '6–10'
        WHEN pos <= 20 THEN '11–20' ELSE '21+' END AS bucket, COALESCE(min(pos), 100000)::int AS ord,
      count(*)::int AS seen, count(*) FILTER (WHERE voted)::int AS voted,
      count(*) FILTER (WHERE skipped AND NOT voted)::int AS skipped, count(*) FILTER (WHERE NOT voted AND NOT skipped)::int AS neither
    FROM o GROUP BY 1, 2, 3`);

  const add = (a: Outcome, r: Outcome) => {
    a.seen += r.seen;
    a.voted += r.voted;
    a.skipped += r.skipped;
    a.neither += r.neither;
  };
  const zero = (): Outcome => ({ seen: 0, voted: 0, skipped: 0, neither: 0 });
  const kindMap = new Map<string, Outcome & { kind: string }>();
  const posMap = new Map<string, Outcome & { bucket: string; ord: number }>();
  const battleMap = new Map<string, Outcome & { kind: string | null }>();
  for (const r of rows) {
    const k = r.kind ?? "?";
    if (!kindMap.has(k)) kindMap.set(k, { kind: k, ...zero() });
    add(kindMap.get(k)!, r);
    if (!posMap.has(r.bucket)) posMap.set(r.bucket, { bucket: r.bucket, ord: r.ord, ...zero() });
    const p = posMap.get(r.bucket)!;
    p.ord = Math.min(p.ord, r.ord);
    add(p, r);
    if (!battleMap.has(r.battle_id)) battleMap.set(r.battle_id, { kind: null, ...zero() });
    const b = battleMap.get(r.battle_id)!;
    if (r.kind && (!b.kind || r.kind > b.kind)) b.kind = r.kind;
    add(b, r);
  }
  const byKind = [...kindMap.values()].sort((a, b) => b.seen - a.seen);
  const byPos = [...posMap.values()].sort((a, b) => a.ord - b.ord);
  const rated = [...battleMap.entries()].filter(([, b]) => b.seen >= 5);
  const info = rated.length
    ? await db.execute<{ id: string; slug: string; title: string }>(
        sql`SELECT id, slug, title FROM battle WHERE id IN (${sql.join(rated.map(([id]) => sql`${id}`), sql`, `)})`,
      )
    : [];
  const byId = new Map(info.map((b) => [b.id, b]));
  const perBattle: SkipBattle[] = rated.flatMap(([id, b]) => {
    const meta = byId.get(id);
    return meta ? [{ slug: meta.slug, title: meta.title, kind: b.kind ?? "?", seen: b.seen, voted: b.voted, skipped: b.skipped, neither: b.neither }] : [];
  });

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
