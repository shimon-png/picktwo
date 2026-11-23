import { sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { isAdmin } from "../viewer";
import { getEconomy } from "./config";
import { AGE_RANGES, SEX_OPTIONS } from "@/lib/constants";
import { classifySource, SOURCE_LABELS, type Source } from "./acquisition-rules";

export type JourneyVote = { at: string; title: string; slug: string; picked: string; after: boolean; method: string | null };
export type Journey = {
  handle: string | null;
  signedUpAt: string;
  source: Source;
  sourceLabel: string;
  sourceTag: string;
  sex: string | null;
  ageRange: string | null;
  zip3: string | null;
  votesBefore: number;
  votesAfter: number;
  posts: number;
  follows: number;
  /** New York days with a visit after the sign-up day. */
  returnDays: number;
  lastSeen: string | null;
  votes: JourneyVote[];
};

/**
 * Admin-only: what each new account did, newest first (Alex, Nov 23 2026: "who signed up from X, did they vote
 * after?"). Real accounts only (email, not banned, not admins), signed up since the Brain's clean start date.
 * Never shows email; ZIP is cut to its first 3 digits.
 */
export async function signupJourneys(limit = 30): Promise<Journey[]> {
  const e = await getEconomy();
  const [{ t: cleanFrom }] = await db.execute<{ t: string }>(
    sql`SELECT (to_date(${String(e.brainCleanFrom)}, 'YYYYMMDD')::timestamp AT TIME ZONE 'America/New_York')::text AS t`,
  );
  const since = new Date(cleanFrom).toISOString();
  const rows = await db
    .select()
    .from(users)
    .where(sql`${users.onboardedAt} >= ${since} AND ${users.email} IS NOT NULL AND ${users.bannedAt} IS NULL`)
    .orderBy(sql`${users.onboardedAt} DESC`)
    .limit(limit + 10);
  const people = rows.filter((u) => !isAdmin(u)).slice(0, limit);

  return Promise.all(
    people.map(async (u) => {
      const signed = u.onboardedAt!.toISOString();
      const devs = sql`(SELECT d.id FROM device d WHERE d.user_id = ${u.id})`;
      const [touch] = await db.execute<{ props: Record<string, unknown> }>(sql`
        SELECT e.props FROM analytics_event e
        WHERE e.name = 'session_start' AND COALESCE((e.props->>'bot')::boolean, false) = false
          AND (e.user_id = ${u.id} OR e.device_id IN ${devs})
        ORDER BY e.created_at ASC LIMIT 1`);
      const votes = await db.execute<{ at: string; title: string; slug: string; picked: string; after: boolean; method: string | null }>(sql`
        SELECT v.created_at::text AS at, b.title, b.slug, o.label AS picked, v.created_at >= ${signed} AS after,
          (SELECT a.props->>'method' FROM analytics_event a WHERE a.name = 'vote_cast' AND a.props->>'battleId' = v.battle_id
             AND (a.user_id = ${u.id} OR a.device_id IN ${devs}) LIMIT 1) AS method
        FROM vote v JOIN battle b ON b.id = v.battle_id
        LEFT JOIN "option" o ON o.battle_id = v.battle_id AND o.side = v.side
        WHERE (v.user_id = ${u.id} OR v.device_id IN ${devs}) AND COALESCE(v.source, '') <> 'seed'
        ORDER BY v.created_at ASC LIMIT 200`);
      const [facts] = await db.execute<{ posts: number; follows: number; return_days: number; last_seen: string | null }>(sql`
        SELECT
          (SELECT count(*)::int FROM battle b WHERE b.author_id = ${u.id}) AS posts,
          (SELECT count(*)::int FROM follow f WHERE f.follower_id = ${u.id}) AS follows,
          (SELECT count(DISTINCT (e.created_at AT TIME ZONE 'America/New_York')::date)::int FROM analytics_event e
            WHERE e.name IN ('session_start', 'page_view') AND (e.user_id = ${u.id} OR e.device_id IN ${devs})
              AND (e.created_at AT TIME ZONE 'America/New_York')::date > (${signed}::timestamptz AT TIME ZONE 'America/New_York')::date) AS return_days,
          (SELECT max(e.created_at)::text FROM analytics_event e WHERE e.user_id = ${u.id} OR e.device_id IN ${devs}) AS last_seen`);
      const p = (touch?.props ?? null) as Record<string, unknown> | null;
      const first = (p?.first && typeof p.first === "object" ? p.first : p) as Record<string, unknown> | null;
      const source = classifySource(p);
      return {
        handle: u.handle,
        signedUpAt: signed,
        source,
        sourceLabel: SOURCE_LABELS[source],
        sourceTag: first ? String(first.utm_campaign ?? first.utm_source ?? first.referrerHost ?? (first.twclid ? "X ad click" : "")) : "",
        sex: SEX_OPTIONS.find((o) => o.id === u.sex)?.label ?? null,
        ageRange: AGE_RANGES.find((o) => o.id === u.ageRange)?.label ?? null,
        zip3: u.zipCode ? u.zipCode.slice(0, 3) : null,
        votesBefore: votes.filter((v) => !v.after).length,
        votesAfter: votes.filter((v) => v.after).length,
        posts: facts.posts,
        follows: facts.follows,
        returnDays: facts.return_days,
        lastSeen: facts.last_seen,
        votes: [...votes],
      } satisfies Journey;
    }),
  );
}
