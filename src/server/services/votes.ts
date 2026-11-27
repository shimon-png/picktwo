import { and, eq, gte, isNull, sql, ne } from "drizzle-orm";
import { db } from "../db";
import { battles, votes, skips, users, reasonHelpful, devices, type User } from "../db/schema";
import { AppError } from "../errors";
import { assertCleanText } from "../moderation";
import { awardPoints, votePointsToday } from "./points";
import { gateArm } from "./gate-test";
import { aboutAfterVote, likeYouFor, moveDeviceAnswers } from "./about";
import { tasteProfileFor, voteTotal } from "./taste-profile";
import { mindAfterVote } from "./mind";
import { gateDecision, type GateArm } from "./gate-test-rules";
import { getEconomy } from "./config";
import { voteQualityIssue, isValidReason } from "./priority";
import { notify } from "./notifications";
import { getBattleRow, assertCanView } from "./battles";
import { track } from "../analytics";
import { pct } from "@/lib/utils";

const VOTE_MILESTONES = [1, 10, 50, 100];

type VoteViewer = { user: User | null; deviceId: string | null };
type VoteInput = { side: "A" | "B"; reason?: string; dwellMs?: number; source?: string; meta?: { method?: string; pos?: number; sessionId?: string } };

type Exec = Pick<typeof db, "execute">;

/**
 * Votes a signed-out device has cast, including votes it carried into an account it signed in to
 * (so signing out doesn't hand out a fresh batch of free votes).
 */
export async function guestVotesUsed(deviceId: string, exec: Exec = db): Promise<number> {
  const rows = await exec.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vote v
    WHERE v.device_id = ${deviceId} OR v.user_id = (SELECT d.user_id FROM device d WHERE d.id = ${deviceId})`);
  return Number(rows[0]?.n ?? 0);
}

/** Free votes left before the sign-up gate (null for signed-in viewers). */
export async function guestVotesLeft(viewer: VoteViewer): Promise<number | null> {
  if (viewer.user) return null;
  const { guestVoteLimit } = await getEconomy();
  if (!viewer.deviceId) return guestVoteLimit;
  return Math.max(0, guestVoteLimit - (await guestVotesUsed(viewer.deviceId)));
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: unknown } | null;
  return !!err && (err.code === "23505" || isUniqueViolation(err.cause));
}

export async function castVote(slug: string, viewer: VoteViewer, input: VoteInput) {
  try {
    return await castVoteOnce(slug, viewer, input);
  } catch (e) {
    // Two requests for the same voter raced (e.g. vote tap then an instant reason chip):
    // both saw no row and tried to insert. Retry once; the row now exists, so it updates.
    if (isUniqueViolation(e)) return castVoteOnce(slug, viewer, input);
    throw e;
  }
}

async function castVoteOnce(slug: string, viewer: VoteViewer, input: VoteInput) {
  const b = await getBattleRow(slug);
  if (!b) throw new AppError("NOT_FOUND", "Battle not found");
  await assertCanView(b, viewer.user);
  if (b.status !== "OPEN") throw new AppError("VOTING_CLOSED", "Voting has closed on this battle");
  if (viewer.user?.id === b.authorId) throw new AppError("FORBIDDEN", "You can't vote on your own battle");
  if (!viewer.user && !viewer.deviceId) throw new AppError("VALIDATION", "Please enable cookies to vote");
  if (input.reason) assertCleanText(input.reason);

  const economy = await getEconomy();
  const user = viewer.user;
  // Sign-up gate A/B test: group A hits the wall after the free votes, group B gets a closable dialog.
  const arm: GateArm | null = user ? null : await gateArm(viewer.deviceId);
  let gatePrompt = false;
  const reasonEarns = isValidReason(input.reason, economy.reasonMinChars);

  // A changed vote overwrites vote.side, so the first pick is kept in the event log (data brain).
  let changedFrom: "A" | "B" | null = null;
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
        changedFrom = existing.side;
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
      // Signed-out visitors get a few free votes, then must sign up (the client shows the gate first).
      if (!user) {
        const used = await guestVotesUsed(viewer.deviceId!, tx);
        const gate = gateDecision(arm ?? "control", used, economy.guestVoteLimit, economy.softGateEvery);
        if (!gate.allow) throw new AppError("SIGNUP_REQUIRED", "Sign up to keep voting — it takes 4 quick steps.");
        gatePrompt = gate.prompt;
      }
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
          voterCorrect: user?.correctPicks ?? 0,
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
    let guestLeft: number | null = null;
    if (user) {
      const [u] = await tx.select({ pp: users.ppBalance }).from(users).where(eq(users.id, user.id));
      ppBalance = u.pp;
    } else {
      guestLeft = Math.max(0, economy.guestVoteLimit - (await guestVotesUsed(viewer.deviceId!, tx)));
    }
    return {
      voteId,
      points,
      results: pct(fresh.votesA, fresh.votesB),
      ppBalance,
      guestVotesLeft: guestLeft,
      /** Group B of the sign-up gate test: never blocked; `gatePrompt` = show the closable sign-up dialog now. */
      softGate: arm === "soft",
      gatePrompt,
      isNew,
    };
  });

  if (res.isNew)
    track(
      "vote_cast",
      {
        battleId: b.id,
        side: input.side,
        anon: !user,
        source: input.source,
        dwellMs: input.dwellMs,
        withReason: !!input.reason,
        points: res.points,
        ...(arm ? { gateArm: arm } : {}),
        ...input.meta,
      },
      { userId: user?.id, deviceId: viewer.deviceId },
    );
  else if (changedFrom)
    track(
      "vote_changed",
      { battleId: b.id, from: changedFrom, to: input.side, source: input.source, ...input.meta },
      { userId: user?.id, deviceId: viewer.deviceId },
    );
  // About-you card next in the Vote deck (only the deck shows them; never together with the sign-up prompt).
  // Deck extras after a new vote: a taste-profile moment wins over an about-you card (which simply waits a vote).
  const inDeck = res.isNew && input.source === "feed" && !res.gatePrompt;
  const [taste, likeYou] = await Promise.all([inDeck ? tasteMilestone(viewer, b.id) : null, likeYouFor(b.id, viewer)]);
  // Then "What's on your mind this week?" or its sign-up nudge (lib/mind.ts); an about-you card waits a vote for it.
  const mind = inDeck && !taste ? await mindAfterVote(viewer, await voteTotal(viewer)) : null;
  const about = inDeck && !taste && !mind ? await aboutAfterVote(viewer) : null;
  return { ...res, about, likeYou, taste, mind };
}

/**
 * Taste profile moments in the deck: the first traits the moment two are really measured (economy tasteAxisMin battles
 * each, from tasteFirstAt votes), the full wheel once all six are and they have tasteFullAt votes (Alex, Nov 27 2026:
 * never show a wheel that says nothing).
 */
async function tasteMilestone(viewer: VoteViewer, battleId: string) {
  try {
    const t = await tasteProfileFor(viewer, { withoutBattle: battleId });
    if (!t || !t.axes.length || t.prevStage == null || t.stage <= t.prevStage) return null;
    return { milestone: t.votes, full: t.stage === 2, signedIn: !!viewer.user, name: t.name, missing: t.missing, axes: t.axes.map(({ id, left, right, score, crowd, why }) => ({ id, left, right, score, crowd, why })) };
  } catch (e) {
    console.error("[taste] milestone", e);
    return null;
  }
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
  // About-you answers given as a guest fill the new account's profile (sign-up then skips them).
  await moveDeviceAnswers(userId, deviceId).catch((e) => console.error("[about] carry over", e));
}
