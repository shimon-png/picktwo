import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";
import { getEconomy } from "./config";
import { inHoldout } from "./ranking";
import { meansP } from "./gate-test-rules";
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
  const holdoutP = meansP(
    people.filter((p) => inHoldout(`about:${p.who}`, e.aboutHoldoutPct)).map((p) => Number(p.votes)),
    people.filter((p) => !inHoldout(`about:${p.who}`, e.aboutHoldoutPct)).map((p) => Number(p.votes)),
  );
  return { questions, arms, holdoutP, holdoutPct: e.aboutHoldoutPct, versions: await versionStats(view, e.aboutHoldoutPct) };
}

export type ArmNumbers = { visitors: number; voters: number; votes: number; answered: number; answers: number };
export type VersionRow = { version: "v1" | "v2"; from: string; to: string | null; cards: ArmNumbers; holdout: ArmNumbers; votesP: number | null };

/**
 * Cards v1 vs v2 (Alex, Nov 25): v1 = sex, age, relationship, ZIP (from the first card ever shown); v2 = no ZIP card,
 * plus kids, education, home, race, party without an account. v2 starts on its own at the first education / race /
 * party card shown, so no date has to be set. Per version and group (sees cards vs the no-cards holdout): visitors,
 * people who voted, votes, people who answered at least one card, and card answers, all over the whole version (not
 * the page's day window), same Clean / All scope as the rest of the Brain.
 */
async function versionStats(view: BrainView, holdoutPct: number): Promise<VersionRow[]> {
  // Epoch milliseconds from Postgres, so JS never parses its timestamp text.
  const [b] = await db.execute<{ v1: number | null; v2: number | null }>(sql`
    SELECT (SELECT extract(epoch from min(created_at)) * 1000 FROM profile_answer WHERE via = 'card')::float8 AS v1,
      (SELECT extract(epoch from min(created_at)) * 1000 FROM profile_answer WHERE via = 'card' AND question IN ('education', 'race', 'party'))::float8 AS v2`);
  if (b?.v1 == null) return [];
  const v1 = new Date(Number(b.v1)).toISOString();
  const v2 = b.v2 != null ? new Date(Number(b.v2)).toISOString() : null;
  const days = Math.ceil((Date.now() - Date.parse(v1)) / 86400_000) + 1;
  const scope = await brainScope(view, days);
  const periods: [VersionRow["version"], string, string | null][] = [["v1", v1, v2]];
  if (v2) periods.push(["v2", v2, null]);
  const out: VersionRow[] = [];
  for (const [version, from, to] of periods) {
    const upTo = (col: SQL) => (to ? sql`AND ${col} < ${to}` : sql``);
    const rows = await db.execute<{ who: string; votes: number; answers: number }>(sql`
      WITH p AS (
        SELECT DISTINCT ${WHO_E} AS who FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
        WHERE e.name = 'session_start' AND e.created_at >= ${from} ${upTo(sql`e.created_at`)} AND ${scope.ev}
      ),
      vv AS (
        SELECT ${WHO_V} AS who, count(*)::int AS n FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
        WHERE v.created_at >= ${from} ${upTo(sql`v.created_at`)} AND NOT v.flagged AND ${scope.vt} GROUP BY 1
      ),
      aa AS (
        SELECT COALESCE(pa.user_id, dp.user_id, pa.device_id) AS who, count(*)::int AS n
        FROM profile_answer pa LEFT JOIN device dp ON dp.id = pa.device_id
        WHERE pa.via = 'card' AND pa.status = 'answered' AND pa.created_at >= ${from} ${upTo(sql`pa.created_at`)} GROUP BY 1
      )
      SELECT p.who, COALESCE(vv.n, 0) AS votes, COALESCE(aa.n, 0) AS answers
      FROM p LEFT JOIN vv ON vv.who = p.who LEFT JOIN aa ON aa.who = p.who WHERE p.who IS NOT NULL`);
    const blank = (): ArmNumbers => ({ visitors: 0, voters: 0, votes: 0, answered: 0, answers: 0 });
    const arms = { cards: blank(), holdout: blank() };
    const votes = { cards: [] as number[], holdout: [] as number[] };
    for (const r of rows) {
      const k = inHoldout(`about:${r.who}`, holdoutPct) ? "holdout" : "cards";
      const a = arms[k];
      const n = Number(r.votes);
      a.visitors++;
      a.votes += n;
      if (n > 0) a.voters++;
      a.answers += Number(r.answers);
      if (Number(r.answers) > 0) a.answered++;
      votes[k].push(n);
    }
    out.push({ version, from, to, ...arms, votesP: meansP(votes.holdout, votes.cards) });
  }
  return out;
}
