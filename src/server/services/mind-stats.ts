import { sql } from "drizzle-orm";
import { db } from "../db";
import { brainScope, type BrainView } from "./brain";
import { getEconomy } from "./config";
import { MIND_OTHER, MIND_TOPICS, mindLabel } from "@/lib/mind";

/**
 * "What's on your mind this week?" on /admin/brain: how often the card was shown, answered (per topic) and skipped,
 * how often the sign-up nudge showed, and what people typed after "Other" (admins only; never tied to a person here).
 * Same Clean / All scope as the rest of the Brain (profile_answer is aliased `s` to reuse the scope's filter).
 */
export async function mindStats(view: BrainView, days: number) {
  const { since, st } = await brainScope(view, days);
  const e = await getEconomy();
  const [counts] = await db.execute<{ shown: number; answered: number; skipped: number; nudges: number }>(sql`
    SELECT count(*) FILTER (WHERE s.question = 'mind')::int AS shown,
      count(*) FILTER (WHERE s.question = 'mind' AND s.status = 'answered')::int AS answered,
      count(*) FILTER (WHERE s.question = 'mind' AND s.status = 'skipped')::int AS skipped,
      count(*) FILTER (WHERE s.question = 'mind_nudge')::int AS nudges
    FROM profile_answer s WHERE s.via = 'mind' AND s.created_at > ${since} AND ${st}`);
  const byTopic = await db.execute<{ topic: string; n: number }>(sql`
    SELECT s.answer AS topic, count(*)::int AS n FROM profile_answer s
    WHERE s.via = 'mind' AND s.question = 'mind' AND s.status = 'answered' AND s.created_at > ${since} AND ${st} GROUP BY 1`);
  const n = new Map([...byTopic].map((r) => [r.topic, Number(r.n)]));
  const topics = [...MIND_TOPICS.map((t) => t.id), MIND_OTHER].map((id) => ({ id, label: mindLabel(id), n: n.get(id) ?? 0 }));
  const typed = await db.execute<{ text: string; n: number; last: string }>(sql`
    SELECT lower(s.answer) AS text, count(*)::int AS n, max(s.created_at)::text AS last FROM profile_answer s
    WHERE s.via = 'mind' AND s.question = 'mind_text' AND s.answer IS NOT NULL AND s.created_at > ${since} AND ${st}
    GROUP BY 1 ORDER BY max(s.created_at) DESC LIMIT 50`);
  return {
    shown: Number(counts?.shown ?? 0),
    answered: Number(counts?.answered ?? 0),
    skipped: Number(counts?.skipped ?? 0),
    nudges: Number(counts?.nudges ?? 0),
    topics,
    typed: [...typed].map((r) => ({ text: r.text, n: Number(r.n), last: r.last })),
    on: e.mindAt > 0,
    holdoutPct: e.mindHoldoutPct,
  };
}
