import { and, desc, eq, gt, inArray, notInArray, sql, or } from "drizzle-orm";
import { db } from "../db";
import { battles, users, votes, follows, blocks, outcomes, type User } from "../db/schema";
import { getEconomy } from "./config";
import { openLoopCountsFor } from "./points";
import { priorityFactor } from "./priority";
import { feedScore, diversify, shuffleFactor, shuffleSeed, type ViewerProfile } from "./ranking";
import { friendIds, hydrateCards, type BattleCard } from "./battles";

export type FeedItem = BattleCard & { score: number; debug?: Record<string, number> };

export async function getFeed(viewer: { user: User | null; deviceId: string | null }, opts: { limit?: number; debug?: boolean } = {}) {
  const limit = opts.limit ?? 20;
  const economy = await getEconomy();
  const now = new Date();
  const user = viewer.user;

  const seenCond = user
    ? sql`NOT EXISTS (SELECT 1 FROM vote v WHERE v.battle_id = ${battles.id} AND (v.user_id = ${user.id}${viewer.deviceId ? sql` OR v.device_id = ${viewer.deviceId}` : sql``}))
       AND NOT EXISTS (SELECT 1 FROM skip s WHERE s.battle_id = ${battles.id} AND (s.user_id = ${user.id}${viewer.deviceId ? sql` OR s.device_id = ${viewer.deviceId}` : sql``}))`
    : viewer.deviceId
      ? // Signed out: this device's votes/skips, plus those of an account it was linked to (merged on sign-in).
        sql`NOT EXISTS (SELECT 1 FROM vote v WHERE v.battle_id = ${battles.id} AND (v.device_id = ${viewer.deviceId} OR v.user_id = (SELECT d.user_id FROM device d WHERE d.id = ${viewer.deviceId})))
         AND NOT EXISTS (SELECT 1 FROM skip s WHERE s.battle_id = ${battles.id} AND (s.device_id = ${viewer.deviceId} OR s.user_id = (SELECT d.user_id FROM device d WHERE d.id = ${viewer.deviceId})))`
      : sql`true`;

  const friends = user ? await friendIds(user.id) : new Set<string>();
  const followed = user
    ? new Set((await db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, user.id))).map((r) => r.id))
    : new Set<string>();
  const blocked = user
    ? (await db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, user.id))).map((r) => r.id)
    : [];

  const visibilityCond =
    friends.size > 0
      ? or(eq(battles.visibility, "PUBLIC"), and(eq(battles.visibility, "FRIENDS"), inArray(battles.authorId, [...friends])))
      : eq(battles.visibility, "PUBLIC");

  const rows = await db
    .select({
      b: battles,
      authorHandle: users.handle,
      authorName: users.name,
      authorImage: users.image,
      authorCountry: users.country,
      authorKidAges: users.kidAges,
      authorPP: users.ppBalance,
      oChosen: outcomes.chosen,
      oThumb: outcomes.thumb,
      oNote: outcomes.note,
    })
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(
      and(
        eq(battles.status, "OPEN"),
        gt(battles.deadline, now),
        gt(battles.createdAt, new Date(now.getTime() - 7 * 86400_000)),
        visibilityCond,
        user ? sql`${battles.authorId} <> ${user.id}` : sql`true`,
        blocked.length ? notInArray(battles.authorId, blocked) : sql`true`,
        sql`${users.bannedAt} IS NULL`,
        seenCond,
      ),
    )
    .orderBy(desc(battles.createdAt))
    .limit(500);

  // Viewer profile
  const profile: ViewerProfile = { categoryShare: {}, kidAges: user?.kidAges ?? [], country: user?.country ?? null };
  if (user) {
    const recent = await db
      .select({ categoryId: battles.categoryId })
      .from(votes)
      .innerJoin(battles, eq(battles.id, votes.battleId))
      .where(eq(votes.userId, user.id))
      .orderBy(desc(votes.createdAt))
      .limit(100);
    for (const r of recent) profile.categoryShare[r.categoryId] = (profile.categoryShare[r.categoryId] ?? 0) + 1 / recent.length;
  }

  // Random order per viewer (stable for the day) so everyone doesn't see the same sequence.
  const seed = shuffleSeed(user?.id ?? viewer.deviceId ?? crypto.randomUUID(), now);
  const loops = await openLoopCountsFor([...new Set(rows.map((r) => r.b.authorId))], economy);
  const scored = rows.map((r) => {
    const boostActive = !!r.b.boostUntil && r.b.boostUntil > now && r.b.boostVotesLeft > 0;
    const pf = priorityFactor({ ppBalance: r.authorPP, openLoops: loops.get(r.b.authorId) ?? 0, boostActive, cap: economy.priorityCap });
    const base = feedScore(profile, {
      categoryId: r.b.categoryId,
      kidAgeTags: r.b.tags?.kidAge ?? [],
      authorCountry: r.authorCountry,
      isFriend: friends.has(r.b.authorId),
      isFollowed: followed.has(r.b.authorId),
      votes: r.b.votesA + r.b.votesB,
      hoursUntilDeadline: (r.b.deadline.getTime() - now.getTime()) / 3600_000,
      hoursSincePublish: (now.getTime() - r.b.createdAt.getTime()) / 3600_000,
      priorityFactor: pf,
    });
    const score = base * shuffleFactor(seed, r.b.id);
    return { row: r, score, categoryId: r.b.categoryId, authorId: r.b.authorId, pf, openLoops: loops.get(r.b.authorId) ?? 0 };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = diversify(scored, limit);
  const cards = await hydrateCards(picked.map((p) => p.row));
  return cards.map((c, i) => ({
    ...c,
    score: picked[i].score,
    ...(opts.debug ? { debug: { priorityFactor: picked[i].pf, openLoops: picked[i].openLoops } } : {}),
  })) as FeedItem[];
}
