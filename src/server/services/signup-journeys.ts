import { sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { isAdmin } from "../viewer";
import { getEconomy } from "./config";
import { AGE_RANGES, SEX_OPTIONS } from "@/lib/constants";
import { classifySource, SOURCE_LABELS, type Source } from "./acquisition-rules";

export type JourneyVote = { at: string; title: string; slug: string; picked: string; after: boolean; method: string | null };
/**
 * One Pickbot question, without its words (questions are private to the asker; admins see the topic and what
 * happened, never the text).
 */
export type JourneyAsk = {
  at: string;
  theme: string;
  scope: string;
  answers: number;
  tailored: number;
  followUps: number;
  rating: "UP" | "DOWN" | null;
  crowd: { slug: string; votes: number; resultsBack: boolean } | null;
  costUsd: number;
};
export type Journey = {
  /** User id, or the guest's device id: the key for /admin/journey/person/[who]. */
  who: string;
  handle: string | null;
  /** null for a guest (no account). */
  signedUpAt: string | null;
  guest: boolean;
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
  /** New York days with a visit after the sign-up day (guests: after their first visit). */
  returnDays: number;
  lastSeen: string | null;
  votes: JourneyVote[];
  /** Pickbot (accounts only): every question, newest first, plus the profile cards answered inside Pickbot. */
  asks: JourneyAsk[];
  pickbotCards: number;
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

  return Promise.all(people.map((u) => buildJourney(u, null)));
}


type UserRow = typeof users.$inferSelect;

/** One person's journey: an account (all its devices) or, with u = null, a guest browser by device id. */
async function buildJourney(u: UserRow | null, deviceId: string | null): Promise<Journey> {
  const uid = u?.id ?? "__none__";
  const signed = u?.onboardedAt ? u.onboardedAt.toISOString() : null;
  const devs = u ? sql`(SELECT d.id FROM device d WHERE d.user_id = ${u.id})` : sql`(${deviceId ?? "__none__"})`;
  const signedCmp = signed ?? "9999-01-01T00:00:00Z";
  const [touch] = await db.execute<{ props: Record<string, unknown> }>(sql`
    SELECT e.props FROM analytics_event e
    WHERE e.name = 'session_start' AND COALESCE((e.props->>'bot')::boolean, false) = false
      AND (e.user_id = ${uid} OR e.device_id IN ${devs})
    ORDER BY e.created_at ASC LIMIT 1`);
  const votes = await db.execute<{ at: string; title: string; slug: string; picked: string; after: boolean; method: string | null }>(sql`
    SELECT v.created_at::text AS at, b.title, b.slug, o.label AS picked, v.created_at >= ${signedCmp} AS after,
      (SELECT a.props->>'method' FROM analytics_event a WHERE a.name = 'vote_cast' AND a.props->>'battleId' = v.battle_id
         AND (a.user_id = ${uid} OR a.device_id IN ${devs}) LIMIT 1) AS method
    FROM vote v JOIN battle b ON b.id = v.battle_id
    LEFT JOIN "option" o ON o.battle_id = v.battle_id AND o.side = v.side
    WHERE (v.user_id = ${uid} OR v.device_id IN ${devs}) AND COALESCE(v.source, '') <> 'seed'
    ORDER BY v.created_at ASC LIMIT 200`);
  const [facts] = await db.execute<{ posts: number; follows: number; return_days: number; last_seen: string | null }>(sql`
    SELECT
      (SELECT count(*)::int FROM battle b WHERE b.author_id = ${uid}) AS posts,
      (SELECT count(*)::int FROM follow f WHERE f.follower_id = ${uid}) AS follows,
      (SELECT count(DISTINCT (e.created_at AT TIME ZONE 'America/New_York')::date)::int FROM analytics_event e
        WHERE e.name IN ('session_start', 'page_view') AND (e.user_id = ${uid} OR e.device_id IN ${devs})
          AND (e.created_at AT TIME ZONE 'America/New_York')::date > (COALESCE(${signed}::timestamptz, (SELECT min(e2.created_at) FROM analytics_event e2 WHERE e2.user_id = ${uid} OR e2.device_id IN ${devs})) AT TIME ZONE 'America/New_York')::date) AS return_days,
      (SELECT max(e.created_at)::text FROM analytics_event e WHERE e.user_id = ${uid} OR e.device_id IN ${devs}) AS last_seen`);
  const asks = await db.execute<{
    at: string;
    theme: string | null;
    scope: string | null;
    answers: number;
    tailored: number;
    followups: number;
    rating: "UP" | "DOWN" | null;
    slug: string | null;
    votes: number | null;
    results: boolean;
    cost: number;
  }>(sql`
    SELECT t.created_at::text AS at, t.classification->>'theme' AS theme, t.classification->>'scope' AS scope,
      count(m.id) FILTER (WHERE m.kind = 'answer')::int AS answers,
      count(m.id) FILTER (WHERE m.kind = 'answer' AND m.answer->>'kind' = 'tailored')::int AS tailored,
      GREATEST(count(m.id) FILTER (WHERE m.kind = 'question') - 1, 0)::int AS followups,
      (array_agg(m.rating ORDER BY m.created_at DESC) FILTER (WHERE m.rating IS NOT NULL))[1]::text AS rating,
      b.slug, (b.votes_a + b.votes_b) AS votes, t.results_at IS NOT NULL AS results,
      COALESCE(sum(m.cost_usd), 0)::float8 AS cost
    FROM pickbot_thread t LEFT JOIN pickbot_message m ON m.thread_id = t.id LEFT JOIN battle b ON b.id = t.battle_id
    WHERE t.user_id = ${uid}
    GROUP BY t.id, b.slug, b.votes_a, b.votes_b ORDER BY t.created_at DESC LIMIT 100`);
  const [cards] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM profile_answer WHERE user_id = ${uid} AND via = 'pickbot' AND status = 'answered'`);
  const p = (touch?.props ?? null) as Record<string, unknown> | null;
  const first = (p?.first && typeof p.first === "object" ? p.first : p) as Record<string, unknown> | null;
  const source = classifySource(p);
  return {
    who: u?.id ?? deviceId ?? "",
    handle: u?.handle ?? null,
    signedUpAt: signed,
    guest: !u,
    source,
    sourceLabel: SOURCE_LABELS[source],
    sourceTag: first ? String(first.utm_campaign ?? first.utm_source ?? first.referrerHost ?? (first.twclid ? "X ad click" : "")) : "",
    sex: SEX_OPTIONS.find((o) => o.id === u?.sex)?.label ?? null,
    ageRange: AGE_RANGES.find((o) => o.id === u?.ageRange)?.label ?? null,
    zip3: u?.zipCode ? u.zipCode.slice(0, 3) : null,
    votesBefore: votes.filter((v) => !v.after).length,
    votesAfter: votes.filter((v) => v.after).length,
    posts: facts.posts,
    follows: facts.follows,
    returnDays: facts.return_days,
    lastSeen: facts.last_seen,
    votes: [...votes],
    asks: [...asks].map((a) => ({
      at: a.at,
      theme: a.theme ?? "?",
      scope: a.scope ?? "?",
      answers: Number(a.answers),
      tailored: Number(a.tailored),
      followUps: Number(a.followups),
      rating: a.rating,
      crowd: a.slug ? { slug: a.slug, votes: Number(a.votes ?? 0), resultsBack: a.results } : null,
      costUsd: Number(a.cost),
    })),
    pickbotCards: Number(cards?.n ?? 0),
  } satisfies Journey;
}

/** Admin-only: the journey of one visitor id from the Journey page (a user id, or a device id for guests). */
export async function personJourney(who: string): Promise<Journey | null> {
  const [u] = await db.select().from(users).where(sql`${users.id} = ${who}`).limit(1);
  if (u) return isAdmin(u) ? null : buildJourney(u, null);
  const [d] = await db.execute<{ id: string }>(sql`
    SELECT id FROM device WHERE id = ${who}
    UNION ALL SELECT device_id FROM analytics_event WHERE device_id = ${who}
    LIMIT 1`);
  if (!d) return null;
  return buildJourney(null, who);
}
