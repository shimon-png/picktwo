import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { battles, outcomes, users, votes } from "../db/schema";
import { battleCards, hydrateCards, visibleStatuses, type BattleCard } from "./battles";

export type VotedCard = BattleCard & { mySide: "A" | "B"; votedAt: string };

/** Battles the user posted (newest first), for Activity → Battles posted. */
export function postedBattles(userId: string, limit = 100) {
  return battleCards(and(eq(battles.authorId, userId), visibleStatuses), limit);
}

/** Battles the user voted on with their pick, most recent vote first, for Activity → Votes. */
export async function votedBattles(userId: string, limit = 100): Promise<VotedCard[]> {
  const rows = await db
    .select({
      b: battles,
      authorHandle: users.handle,
      authorName: users.name,
      authorImage: users.image,
      oChosen: outcomes.chosen,
      oThumb: outcomes.thumb,
      oNote: outcomes.note,
      side: votes.side,
      votedAt: votes.createdAt,
    })
    .from(votes)
    .innerJoin(battles, eq(battles.id, votes.battleId))
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(and(eq(votes.userId, userId), visibleStatuses))
    .orderBy(desc(votes.createdAt))
    .limit(limit);
  const cards = await hydrateCards(rows);
  return cards.map((c, i) => ({ ...c, mySide: rows[i].side, votedAt: rows[i].votedAt.toISOString() }));
}
