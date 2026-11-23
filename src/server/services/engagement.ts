import { sql } from "drizzle-orm";
import { db } from "../db";
import { ENGAGEMENT_TZ, MAX_RETURN_DAYS, PRIOR, PRIOR_WEIGHT, weightCaseSql } from "./engagement-rules";

/**
 * Shimon's engagement score, kept up to date two ways (docs/brain/hypotheses.md H6):
 *  - live: `recordReturn()` runs on each new visit (session_start) and credits the battles that person
 *    voted on 1–3 days earlier, then recomputes just those battles;
 *  - daily: `refreshEngagement()` back-fills returns from all activity and recomputes every recent battle.
 * Only real votes count: no seed votes, no flagged votes.
 */

const TZ = sql.raw(`'${ENGAGEMENT_TZ}'`);
const REAL = sql`COALESCE(v.source, '') <> 'seed' AND NOT v.flagged`;
const VDAY = sql`(v.created_at AT TIME ZONE ${TZ})::date`;
const TODAY = sql`(now() AT TIME ZONE ${TZ})::date`;
const WEIGHT = sql.raw(weightCaseSql("v.returned_after_days"));
const MAXD = sql.raw(String(MAX_RETURN_DAYS));

/** Recompute the score for the given battles (all battles with real votes in the last `days` when ids is null). */
export async function recomputeEngagement(ids: string[] | null, days = 30): Promise<number> {
  if (ids && !ids.length) return 0;
  const scope = ids
    ? sql`v.battle_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`
    : sql`v.battle_id IN (SELECT DISTINCT battle_id FROM vote WHERE created_at > ${new Date(Date.now() - days * 86400_000).toISOString()})`;
  const rows = await db.execute<{ id: string }>(sql`
    UPDATE battle b SET
      engagement_voters = x.eligible,
      engagement_returns = x.ret,
      engagement_score = (LEAST(x.ret, x.eligible) + ${PRIOR * PRIOR_WEIGHT}) / (x.eligible + ${PRIOR_WEIGHT}),
      engagement_at = now()
    FROM (
      SELECT v.battle_id,
        count(*) FILTER (WHERE ${VDAY} < ${TODAY})::int AS eligible,
        COALESCE(sum(${WEIGHT}), 0)::float AS ret
      FROM vote v
      WHERE ${REAL} AND ${scope}
      GROUP BY v.battle_id
    ) x
    WHERE b.id = x.battle_id
    RETURNING b.id`);
  return rows.length;
}

/**
 * A person is here on a new day: mark their votes from 1–3 days ago as "came back" and recompute those battles.
 * Cheap: one indexed update over a few days of this person's votes. Never throws.
 */
export async function recordReturn(ids: { userId: string | null; deviceId: string | null }) {
  if (!ids.userId && !ids.deviceId) return;
  try {
    const who = ids.userId && ids.deviceId
      ? sql`(v.user_id = ${ids.userId} OR v.device_id = ${ids.deviceId})`
      : ids.userId
        ? sql`v.user_id = ${ids.userId}`
        : sql`v.device_id = ${ids.deviceId}`;
    const rows = await db.execute<{ battle_id: string }>(sql`
      UPDATE vote v SET returned_after_days = ${TODAY} - ${VDAY}
      WHERE ${who}
        AND v.returned_after_days IS NULL
        AND v.created_at > ${new Date(Date.now() - (MAX_RETURN_DAYS + 2) * 86400_000).toISOString()}
        AND ${TODAY} - ${VDAY} BETWEEN 1 AND ${MAXD}
        AND ${REAL}
      RETURNING v.battle_id`);
    const battles = [...new Set(rows.map((r) => r.battle_id))];
    if (battles.length) await recomputeEngagement(battles);
  } catch (e) {
    console.error("[engagement] recordReturn", e);
  }
}

/**
 * Daily: fill in returns the live path missed (people who came back without a new session, history before
 * live tracking) from later votes and visits, then recompute every battle with recent real votes.
 */
export async function refreshEngagement(opts: { backfillDays?: number } = {}) {
  const since = new Date(Date.now() - (opts.backfillDays ?? 8) * 86400_000).toISOString();
  const filled = await db.execute<{ id: string }>(sql`
    UPDATE vote t SET returned_after_days = r.d
    FROM (
      SELECT v.id, min(act.day - ${VDAY}) AS d
      FROM vote v
      JOIN LATERAL (
        SELECT (a.created_at AT TIME ZONE ${TZ})::date AS day FROM vote a
        WHERE a.id <> v.id
          AND ((v.user_id IS NOT NULL AND a.user_id = v.user_id) OR (v.device_id IS NOT NULL AND a.device_id = v.device_id))
          AND a.created_at > v.created_at AND a.created_at < v.created_at + interval '5 days'
        UNION ALL
        SELECT (e.created_at AT TIME ZONE ${TZ})::date AS day FROM analytics_event e
        WHERE e.name IN ('session_start', 'page_view')
          AND ((v.user_id IS NOT NULL AND e.user_id = v.user_id) OR (v.device_id IS NOT NULL AND e.device_id = v.device_id))
          AND e.created_at > v.created_at AND e.created_at < v.created_at + interval '5 days'
      ) act ON true
      WHERE v.created_at > ${since} AND v.returned_after_days IS NULL AND ${REAL}
        AND act.day - ${VDAY} BETWEEN 1 AND ${MAXD}
      GROUP BY v.id
    ) r
    WHERE t.id = r.id
    RETURNING t.id`);
  const battles = await recomputeEngagement(null, Math.max(30, opts.backfillDays ?? 0));
  return { returnsFilled: filled.length, battlesScored: battles };
}
