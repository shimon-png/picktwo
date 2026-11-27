import { sql } from "drizzle-orm";
import { db } from "../db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";
import { themeOf } from "@/lib/theme-guess";
import { themeEngagement, type BattleMeta, type Person } from "./theme-engagement-rules";

const TZ = "America/New_York";
const EV_FROM = sql`analytics_event e LEFT JOIN device d ON d.id = e.device_id`;
const V_FROM = sql`vote v LEFT JOIN device dv ON dv.id = v.device_id`;

/**
 * Theme engagement on /admin/brain (Alex, Nov 24 2026): views, votes, skips and "left on it" per battle theme, one row
 * per real voter, and the battles bounced visitors saw last. Same Clean / All scope as every other Brain number, so
 * the theme columns add up to the tiles (checked by `brainChecks`). Counting rules: `theme-engagement-rules.ts`.
 * Themes: the battle's AI tag when it has one, else a word-match guess (`lib/theme-guess.ts`), so seed battles,
 * which most of the deck is, get a theme too.
 */
export async function themeEngagementData(days = 7, view: BrainView = "clean") {
  const scope = await brainScope(view, days);
  const { since, ev, vt, st, us } = scope;
  // "Came back on another day" looks at everything since the clean start (All view: all time), not just the window.
  const activeFrom = scope.cleanFrom ?? "1970-01-01T00:00:00.000Z";

  const [seen, votes, skips, people, [su]] = await Promise.all([
    db.execute<{ who: string; battle_id: string; at: string }>(sql`
      SELECT ${WHO_E} AS who, e.props->>'battleId' AS battle_id, max(e.created_at)::text AS at
      FROM ${EV_FROM}
      WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${ev} AND e.props->>'battleId' IS NOT NULL AND ${WHO_E} IS NOT NULL
      GROUP BY 1, 2`),
    db.execute<{ who: string; battle_id: string; at: string }>(sql`
      SELECT ${WHO_V} AS who, v.battle_id, v.created_at::text AS at
      FROM ${V_FROM} WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt}`),
    db.execute<{ who: string; battle_id: string; at: string }>(sql`
      SELECT COALESCE(s.user_id, ds.user_id, s.device_id, s.id) AS who, s.battle_id, s.created_at::text AS at
      FROM skip s LEFT JOIN device ds ON ds.id = s.device_id
      WHERE s.created_at > ${since} AND ${st}`),
    db.execute<{ who: string; days: number; first_seen: string; last_seen: string; handle: string | null; has_account: boolean; signed_up: boolean }>(sql`
      WITH act AS (
        SELECT ${WHO_E} AS who, e.created_at AS at FROM ${EV_FROM}
        WHERE e.name IN ('session_start', 'page_view', 'card_shown', 'engaged') AND e.created_at >= ${activeFrom} AND ${ev}
        UNION ALL
        SELECT ${WHO_V} AS who, v.created_at AS at FROM ${V_FROM}
        WHERE v.created_at >= ${activeFrom} AND NOT v.flagged AND ${vt}
      ),
      p AS (
        SELECT who, count(DISTINCT (at AT TIME ZONE ${TZ})::date)::int AS days, min(at)::text AS first_seen, max(at)::text AS last_seen
        FROM act WHERE who IS NOT NULL GROUP BY who
      )
      SELECT p.who, p.days, p.first_seen, p.last_seen, u.handle,
        (u.id IS NOT NULL AND u.onboarded_at IS NOT NULL) AS has_account,
        (u.id IS NOT NULL AND u.onboarded_at > ${since} AND ${us}) AS signed_up
      FROM p LEFT JOIN "user" u ON u.id = p.who
      WHERE p.last_seen::timestamptz > ${since}::timestamptz`),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM "user" u WHERE u.onboarded_at > ${since} AND ${us}`),
  ]);

  const ids = [...new Set([...seen, ...votes, ...skips].map((r) => r.battle_id))];
  const battles = new Map<string, BattleMeta>();
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const rows = await db.execute<{ id: string; slug: string; title: string; context: string | null; tags: { brain?: { theme?: string } } | null; label_a: string | null; label_b: string | null; photos: number }>(sql`
      SELECT b.id, b.slug, b.title, b.context, b.tags,
        max(o.label) FILTER (WHERE o.side = 'A') AS label_a, max(o.label) FILTER (WHERE o.side = 'B') AS label_b,
        count(o.image_url)::int AS photos
      FROM battle b LEFT JOIN "option" o ON o.battle_id = b.id
      WHERE b.id IN (${sql.join(chunk.map((id) => sql`${id}`), sql`, `)})
      GROUP BY b.id`);
    for (const r of rows) {
      const { theme, ai } = themeOf({ tags: r.tags, title: r.title, context: r.context, labelA: r.label_a, labelB: r.label_b });
      battles.set(r.id, { slug: r.slug, title: r.title, theme, ai, kind: r.photos > 0 ? "photo" : "text" });
    }
  }

  const peopleMap = new Map<string, Person>(
    people.map((p) => [p.who, { handle: p.handle, signedUp: p.signed_up, hasAccount: p.has_account, activeDays: p.days, firstSeen: p.first_seen, lastSeen: p.last_seen }]),
  );
  const toRow = (r: { who: string; battle_id: string; at: string }) => ({ who: r.who, battleId: r.battle_id, at: new Date(r.at).toISOString() });

  return themeEngagement({
    battles,
    seen: seen.map(toRow),
    votes: votes.map(toRow),
    skips: skips.map(toRow),
    people: new Map([...peopleMap].map(([w, p]) => [w, { ...p, lastSeen: new Date(p.lastSeen).toISOString() }])),
    signups: su?.n ?? 0,
  });
}
