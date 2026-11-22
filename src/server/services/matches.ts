import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { battles, users, votes, type User } from "../db/schema";
import { hydrateCards, visibleStatuses, type BattleCard } from "./battles";
import { toPeople, type PersonRow } from "./social";
import { rankTwins, TASTE_MIN_SHARED } from "./taste";

/**
 * "Voted like you": who picked the same side as you.
 * Privacy: only signed-in people with a real account and `show_in_vote_matches` on are listed, only to someone who
 * picked the same side, and it's mutual — if you hide yourself you can't see others either. Blocks hide both ways.
 */

export type Twin = PersonRow & { pct: number; shared: number; agree: number };

/** SQL condition: user `u` can appear in match lists for viewer `me`. */
const listable = (me: string) => sql`u.banned_at IS NULL AND u.show_in_vote_matches AND u.email IS NOT NULL AND u.handle IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM block bl WHERE (bl.blocker_id = ${me} AND bl.blocked_id = u.id) OR (bl.blocker_id = u.id AND bl.blocked_id = ${me}))`;

/** Raw agreement counts between `me` and everyone who voted on at least one of the same battles. */
async function agreementRows(me: string, onlyIds?: string[]) {
  return db.execute<{ id: string; shared: number; agree: number }>(sql`
    SELECT v2.user_id AS id, count(*)::int AS shared, count(*) FILTER (WHERE v2.side = v1.side)::int AS agree
    FROM vote v1
    JOIN vote v2 ON v2.battle_id = v1.battle_id AND v2.user_id IS NOT NULL AND v2.user_id <> v1.user_id
    JOIN "user" u ON u.id = v2.user_id
    WHERE v1.user_id = ${me} AND ${listable(me)}
      ${onlyIds?.length ? sql`AND v2.user_id IN (${sql.join(onlyIds.map((i) => sql`${i}`), sql`, `)})` : sql``}
    GROUP BY v2.user_id`);
}

async function withPeople<T extends { id: string }>(rows: T[], viewerId: string) {
  if (!rows.length) return [];
  const info = await db
    .select({ id: users.id, handle: users.handle, name: users.name, image: users.image, correctPicks: users.correctPicks })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})`);
  const byId = new Map(info.map((i) => [i.id, i]));
  const people = await toPeople(rows.map((r) => byId.get(r.id)!).filter(Boolean), viewerId);
  const pById = new Map(people.map((p) => [p.id, p]));
  return rows.filter((r) => pById.has(r.id)).map((r) => ({ ...pById.get(r.id)!, ...r }));
}

/** People who vote most like `user`, best match first (needs TASTE_MIN_SHARED battles in common). */
export async function tasteTwins(user: User, limit = 50): Promise<Twin[]> {
  if (!user.showInVoteMatches) return [];
  const ranked = rankTwins(await agreementRows(user.id)).slice(0, limit);
  const people = await withPeople(ranked, user.id);
  return people.map((t) => ({ ...t, score: undefined })) as Twin[];
}

export type LikeYou = {
  battle: { slug: string; title: string; labelA: string; labelB: string; votesA: number; votesB: number };
  mySide: "A" | "B";
  people: (PersonRow & { pct: number | null; shared: number; reason: string | null })[];
  /** Same-side votes that aren't listed: guests, hidden profiles, seed votes. */
  others: number;
};

/** Everyone listable who picked the same side as `user` on this battle, ordered by overall taste match. Null if `user` didn't vote. */
export async function votedLikeYou(user: User, slug: string): Promise<LikeYou | null> {
  const [b] = await db.select().from(battles).where(and(eq(battles.slug, slug), visibleStatuses));
  if (!b) return null;
  const [mine] = await db.select({ side: votes.side }).from(votes).where(and(eq(votes.battleId, b.id), eq(votes.userId, user.id)));
  if (!mine) return null;
  const [card] = await hydrateCards([{ b, authorHandle: null, authorName: null, oChosen: null, oThumb: null, oNote: null }]);
  const battle = { slug: b.slug, title: b.title, labelA: card.labelA, labelB: card.labelB, votesA: b.votesA, votesB: b.votesB };
  const sameSideTotal = Math.max(0, (mine.side === "A" ? b.votesA : b.votesB) - 1);
  if (!user.showInVoteMatches) return { battle, mySide: mine.side, people: [], others: sameSideTotal };

  const same = await db.execute<{ id: string; reason: string | null; reason_hidden: boolean }>(sql`
    SELECT v.user_id AS id, v.reason, v.reason_hidden FROM vote v JOIN "user" u ON u.id = v.user_id
    WHERE v.battle_id = ${b.id} AND v.side = ${mine.side} AND v.user_id <> ${user.id} AND ${listable(user.id)}
    LIMIT 500`);
  const ids = same.map((s) => s.id);
  const agree = new Map((ids.length ? await agreementRows(user.id, ids) : []).map((r) => [r.id, r]));
  const rows = same.map((s) => {
    const a = agree.get(s.id);
    const shared = a?.shared ?? 1;
    return { id: s.id, shared, pct: shared >= TASTE_MIN_SHARED ? Math.round((100 * (a?.agree ?? 1)) / shared) : null, reason: s.reason_hidden ? null : s.reason };
  });
  rows.sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1) || y.shared - x.shared || x.id.localeCompare(y.id));
  const people = await withPeople(rows, user.id);
  return { battle, mySide: mine.side, people, others: Math.max(0, sameSideTotal - people.length) };
}

export type MyVote = BattleCard & { mySide: "A" | "B"; votedAt: string };

/** Battles `user` voted on, newest vote first. */
export async function myVotedBattles(user: User, limit = 60): Promise<MyVote[]> {
  const rows = await db
    .select({ b: battles, side: votes.side, votedAt: votes.createdAt, authorHandle: users.handle, authorName: users.name })
    .from(votes)
    .innerJoin(battles, eq(battles.id, votes.battleId))
    .innerJoin(users, eq(users.id, battles.authorId))
    .where(and(eq(votes.userId, user.id), visibleStatuses))
    .orderBy(desc(votes.createdAt))
    .limit(limit);
  const cards = await hydrateCards(rows.map((r) => ({ b: r.b, authorHandle: r.authorHandle, authorName: r.authorName, oChosen: null, oThumb: null, oNote: null })));
  return cards.map((c, i) => ({ ...c, mySide: rows[i].side, votedAt: rows[i].votedAt.toISOString() }));
}
