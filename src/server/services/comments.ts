import { sql } from "drizzle-orm";
import { db } from "../db";
import { adminIds } from "./brain";
import { commentPatterns, isChipReason, isReal, type Commenter, type VoteFact } from "./comments-rules";

/**
 * /admin/comments (Alex, Nov 26 2026): every battle with reasons ("Top reasons" on the battle page), who wrote them,
 * and the pattern of who comments and on what. All time (reasons are rare). Read-only.
 * view "real" (default) = real people only: accounts with an email and guest browsers, no admins or their browsers,
 * no seed votes or email-less seed accounts. "all" = everything, each row labelled.
 */
export type CommentsView = "real" | "all";

export type CommentRow = {
  at: string;
  who: string | null;
  handle: string | null;
  kind: Commenter;
  side: "A" | "B";
  picked: string;
  reason: string;
  chip: boolean;
  hidden: boolean;
  upvotes: number;
  sex: string | null;
  age: string | null;
  personVotes: number;
};
export type CommentBattle = {
  id: string;
  slug: string;
  title: string;
  photo: boolean;
  seedBattle: boolean;
  theme: string | null;
  poster: string | null;
  votes: number;
  comments: CommentRow[];
};
export type CommenterRow = {
  who: string;
  handle: string | null;
  kind: Commenter;
  sex: string | null;
  age: string | null;
  personVotes: number;
  comments: number;
  battles: number;
  last: string;
};

type Raw = {
  at: string;
  who: string | null;
  handle: string | null;
  user_id: string | null;
  device_id: string | null;
  seed_vote: boolean;
  seed_user: boolean;
  side: "A" | "B";
  label_a: string | null;
  label_b: string | null;
  reason: string | null;
  hidden: boolean;
  upvotes: number;
  sex: string | null;
  age: string | null;
  person_votes: number;
  battle_id: string;
  slug: string;
  title: string;
  photo: boolean;
  seed_battle: boolean;
  theme: string | null;
  poster: string | null;
  battle_votes: number;
};

export async function commentsData(view: CommentsView) {
  const { ids, devs } = await adminIds();
  const adminSet = new Set([...ids, ...devs]);

  // One row per (non-flagged) vote. Sex/age: the person's account, else the guest browser's about-you answers.
  const rows = await db.execute<Raw>(sql`
    WITH v0 AS (
      SELECT v.*, COALESCE(v.user_id, dv.user_id, v.device_id) AS who, COALESCE(v.user_id, dv.user_id) AS person_user
      FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
      WHERE NOT v.flagged
    ), pv AS (
      SELECT who, count(*)::int AS n FROM v0 WHERE who IS NOT NULL GROUP BY who
    ), ga AS (
      SELECT device_id,
        max(answer) FILTER (WHERE question = 'sex') AS sex,
        max(answer) FILTER (WHERE question = 'age') AS age
      FROM profile_answer WHERE status = 'answered' AND device_id IS NOT NULL AND question IN ('sex', 'age')
      GROUP BY device_id
    )
    SELECT v0.created_at::text AS at, v0.who, pu.handle AS handle, v0.user_id, v0.device_id,
      COALESCE(v0.source, '') = 'seed' AS seed_vote,
      (v0.user_id IS NOT NULL AND u.email IS NULL) AS seed_user,
      v0.side, oa.label AS label_a, ob.label AS label_b,
      v0.reason, v0.reason_hidden AS hidden,
      (SELECT count(*)::int FROM reason_helpful h WHERE h.vote_id = v0.id) AS upvotes,
      COALESCE(pu.sex, ga.sex) AS sex, COALESCE(pu.age_range, ga.age) AS age,
      COALESCE(pv.n, 1) AS person_votes,
      b.id AS battle_id, b.slug, b.title,
      (oa.image_url IS NOT NULL OR ob.image_url IS NOT NULL) AS photo,
      (b.id LIKE 'seed_%' OR au.email IS NULL) AS seed_battle,
      b.tags->'brain'->>'theme' AS theme, au.handle AS poster,
      (b.votes_a + b.votes_b) AS battle_votes
    FROM v0
    JOIN battle b ON b.id = v0.battle_id
    LEFT JOIN "user" u ON u.id = v0.user_id
    LEFT JOIN "user" pu ON pu.id = v0.person_user
    LEFT JOIN "user" au ON au.id = b.author_id
    LEFT JOIN option oa ON oa.battle_id = b.id AND oa.side = 'A'
    LEFT JOIN option ob ON ob.battle_id = b.id AND ob.side = 'B'
    LEFT JOIN pv ON pv.who = v0.who
    LEFT JOIN ga ON ga.device_id = v0.device_id AND v0.person_user IS NULL
  `);

  const kindOf = (r: Raw): Commenter => {
    if (r.seed_vote || r.seed_user) return "seed";
    if ((r.user_id && adminSet.has(r.user_id)) || (r.device_id && adminSet.has(r.device_id)) || (r.who && adminSet.has(r.who))) return "admin";
    return r.user_id ? "account" : "guest";
  };

  const all = rows.map((r) => ({ r, kind: kindOf(r) }));
  const scoped = view === "real" ? all.filter((x) => isReal(x.kind)) : all;

  const facts: VoteFact[] = scoped.map(({ r, kind }) => ({
    who: r.who ?? `deleted:${r.at}`,
    kind,
    sex: r.sex,
    age: r.age,
    personVotes: r.person_votes,
    reason: r.reason,
    photo: r.photo,
    seedBattle: r.seed_battle,
    theme: r.theme,
  }));
  const patterns = commentPatterns(facts);

  // Battles with at least one reason, most reasons first.
  const battles = new Map<string, CommentBattle>();
  const people = new Map<string, CommenterRow & { battleSet: Set<string> }>();
  for (const { r, kind } of scoped) {
    if (!r.reason || !r.reason.trim()) continue;
    const b =
      battles.get(r.battle_id) ??
      ({
        id: r.battle_id,
        slug: r.slug,
        title: r.title,
        photo: r.photo,
        seedBattle: r.seed_battle,
        theme: r.theme,
        poster: r.poster,
        votes: r.battle_votes,
        comments: [],
      } satisfies CommentBattle);
    b.comments.push({
      at: r.at,
      who: r.who,
      handle: r.handle,
      kind,
      side: r.side,
      picked: (r.side === "A" ? r.label_a : r.label_b) ?? r.side,
      reason: r.reason,
      chip: isChipReason(r.reason),
      hidden: r.hidden,
      upvotes: r.upvotes,
      sex: r.sex,
      age: r.age,
      personVotes: r.person_votes,
    });
    battles.set(r.battle_id, b);

    const key = r.who ?? `deleted:${r.at}`;
    const p = people.get(key) ?? {
      who: key,
      handle: r.handle,
      kind,
      sex: r.sex,
      age: r.age,
      personVotes: r.person_votes,
      comments: 0,
      battles: 0,
      last: r.at,
      battleSet: new Set<string>(),
    };
    p.comments++;
    p.battleSet.add(r.battle_id);
    if (r.at > p.last) p.last = r.at;
    people.set(key, p);
  }

  const battleList = [...battles.values()]
    .map((b) => ({ ...b, comments: b.comments.sort((x, y) => (x.at < y.at ? 1 : -1)) }))
    .sort((a, b) => b.comments.length - a.comments.length || (a.comments[0].at < b.comments[0].at ? 1 : -1));
  const commenters: CommenterRow[] = [...people.values()]
    .map(({ battleSet, ...p }) => ({ ...p, battles: battleSet.size }))
    .sort((a, b) => b.comments - a.comments || (a.last < b.last ? 1 : -1));

  return { view, patterns, battles: battleList, commenters };
}
