import { sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";
import { classifySource, SOURCE_LABELS, type Source } from "./acquisition-rules";

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
  askers: "People who asked Pickbot",
  newvoters: "New voters (first vote ever)",
  cards: "Deck cards seen",
  skips: "Skips",
  changes: "Vote changes",
  seedvotes: "Seed votes (fake)",
} as const;
export type BrainListKind = keyof typeof BRAIN_LISTS;

const TZ = "America/New_York";
const LIMIT = 500;
const EV_FROM = sql`analytics_event e LEFT JOIN device d ON d.id = e.device_id`;
const V_FROM = sql`vote v LEFT JOIN device dv ON dv.id = v.device_id`;

/** `asked` = Pickbot questions this person ever asked (follow-ups not counted). */
export type PersonRow = { who: string; handle: string | null; n: number; first: string; last: string; asked: number };
export type BattleRow = { slug: string; title: string; status: string; at: string; handle: string | null; authorId: string; votes: number; photo: boolean; iVoted: boolean };
/** `who` is null for a vote whose account was deleted after its browser's votes moved into it (no owner left). */
export type VoteRow = { at: string; who: string | null; handle: string | null; slug: string; title: string; picked: string; source: string | null };
export type SignupRow = { who: string; handle: string | null; at: string; sex: string | null; ageRange: string | null; votes: number; asked: number };

/** One deck card a person saw (person × battle) and how it ended. */
export type CardRow = { who: string; handle: string | null; slug: string; title: string; kind: string | null; pos: number | null; at: string; outcome: "voted" | "skipped" | "neither" };
export type SkipRow = { at: string; who: string | null; handle: string | null; slug: string; title: string };
export type ChangeRow = { at: string; who: string | null; handle: string | null; slug: string | null; title: string | null; from: string | null; to: string | null };

export type BrainList =
  | { kind: "battles"; total: number; rows: BattleRow[] }
  | { kind: "votes"; total: number; rows: VoteRow[] }
  | { kind: "seedvotes"; total: number; rows: VoteRow[] }
  | { kind: "signups"; total: number; rows: SignupRow[] }
  | { kind: "cards"; total: number; rows: CardRow[] }
  | { kind: "skips"; total: number; rows: SkipRow[] }
  | { kind: "changes"; total: number; rows: ChangeRow[] }
  | { kind: "voters" | "visitors" | "gates" | "askers" | "newvoters"; total: number; rows: PersonRow[] };

/** Where a vote was made (vote.source); "page" = battle page or a shared link (no source). */
export const VOTE_PLACES = { feed: "Vote deck", home: "Homepage card", discover: "Discover", search: "Search", profile: "Profile", seed: "Seed (fake)", page: "Battle page / link" } as const;
export type VotePlace = keyof typeof VOTE_PLACES;

/**
 * Optional narrowing so a table cell can open exactly the rows behind it (Alex, Nov 26: "drill down into the numbers
 * from anywhere"). Each filter only applies to the lists that have that field.
 * - place: votes by where they were made · kind: text/photo battle (votes, cards) · battle: one battle's slug
 *   (votes, cards, skips) · outcome / pos: deck cards by how they ended / deck position range · source: visitors by
 *   how that visit came in (same `classifySource()` as Visits by source) · from: an ISO start time instead of the window.
 */
export type ListFilters = {
  place?: VotePlace;
  kind?: "text" | "photo";
  battle?: string;
  outcome?: CardRow["outcome"];
  pos?: [number, number];
  source?: Source;
  from?: string;
};

/** Parse the list page's search params into filters (anything unknown is ignored). */
export function parseFilters(sp: Record<string, string | undefined>): ListFilters {
  const f: ListFilters = {};
  if (sp.place && sp.place in VOTE_PLACES) f.place = sp.place as VotePlace;
  if (sp.kind === "text" || sp.kind === "photo") f.kind = sp.kind;
  if (sp.battle && /^[\w-]{1,40}$/.test(sp.battle)) f.battle = sp.battle;
  if (sp.outcome === "voted" || sp.outcome === "skipped" || sp.outcome === "neither") f.outcome = sp.outcome;
  const pos = sp.pos?.match(/^(\d+)-(\d+)$/);
  if (pos) f.pos = [Number(pos[1]), Number(pos[2])];
  if (sp.source && (sp.source === "unknown" || sp.source in SOURCE_LABELS)) f.source = sp.source as Source;
  if (sp.from && !Number.isNaN(Date.parse(sp.from))) f.from = new Date(sp.from).toISOString();
  return f;
}

/** The filters as query-string pairs (for links that keep them). */
export function filterQuery(f: ListFilters): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.place) q.place = f.place;
  if (f.kind) q.kind = f.kind;
  if (f.battle) q.battle = f.battle;
  if (f.outcome) q.outcome = f.outcome;
  if (f.pos) q.pos = `${f.pos[0]}-${f.pos[1]}`;
  if (f.source) q.source = f.source;
  if (f.from) q.from = f.from;
  return q;
}

/** Plain words for the active filters, shown in the list's header. */
export function describeFilters(f: ListFilters): string[] {
  const out: string[] = [];
  if (f.place) out.push(VOTE_PLACES[f.place]);
  if (f.kind) out.push(`${f.kind} battles`);
  if (f.battle) out.push("one battle");
  if (f.outcome) out.push(f.outcome === "neither" ? "neither voted nor skipped" : f.outcome);
  if (f.pos) out.push(f.pos[0] === f.pos[1] ? `deck position ${f.pos[0]}` : `deck positions ${f.pos[0]}–${f.pos[1] >= 9999 ? "end" : f.pos[1]}`);
  if (f.source) out.push(`came in from ${f.source === "unknown" ? "Unknown" : SOURCE_LABELS[f.source]}`);
  return out;
}

const isPhoto = (battleId: SQL) => sql`EXISTS (SELECT 1 FROM "option" o WHERE o.battle_id = ${battleId} AND o.image_url IS NOT NULL)`;

/**
 * `day` = a New York date (YYYY-MM-DD) from the Day by day table or the pinned row, to narrow the list to that day.
 * A day list looks back far enough to hold that day whatever window the Brain is on (24h would cut yesterday off).
 */
export async function brainList(
  kind: BrainListKind,
  view: BrainView,
  days: number,
  day: string | null,
  viewerId: string | null,
  f: ListFilters = {},
): Promise<BrainList> {
  const scope = await brainScope(view, day || f.from ? 400 : days);
  const { ev, vt, bt, us, st } = scope;
  let since = scope.since;
  if (f.from && f.from > since) since = f.from;
  const onDay = (col: SQL) => (day ? sql`to_char((${col} AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') = ${day}` : sql`true`);
  const handleOf = (who: SQL) => sql`(SELECT pu.handle FROM "user" pu WHERE pu.id = ${who})`;
  // Pickbot is for accounts only, so its events carry the user id.
  const askedBy = (who: SQL) =>
    sql`(SELECT count(*)::int FROM analytics_event pa WHERE pa.name = 'pickbot_asked' AND pa.user_id = ${who} AND COALESCE(pa.props->>'followUp', 'false') <> 'true')`;

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

  if (kind === "votes" || kind === "seedvotes") {
    const known = Object.keys(VOTE_PLACES).filter((k) => k !== "page");
    const place = !f.place
      ? sql`true`
      : f.place === "page"
        ? sql`COALESCE(v.source, '') NOT IN (${sql.join(known.map((k) => sql`${k}`), sql`, `)})`
        : sql`v.source = ${f.place}`;
    const filters = sql`${place} AND ${f.kind ? (f.kind === "photo" ? isPhoto(sql`v.battle_id`) : sql`NOT ${isPhoto(sql`v.battle_id`)}`) : sql`true`}
      AND ${f.battle ? sql`v.battle_id = (SELECT id FROM battle WHERE slug = ${f.battle})` : sql`true`}`;
    // Seed votes: the "Seed votes (all time, excluded)" tile, so all time and only seed.
    const where =
      kind === "seedvotes"
        ? sql`v.source = 'seed' AND NOT v.flagged AND ${onDay(sql`v.created_at`)} AND ${filters}`
        : sql`v.created_at > ${since} AND NOT v.flagged AND ${vt} AND ${onDay(sql`v.created_at`)} AND ${filters}`;
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
        (SELECT count(*)::int FROM vote v WHERE v.user_id = u.id AND NOT v.flagged) AS votes, ${askedBy(sql`u.id`)} AS asked
      FROM "user" u WHERE ${where} ORDER BY u.onboarded_at DESC LIMIT ${LIMIT}`);
    const [t] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM "user" u WHERE ${where}`);
    return { kind, total: t?.n ?? 0, rows: [...rows] };
  }

  if (kind === "cards") {
    // Same counting as "Voted vs skipped" (services/skip-stats.ts): person × battle, voted wins over skipped.
    const base = sql`
      WITH c AS (
        SELECT e.props->>'battleId' AS battle_id, ${WHO_E} AS who, max(e.props->>'kind') AS kind, min(e.created_at) AS at,
          min(CASE WHEN e.props->>'pos' ~ '^[0-9]+$' THEN (e.props->>'pos')::int END) AS pos
        FROM ${EV_FROM}
        WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${ev} AND e.props ? 'battleId' AND ${onDay(sql`e.created_at`)}
        GROUP BY 1, 2
      ), o AS (
        SELECT c.*,
          CASE
            WHEN EXISTS (SELECT 1 FROM ${V_FROM} WHERE v.battle_id = c.battle_id AND v.created_at > ${since} AND NOT v.flagged AND ${vt} AND ${WHO_V} = c.who) THEN 'voted'
            WHEN EXISTS (SELECT 1 FROM skip s LEFT JOIN device ds ON ds.id = s.device_id
              WHERE s.battle_id = c.battle_id AND s.created_at > ${since} AND ${st} AND COALESCE(s.user_id, ds.user_id, s.device_id) = c.who) THEN 'skipped'
            ELSE 'neither'
          END AS outcome
        FROM c WHERE c.who IS NOT NULL
      )`;
    const where = sql`${f.kind ? sql`COALESCE(o.kind, '?') = ${f.kind}` : sql`true`}
      AND ${f.outcome ? sql`o.outcome = ${f.outcome}` : sql`true`}
      AND ${f.pos ? sql`o.pos BETWEEN ${f.pos[0]} AND ${f.pos[1]}` : sql`true`}
      AND ${f.battle ? sql`o.battle_id = (SELECT id FROM battle WHERE slug = ${f.battle})` : sql`true`}`;
    const rows = await db.execute<CardRow>(sql`${base}
      SELECT o.who, ${handleOf(sql`o.who`)} AS handle, b.slug, b.title, o.kind, o.pos, o.at::text AS at, o.outcome
      FROM o JOIN battle b ON b.id = o.battle_id WHERE ${where} ORDER BY o.at DESC LIMIT ${LIMIT}`);
    const [t] = await db.execute<{ n: number }>(sql`${base} SELECT count(*)::int AS n FROM o JOIN battle b ON b.id = o.battle_id WHERE ${where}`);
    return { kind, total: t?.n ?? 0, rows: [...rows] };
  }

  if (kind === "skips") {
    const who = sql`COALESCE(s.user_id, ds.user_id, s.device_id)`;
    const where = sql`s.created_at > ${since} AND ${st} AND ${onDay(sql`s.created_at`)}
      AND ${f.battle ? sql`s.battle_id = (SELECT id FROM battle WHERE slug = ${f.battle})` : sql`true`}`;
    const rows = await db.execute<SkipRow>(sql`
      SELECT s.created_at::text AS at, ${who} AS who, ${handleOf(who)} AS handle, b.slug, b.title
      FROM skip s LEFT JOIN device ds ON ds.id = s.device_id JOIN battle b ON b.id = s.battle_id
      WHERE ${where} ORDER BY s.created_at DESC LIMIT ${LIMIT}`);
    const [t] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM skip s WHERE ${where}`);
    return { kind, total: t?.n ?? 0, rows: [...rows] };
  }

  if (kind === "changes") {
    const where = sql`e.name = 'vote_changed' AND e.created_at > ${since} AND ${ev} AND ${onDay(sql`e.created_at`)}`;
    const rows = await db.execute<ChangeRow>(sql`
      SELECT e.created_at::text AS at, ${WHO_E} AS who, ${handleOf(WHO_E)} AS handle, b.slug, b.title,
        (SELECT o.label FROM "option" o WHERE o.battle_id = b.id AND o.side::text = e.props->>'from' LIMIT 1) AS "from",
        (SELECT o.label FROM "option" o WHERE o.battle_id = b.id AND o.side::text = e.props->>'to' LIMIT 1) AS "to"
      FROM ${EV_FROM} LEFT JOIN battle b ON b.id = e.props->>'battleId'
      WHERE ${where} ORDER BY e.created_at DESC LIMIT ${LIMIT}`);
    const [t] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ${EV_FROM} WHERE ${where}`);
    return { kind, total: t?.n ?? 0, rows: [...rows] };
  }

  if (kind === "visitors" && f.source) {
    // The source belongs to each visit (session_start tags), so classify in code with the same rule as Visits by source.
    const evs = await db.execute<{ props: Record<string, unknown> | null; who: string | null; at: string }>(sql`
      SELECT e.props, ${WHO_E} AS who, e.created_at::text AS at
      FROM ${EV_FROM} WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev} AND ${onDay(sql`e.created_at`)}
      ORDER BY e.created_at LIMIT 200000`);
    const by = new Map<string, PersonRow>();
    for (const r of evs) {
      if (!r.who || classifySource({ ...(r.props ?? {}), first: undefined }) !== f.source) continue;
      const p = by.get(r.who);
      if (p) {
        p.n++;
        p.last = r.at;
      } else by.set(r.who, { who: r.who, handle: null, n: 1, first: r.at, last: r.at, asked: 0 });
    }
    const all = [...by.values()].sort((a, b) => b.last.localeCompare(a.last));
    const rows = all.slice(0, LIMIT);
    if (rows.length) {
      const ids = rows.map((r) => sql`${r.who}`);
      const extra = await db.execute<{ who: string; handle: string | null; asked: number }>(sql`
        SELECT w.who, (SELECT pu.handle FROM "user" pu WHERE pu.id = w.who) AS handle, ${askedBy(sql`w.who`)} AS asked
        FROM (SELECT unnest(ARRAY[${sql.join(ids, sql`, `)}]::text[]) AS who) w`);
      const m = new Map([...extra].map((x) => [x.who, x]));
      for (const r of rows) {
        r.handle = m.get(r.who)?.handle ?? null;
        r.asked = m.get(r.who)?.asked ?? 0;
      }
    }
    return { kind, total: all.length, rows };
  }

  // People lists: one row per person (account, else device mapped to its account).
  const inner =
    kind === "newvoters"
      ? // First counted vote ever (in this view) falls in the window / day; n = their votes in the window. Same rule as the pinned "New voters" tile.
        sql`SELECT * FROM (
            SELECT ${WHO_V} AS who, count(*) FILTER (WHERE v.created_at > ${since})::int AS n, min(v.created_at) AS first, max(v.created_at) AS last
            FROM ${V_FROM} WHERE NOT v.flagged AND ${vt} GROUP BY 1
          ) f WHERE f.first > ${since} AND ${onDay(sql`f.first`)}`
      : kind === "askers"
      ? sql`SELECT ${WHO_E} AS who, count(*)::int AS n, min(e.created_at) AS first, max(e.created_at) AS last
          FROM ${EV_FROM} WHERE e.name = 'pickbot_asked' AND COALESCE(e.props->>'followUp', 'false') <> 'true'
            AND e.created_at > ${since} AND ${ev} AND ${onDay(sql`e.created_at`)} GROUP BY 1`
      : kind === "voters"
      ? sql`SELECT ${WHO_V} AS who, count(*)::int AS n, min(v.created_at) AS first, max(v.created_at) AS last
          FROM ${V_FROM} WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} AND ${onDay(sql`v.created_at`)} GROUP BY 1`
      : sql`SELECT ${WHO_E} AS who, count(*)::int AS n, min(e.created_at) AS first, max(e.created_at) AS last
          FROM ${EV_FROM} WHERE e.name = ${kind === "visitors" ? "session_start" : "signup_gate_shown"} AND e.created_at > ${since} AND ${ev}
            AND ${onDay(sql`e.created_at`)} GROUP BY 1`;
  const rows = await db.execute<PersonRow>(sql`
    SELECT p.who, (SELECT pu.handle FROM "user" pu WHERE pu.id = p.who) AS handle, p.n, p.first::text AS first, p.last::text AS last,
      ${askedBy(sql`p.who`)} AS asked
    FROM (${inner}) p WHERE p.who IS NOT NULL ORDER BY p.last DESC LIMIT ${LIMIT}`);
  // No owner left (account deleted after its guest votes moved into it): not a person, and the tiles' count(DISTINCT) skips it too.
  const [t] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM (${inner}) p WHERE p.who IS NOT NULL`);
  return { kind, total: t?.n ?? 0, rows: [...rows] };
}
