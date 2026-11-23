import { and, eq, isNull, lt, sql, gt } from "drizzle-orm";
import { db } from "../db";
import { battles, outcomes, users } from "../db/schema";
import { closeDueBattles } from "./battles";
import { reminderDue } from "./priority";
import { notify } from "./notifications";
import { emailLoopReminder } from "./lifecycle";
import { getEconomy } from "./config";
import { awardPoints } from "./points";

export { closeDueBattles };

/** Report-back reminders at deadline +2h, +48h, +7d (in-app always; email if opted in). */
export async function sendReminders(now = new Date()) {
  const rows = await db
    .select({ b: battles })
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(
      and(
        eq(battles.status, "CLOSED"),
        isNull(outcomes.id),
        lt(battles.reminderCount, 3),
        gt(sql`${battles.votesA} + ${battles.votesB}`, 0),
        isNull(users.bannedAt),
      ),
    )
    .limit(500);
  let sent = 0;
  for (const { b } of rows) {
    if (!reminderDue(b.deadline, b.reminderCount, now)) continue;
    const updated = await db
      .update(battles)
      .set({ reminderCount: b.reminderCount + 1, lastReminderAt: now })
      .where(and(eq(battles.id, b.id), eq(battles.reminderCount, b.reminderCount)))
      .returning({ id: battles.id });
    if (!updated.length) continue;
    await notify(db, b.authorId, "REMINDER", { slug: b.slug, title: b.title, n: b.reminderCount + 1 });
    // The first reminder's email is "Results are in" (hourly job); later ones are close-the-loop reminders.
    if (b.reminderCount > 0) await emailLoopReminder(b.id, b.reminderCount + 1);
    sent++;
  }
  return sent;
}

/** −10% of balance per 30 days of inactivity, floor 10 (PRD 5.3). */
export async function decayPoints(now = new Date()) {
  const e = await getEconomy();
  const cutoff = new Date(now.getTime() - e.decayInactiveDays * 86400_000);
  const period = Math.floor(now.getTime() / (e.decayInactiveDays * 86400_000));
  const idle = await db
    .select({ id: users.id, pp: users.ppBalance })
    .from(users)
    .where(and(lt(users.lastActiveAt, cutoff), gt(users.ppBalance, e.decayFloor)));
  let n = 0;
  for (const u of idle) {
    const delta = -Math.min(u.pp - e.decayFloor, Math.ceil((u.pp * e.decayPercent) / 100));
    if (delta < 0 && (await awardPoints(db, u.id, delta, "DECAY", { idemKey: `decay:${u.id}:${period}` }))) n++;
  }
  return n;
}

export async function dailyRollup() {
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [r] = await db.execute<{ battles: number; votes: number; outcomes: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM battle WHERE created_at > ${since}) AS battles,
      (SELECT count(*)::int FROM vote WHERE created_at > ${since}) AS votes,
      (SELECT count(*)::int FROM outcome WHERE reported_at > ${since}) AS outcomes`);
  return r;
}
