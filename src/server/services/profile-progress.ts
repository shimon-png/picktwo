/**
 * Profile bar (Pickbot PRD Phase 0, Nov 25 2026): how close someone is to a complete profile (four core about-you
 * answers + economy `tasteFullAt` battles), for the Vote deck and You. A stable `profileBarHoldoutPct` share of people
 * never sees the bar, so the Brain can measure what it adds in votes (`profileBarStats`). Math in lib/profile-progress.ts.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { User } from "../db/schema";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";
import { getEconomy } from "./config";
import { inHoldout } from "./ranking";
import { meansP } from "./gate-test-rules";
import { knownAnswers } from "./about";
import { voteTotal } from "./taste-profile";
import { profileProgress, type ProfileProgress } from "@/lib/profile-progress";

type Viewer = { user: User | null; deviceId: string | null };
export type ProfileBarArm = "bar" | "holdout";

const armFor = (key: string, pct: number): ProfileBarArm => (inHoldout(`pbar:${key}`, pct) ? "holdout" : "bar");
export const profileBarArm = (v: Viewer, pct: number) => armFor(v.user?.id ?? v.deviceId ?? "", pct);

/** The viewer's progress, or null when they're in the holdout or we can't tell who they are. Never throws. */
export async function profileProgressFor(v: Viewer): Promise<ProfileProgress | null> {
  if (!v.user && !v.deviceId) return null;
  try {
    const e = await getEconomy();
    if (profileBarArm(v, e.profileBarHoldoutPct) === "holdout") return null;
    const [votes, known] = await Promise.all([voteTotal(v), knownAnswers(v)]);
    return profileProgress(votes, known, e.tasteFullAt);
  } catch (err) {
    console.error("[profile-bar]", err);
    return null;
  }
}

/**
 * Brain: bar vs holdout among people with a visit in the window. Votes per visitor, and the share who reached the
 * full-profile vote count (all their votes ever, so it isn't cut by the window).
 */
export async function profileBarStats(view: BrainView, days: number) {
  const e = await getEconomy();
  const { since, ev, vt } = await brainScope(view, days);
  const people = await db.execute<{ who: string; votes: number; ever: number }>(sql`
    WITH p AS (
      SELECT DISTINCT ${WHO_E} AS who FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev}
    ),
    vv AS (
      SELECT ${WHO_V} AS who, count(*) FILTER (WHERE v.created_at > ${since})::int AS n, count(*)::int AS ever
      FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
      WHERE NOT v.flagged AND ${vt} GROUP BY 1
    )
    SELECT p.who, COALESCE(vv.n, 0) AS votes, COALESCE(vv.ever, 0) AS ever FROM p LEFT JOIN vv ON vv.who = p.who WHERE p.who IS NOT NULL`);
  const arms = { bar: { visitors: 0, votes: 0, reached: 0 }, holdout: { visitors: 0, votes: 0, reached: 0 } };
  const each = { bar: [] as number[], holdout: [] as number[] };
  for (const p of people) {
    const k = armFor(p.who, e.profileBarHoldoutPct);
    const a = arms[k];
    each[k].push(Number(p.votes));
    a.visitors++;
    a.votes += Number(p.votes);
    if (Number(p.ever) >= e.tasteFullAt) a.reached++;
  }
  return { arms, p: meansP(each.holdout, each.bar), holdoutPct: e.profileBarHoldoutPct, target: e.tasteFullAt };
}
