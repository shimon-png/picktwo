/**
 * Topics in the Vote deck A/B test (Alex, Nov 27 2026). Every new browser is put in "control" (today's deck, all
 * mixed) or "topics" (lib/topics.ts) the first time we see it, saved in `experiment_assignment`, so it never changes.
 * `topicsTestPct` (economy) = share put in "topics"; 0 = off. Admins always see topics (not counted).
 * Pure rules + stats in topics-test-rules.ts (tested); results on /admin/topics.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { devices, experimentAssignments, type User } from "../db/schema";
import { getEconomy } from "./config";
import { adminIds } from "./brain";
import { isAdmin } from "../viewer";
import { TOPICS_EXPERIMENT, pickTopicsArm, summarizeTopicsTest, type TopicsArm, type TopicsVisitor } from "./topics-test-rules";

/**
 * This viewer's group. Only browsers new to us join the test (no account linked, no votes or skips yet); everyone
 * else keeps the old deck. A signed-in person keeps the group their browser got as a guest.
 */
export async function topicsArm(viewer: { user: User | null; deviceId: string | null }): Promise<TopicsArm> {
  if (isAdmin(viewer.user)) return "topics";
  const deviceId = viewer.deviceId;
  if (!deviceId) return "control";
  const where = and(eq(experimentAssignments.experiment, TOPICS_EXPERIMENT), eq(experimentAssignments.unitId, deviceId));
  const [saved] = await db.select({ arm: experimentAssignments.arm }).from(experimentAssignments).where(where);
  if (saved) return saved.arm as TopicsArm;
  if (viewer.user) return "control";
  // End-to-end tests run on the old deck, except browsers a topics test opts in (device id containing "topics").
  if (process.env.E2E_RELAX_RATE_LIMITS === "true" && !deviceId.includes("topics")) return "control";
  const { topicsTestPct } = await getEconomy();
  if (topicsTestPct <= 0) return "control";
  const [d] = await db.select({ userId: devices.userId }).from(devices).where(eq(devices.id, deviceId));
  if (d?.userId) return "control";
  const [old] = await db.execute<{ yes: boolean }>(sql`
    SELECT (EXISTS (SELECT 1 FROM vote WHERE device_id = ${deviceId}) OR EXISTS (SELECT 1 FROM skip WHERE device_id = ${deviceId})) AS yes`);
  if (old?.yes) return "control";
  const arm = pickTopicsArm(deviceId, topicsTestPct);
  await db.insert(experimentAssignments).values({ experiment: TOPICS_EXPERIMENT, unitId: deviceId, arm }).onConflictDoNothing();
  const [row] = await db.select({ arm: experimentAssignments.arm }).from(experimentAssignments).where(where);
  return (row?.arm as TopicsArm) ?? arm;
}

/**
 * Results for /admin/topics. One row per browser in the test (bots and admins' browsers left out): group, New York day
 * first seen, real votes (as a guest plus the account it signed up to), sessions, active days in its first 7 days,
 * signed up, picked a topic. Plus per-topic numbers for the topics group.
 */
export async function topicsTestResults() {
  const e = await getEconomy();
  const { ids } = await adminIds();
  const notAdmin = ids.length ? sql`(d.user_id IS NULL OR d.user_id NOT IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}))` : sql`true`;
  const rows = await db.execute<{
    day: string;
    arm: TopicsArm;
    votes: number;
    sessions: number;
    active_days: number;
    signed_up: boolean;
    chose: boolean;
  }>(sql`
    WITH a AS (
      SELECT a.unit_id, a.arm, a.created_at, d.user_id
      FROM experiment_assignment a
      LEFT JOIN device d ON d.id = a.unit_id
      WHERE a.experiment = ${TOPICS_EXPERIMENT} AND ${notAdmin}
        AND NOT EXISTS (SELECT 1 FROM analytics_event b WHERE b.device_id = a.unit_id AND b.name = 'session_start'
          AND COALESCE((b.props->>'bot')::boolean, false))
    ),
    vv AS (
      SELECT unit_id, count(DISTINCT vid)::int AS n FROM (
        SELECT a.unit_id, v.id AS vid FROM a JOIN vote v ON v.device_id = a.unit_id
          WHERE NOT v.flagged AND COALESCE(v.source, '') <> 'seed'
        UNION ALL
        SELECT a.unit_id, v.id FROM a JOIN vote v ON v.user_id = a.user_id
          WHERE a.user_id IS NOT NULL AND NOT v.flagged AND COALESCE(v.source, '') <> 'seed'
      ) x GROUP BY 1
    ),
    ev AS (
      SELECT a.unit_id,
        count(*) FILTER (WHERE ae.name = 'session_start')::int AS sessions,
        count(DISTINCT (ae.created_at AT TIME ZONE 'America/New_York')::date)
          FILTER (WHERE ae.created_at < a.created_at + interval '7 days')::int AS active_days,
        bool_or(ae.name = 'topic_selected' AND COALESCE(ae.props->>'topic', 'mix') <> 'mix') AS chose
      FROM a JOIN analytics_event ae ON ae.device_id = a.unit_id AND ae.created_at >= a.created_at - interval '1 hour'
      GROUP BY 1
    )
    SELECT to_char((a.created_at AT TIME ZONE 'America/New_York')::date, 'YYYY-MM-DD') AS day, a.arm,
      COALESCE(vv.n, 0) AS votes, COALESCE(ev.sessions, 0) AS sessions, COALESCE(ev.active_days, 1) AS active_days,
      COALESCE(ev.chose, false) AS chose,
      EXISTS (SELECT 1 FROM "user" u WHERE u.id = a.user_id AND u.onboarded_at IS NOT NULL AND u.email IS NOT NULL
        AND u.banned_at IS NULL) AS signed_up
    FROM a LEFT JOIN vv ON vv.unit_id = a.unit_id LEFT JOIN ev ON ev.unit_id = a.unit_id`);
  const all: TopicsVisitor[] = rows.map((r) => ({
    day: r.day,
    arm: r.arm,
    votes: Number(r.votes),
    sessions: Number(r.sessions),
    activeDays: Number(r.active_days),
    signedUp: !!r.signed_up,
    choseTopic: !!r.chose,
  }));

  // Per topic, topics group only: people who picked it, votes cast while on it, and the topic cards' funnel.
  const perTopic = await db.execute<{ topic: string; pickers: number; votes: number; voters: number }>(sql`
    WITH a AS (
      SELECT a.unit_id FROM experiment_assignment a LEFT JOIN device d ON d.id = a.unit_id
      WHERE a.experiment = ${TOPICS_EXPERIMENT} AND a.arm = 'topics' AND ${notAdmin}
        AND NOT EXISTS (SELECT 1 FROM analytics_event b WHERE b.device_id = a.unit_id AND b.name = 'session_start'
        AND COALESCE((b.props->>'bot')::boolean, false))
    )
    SELECT t.topic, COALESCE(p.n, 0)::int AS pickers, COALESCE(v.n, 0)::int AS votes, COALESCE(v.people, 0)::int AS voters
    FROM (SELECT DISTINCT COALESCE(props->>'topic', 'mix') AS topic FROM analytics_event
          WHERE name IN ('topic_selected', 'vote_cast') AND props ? 'topic') t
    LEFT JOIN (SELECT ae.props->>'topic' AS topic, count(DISTINCT ae.device_id) AS n FROM analytics_event ae JOIN a ON a.unit_id = ae.device_id
               WHERE ae.name = 'topic_selected' GROUP BY 1) p ON p.topic = t.topic
    LEFT JOIN (SELECT ae.props->>'topic' AS topic, count(*) AS n, count(DISTINCT ae.device_id) AS people FROM analytics_event ae JOIN a ON a.unit_id = ae.device_id
               WHERE ae.name = 'vote_cast' AND ae.props ? 'topic' GROUP BY 1) v ON v.topic = t.topic
    ORDER BY votes DESC`);
  const funnel = await db.execute<{ name: string; people: number; times: number }>(sql`
    SELECT ae.name, count(DISTINCT ae.device_id)::int AS people, count(*)::int AS times
    FROM analytics_event ae JOIN experiment_assignment a ON a.unit_id = ae.device_id AND a.experiment = ${TOPICS_EXPERIMENT}
    LEFT JOIN device d ON d.id = a.unit_id
    WHERE ae.name LIKE 'topic\\_%' AND ${notAdmin}
      AND NOT EXISTS (SELECT 1 FROM analytics_event b WHERE b.device_id = a.unit_id AND b.name = 'session_start'
        AND COALESCE((b.props->>'bot')::boolean, false))
    GROUP BY 1 ORDER BY 1`);
  const [started] = await db.execute<{ at: string | null }>(
    sql`SELECT to_char(min(created_at) AT TIME ZONE 'America/New_York', 'Mon DD, HH12:MI AM') AS at FROM experiment_assignment WHERE experiment = ${TOPICS_EXPERIMENT}`,
  );
  return {
    ...summarizeTopicsTest(all),
    perTopic: perTopic.map((r) => ({ topic: r.topic, pickers: Number(r.pickers), votes: Number(r.votes), voters: Number(r.voters) })),
    funnel: funnel.map((r) => ({ name: r.name, people: Number(r.people), times: Number(r.times) })),
    pct: e.topicsTestPct,
    startedAt: started?.at ?? null,
  };
}
