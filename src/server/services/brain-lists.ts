import { sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";

/**
 * Drill-downs behind the Brain page's numbers (Alex, Nov 24 2026: "everything should be clickable so I can dig
 * deeper"). Each list uses the same scope as the tile it opens, so its total matches that tile. Admin-only.
 */
export const BRAIN_LISTS = {
  battles: "Battles posted",
  votes: "Votes",
  voters: "People who voted",
  visitors: "Visitors (people)",
  signups: "Sign-ups",
  gates: "Hit the sign-up wall",
} as const;
export type BrainListKind = keyof typeof BRAIN_LISTS;

const TZ = "America/New_York";
const LIMIT = 500;
const EV_FROM = sql`analytics_event e LEFT JOIN device d ON d.id = e.device_id`;
const V_FROM = sql`vote v LEFT JOIN device dv ON dv.id = v.device_id`;

export type PersonRow = { who: string; handle: string | null; n: number; first: string; last: string };
export type BattleRow = { slug: string; title: string; status: string; at: string; handle: string | null; authorId: string; votes: number; photo: boolean; iVoted: boolean };
/** `who` is null for a vote whose account was deleted after its browser's votes moved into it (no owner left). */
export type VoteRow = { at: string; who: string | null; handle: string | null; slug: string; title: string; picked: string; source: string | null };
export type SignupRow = { who: string; handle: string | null; at: string; sex: string | null; ageRange: string | null; votes: number };

export type BrainList =
  | { kind: "battles"; total: number; rows: BattleRow[] }
  | { kind: "votes"; total: number; rows: VoteRow[] }
  | { kind: "signups"; total: number; rows: SignupRow[] }
  | { kind: "voters" | "visitors" | "gates"; total: number; rows: PersonRow[] };

/** `day` = a New York date (YYYY-MM-DD) from the Day by day table, to narrow the list to that day. */
export async function brainList(kind: BrainListKind, view: BrainView, days: number, day: string | null, viewerId: string | null): Promise<BrainList> {
  const scope = await brainScope(view, days);
  const { since, ev, vt, bt, us } = scope;
  const onDay = (col: SQL) => (day ? sql`to_char((${col} AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') = ${day}` : sql`true`);
  const handleOf = (who: SQL) => sql`(SELECT pu.handle FROM "user" pu WHERE pu.id = ${who})`;

  if (kind === "battles") {
    const where = sql`b.created_at > ${since} AND ${bt} AND ${onDay(sql`b.created_at`)}`;
    const rows = await db.execute<BattleRow>(sql`
      SELECT b.slug, b.title, b.status::text AS status, b.created_at::text AS at, u.handle, b.author_id AS "authorId",
        (SELECT count(*)::int FROM vote v WHERE v.battle_id = b.id AND NOT v.flagged AND ${vt}) AS votes,
        EXISTS (SELECT 1 FROM "option" o WHERE o.battle_id = b.id AND o.image_url IS NOT NULL) AS photo,
        ${viewerId ? sql`EXISTS (SELECT 1 FROM vote mv WHERE mv.battle_id = b.id AND mv.user_id = ${viewerId})` : sql`false`} AS "iVoted"
      FROM battle b JOIN "user" u ON u.id = b.author_id
      WHERE ${where} ORDER BY b.created_at DESC LIMIT ${LIMIT}`);
    const [t] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM battle b WHERE ${where}`);
    return { kind, total: t?.n ?? 0, rows: [...rows] };
  }

  if (kind === "votes") {
    const where = sql`v.created_at > ${since} AND NOT v.flagged AND ${vt} AND ${onDay(sql`v.created_at`)}`;
    const rows = await db.execute<VoteRow>(sql`
      SELECT v.created_at::text AS at, ${WHO_V} AS who, ${handleOf(WHO_V)} AS handle, b.slug, b.title,
        COALESCE((SELECT o.label FROM "option" o WHERE o.battle_id = v.battle_id AND o.side = v.side LIMIT 1), v.side::text) AS picked, v.source
      FROM ${V_FROM} JOIN battle b ON b.id = v.battle_id
      WHERE ${where} ORDER BY v.created_at DESC LIMIT ${LIMIT}`);
    const [t] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vote v WHERE ${where}`);
    return { kind, total: t?.n ?? 0, rows: [...rows] };
  }

  if (kind === "signups") {
    const where = sql`u.onboarded_at > ${since} AND ${us} AND ${onDay(sql`u.onboarded_at`)}`;
    const rows = await db.execute<SignupRow>(sql`
      SELECT u.id AS who, u.handle, u.onboarded_at::text AS at, u.sex, u.age_range AS "ageRange",
        (SELECT count(*)::int FROM vote v WHERE v.user_id = u.id AND NOT v.flagged) AS votes
      FROM "user" u WHERE ${where} ORDER BY u.onboarded_at DESC LIMIT ${LIMIT}`);
    const [t] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM "user" u WHERE ${where}`);
    return { kind, total: t?.n ?? 0, rows: [...rows] };
  }

  // People lists: one row per person (account, else device mapped to its account).
  const inner =
    kind === "voters"
      ? sql`SELECT ${WHO_V} AS who, count(*)::int AS n, min(v.created_at) AS first, max(v.created_at) AS last
          FROM ${V_FROM} WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} AND ${onDay(sql`v.created_at`)} GROUP BY 1`
      : sql`SELECT ${WHO_E} AS who, count(*)::int AS n, min(e.created_at) AS first, max(e.created_at) AS last
          FROM ${EV_FROM} WHERE e.name = ${kind === "visitors" ? "session_start" : "signup_gate_shown"} AND e.created_at > ${since} AND ${ev}
            AND ${onDay(sql`e.created_at`)} GROUP BY 1`;
  const rows = await db.execute<PersonRow>(sql`
    SELECT p.who, (SELECT pu.handle FROM "user" pu WHERE pu.id = p.who) AS handle, p.n, p.first::text AS first, p.last::text AS last
    FROM (${inner}) p WHERE p.who IS NOT NULL ORDER BY p.last DESC LIMIT ${LIMIT}`);
  // No owner left (account deleted after its guest votes moved into it): not a person, and the tiles' count(DISTINCT) skips it too.
  const [t] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM (${inner}) p WHERE p.who IS NOT NULL`);
  return { kind, total: t?.n ?? 0, rows: [...rows] };
}
