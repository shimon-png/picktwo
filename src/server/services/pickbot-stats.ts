/**
 * Pickbot on /admin/brain (PRD §8, §11): the funnel (people at each step), answers (count, cost, speed, 👍 rate per
 * model and answer type), the crowd (posted, results back, agreement with Pickbot) and the holdout check (accounts
 * without Pickbot vs with: votes per visitor). Same Clean / All scope and window as the rest of the Brain.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";
import { getEconomy } from "./config";
import { inHoldout } from "./ranking";
import { meansP } from "./gate-test-rules";

const STEPS = [
  ["pickbot_asked", "Asked a question"],
  ["pickbot_gate_answered", "Answered a profile question"],
  ["pickbot_gate_skipped", "Skipped the profile questions"],
  ["pickbot_choice", "Chose general or tailored"],
  ["pickbot_answered", "Got an answer"],
  ["pickbot_rated", "Rated an answer"],
  ["pickbot_crowd_drafted", "Drafted a crowd battle"],
  ["pickbot_crowd_posted", "Posted to the crowd"],
  ["pickbot_results_delivered", "Got crowd results back"],
  ["pickbot_outcome", "Said what they picked"],
] as const;

export async function pickbotStats(view: BrainView, days: number) {
  const e = await getEconomy();
  const { since, ev, vt } = await brainScope(view, days);
  const funnel = await db.execute<{ name: string; people: number; events: number }>(sql`
    SELECT e.name, count(DISTINCT ${WHO_E})::int AS people, count(*)::int AS events
    FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
    WHERE e.name LIKE 'pickbot_%' AND e.created_at > ${since} AND ${ev} GROUP BY 1`);
  const byName = new Map([...funnel].map((r) => [r.name, r]));
  const choice = await db.execute<{ choice: string; n: number }>(sql`
    SELECT e.props->>'choice' AS choice, count(*)::int AS n FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
    WHERE e.name = 'pickbot_choice' AND e.created_at > ${since} AND ${ev} GROUP BY 1`);
  const answers = await db.execute<{ model: string; kind: string; n: number; cost: number; latency: number }>(sql`
    SELECT COALESCE(e.props->>'model', '?') AS model, COALESCE(e.props->>'kind', '?') AS kind, count(*)::int AS n,
      COALESCE(sum((e.props->>'costUsd')::float8), 0)::float8 AS cost, COALESCE(avg((e.props->>'latencyMs')::float8), 0)::float8 AS latency
    FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
    WHERE e.name = 'pickbot_answered' AND e.created_at > ${since} AND ${ev} GROUP BY 1, 2 ORDER BY 3 DESC`);
  const ratings = await db.execute<{ model: string; up: number; down: number }>(sql`
    SELECT COALESCE(e.props->>'model', '?') AS model, count(*) FILTER (WHERE e.props->>'rating' = 'UP')::int AS up,
      count(*) FILTER (WHERE e.props->>'rating' = 'DOWN')::int AS down
    FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
    WHERE e.name = 'pickbot_rated' AND e.created_at > ${since} AND ${ev} GROUP BY 1`);
  const [agree] = await db.execute<{ yes: number; no: number }>(sql`
    SELECT count(*) FILTER (WHERE e.props->>'agreed' = 'true')::int AS yes, count(*) FILTER (WHERE e.props->>'agreed' = 'false')::int AS no
    FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
    WHERE e.name = 'pickbot_results_delivered' AND e.created_at > ${since} AND ${ev}`);
  // Holdout: accounts with a visit in the window, split by the same stable hash as pickbotAccess.
  const people = await db.execute<{ who: string; votes: number }>(sql`
    WITH p AS (
      SELECT DISTINCT ${WHO_E} AS who FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev}
    ),
    vv AS (
      SELECT ${WHO_V} AS who, count(*)::int AS n FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
      WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} GROUP BY 1
    )
    SELECT p.who, COALESCE(vv.n, 0) AS votes FROM p JOIN "user" u ON u.id = p.who LEFT JOIN vv ON vv.who = p.who`);
  const arms = { pickbot: { visitors: 0, votes: 0 }, holdout: { visitors: 0, votes: 0 } };
  const each = { pickbot: [] as number[], holdout: [] as number[] };
  for (const p of people) {
    const k = inHoldout(`pickbot:${p.who}`, e.pickbotHoldoutPct) ? "holdout" : "pickbot";
    arms[k].visitors++;
    arms[k].votes += Number(p.votes);
    each[k].push(Number(p.votes));
  }
  const totalAnswers = [...answers].reduce((t, r) => t + Number(r.n), 0);
  const totalCost = [...answers].reduce((t, r) => t + Number(r.cost), 0);
  return {
    funnel: STEPS.map(([name, label]) => ({ name, label, people: byName.get(name)?.people ?? 0, events: byName.get(name)?.events ?? 0 })),
    choice: Object.fromEntries([...choice].map((r) => [r.choice, Number(r.n)])) as Record<string, number>,
    answers: [...answers].map((r) => ({ model: r.model, kind: r.kind, n: Number(r.n), costPer: Number(r.n) ? Number(r.cost) / Number(r.n) : 0, latencyS: Number(r.latency) / 1000 })),
    totalAnswers,
    totalCost,
    ratings: [...ratings].map((r) => ({ model: r.model, up: Number(r.up), down: Number(r.down) })),
    agree: { yes: Number(agree?.yes ?? 0), no: Number(agree?.no ?? 0) },
    arms,
    holdoutP: meansP(each.holdout, each.pickbot),
    holdoutPct: e.pickbotHoldoutPct,
    open: !!e.pickbotOpen,
    model: e.pickbotModelOpus ? "Opus 5.5" : "Sonnet 5.5",
  };
}
