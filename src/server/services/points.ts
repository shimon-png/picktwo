import { and, eq, gte, sql, lt, isNull, inArray, notInArray, or } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { pointLedger, users, battles, outcomes } from "../db/schema";
import type { Economy } from "@/lib/constants";

type LedgerReason = (typeof pointLedger.$inferInsert)["reason"];

/**
 * The ONLY way to change a user's Priority Points. Writes a ledger row and updates the balance atomically.
 * Idempotent on idemKey: re-running with the same key is a no-op. Returns the delta actually applied.
 */
export async function awardPoints(
  tx: DbOrTx,
  userId: string,
  delta: number,
  reason: LedgerReason,
  refs: { battleId?: string; voteId?: string; idemKey?: string } = {},
): Promise<number> {
  if (delta === 0) return 0;
  const inserted = await tx
    .insert(pointLedger)
    .values({ userId, delta, reason, battleId: refs.battleId, voteId: refs.voteId, idemKey: refs.idemKey })
    .onConflictDoNothing({ target: pointLedger.idemKey })
    .returning({ id: pointLedger.id });
  if (inserted.length === 0) return 0;
  await tx
    .update(users)
    .set({ ppBalance: sql`GREATEST(0, ${users.ppBalance} + ${delta})` })
    .where(eq(users.id, userId));
  return delta;
}

/** Points earned today from votes (for the daily cap). */
export async function votePointsToday(tx: DbOrTx, userId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [r] = await tx
    .select({ s: sql<number>`COALESCE(SUM(${pointLedger.delta}), 0)::int` })
    .from(pointLedger)
    .where(
      and(
        eq(pointLedger.userId, userId),
        inArray(pointLedger.reason, ["VOTE", "VOTE_REASON"]),
        gte(pointLedger.createdAt, start),
      ),
    );
  return r?.s ?? 0;
}

/**
 * Open loops: the user's battles more than `openLoopGraceHours` past deadline, with ≥ minVotesForLoop votes
 * and no outcome reported (PRD 5.4).
 */
export function openLoopsWhere(economy: Economy, now = new Date()) {
  const cutoff = new Date(now.getTime() - economy.openLoopGraceHours * 3600_000);
  return and(
    lt(battles.deadline, cutoff),
    notInArray(battles.status, ["DELETED", "HIDDEN"]),
    sql`${battles.votesA} + ${battles.votesB} >= ${economy.minVotesForLoop}`,
    isNull(outcomes.id),
  );
}

export async function countOpenLoops(userId: string, economy: Economy): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(battles)
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(and(eq(battles.authorId, userId), openLoopsWhere(economy)));
  return r?.n ?? 0;
}

export async function openLoopCountsFor(authorIds: string[], economy: Economy): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (authorIds.length === 0) return m;
  const rows = await db
    .select({ authorId: battles.authorId, n: sql<number>`count(*)::int` })
    .from(battles)
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(and(inArray(battles.authorId, authorIds), openLoopsWhere(economy)))
    .groupBy(battles.authorId);
  for (const r of rows) m.set(r.authorId, r.n);
  return m;
}

/**
 * Close-the-loop posting gate (docs/rules/close-the-loop-and-experts.md): the user's battles that have
 * closed (deadline passed or closed early), got at least one vote and have no reported choice yet.
 * No grace period: a battle counts the moment it closes. Hidden and deleted battles don't count.
 */
export function unreportedWhere(now = new Date()) {
  return and(
    or(eq(battles.status, "CLOSED"), lt(battles.deadline, now)),
    notInArray(battles.status, ["DELETED", "HIDDEN"]),
    sql`${battles.votesA} + ${battles.votesB} > 0`,
    isNull(outcomes.id),
  );
}

export async function unreportedBattles(userId: string) {
  return db
    .select({ slug: battles.slug, title: battles.title, deadline: battles.deadline })
    .from(battles)
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(and(eq(battles.authorId, userId), unreportedWhere()))
    .orderBy(battles.deadline);
}

export async function countUnreported(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(battles)
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(and(eq(battles.authorId, userId), unreportedWhere()));
  return r?.n ?? 0;
}

/** Battles awaiting an outcome (past deadline or closed, no outcome) — includes ones still in the grace window. */
export async function awaitingOutcome(userId: string) {
  return db
    .select({
      id: battles.id,
      slug: battles.slug,
      title: battles.title,
      deadline: battles.deadline,
      votesA: battles.votesA,
      votesB: battles.votesB,
      labelA: sql<string>`(SELECT label FROM "option" o WHERE o.battle_id = ${battles.id} AND o.side = 'A')`,
      labelB: sql<string>`(SELECT label FROM "option" o WHERE o.battle_id = ${battles.id} AND o.side = 'B')`,
    })
    .from(battles)
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(
      and(
        eq(battles.authorId, userId),
        lt(battles.deadline, new Date()),
        notInArray(battles.status, ["DELETED", "HIDDEN"]),
        isNull(outcomes.id),
      ),
    )
    .orderBy(battles.deadline);
}
