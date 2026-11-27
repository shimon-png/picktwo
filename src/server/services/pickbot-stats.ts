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
import { PROMO_POSITIONS, promoPosition } from "@/lib/pickbot-promo";

const STEPS = [
  ["pickbot_asked", "Asked a question"],
  ["pickbot_gate_answered", "Answered a profile question"],
  ["pickbot_answered", "Got an answer"],
  ["pickbot_rated", "Rated an answer"],
  ["pickbot_crowd_drafted", "Drafted a crowd battle"],
  ["pickbot_crowd_posted", "Posted to the crowd"],
  ["pickbot_choice", "Said yes to a better (tailored) answer"],
  ["pickbot_battles_stopped", "Said not now to a better answer"],
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
  // Day by day (New York days), the same event scope.
  const daily = await db.execute<{
    day: string;
    askers: number;
    questions: number;
    followups: number;
    answers: number;
    tailored: number;
    up: number;
    down: number;
    crowd: number;
    results: number;
    cost: number;
  }>(sql`
    SELECT to_char((e.created_at AT TIME ZONE 'America/New_York')::date, 'YYYY-MM-DD') AS day,
      count(DISTINCT ${WHO_E}) FILTER (WHERE e.name = 'pickbot_asked')::int AS askers,
      count(*) FILTER (WHERE e.name = 'pickbot_asked' AND COALESCE(e.props->>'followUp', 'false') <> 'true')::int AS questions,
      count(*) FILTER (WHERE e.name = 'pickbot_asked' AND e.props->>'followUp' = 'true')::int AS followups,
      count(*) FILTER (WHERE e.name = 'pickbot_answered')::int AS answers,
      count(*) FILTER (WHERE e.name = 'pickbot_answered' AND e.props->>'kind' = 'tailored')::int AS tailored,
      count(*) FILTER (WHERE e.name = 'pickbot_rated' AND e.props->>'rating' = 'UP')::int AS up,
      count(*) FILTER (WHERE e.name = 'pickbot_rated' AND e.props->>'rating' = 'DOWN')::int AS down,
      count(*) FILTER (WHERE e.name = 'pickbot_crowd_posted')::int AS crowd,
      count(*) FILTER (WHERE e.name = 'pickbot_results_delivered')::int AS results,
      COALESCE(sum((e.props->>'costUsd')::float8) FILTER (WHERE e.name = 'pickbot_answered'), 0)::float8 AS cost
    FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
    WHERE e.name LIKE 'pickbot_%' AND e.created_at > ${since} AND ${ev}
    GROUP BY 1 ORDER BY 1 DESC`);
  // What people ask about (the classifier's theme and scope; never the text).
  const themes = await db.execute<{ theme: string; scope: string; questions: number; people: number }>(sql`
    SELECT COALESCE(e.props->>'theme', '?') AS theme, COALESCE(e.props->>'scope', '?') AS scope,
      count(*)::int AS questions, count(DISTINCT ${WHO_E})::int AS people
    FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
    WHERE e.name = 'pickbot_asked' AND COALESCE(e.props->>'followUp', 'false') <> 'true' AND e.created_at > ${since} AND ${ev}
    GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`);
  // Coming back: of the people who asked in the window, how many have asked on 2+ different days (ever).
  const [repeat] = await db.execute<{ askers: number; repeat: number; questions: number; answeredPeople: number }>(sql`
    WITH a AS (
      SELECT DISTINCT ${WHO_E} AS who FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'pickbot_asked' AND e.created_at > ${since} AND ${ev}
    ),
    days AS (
      SELECT e.user_id AS who, count(DISTINCT (e.created_at AT TIME ZONE 'America/New_York')::date)::int AS n
      FROM analytics_event e WHERE e.name = 'pickbot_asked' AND e.user_id IN (SELECT who FROM a) GROUP BY 1
    )
    SELECT (SELECT count(*)::int FROM a) AS askers,
      (SELECT count(*)::int FROM days WHERE n >= 2) AS repeat,
      (SELECT count(*)::int FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
        WHERE e.name = 'pickbot_asked' AND COALESCE(e.props->>'followUp', 'false') <> 'true' AND e.created_at > ${since} AND ${ev}) AS questions,
      (SELECT count(DISTINCT ${WHO_E})::int FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
        WHERE e.name = 'pickbot_answered' AND e.created_at > ${since} AND ${ev}) AS "answeredPeople"`);
  // "Ask Pickbot" deck card, by tested position: signed-in people who used the deck in the window (minus those who
  // had asked Pickbot before it), how far they got in one deck visit, and what the card did.
  const promoPeople = await db.execute<{ who: string; reach: number; saw: boolean; tapped: boolean; dismissed: boolean; asked: boolean }>(sql`
    WITH deck AS (
      SELECT e.user_id AS who, max(COALESCE((e.props->>'pos')::int, 0)) AS reach
      FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'card_shown' AND e.user_id IS NOT NULL AND e.created_at > ${since} AND ${ev} GROUP BY 1
    ),
    shown AS (
      SELECT user_id AS who, min(created_at) AS at FROM analytics_event WHERE name = 'pickbot_promo_shown' AND user_id IS NOT NULL GROUP BY 1
    )
    SELECT deck.who, deck.reach, shown.at IS NOT NULL AS saw,
      EXISTS (SELECT 1 FROM analytics_event t WHERE t.name = 'pickbot_promo_tap' AND t.user_id = deck.who) AS tapped,
      EXISTS (SELECT 1 FROM analytics_event t WHERE t.name = 'pickbot_promo_dismissed' AND t.user_id = deck.who) AS dismissed,
      EXISTS (SELECT 1 FROM analytics_event a WHERE a.name = 'pickbot_asked' AND a.user_id = deck.who AND shown.at IS NOT NULL
        AND a.created_at >= shown.at AND a.created_at < shown.at + interval '7 days') AS asked
    FROM deck LEFT JOIN shown ON shown.who = deck.who
    WHERE NOT EXISTS (SELECT 1 FROM analytics_event b WHERE b.name = 'pickbot_asked' AND b.user_id = deck.who
      AND b.created_at < COALESCE(shown.at, ${since}::timestamptz))`);
  const promo = PROMO_POSITIONS.map((at) => ({ at, active: 0, reached: 0, saw: 0, tapped: 0, dismissed: 0, asked: 0 }));
  for (const p of promoPeople) {
    const row = promo.find((r) => r.at === promoPosition(p.who))!;
    row.active++;
    if (Number(p.reach) >= row.at + 1) row.reached++;
    if (p.saw) row.saw++;
    if (p.tapped) row.tapped++;
    if (p.dismissed) row.dismissed++;
    if (p.asked) row.asked++;
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
    promo,
    promoOn: !!e.pickbotPromo,
    daily: [...daily].map((r) => ({
      day: r.day,
      askers: Number(r.askers),
      questions: Number(r.questions),
      followups: Number(r.followups),
      answers: Number(r.answers),
      tailored: Number(r.tailored),
      up: Number(r.up),
      down: Number(r.down),
      crowd: Number(r.crowd),
      results: Number(r.results),
      cost: Number(r.cost),
    })),
    themes: [...themes].map((r) => ({ theme: r.theme, scope: r.scope, questions: Number(r.questions), people: Number(r.people) })),
    usage: {
      askers: Number(repeat?.askers ?? 0),
      repeat: Number(repeat?.repeat ?? 0),
      questions: Number(repeat?.questions ?? 0),
      answeredPeople: Number(repeat?.answeredPeople ?? 0),
    },
    model: e.pickbotModelOpus ? "Opus 5.5" : "Sonnet 5.5",
  };
}
