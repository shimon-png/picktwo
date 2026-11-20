import { and, eq, gte, isNull, sql, ne } from "drizzle-orm";
import { db } from "../db";
import { battles, votes, skips, users, reasonHelpful, devices, type User } from "../db/schema";
import { AppError } from "../errors";
import { assertCleanText } from "../moderation";
import { awardPoints, votePointsToday } from "./points";
import { getEconomy } from "./config";
import { voteQualityIssue, isValidReason } from "./priority";
import { notify } from "./notifications";
import { getBattleRow, assertCanView } from "./battles";
import { track } from "../analytics";
import { pct } from "@/lib/utils";
import { reasonSuggestions } from "@/lib/constants";

const VOTE_MILESTONES = [1, 10, 50, 100];

export async function castVote(
  slug: string,
  viewer: { user: User | null; deviceId: string | null },
  input: { side: "A" | "B"; reason?: string; dwellMs?: number; source?: string },
) {
  const b = await getBattleRow(slug);
  if (!b) throw new AppError("NOT_FOUND", "Battle not found");
  await assertCanView(b, viewer.user);
  if (b.status !== "OPEN") throw new AppError("VOTING_CLOSED", "Voting has closed on this battle");
  if (viewer.user?.id === b.authorId) throw new AppError("FORBIDDEN", "You can't vote on your own battle");
  if (!viewer.user && !viewer.deviceId) throw new AppError("VALIDATION", "Please enable cookies to vote");
  if (input.reason) assertCleanText(input.reason);

  const economy = await getEconomy();
  const user = viewer.user;
  // A one-tap suggested reason chip counts as a reason even though it's short.
  const reasonEarns =
    isValidReason(input.reason, economy.reasonMinChars) || (!!input.reason && reasonSuggestions(b.categoryId).includes(input.reason.trim()));

  const res = await db.transaction(async (tx) => {
    const owner = user ? eq(votes.userId, user.id) : eq(votes.deviceId, viewer.deviceId!);
    const [existing] = await tx.select().from(votes).where(and(eq(votes.battleId, b.id), owner)).for("update");

    let points = 0;
    let voteId: string;
    let isNew = false;

    if (existing) {
      voteId = existing.id;
      const patch: Partial<typeof votes.$inferInsert> = {};
      if (existing.side !== input.side) {
        patch.side = input.side;
        patch.changedAt = new Date();
        await tx
          .update(battles)
          .set(
            input.side === "A"
              ? { votesA: sql`${battles.votesA} + 1`, votesB: sql`GREATEST(0, ${battles.votesB} - 1)` }
              : { votesB: sql`${battles.votesB} + 1`, votesA: sql`GREATEST(0, ${battles.votesA} - 1)` },
          )
          .where(eq(battles.id, b.id));
      }
      if (input.reason !== undefined) patch.reason = input.reason || null;
      if (Object.keys(patch).length) await tx.update(votes).set(patch).where(eq(votes.id, existing.id));
      // Late reason bonus (once) for a quality vote
      if (user && existing.pointsAwarded > 0 && reasonEarns) {
        const today = await votePointsToday(tx, user.id);
        if (today < economy.dailyVotePointCap)
          points += await awardPoints(tx, user.id, economy.voteReasonBonus, "VOTE_REASON", {
            battleId: b.id,
            voteId: existing.id,
            idemKey: `reason:${existing.id}`,
          });
      }
    } else {
      isNew = true;
      // Quality checks for points (PRD 5.5)
      let issue: ReturnType<typeof voteQualityIssue> = "anonymous";
      if (user) {
        const windowStart = new Date(Date.now() - economy.burstWindowSec * 1000);
        const [[recent], [life]] = await Promise.all([
          tx
            .select({ n: sql<number>`count(*)::int` })
            .from(votes)
            .where(and(eq(votes.userId, user.id), gte(votes.createdAt, windowStart))),
          tx
            .select({ n: sql<number>`count(*)::int`, a: sql<number>`count(*) FILTER (WHERE ${votes.side} = 'A')::int` })
            .from(votes)
            .where(eq(votes.userId, user.id)),
        ]);
        issue = voteQualityIssue({
          signedIn: true,
          isOwnBattle: false,
          dwellMs: input.dwellMs,
          recentVotesInWindow: recent.n,
          lifetimeVotes: life.n,
          lifetimeSideAShare: life.n ? life.a / life.n : 0.5,
          minDwellMs: economy.minDwellMs,
          burstMaxVotes: economy.burstMaxVotes,
          degenerateMinVotes: economy.degenerateMinVotes,
          degenerateRatio: economy.degenerateRatio,
        });
      }
      const [v] = await tx
        .insert(votes)
        .values({
          battleId: b.id,
          userId: user?.id ?? null,
          deviceId: user ? null : viewer.deviceId,
          side: input.side,
          reason: input.reason || null,
          dwellMs: input.dwellMs ?? null,
          source: input.source ?? null,
          flagged: issue === "burst" || issue === "degenerate",
        })
        .returning();
      voteId = v.id;
      await tx
        .update(battles)
        .set({
          ...(input.side === "A" ? { votesA: sql`${battles.votesA} + 1` } : { votesB: sql`${battles.votesB} + 1` }),
          ...(b.boostVotesLeft > 0 ? { boostVotesLeft: sql`GREATEST(0, ${battles.boostVotesLeft} - 1)` } : {}),
        })
        .where(eq(battles.id, b.id));

      if (user && !issue) {
        const today = await votePointsToday(tx, user.id);
        if (today < economy.dailyVotePointCap) {
          points += await awardPoints(tx, user.id, economy.votePoints, "VOTE", { battleId: b.id, voteId: v.id, idemKey: `vote:${v.id}` });
          if (reasonEarns && today + points < economy.dailyVotePointCap)
            points += await awardPoints(tx, user.id, economy.voteReasonBonus, "VOTE_REASON", {
              battleId: b.id,
              voteId: v.id,
              idemKey: `reason:${v.id}`,
            });
        }
        if (points) await tx.update(votes).set({ pointsAwarded: points }).where(eq(votes.id, v.id));
      }
      if (user) await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));

      const total = b.votesA + b.votesB + 1;
      if (VOTE_MILESTONES.includes(total))
        await notify(tx, b.authorId, "VOTES_MILESTONE", { slug: b.slug, title: b.title, votes: total });
    }

    const [fresh] = await tx
      .select({ votesA: battles.votesA, votesB: battles.votesB })
      .from(battles)
      .where(eq(battles.id, b.id));
    let ppBalance: number | null = null;
    if (user) {
      const [u] = await tx.select({ pp: users.ppBalance }).from(users).where(eq(users.id, user.id));
      ppBalance = u.pp;
    }
    return { voteId, points, results: pct(fresh.votesA, fresh.votesB), ppBalance, isNew };
  });

  if (res.isNew)
    track(
      "vote_cast",
      { battleId: b.id, anon: !user, source: input.source, dwellMs: input.dwellMs, withReason: !!input.reason, points: res.points },
      { userId: user?.id, deviceId: viewer.deviceId },
    );
  return res;
}

export async function skipBattle(slug: string, viewer: { user: User | null; deviceId: string | null }) {
  const b = await getBattleRow(slug);
  if (!b) throw new AppError("NOT_FOUND", "Battle not found");
  if (!viewer.user && !viewer.deviceId) return;
  await db
    .insert(skips)
    .values({ battleId: b.id, userId: viewer.user?.id ?? null, deviceId: viewer.user ? null : viewer.deviceId })
    .onConflictDoNothing();
  track("skip", { battleId: b.id }, { userId: viewer.user?.id, deviceId: viewer.deviceId });
}

/** Toggle "helpful" on a reason. The poster's mark awards the reason's author points (PRD 5.3). */
export async function toggleHelpful(voteId: string, user: User) {
  const [v] = await db
    .select({ id: votes.id, userId: votes.userId, battleId: votes.battleId, authorId: battles.authorId })
    .from(votes)
    .innerJoin(battles, eq(battles.id, votes.battleId))
    .where(eq(votes.id, voteId));
  if (!v) throw new AppError("NOT_FOUND", "Reason not found");
  if (v.userId === user.id) throw new AppError("FORBIDDEN", "You can't mark your own reason");
  const isOwner = v.authorId === user.id;
  const economy = await getEconomy();

  return db.transaction(async (tx) => {
    const del = await tx
      .delete(reasonHelpful)
      .where(and(eq(reasonHelpful.voteId, voteId), eq(reasonHelpful.userId, user.id)))
      .returning();
    if (del.length) return { marked: false };
    await tx.insert(reasonHelpful).values({ voteId, userId: user.id, isOwner });
    if (isOwner && v.userId) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(reasonHelpful)
        .innerJoin(votes, eq(votes.id, reasonHelpful.voteId))
        .where(and(eq(votes.battleId, v.battleId), eq(reasonHelpful.isOwner, true)));
      if (n <= economy.ownerHelpfulMaxPerBattle) {
        const got = await awardPoints(tx, v.userId, economy.ownerHelpfulPoints, "REASON_HELPFUL", {
          battleId: v.battleId,
          voteId,
          idemKey: `helpful:${voteId}`,
        });
        if (got) await notify(tx, v.userId, "HELPFUL", { battleId: v.battleId, points: got });
      }
    }
    track("reason_helpful", { voteId, isOwner }, { userId: user.id });
    return { marked: true };
  });
}

/**
 * Links an anonymous device to a user on sign-in and merges its votes (PRD 6.2/A-16).
 * If the user already voted on the same battle, the device vote is dropped and counters fixed.
 */
export async function linkDevice(userId: string, deviceId: string) {
  const [d] = await db.select().from(devices).where(eq(devices.id, deviceId));
  if (d?.userId === userId) return;
  await db.transaction(async (tx) => {
    await tx
      .insert(devices)
      .values({ id: deviceId, userId })
      .onConflictDoUpdate({ target: devices.id, set: { userId } });
    const devVotes = await tx.select().from(votes).where(and(eq(votes.deviceId, deviceId), isNull(votes.userId)));
    for (const dv of devVotes) {
      const [dup] = await tx
        .select({ id: votes.id })
        .from(votes)
        .where(and(eq(votes.battleId, dv.battleId), eq(votes.userId, userId), ne(votes.id, dv.id)));
      const [b] = await tx.select({ authorId: battles.authorId }).from(battles).where(eq(battles.id, dv.battleId));
      if (dup || b?.authorId === userId) {
        await tx.delete(votes).where(eq(votes.id, dv.id));
        await tx
          .update(battles)
          .set(dv.side === "A" ? { votesA: sql`GREATEST(0, ${battles.votesA} - 1)` } : { votesB: sql`GREATEST(0, ${battles.votesB} - 1)` })
          .where(eq(battles.id, dv.battleId));
      } else {
        await tx.update(votes).set({ userId, deviceId: null }).where(eq(votes.id, dv.id));
      }
    }
    await tx.execute(sql`UPDATE skip s SET user_id = ${userId}, device_id = NULL
      WHERE s.device_id = ${deviceId} AND s.user_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM skip s2 WHERE s2.battle_id = s.battle_id AND s2.user_id = ${userId})`);
  });
}
