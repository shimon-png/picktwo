import { and, desc, eq, gt, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { battles, outcomes, users } from "../db/schema";
import { AppError } from "../errors";
import { getEconomy } from "./config";
import { clampBattleHours } from "./expertise";

export type AdminBattleFilter = "ended" | "live" | "all";

/**
 * Battles an admin can relaunch: not hidden or deleted, no outcome reported yet (a decided battle
 * stays decided), and the poster isn't banned.
 */
function relaunchable() {
  return and(inArray(battles.status, ["OPEN", "CLOSED"]), isNull(outcomes.battleId), isNull(users.bannedAt));
}

function filterCond(filter: AdminBattleFilter, now: Date) {
  if (filter === "live") return and(eq(battles.status, "OPEN"), gt(battles.deadline, now));
  if (filter === "ended") return or(eq(battles.status, "CLOSED"), and(eq(battles.status, "OPEN"), lte(battles.deadline, now)));
  return sql`true`;
}

export async function battleCounts(now = new Date()) {
  const [r] = await db.execute<{ total: number; live: number; ended: number; decided: number; hidden: number; relaunchable: number }>(sql`
    SELECT
      count(*) FILTER (WHERE b.status IN ('OPEN','CLOSED','HIDDEN'))::int AS total,
      count(*) FILTER (WHERE b.status = 'OPEN' AND b.deadline > ${now.toISOString()})::int AS live,
      count(*) FILTER (WHERE b.status = 'CLOSED' OR (b.status = 'OPEN' AND b.deadline <= ${now.toISOString()}))::int AS ended,
      count(*) FILTER (WHERE b.status IN ('OPEN','CLOSED') AND o.battle_id IS NOT NULL)::int AS decided,
      count(*) FILTER (WHERE b.status = 'HIDDEN')::int AS hidden,
      count(*) FILTER (WHERE (b.status = 'CLOSED' OR (b.status = 'OPEN' AND b.deadline <= ${now.toISOString()}))
        AND o.battle_id IS NULL AND u.banned_at IS NULL)::int AS relaunchable
    FROM battle b
    JOIN "user" u ON u.id = b.author_id
    LEFT JOIN outcome o ON o.battle_id = b.id`);
  return r;
}

export async function listAdminBattles(filter: AdminBattleFilter, q = "", limit = 500, now = new Date()) {
  const rows = await db
    .select({
      id: battles.id,
      slug: battles.slug,
      title: battles.title,
      status: battles.status,
      deadline: battles.deadline,
      createdAt: battles.createdAt,
      votes: sql<number>`${battles.votesA} + ${battles.votesB}`,
      authorHandle: users.handle,
      decided: sql<boolean>`${outcomes.battleId} IS NOT NULL`,
      banned: sql<boolean>`${users.bannedAt} IS NOT NULL`,
    })
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(
      and(
        inArray(battles.status, ["OPEN", "CLOSED"]),
        filterCond(filter, now),
        q.trim() ? or(ilike(battles.title, `%${q.trim()}%`), ilike(users.handle, `%${q.trim()}%`)) : sql`true`,
      ),
    )
    .orderBy(desc(battles.deadline))
    .limit(limit);
  return rows.map((r) => ({ ...r, live: r.status === "OPEN" && r.deadline > now, canRelaunch: !r.decided && !r.banned }));
}

/**
 * Relaunch battles in place: back to OPEN with a fresh deadline (capped at maxBattleHours, 5 days).
 * Votes are kept, and people who already voted still won't see it again (a pick is final). The
 * publish time resets so the deck (which shows battles from the last 7 days) picks it up as new.
 * Either pass ids, or allEnded to relaunch every ended battle that qualifies.
 */
export async function relaunchBattles(input: { ids?: string[]; allEnded?: boolean; hours?: number }, now = new Date()) {
  const { maxBattleHours } = await getEconomy();
  const hours = clampBattleHours(input.hours ?? maxBattleHours, maxBattleHours);
  const deadline = new Date(now.getTime() + hours * 3600_000);

  let where;
  if (input.allEnded) where = and(relaunchable(), filterCond("ended", now));
  else if (input.ids?.length) where = and(relaunchable(), inArray(battles.id, input.ids));
  else throw new AppError("VALIDATION", "Pick at least one battle");

  const targets = await db
    .select({ id: battles.id })
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(where);
  const ids = targets.map((t) => t.id);
  if (!ids.length) return { relaunched: 0, hours, skipped: input.ids?.length ?? 0 };

  let relaunched = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const res = await db
      .update(battles)
      .set({ status: "OPEN", deadline, closedAt: null, createdAt: now, reminderCount: 0, lastReminderAt: null, updatedAt: now })
      .where(and(inArray(battles.id, chunk), inArray(battles.status, ["OPEN", "CLOSED"])))
      .returning({ id: battles.id });
    relaunched += res.length;
  }
  return { relaunched, hours, skipped: input.ids?.length ? input.ids.length - relaunched : 0 };
}
