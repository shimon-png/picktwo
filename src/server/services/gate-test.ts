/**
 * Sign-up gate A/B test (Shimon, Nov 24 2026). Every new signed-out browser is put in group A (control: the
 * sign-up wall after `guestVoteLimit` free votes, as before) or group B (a closable sign-up dialog; they can keep
 * voting, and it shows again every `softGateEvery` votes). `gateTestPct` (economy) = share put in B; 0 = off.
 * The group is saved in `experiment_assignment` the first time we see the browser, so it never changes.
 * Pure rules + stats in gate-test-rules.ts (tested); results on /admin/brain.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { devices, experimentAssignments } from "../db/schema";
import { getEconomy } from "./config";
import { adminIds } from "./brain";
import { GATE_EXPERIMENT, pickArm, summarizeGateTest, type GateArm, type GateVisitor } from "./gate-test-rules";

/** This browser's group. Signed-in viewers, browsers already linked to an account and the test being off → A. */
export async function gateArm(deviceId: string | null | undefined): Promise<GateArm> {
  if (!deviceId) return "control";
  const where = and(eq(experimentAssignments.experiment, GATE_EXPERIMENT), eq(experimentAssignments.unitId, deviceId));
  const [saved] = await db.select({ arm: experimentAssignments.arm }).from(experimentAssignments).where(where);
  if (saved) return saved.arm as GateArm;
  const { gateTestPct } = await getEconomy();
  if (gateTestPct <= 0) return "control";
  // A browser that already belongs to an account isn't a new visitor: leave it out of the test.
  const [d] = await db.select({ userId: devices.userId }).from(devices).where(eq(devices.id, deviceId));
  if (d?.userId) return "control";
  const arm = pickArm(deviceId, gateTestPct);
  await db.insert(experimentAssignments).values({ experiment: GATE_EXPERIMENT, unitId: deviceId, arm }).onConflictDoNothing();
  const [row] = await db.select({ arm: experimentAssignments.arm }).from(experimentAssignments).where(where);
  return (row?.arm as GateArm) ?? arm;
}

/** True when this signed-out viewer gets the closable dialog (group B). */
export async function softGateFor(viewer: { user: unknown; deviceId: string | null }): Promise<boolean> {
  if (viewer.user) return false;
  return (await gateArm(viewer.deviceId)) === "soft";
}

/**
 * Results for the Brain page. One row per browser in the test (bots and admins' browsers left out): its group, the
 * New York day it was first seen, real votes it made (as a guest, plus as the account it signed up to), whether it
 * reached the sign-up gate and whether it signed up. `days` limits the day-by-day rows; totals cover the whole test.
 */
export async function gateTestResults(days: number) {
  const e = await getEconomy();
  const { ids } = await adminIds();
  const notAdmin = ids.length ? sql`(d.user_id IS NULL OR d.user_id NOT IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}))` : sql`true`;
  const rows = await db.execute<{ day: string; arm: GateArm; votes: number; saw_gate: boolean; signed_up: boolean; recent: boolean }>(sql`
    SELECT to_char((a.created_at AT TIME ZONE 'America/New_York')::date, 'YYYY-MM-DD') AS day, a.arm,
      (SELECT count(*)::int FROM vote v
        WHERE (v.device_id = a.unit_id OR (d.user_id IS NOT NULL AND v.user_id = d.user_id))
          AND NOT v.flagged AND COALESCE(v.source, '') <> 'seed') AS votes,
      EXISTS (SELECT 1 FROM analytics_event g WHERE g.name = 'signup_gate_shown' AND g.device_id = a.unit_id) AS saw_gate,
      EXISTS (SELECT 1 FROM "user" u WHERE u.id = d.user_id AND u.onboarded_at IS NOT NULL AND u.email IS NOT NULL
        AND u.banned_at IS NULL) AS signed_up,
      a.created_at > now() - make_interval(days => ${days}) AS recent
    FROM experiment_assignment a
    LEFT JOIN device d ON d.id = a.unit_id
    WHERE a.experiment = ${GATE_EXPERIMENT} AND ${notAdmin}
      AND NOT EXISTS (SELECT 1 FROM analytics_event b WHERE b.device_id = a.unit_id AND b.name = 'session_start'
        AND COALESCE((b.props->>'bot')::boolean, false))`);
  const all: (GateVisitor & { recent: boolean })[] = rows.map((r) => ({
    day: r.day,
    arm: r.arm,
    votes: Number(r.votes),
    sawGate: r.saw_gate,
    signedUp: r.signed_up,
    recent: r.recent,
  }));
  const summary = summarizeGateTest(all);
  const recentDays = new Set(all.filter((v) => v.recent).map((v) => v.day));
  const [started] = await db.execute<{ at: string | null }>(
    sql`SELECT min(created_at)::text AS at FROM experiment_assignment WHERE experiment = ${GATE_EXPERIMENT}`,
  );
  return {
    ...summary,
    daily: summary.daily.filter((d) => recentDays.has(d.day)),
    pct: e.gateTestPct,
    limit: e.guestVoteLimit,
    every: e.softGateEvery,
    startedAt: started?.at ?? null,
  };
}
