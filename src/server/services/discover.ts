import { and, desc, eq, gt, inArray, isNotNull, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { battles, blocks, outcomes, users, votes, type User } from "../db/schema";
import { friendIds, hydrateCards, visibleStatuses, type BattleCard } from "./battles";
import { matchesTarget } from "./targeting";
import { toPeople, type PersonRow } from "./social";
import { cleanQuery, likeEscape } from "@/lib/search";

export { cleanQuery };

type Viewer = { user: User | null; deviceId: string | null };

/** A battle card on Discover. Scores stay hidden (they're for the poster, and keep votes unbiased); `voted` = the viewer already voted. */
export type DiscoverCard = BattleCard & { hideResults: boolean; voted: boolean };

/** Visibility, status, author and block filters shared by every Discover battle query. */
async function battleScope(viewer: Viewer): Promise<SQL> {
  const user = viewer.user;
  const [friends, blocked] = await Promise.all([
    user ? friendIds(user.id) : Promise.resolve(new Set<string>()),
    user ? db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, user.id)) : Promise.resolve([]),
  ]);
  const visible = friends.size
    ? or(eq(battles.visibility, "PUBLIC"), and(eq(battles.visibility, "FRIENDS"), inArray(battles.authorId, [...friends])))!
    : eq(battles.visibility, "PUBLIC");
  return and(
    visibleStatuses,
    visible,
    isNull(users.bannedAt),
    blocked.length ? notInArray(battles.authorId, blocked.map((b) => b.id)) : sql`true`,
  )!;
}

const rowCols = {
  b: battles,
  authorHandle: users.handle,
  authorName: users.name,
  authorImage: users.image,
  authorKidAges: users.kidAges,
  oChosen: outcomes.chosen,
  oThumb: outcomes.thumb,
  oNote: outcomes.note,
};

/** Battle ids (of `ids`) this viewer already voted on: their account, or this device when signed out. */
async function votedIds(viewer: Viewer, ids: string[]) {
  if (!ids.length || (!viewer.user && !viewer.deviceId)) return new Set<string>();
  const who = viewer.user
    ? viewer.deviceId
      ? or(eq(votes.userId, viewer.user.id), eq(votes.deviceId, viewer.deviceId))
      : eq(votes.userId, viewer.user.id)
    : eq(votes.deviceId, viewer.deviceId!);
  const rows = await db.select({ id: votes.battleId }).from(votes).where(and(inArray(votes.battleId, ids), who));
  return new Set(rows.map((r) => r.id));
}

async function toCards(viewer: Viewer, rows: Parameters<typeof hydrateCards>[0]): Promise<DiscoverCard[]> {
  // Targeted battles only show to viewers who match, same as the Vote deck (the link still works).
  const kept = rows.filter((r) => r.b.authorId === viewer.user?.id || matchesTarget(r.b.tags?.target, viewer.user));
  const cards = await hydrateCards(kept);
  const voted = await votedIds(viewer, cards.map((c) => c.id));
  const me = viewer.user?.id;
  return cards.map((c, i) => ({ ...c, hideResults: kept[i].b.authorId !== me, voted: voted.has(c.id) }));
}

/** Open battles with the most votes. Includes ones the viewer already voted on. */
export async function topBattles(viewer: Viewer, limit = 20): Promise<DiscoverCard[]> {
  const scope = await battleScope(viewer);
  const rows = await db
    .select(rowCols)
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(and(scope, eq(battles.status, "OPEN"), gt(battles.deadline, new Date())))
    .orderBy(desc(sql`${battles.votesA} + ${battles.votesB}`), desc(battles.createdAt))
    .limit(limit * 3);
  return (await toCards(viewer, rows)).slice(0, limit);
}

/**
 * Smart battle search: English full-text over the question, context and both options (so "toy" finds "toys",
 * "strollers" finds "stroller"), plus a plain substring match on the question. Best matches first, then most votes.
 */
export async function searchBattles(viewer: Viewer, q: string, limit = 30): Promise<DiscoverCard[]> {
  const query = cleanQuery(q);
  if (!query) return [];
  const scope = await battleScope(viewer);
  const doc = sql`to_tsvector('english', ${battles.title} || ' ' || coalesce(${battles.context}, '') || ' ' || coalesce((SELECT string_agg(o.label || ' ' || coalesce(o.description, ''), ' ') FROM "option" o WHERE o.battle_id = ${battles.id}), ''))`;
  const tsq = sql`websearch_to_tsquery('english', ${query})`;
  const like = `%${likeEscape(query)}%`;
  const rows = await db
    .select(rowCols)
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(and(scope, or(sql`${doc} @@ ${tsq}`, sql`${battles.title} ILIKE ${like}`, sql`${battles.context} ILIKE ${like}`)))
    .orderBy(desc(sql`ts_rank(${doc}, ${tsq}) + CASE WHEN ${battles.title} ILIKE ${like} THEN 0.5 ELSE 0 END`), desc(sql`${battles.votesA} + ${battles.votesB}`))
    .limit(limit * 2);
  return (await toCards(viewer, rows)).slice(0, limit);
}

/** People search by username or name. Exact username first, then prefix matches, then by correct picks. */
export async function searchPeople(viewer: Viewer, q: string, limit = 20): Promise<PersonRow[]> {
  const query = cleanQuery(q);
  if (!query) return [];
  const lower = query.toLowerCase();
  const any = `%${likeEscape(lower)}%`;
  const prefix = `${likeEscape(lower)}%`;
  const rows = await db
    .select({ id: users.id, handle: users.handle, name: users.name, image: users.image, correctPicks: users.correctPicks })
    .from(users)
    .where(and(isNotNull(users.handle), isNull(users.bannedAt), or(sql`${users.handle} ILIKE ${any}`, sql`${users.name} ILIKE ${any}`)))
    .orderBy(
      sql`CASE WHEN lower(${users.handle}) = ${lower} THEN 0 WHEN ${users.handle} ILIKE ${prefix} OR ${users.name} ILIKE ${prefix} THEN 1 ELSE 2 END`,
      desc(users.correctPicks),
    )
    .limit(limit);
  return toPeople(rows, viewer.user?.id ?? null);
}

/** Leaderboard: most correct picks (the expert score). */
export async function topExperts(viewer: Viewer, limit = 20): Promise<PersonRow[]> {
  const rows = await db
    .select({ id: users.id, handle: users.handle, name: users.name, image: users.image, correctPicks: users.correctPicks })
    .from(users)
    .where(and(isNotNull(users.handle), isNull(users.bannedAt), gt(users.correctPicks, 0)))
    .orderBy(desc(users.correctPicks))
    .limit(limit);
  return toPeople(rows, viewer.user?.id ?? null);
}

export const ACTIVE_DAYS = 30;

/** Leaderboard: most votes cast in the last ACTIVE_DAYS days. `stat` = that vote count. */
export async function topVoters(viewer: Viewer, limit = 20): Promise<PersonRow[]> {
  const since = new Date(Date.now() - ACTIVE_DAYS * 86400_000);
  const n = sql<number>`count(*)::int`;
  const rows = await db
    .select({ id: users.id, handle: users.handle, name: users.name, image: users.image, correctPicks: users.correctPicks, stat: n })
    .from(votes)
    .innerJoin(users, eq(users.id, votes.userId))
    .where(and(gt(votes.createdAt, since), isNotNull(users.handle), isNull(users.bannedAt)))
    .groupBy(users.id)
    .orderBy(desc(n))
    .limit(limit);
  return toPeople(rows, viewer.user?.id ?? null);
}
