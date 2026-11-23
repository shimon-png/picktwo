import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Numbers for /admin/brain (docs/brain/). Read-only, admin-only, loaded rarely. Real data only: seed votes,
 * seed battles (`seed_%` are counted separately), flagged votes and bot events are left out.
 * Heavy queries move to a nightly copy once volume grows (docs/brain/README.md rule 7).
 */
export async function getBrainStats(days = 7) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const notBot = sql`COALESCE((e.props->>'bot')::boolean, false) = false`;

  const [tiles] = await db.execute<Record<string, number | null>>(sql`
    SELECT
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}) AS sessions,
      (SELECT count(DISTINCT COALESCE(e.user_id, e.device_id))::int FROM analytics_event e WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}) AS visitors,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${notBot}) AS views,
      (SELECT count(*)::int FROM vote v WHERE v.created_at > ${since} AND COALESCE(v.source, '') <> 'seed' AND NOT v.flagged) AS real_votes,
      (SELECT count(*)::int FROM vote v WHERE v.created_at > ${since} AND v.source = 'feed' AND NOT v.flagged) AS deck_votes,
      (SELECT count(*)::int FROM vote v WHERE v.source = 'seed') AS seed_votes_all,
      (SELECT count(*)::int FROM skip s WHERE s.created_at > ${since}) AS skips,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'signup_gate_shown' AND e.created_at > ${since}) AS gates,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'onboarding_completed' AND e.created_at > ${since}) AS signups,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'vote_changed' AND e.created_at > ${since}) AS changed,
      (SELECT count(*)::int FROM battle b WHERE b.created_at > ${since} AND b.id NOT LIKE 'seed_%') AS real_battles,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v.dwell_ms)::float FROM vote v WHERE v.created_at > ${since} AND v.source = 'feed' AND v.dwell_ms IS NOT NULL) AS median_pick_ms
  `);

  // Text vs photo: a view converts when the same person (user or device) voted on that battle.
  const byKind = await db.execute<{ kind: string; views: number; voted: number; median_ms: number | null }>(sql`
    SELECT e.props->>'kind' AS kind, count(*)::int AS views,
      count(v.id)::int AS voted,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY v.dwell_ms)::float AS median_ms
    FROM analytics_event e
    LEFT JOIN LATERAL (
      SELECT v.id, v.dwell_ms FROM vote v
      WHERE v.battle_id = e.props->>'battleId'
        AND ((e.user_id IS NOT NULL AND v.user_id = e.user_id) OR (e.device_id IS NOT NULL AND v.device_id = e.device_id))
      LIMIT 1
    ) v ON true
    WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${notBot}
    GROUP BY 1 ORDER BY 2 DESC`);

  // How deep people go into the deck.
  const depth = await db.execute<{ bucket: string; views: number }>(sql`
    SELECT CASE WHEN p <= 5 THEN '1–5' WHEN p <= 10 THEN '6–10' WHEN p <= 20 THEN '11–20' WHEN p <= 50 THEN '21–50' ELSE '50+' END AS bucket,
      count(*)::int AS views, min(p) AS o
    FROM (SELECT (e.props->>'pos')::int AS p FROM analytics_event e WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${notBot}) t
    GROUP BY 1 ORDER BY o`);

  const methods = await db.execute<{ method: string; n: number }>(sql`
    SELECT COALESCE(e.props->>'method', 'other') AS method, count(*)::int AS n
    FROM analytics_event e WHERE e.name = 'vote_cast' AND e.created_at > ${since}
    GROUP BY 1 ORDER BY 2 DESC`);

  // Acquisition: where visits came from, and how many of those visitors voted.
  const sources = await db.execute<{ source: string; sessions: number; visitors: number; voters: number }>(sql`
    WITH s AS (
      SELECT COALESCE(NULLIF(e.props->>'utm_source', ''), NULLIF(e.props->>'referrerHost', ''), 'direct') AS source,
        COALESCE(e.user_id, e.device_id) AS who, e.user_id, e.device_id
      FROM analytics_event e WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}
    )
    SELECT source, count(*)::int AS sessions, count(DISTINCT who)::int AS visitors,
      count(DISTINCT who) FILTER (WHERE EXISTS (
        SELECT 1 FROM vote v WHERE v.created_at > ${since} AND COALESCE(v.source, '') <> 'seed'
          AND ((s.user_id IS NOT NULL AND v.user_id = s.user_id) OR (s.device_id IS NOT NULL AND v.device_id = s.device_id))
      ))::int AS voters
    FROM s GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);

  // Next-day return: of people first seen on a day, how many visited again the next day.
  const retention = await db.execute<{ day: string; new_visitors: number; back_d1: number }>(sql`
    WITH a AS (
      SELECT COALESCE(e.user_id, e.device_id) AS who, (e.created_at AT TIME ZONE 'America/New_York')::date AS d
      FROM analytics_event e WHERE e.name IN ('session_start', 'page_view') AND e.created_at > ${since} AND ${notBot}
        AND COALESCE(e.user_id, e.device_id) IS NOT NULL
      GROUP BY 1, 2
    ), f AS (SELECT who, min(d) AS first FROM a GROUP BY 1)
    SELECT to_char(f.first, 'MM-DD') AS day, count(*)::int AS new_visitors,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM a WHERE a.who = f.who AND a.d = f.first + 1))::int AS back_d1
    FROM f GROUP BY f.first ORDER BY f.first`);

  const topEngaging = await db.execute<{ slug: string; title: string; score: number; voters: number; returns: number; votes_a: number; votes_b: number; seed: boolean; kind: string }>(sql`
    SELECT b.slug, b.title, b.engagement_score AS score, b.engagement_voters AS voters, b.engagement_returns AS returns,
      b.votes_a, b.votes_b, b.id LIKE 'seed_%' AS seed,
      CASE WHEN count(o.image_url) = 2 THEN 'photo' WHEN count(o.image_url) = 0 THEN 'text' ELSE 'mixed' END AS kind
    FROM battle b LEFT JOIN "option" o ON o.battle_id = b.id
    WHERE b.engagement_voters >= 3 AND b.status <> 'DELETED'
    GROUP BY b.id ORDER BY b.engagement_score DESC LIMIT 15`);

  // Splits on real votes only (≥ 10 real votes): closest to 50/50 and most one-sided.
  const splits = (dir: "ASC" | "DESC") =>
    db.execute<{ slug: string; title: string; a: number; b: number; total: number; gap: number }>(sql`
      SELECT b.slug, b.title,
        count(*) FILTER (WHERE v.side = 'A')::int AS a, count(*) FILTER (WHERE v.side = 'B')::int AS b, count(*)::int AS total,
        abs(count(*) FILTER (WHERE v.side = 'A') - count(*) FILTER (WHERE v.side = 'B'))::float / count(*) AS gap
      FROM battle b JOIN vote v ON v.battle_id = b.id
      WHERE COALESCE(v.source, '') <> 'seed' AND NOT v.flagged AND b.status <> 'DELETED'
      GROUP BY b.id HAVING count(*) >= 10
      ORDER BY gap ${sql.raw(dir)}, count(*) DESC LIMIT 8`);
  const [closest, lopsided] = await Promise.all([splits("ASC"), splits("DESC")]);

  // By AI tag: how each theme / stakes level performs (all-time votes, views in the window).
  const byTag = (key: "theme" | "stakes") =>
    db.execute<{ tag: string; battles: number; real_votes: number; views: number; voted_views: number; score: number | null }>(sql`
      SELECT b.tags->'brain'->>${key} AS tag, count(DISTINCT b.id)::int AS battles,
        COALESCE(sum(rv.n), 0)::int AS real_votes,
        COALESCE(sum(cv.views), 0)::int AS views, COALESCE(sum(cv.voted), 0)::int AS voted_views,
        avg(b.engagement_score) FILTER (WHERE b.engagement_voters >= 3)::float AS score
      FROM battle b
      LEFT JOIN LATERAL (SELECT count(*) AS n FROM vote v WHERE v.battle_id = b.id AND COALESCE(v.source, '') <> 'seed' AND NOT v.flagged) rv ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS views, count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM vote v WHERE v.battle_id = b.id
            AND ((e.user_id IS NOT NULL AND v.user_id = e.user_id) OR (e.device_id IS NOT NULL AND v.device_id = e.device_id))
        )) AS voted
        FROM analytics_event e
        WHERE e.name = 'card_shown' AND e.props->>'battleId' = b.id AND e.created_at > ${since} AND ${notBot}
      ) cv ON true
      WHERE b.tags ? 'brain' AND b.status <> 'DELETED'
      GROUP BY 1 ORDER BY 3 DESC`);
  const [byTheme, byStakes, [untagged]] = await Promise.all([
    byTag("theme"),
    byTag("stakes"),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM battle WHERE status <> 'DELETED' AND NOT (tags ? 'brain')`),
  ]);

  return { byTheme, byStakes, untagged: untagged?.n ?? 0, days, tiles, byKind, depth, methods, sources, retention, topEngaging, closest, lopsided };
}
