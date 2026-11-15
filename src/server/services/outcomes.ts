import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { battles, outcomes, votes, users, type User } from "../db/schema";
import { AppError } from "../errors";
import { assertCleanText } from "../moderation";
import { awardPoints } from "./points";
import { getEconomy } from "./config";
import { notify } from "./notifications";
import { applyOutcomeToReputation } from "./reputation";
import { getOwnedBattle } from "./battles";
import { track } from "../analytics";

export async function reportOutcome(
  slug: string,
  user: User,
  input: { chosen: "A" | "B" | "NEITHER"; thumb?: "UP" | "DOWN" | null; note?: string; photoUrl?: string },
) {
  const b = await getOwnedBattle(slug, user);
  const economy = await getEconomy();
  const total = b.votesA + b.votesB;
  const now = new Date();
  const isOpen = b.status === "OPEN";
  if (isOpen && total < economy.minVotesForLoop)
    throw new AppError("CONFLICT", `Wait for at least ${economy.minVotesForLoop} votes or the deadline before reporting back`);
  assertCleanText(input.note);
  const thumb = input.chosen === "NEITHER" ? null : (input.thumb ?? null);

  const [existing] = await db.select().from(outcomes).where(eq(outcomes.battleId, b.id));
  if (existing) {
    if (now.getTime() - existing.reportedAt.getTime() > 7 * 86400_000)
      throw new AppError("CONFLICT", "Outcomes can only be edited for 7 days");
    await db
      .update(outcomes)
      .set({ chosen: input.chosen, thumb, note: input.note || null, photoUrl: input.photoUrl || existing.photoUrl, editedAt: now })
      .where(eq(outcomes.id, existing.id));
    return { points: 0, edited: true };
  }

  const result = await db.transaction(async (tx) => {
    await tx.insert(outcomes).values({
      battleId: b.id,
      userId: user.id,
      chosen: input.chosen,
      thumb,
      note: input.note || null,
      photoUrl: input.photoUrl || null,
    });
    if (isOpen) await tx.update(battles).set({ status: "CLOSED", closedAt: now, deadline: now, updatedAt: now }).where(eq(battles.id, b.id));

    let points = 0;
    if (total >= economy.minVotesForLoop) {
      points += await awardPoints(tx, user.id, economy.loopClosedPoints, "LOOP_CLOSED", { battleId: b.id, idemKey: `loop:${b.id}` });
      const deadline = isOpen ? now : b.deadline;
      if (now.getTime() - deadline.getTime() <= economy.loopClosedFastHours * 3600_000)
        points += await awardPoints(tx, user.id, economy.loopClosedFastBonus, "LOOP_CLOSED_FAST", { battleId: b.id, idemKey: `loopfast:${b.id}` });
      if ((input.note?.trim().length ?? 0) >= economy.outcomeNoteMinChars)
        points += await awardPoints(tx, user.id, economy.outcomeNotePoints, "OUTCOME_NOTE", { battleId: b.id, idemKey: `note:${b.id}` });
    }

    // Notify voters and award "Called it" (PRD 5.3)
    const voters = await tx
      .select({ id: votes.id, userId: votes.userId, side: votes.side })
      .from(votes)
      .where(and(eq(votes.battleId, b.id), isNotNull(votes.userId)));
    for (const v of voters) {
      let called = 0;
      if (thumb === "UP" && v.side === input.chosen)
        called = await awardPoints(tx, v.userId!, economy.calledItPoints, "CALLED_IT", { battleId: b.id, voteId: v.id, idemKey: `called:${v.id}` });
      await notify(tx, v.userId!, called ? "CALLED_IT" : "OUTCOME", {
        slug: b.slug,
        title: b.title,
        chosen: input.chosen,
        thumb,
        yourSide: v.side,
        points: called,
        poster: user.name || user.handle,
      });
    }
    await applyOutcomeToReputation(tx, b, input.chosen, thumb);
    await tx.update(users).set({ lastActiveAt: now }).where(eq(users.id, user.id));
    return { points };
  });

  track(
    "outcome_reported",
    { battleId: b.id, chosen: input.chosen, thumb, hoursAfterDeadline: (now.getTime() - b.deadline.getTime()) / 3600_000 },
    { userId: user.id },
  );
  return { ...result, edited: false };
}
