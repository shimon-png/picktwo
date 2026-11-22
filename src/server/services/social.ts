import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { follows, users } from "../db/schema";
import { getEconomy } from "./config";
import { expertTier, type ExpertTier } from "./expertise";

/** A person in a list (followers, following, leaderboards, search). Relationship flags are relative to the viewer. */
export type PersonRow = {
  id: string;
  handle: string;
  name: string | null;
  image: string | null;
  tier: ExpertTier;
  correctPicks: number;
  /** The viewer follows this person. */
  iFollow: boolean;
  /** This person follows the viewer. */
  followsMe: boolean;
  /** Extra number for leaderboards (e.g. votes in the last 30 days). */
  stat?: number;
};

/** Friends = mutual follows. Pure. */
export function isFriend(p: { iFollow: boolean; followsMe: boolean }) {
  return p.iFollow && p.followsMe;
}

/** Adds tier + the viewer's follow relationship to bare user rows (keeps the input order). */
export async function toPeople(
  rows: { id: string; handle: string | null; name: string | null; image: string | null; correctPicks: number; stat?: number }[],
  viewerId: string | null,
): Promise<PersonRow[]> {
  const list = rows.filter((r): r is typeof r & { handle: string } => !!r.handle);
  if (!list.length) return [];
  const ids = list.map((r) => r.id);
  const [economy, out, inc] = await Promise.all([
    getEconomy(),
    viewerId
      ? db.select({ id: follows.followingId }).from(follows).where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, ids)))
      : Promise.resolve([]),
    viewerId
      ? db.select({ id: follows.followerId }).from(follows).where(and(eq(follows.followingId, viewerId), inArray(follows.followerId, ids)))
      : Promise.resolve([]),
  ]);
  const iFollow = new Set(out.map((r) => r.id));
  const followsMe = new Set(inc.map((r) => r.id));
  return list.map((r) => ({
    id: r.id,
    handle: r.handle,
    name: r.name,
    image: r.image,
    correctPicks: r.correctPicks,
    tier: expertTier(r.correctPicks, economy),
    iFollow: iFollow.has(r.id),
    followsMe: followsMe.has(r.id),
    ...(r.stat !== undefined ? { stat: r.stat } : {}),
  }));
}

const personCols = { id: users.id, handle: users.handle, name: users.name, image: users.image, correctPicks: users.correctPicks };

/** People who follow `userId`, newest first. */
export async function listFollowers(userId: string, viewerId: string | null, limit = 300) {
  const rows = await db
    .select(personCols)
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(and(eq(follows.followingId, userId), isNull(users.bannedAt)))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
  return toPeople(rows, viewerId);
}

/** People `userId` follows, newest first. */
export async function listFollowing(userId: string, viewerId: string | null, limit = 300) {
  const rows = await db
    .select(personCols)
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .where(and(eq(follows.followerId, userId), isNull(users.bannedAt)))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
  return toPeople(rows, viewerId);
}

/** Does `a` follow `b`, and does `b` follow `a`? */
export async function relationship(a: string, b: string) {
  const rows = await db
    .select({ f: follows.followerId })
    .from(follows)
    .where(sql`(${follows.followerId} = ${a} AND ${follows.followingId} = ${b}) OR (${follows.followerId} = ${b} AND ${follows.followingId} = ${a})`);
  return { iFollow: rows.some((r) => r.f === a), followsMe: rows.some((r) => r.f === b) };
}

/** For "X followed you" notifications: each handle's user id and the follow state both ways (keyed by lower-case handle). */
export async function followBackInfo(viewerId: string, handles: string[]) {
  const m = new Map<string, { id: string; iFollow: boolean; followsMe: boolean }>();
  const list = [...new Set(handles.map((h) => h.toLowerCase()))];
  if (!list.length) return m;
  const rows = await db
    .select({ id: users.id, handle: users.handle, name: users.name, image: users.image, correctPicks: users.correctPicks })
    .from(users)
    .where(and(inArray(users.handle, list), isNull(users.bannedAt)));
  for (const p of await toPeople(rows, viewerId)) m.set(p.handle.toLowerCase(), { id: p.id, iFollow: p.iFollow, followsMe: p.followsMe });
  return m;
}
