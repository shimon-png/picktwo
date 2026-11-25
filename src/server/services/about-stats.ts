import { sql } from "drizzle-orm";
import { db } from "../db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";
import { getEconomy } from "./config";
import { inHoldout } from "./ranking";
import { ABOUT_QUESTION_IDS, ABOUT_QUESTIONS } from "@/lib/about";

/**
 * About-you cards on /admin/brain: per question how often it was shown, answered and skipped, and the holdout check
 * (people who never see cards vs those who do: visitors and votes per visitor). The group comes from the same stable
 * hash as `aboutArm`, keyed on the person (account, else browser).
 */
export async function aboutStats(view: BrainView, days: number) {
  const scope = await brainScope(view, days);
  const { since, ev, vt } = scope;
  const e = await getEconomy();
  const q = await db.execute<{ question: string; shown: number; answered: number; skipped: number }>(sql`
    SELECT question, count(*)::int AS shown,
      count(*) FILTER (WHERE status = 'answered')::int AS answered,
      count(*) FILTER (WHERE status = 'skipped')::int AS skipped
    FROM profile_answer WHERE via = 'card' AND created_at > ${since} GROUP BY 1`);
  const byQ = new Map([...q].map((r) => [r.question, r]));
  const questions = ABOUT_QUESTION_IDS.map((id) => {
    const r = byQ.get(id);
    return { id, title: ABOUT_QUESTIONS[id].title, shown: r?.shown ?? 0, answered: r?.answered ?? 0, skipped: r?.skipped ?? 0 };
  });
  const people = await db.execute<{ who: string; votes: number }>(sql`
    WITH p AS (
      SELECT DISTINCT ${WHO_E} AS who FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev}
    ),
    vv AS (
      SELECT ${WHO_V} AS who, count(*)::int AS n FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
      WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} GROUP BY 1
    )
    SELECT p.who, COALESCE(vv.n, 0) AS votes FROM p LEFT JOIN vv ON vv.who = p.who WHERE p.who IS NOT NULL`);
  const arms = { cards: { visitors: 0, votes: 0 }, holdout: { visitors: 0, votes: 0 } };
  for (const p of people) {
    const a = inHoldout(`about:${p.who}`, e.aboutHoldoutPct) ? arms.holdout : arms.cards;
    a.visitors++;
    a.votes += Number(p.votes);
  }
  return { questions, arms, holdoutPct: e.aboutHoldoutPct };
}
