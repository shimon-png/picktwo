import { and, desc, eq, gt, inArray, notInArray, sql, or } from "drizzle-orm";
import { db } from "../db";
import { battles, users, votes, follows, blocks, outcomes, type User } from "../db/schema";
import { getEconomy } from "./config";
import { openLoopCountsFor } from "./points";
import { priorityFactor } from "./priority";
import { feedScore, tieredPick, shuffleFactor, shuffleSeed, engagementFactor, inHoldout, skipFactor, averagePickRate, hotFactor, gapFactor, isGenericPhoto, genericFactor, pickOpener, pickRate, type ViewerProfile } from "./ranking";
import { missingAxesFor } from "./taste-profile";
import { battleAxes } from "@/lib/taste-profile";
import { friendIds, hydrateCards, type BattleCard } from "./battles";
import { matchesTarget } from "./targeting";
import { isHumanBattle } from "@/lib/auto-seed";
import { activeMindTopic } from "./mind";
import { mindFactor } from "@/lib/mind";

export type FeedItem = BattleCard & { score: number; arm?: "engine" | "holdout"; featured?: boolean; opener?: boolean; pickRate?: number; debug?: Record<string, number> };

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

  const allRows = await db
    .select({
      b: battles,
      authorHandle: users.handle,
      authorName: users.name,
      authorImage: users.image,
      authorCountry: users.country,
      authorKidAges: users.kidAges,
      authorPP: users.ppBalance,
      authorHasEmail: sql<boolean>`${users.email} IS NOT NULL`,
      oChosen: outcomes.chosen,
      oThumb: outcomes.thumb,
      oNote: outcomes.note,
      photos: sql<number>`(SELECT count(o.image_url)::int FROM "option" o WHERE o.battle_id = ${battles.id})`,
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
        // Your own Pickbot crowd questions (posted as @askedviapickbot) aren't yours to vote on.
        user ? sql`NOT EXISTS (SELECT 1 FROM pickbot_thread pt WHERE pt.battle_id = ${battles.id} AND pt.user_id = ${user.id})` : sql`true`,
        blocked.length ? notInArray(battles.authorId, blocked) : sql`true`,
        sql`${users.bannedAt} IS NULL`,
        // "People like you are asking" preset battles (lib/asking.ts) only show through their card.
        sql`(${battles.tags}->>'askingPreset') IS NULL`,
        seenCond,
      ),
    )
    // Real people's battles first, so the 500 cap never cuts one off when there's lots of seed content.
    .orderBy(
      sql`CASE WHEN ${battles.id} NOT LIKE 'seed\_%' AND (${users.email} IS NOT NULL OR COALESCE((${battles.tags}->>'pickbot')::boolean, false)) THEN 0 ELSE 1 END`,
      desc(battles.createdAt),
    )
    .limit(500);
  // "Target a specific group": only viewers whose profile matches see a targeted battle in the deck.
  const rows = allRows.filter((r) => matchesTarget(r.b.tags?.target, user));

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
  const viewerKey = user?.id ?? viewer.deviceId ?? crypto.randomUUID();
  const seed = shuffleSeed(viewerKey, now);
  // Data brain Phase 3: rank by engagement too, except for a stable holdout group (the comparison for lift).
  const arm: "engine" | "holdout" = inHoldout(viewerKey, economy.engagementHoldoutPct) ? "holdout" : "engine";
  const eWeight = arm === "engine" ? economy.engagementWeight : 0;
  // Vote deck decisions per battle (votes made in the deck vs skips), for the skip signal.
  const sWeight = arm === "engine" ? economy.skipWeight : 0;
  // Opener: only for someone who hasn't voted or skipped anything yet (engine arm only).
  const wantOpener = arm === "engine" && economy.openerOn > 0 && !(await hasDecided(viewer));
  const wantRates = !!sWeight || wantOpener || economy.skipRescueAfter > 0;
  const decisions = wantRates ? await deckDecisions(rows.map((r) => r.b.id)) : new Map<string, { votes: number; skips: number }>();
  const avgPick = averagePickRate([...decisions.values()]);
  const [loops, mind, hot, missing] = await Promise.all([
    openLoopCountsFor([...new Set(rows.map((r) => r.b.authorId))], economy),
    activeMindTopic(viewer),
    // Alex, Nov 27 2026: after real people's battles, the hottest battles and the ones that fill out the taste profile.
    economy.hotBoost > 1 ? recentRealVotes(rows.map((r) => r.b.id)) : new Map<string, number>(),
    economy.tasteGapBoost > 1 ? missingAxesFor(viewer).catch(() => [] as string[]) : ([] as string[]),
  ]);
  let openerId: string | null = null;
  const scored = rows.map((r) => {
    const boostActive = !!r.b.boostUntil && r.b.boostUntil > now && r.b.boostVotesLeft > 0;
    const pf = priorityFactor({ ppBalance: r.authorPP, openLoops: loops.get(r.b.authorId) ?? 0, boostActive, cap: economy.priorityCap });
    const base = feedScore(profile, {
      categoryId: r.b.categoryId,
      kidAgeTags: r.b.tags?.target?.kidAges ?? r.b.tags?.kidAge ?? [],
      authorCountry: r.authorCountry,
      isFriend: friends.has(r.b.authorId),
      isFollowed: followed.has(r.b.authorId),
      votes: r.b.votesA + r.b.votesB,
      hoursUntilDeadline: (r.b.deadline.getTime() - now.getTime()) / 3600_000,
      hoursSincePublish: (now.getTime() - r.b.createdAt.getTime()) / 3600_000,
      priorityFactor: pf,
    });
    const engaged = base * shuffleFactor(seed, r.b.id) * engagementFactor(r.b.engagementScore, eWeight);
    const d = decisions.get(r.b.id);
    // "What's on your mind this week?" (lib/mind.ts): battles on the topic they picked rise.
    const onMind = mindFactor(mind?.topic ?? null, { theme: r.b.tags?.brain?.theme, title: r.b.title, context: r.b.context }, economy.mindBoost, mind?.text);
    const brain = r.b.tags?.brain as { a?: string[]; b?: string[]; axes?: Record<string, string> } | undefined;
    const tests = battleAxes(brain?.a, brain?.b, brain?.axes);
    const fill = gapFactor(tests, missing, economy.tasteGapBoost);
    const score = engaged * skipFactor(d?.votes ?? 0, d?.skips ?? 0, avgPick, sWeight) * onMind * hotFactor(hot.get(r.b.id) ?? 0, economy.hotBoost) * fill
      * genericFactor(isGenericPhoto({ title: r.b.title, context: r.b.context, photos: Number(r.photos) || 0 }), economy.genericPhotoPenalty);
    const featured = !!r.b.tags?.featured;
    const human = isHumanBattle({ id: r.b.id, authorHasEmail: !!r.authorHasEmail, pickbot: r.b.tags?.pickbot });
    return { row: r, score, categoryId: r.b.categoryId, authorId: r.b.authorId, featured, human, fill: fill > 1, pf, openLoops: loops.get(r.b.authorId) ?? 0 };
  });
  // Featured battles (battle.tags.featured) go first for everyone who hasn't voted on them yet; then every battle a
  // real person posted, above all seed content (Alex + Shimon, Nov 26 2026). Same for the holdout.
  scored.sort((a, b) => b.score - a.score);
  const picked = tieredPick(scored, limit);
  if (wantOpener) {
    const best = pickOpener(
      scored.filter((x) => !x.featured).map((x) => ({ x, ...(decisions.get(x.row.b.id) ?? { votes: 0, skips: 0 }) })),
      economy.openerMinDecisions,
      avgPick,
    );
    if (best) {
      const at = picked.indexOf(best.x);
      if (at !== -1) picked.splice(at, 1);
      else if (picked.length >= limit) picked.pop();
      picked.splice(picked.filter((p) => p.featured).length, 0, best.x);
      openerId = best.x.row.b.id;
    }
  }
  const cards = await hydrateCards(picked.map((p) => p.row));
  return cards.map((c, i) => ({
    ...c,
    arm,
    score: picked[i].score,
    ...(picked[i].row.b.tags?.featured ? { featured: true } : {}),
    ...(openerId === picked[i].row.b.id ? { opener: true } : {}),
    ...(wantRates ? { pickRate: Math.round(pickRate(decisions.get(picked[i].row.b.id)?.votes ?? 0, decisions.get(picked[i].row.b.id)?.skips ?? 0, avgPick) * 1000) / 1000 } : {}),
    ...(opts.debug ? { debug: { priorityFactor: picked[i].pf, openLoops: picked[i].openLoops } } : {}),
  })) as FeedItem[];
}

/** Has this person (account, else device and an account it was linked to) voted on or skipped anything yet? */
async function hasDecided(viewer: { user: User | null; deviceId: string | null }) {
  const u = viewer.user?.id ?? null;
  const d = viewer.deviceId;
  if (!u && !d) return false;
  const who = (t: string) =>
    u
      ? sql`(${sql.raw(t)}.user_id = ${u}${d ? sql` OR ${sql.raw(t)}.device_id = ${d}` : sql``})`
      : sql`(${sql.raw(t)}.device_id = ${d} OR ${sql.raw(t)}.user_id = (SELECT dv.user_id FROM device dv WHERE dv.id = ${d}))`;
  const rows = await db.execute<{ yes: boolean }>(sql`
    SELECT (EXISTS (SELECT 1 FROM vote v WHERE ${who("v")}) OR EXISTS (SELECT 1 FROM skip s WHERE ${who("s")})) AS yes`);
  return !!rows[0]?.yes;
}

/** Per battle: real (non-seed) votes in the last 24 hours, for the hot boost. */
async function recentRealVotes(ids: string[]) {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const since = new Date(Date.now() - 86400_000).toISOString();
  const list = sql.join(ids.map((i) => sql`${i}`), sql`, `);
  const rows = await db.execute<{ id: string; n: number }>(sql`
    SELECT battle_id AS id, count(*)::int AS n FROM vote
    WHERE battle_id IN (${list}) AND created_at > ${since} AND NOT flagged AND COALESCE(source, '') <> 'seed'
    GROUP BY 1`);
  for (const r of rows) out.set(r.id, Number(r.n));
  return out;
}

/** Per battle: votes made in the Vote deck and skips (all time, real people only: seed votes have source 'seed'). */
async function deckDecisions(ids: string[]) {
  const out = new Map<string, { votes: number; skips: number }>();
  if (!ids.length) return out;
  const list = sql.join(ids.map((i) => sql`${i}`), sql`, `);
  const rows = await db.execute<{ id: string; votes: number; skips: number }>(sql`
    SELECT x.id,
      (SELECT count(*)::int FROM vote v WHERE v.battle_id = x.id AND v.source = 'feed' AND NOT v.flagged) AS votes,
      (SELECT count(*)::int FROM skip s WHERE s.battle_id = x.id) AS skips
    FROM (SELECT unnest(ARRAY[${list}]::text[]) AS id) x`);
  for (const r of rows) out.set(r.id, { votes: Number(r.votes), skips: Number(r.skips) });
  return out;
}
