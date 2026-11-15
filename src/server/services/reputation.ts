import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { DbOrTx } from "../db";
import { reputations, votes } from "../db/schema";

/** PRD 9.4 — a vote is "correct" if it matches a 👍 pick, or opposes a 👎 pick. */
export function isCorrectVote(side: "A" | "B", chosen: "A" | "B", thumb: "UP" | "DOWN"): boolean {
  return thumb === "UP" ? side === chosen : side !== chosen;
}

/** Bayesian-smoothed reputation score. */
export function reputationScore(correct: number, resolved: number): number {
  return (correct + 2) / (resolved + 4);
}

export async function applyOutcomeToReputation(
  tx: DbOrTx,
  battle: { id: string; categoryId: string },
  chosen: "A" | "B" | "NEITHER",
  thumb: "UP" | "DOWN" | null,
) {
  if (chosen === "NEITHER" || !thumb) return;
  const vs = await tx
    .select({ userId: votes.userId, side: votes.side })
    .from(votes)
    .where(and(eq(votes.battleId, battle.id), isNotNull(votes.userId)));
  for (const v of vs) {
    const correct = isCorrectVote(v.side, chosen, thumb) ? 1 : 0;
    await tx
      .insert(reputations)
      .values({ userId: v.userId!, categoryId: battle.categoryId, correct, resolved: 1, score: reputationScore(correct, 1) })
      .onConflictDoUpdate({
        target: [reputations.userId, reputations.categoryId],
        set: {
          correct: sql`${reputations.correct} + ${correct}`,
          resolved: sql`${reputations.resolved} + 1`,
          score: sql`(${reputations.correct} + ${correct} + 2)::float / (${reputations.resolved} + 1 + 4)`,
        },
      });
  }
}
