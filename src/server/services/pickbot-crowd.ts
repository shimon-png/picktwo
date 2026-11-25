/**
 * Pickbot crowd signals (PRD §7): battles on the same AI theme with enough votes, split for everyone and for
 * "people like you" (same sex × age range as the asker). Real numbers only; Claude is told never to invent any.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { User } from "../db/schema";
import type { Theme } from "@/lib/pickbot";
import type { SimilarBattle } from "./pickbot-ai";

export async function similarBattles(theme: Theme, user: User, n: number, minVotes: number): Promise<(SimilarBattle & { slug: string })[]> {
  if (theme === "other" || n <= 0) return [];
  const rows = await db.execute<{ slug: string; title: string; a: string; b: string; votes_a: number; votes_b: number; like_a: number | null; like_b: number | null }>(sql`
    SELECT b.slug, b.title,
      (SELECT o.label FROM option o WHERE o.battle_id = b.id AND o.side = 'A') AS a,
      (SELECT o.label FROM option o WHERE o.battle_id = b.id AND o.side = 'B') AS b,
      b.votes_a, b.votes_b,
      ${
        user.sex && user.ageRange
          ? sql`(SELECT count(*) FILTER (WHERE v.side = 'A') FROM vote v JOIN "user" u ON u.id = v.user_id
                 WHERE v.battle_id = b.id AND NOT v.flagged AND u.sex = ${user.sex} AND u.age_range = ${user.ageRange})::int`
          : sql`NULL::int`
      } AS like_a,
      ${
        user.sex && user.ageRange
          ? sql`(SELECT count(*) FILTER (WHERE v.side = 'B') FROM vote v JOIN "user" u ON u.id = v.user_id
                 WHERE v.battle_id = b.id AND NOT v.flagged AND u.sex = ${user.sex} AND u.age_range = ${user.ageRange})::int`
          : sql`NULL::int`
      } AS like_b
    FROM battle b
    WHERE b.tags->'brain'->>'theme' = ${theme} AND b.status IN ('OPEN', 'CLOSED')
      AND b.votes_a + b.votes_b >= ${minVotes} AND COALESCE((b.tags->>'pickbot')::boolean, false) = false
    ORDER BY b.votes_a + b.votes_b DESC
    LIMIT ${n}`);
  return [...rows].map((r) => ({
    slug: r.slug,
    title: r.title,
    a: r.a,
    b: r.b,
    votesA: Number(r.votes_a),
    votesB: Number(r.votes_b),
    likeA: r.like_a == null ? null : Number(r.like_a),
    likeB: r.like_b == null ? null : Number(r.like_b),
  }));
}
