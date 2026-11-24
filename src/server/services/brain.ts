import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { or, eq, isNotNull } from "drizzle-orm";
import { isAdmin } from "../viewer";
import { getEconomy } from "./config";
import { classifySource, SOURCE_LABELS, type Source } from "./acquisition-rules";

/**
 * Two ways to look at the Brain (Alex, Nov 23 2026). Nothing is ever deleted; the views only filter.
 * - clean (default): real people from the economy setting `brainCleanFrom` (YYYYMMDD, New York midnight) on.
 *   No seed votes (vote.source = 'seed') and no seed battles in battle counts. A real person's vote on a seed
 *   battle IS counted (most of the deck is seed content; Alex, Nov 24: excluding those made votes not add up).
 *   No no email-less (seed / "post as") accounts, no admins or their browsers, no bots.
 * - all ("AI view"): everything, seed votes and test activity included (bots still left out).
 */
export type BrainView = "clean" | "all";

const TZ = "America/New_York";

/** YYYYMMDD → ISO time of that day's midnight in New York. */
async function nyMidnight(yyyymmdd: number): Promise<string> {
  const d = String(Math.trunc(yyyymmdd));
  const [r] = await db.execute<{ t: string }>(sql`SELECT (to_date(${d}, 'YYYYMMDD')::timestamp AT TIME ZONE ${TZ})::text AS t`);
  return new Date(r.t).toISOString();
}

/** Admin accounts and the browsers linked to them (their test votes and visits stay out of the clean view). */
async function adminIds() {
  const rows = await db.select().from(users).where(or(eq(users.role, "ADMIN"), isNotNull(users.email)));
  const ids = rows.filter((u) => isAdmin(u)).map((u) => u.id);
  const devs = ids.length
    ? (await db.execute<{ id: string }>(sql`SELECT id FROM device WHERE user_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)).map((r) => r.id)
    : [];
  return { ids, devs };
}

/**
 * One person = an account, or a browser not linked to one. A guest browser that later signs in maps to the account
 * (device.user_id), so the same person isn't counted twice. Needs `LEFT JOIN device d ON d.id = e.device_id` (events)
 * or `LEFT JOIN device dv ON dv.id = v.device_id` (votes).
 */
export const WHO_E = sql`COALESCE(e.user_id, d.user_id, e.device_id)`;
export const WHO_V = sql`COALESCE(v.user_id, dv.user_id, v.device_id)`;
const EV_FROM = sql`analytics_event e LEFT JOIN device d ON d.id = e.device_id`;
const V_FROM = sql`vote v LEFT JOIN device dv ON dv.id = v.device_id`;

const notIn = (col: SQL, list: string[]) => (list.length ? sql`(${col} IS NULL OR ${col} NOT IN (${sql.join(list.map((i) => sql`${i}`), sql`, `)}))` : sql`true`);

export async function brainScope(view: BrainView, days: number) {
  const windowStart = new Date(Date.now() - days * 86400_000).toISOString();
  if (view === "all") {
    return {
      view,
      cleanFrom: null as string | null,
      since: windowStart,
      ev: sql`COALESCE((e.props->>'bot')::boolean, false) = false`,
      vt: sql`true`,
      bt: sql`true`,
      st: sql`true`,
      us: sql`u.onboarded_at IS NOT NULL`,
      ua: sql`true`,
    };
  }
  const e = await getEconomy();
  const cleanFrom = await nyMidnight(e.brainCleanFrom);
  const since = cleanFrom > windowStart ? cleanFrom : windowStart;
  const { ids, devs } = await adminIds();
  const realUser = (col: SQL) => sql`(${col} IS NULL OR EXISTS (SELECT 1 FROM "user" ru WHERE ru.id = ${col} AND ru.email IS NOT NULL))`;
  return {
    view,
    cleanFrom,
    since,
    ev: sql`COALESCE((e.props->>'bot')::boolean, false) = false AND e.created_at >= ${cleanFrom}
      AND ${notIn(sql`e.user_id`, ids)} AND ${notIn(sql`e.device_id`, devs)} AND ${realUser(sql`e.user_id`)}`,
    vt: sql`COALESCE(v.source, '') <> 'seed' AND v.created_at >= ${cleanFrom}
      AND ${notIn(sql`v.user_id`, ids)} AND ${notIn(sql`v.device_id`, devs)} AND ${realUser(sql`v.user_id`)}`,
    bt: sql`b.id NOT LIKE 'seed_%' AND b.created_at >= ${cleanFrom} AND ${notIn(sql`b.author_id`, ids)} AND ${realUser(sql`b.author_id`)}`,
    st: sql`s.created_at >= ${cleanFrom} AND ${notIn(sql`s.user_id`, ids)} AND ${notIn(sql`s.device_id`, devs)} AND ${realUser(sql`s.user_id`)}`,
    // A sign-up = an account with an email that finished onboarding; not banned, not an admin. Same everywhere
    // (tiles, day by day, sign-ups by source, the sign-ups list, the Journey).
    us: sql`u.onboarded_at >= ${cleanFrom} AND u.email IS NOT NULL AND u.banned_at IS NULL AND ${notIn(sql`u.id`, ids)}`,
    /** Real account at any date (alias u): email, not banned, not an admin. */
    ua: sql`u.email IS NOT NULL AND u.banned_at IS NULL AND ${notIn(sql`u.id`, ids)}`,
  };
}

/**
 * Numbers for /admin/brain (docs/brain/). Read-only, admin-only, loaded rarely. What counts depends on the view
 * (`brainScope`); flagged votes and bot events are always left out.
 * Heavy queries move to a nightly copy once volume grows (docs/brain/README.md rule 7).
 */
export async function getBrainStats(days = 7, view: BrainView = "clean") {
  const scope = await brainScope(view, days);
  const { since, ev: notBot, vt: voteOK, bt: battleOK } = scope;

  const { st: skipOK, us: signupOK } = scope;
  const [tiles] = await db.execute<Record<string, number | null>>(sql`
    SELECT
      (SELECT count(*)::int FROM ${EV_FROM} WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}) AS sessions,
      (SELECT count(DISTINCT ${WHO_E})::int FROM ${EV_FROM} WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}) AS visitors,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${notBot}) AS views,
      (SELECT count(*)::int FROM vote v WHERE v.created_at > ${since} AND ${voteOK} AND NOT v.flagged) AS real_votes,
      (SELECT count(DISTINCT ${WHO_V})::int FROM ${V_FROM} WHERE v.created_at > ${since} AND ${voteOK} AND NOT v.flagged) AS voters,
      (SELECT count(*)::int FROM vote v WHERE v.source = 'seed') AS seed_votes_all,
      (SELECT count(*)::int FROM skip s WHERE s.created_at > ${since} AND ${skipOK}) AS skips,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'signup_gate_shown' AND e.created_at > ${since} AND ${notBot}) AS gates,
      (SELECT count(*)::int FROM "user" u WHERE u.onboarded_at > ${since} AND ${signupOK}) AS signups,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'vote_changed' AND e.created_at > ${since} AND ${notBot}) AS changed,
      (SELECT count(*)::int FROM battle b WHERE b.created_at > ${since} AND ${battleOK}) AS real_battles,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v.dwell_ms)::float FROM vote v WHERE v.created_at > ${since} AND v.source = 'feed' AND v.dwell_ms IS NOT NULL AND NOT v.flagged AND ${voteOK}) AS median_pick_ms
  `);

  // Text vs photo, counted per person × battle (a card shown twice to the same person counts once), and voted =
  // that person cast a counted vote on it in the window. So "Voted" adds up to at most the votes tile.
  const byKind = await db.execute<{ kind: string; views: number; seen: number; voted: number; median_ms: number | null }>(sql`
    WITH c AS (
      SELECT e.props->>'kind' AS kind, e.props->>'battleId' AS battle_id, ${WHO_E} AS who, count(*)::int AS shown
      FROM ${EV_FROM}
      WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${notBot}
      GROUP BY 1, 2, 3
    )
    SELECT c.kind, sum(c.shown)::int AS views, count(*)::int AS seen, count(v.id)::int AS voted,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY v.dwell_ms)::float AS median_ms
    FROM c
    LEFT JOIN LATERAL (
      SELECT v.id, v.dwell_ms FROM ${V_FROM}
      WHERE v.battle_id = c.battle_id AND v.source = 'feed' AND v.created_at > ${since} AND NOT v.flagged AND ${voteOK} AND ${WHO_V} = c.who
      LIMIT 1
    ) v ON true
    GROUP BY 1 ORDER BY 2 DESC`);

  // Every counted vote by where it was made × text/photo battle. Adds up exactly to the votes tile.
  const votePlaces = await db.execute<{ place: string; kind: string; n: number }>(sql`
    SELECT CASE COALESCE(v.source, '')
        WHEN 'feed' THEN 'Vote deck' WHEN 'home' THEN 'Homepage card' WHEN 'discover' THEN 'Discover'
        WHEN 'search' THEN 'Search' WHEN 'profile' THEN 'Profile' WHEN 'seed' THEN 'Seed votes (fake, All view only)' ELSE 'Battle page / shared link' END AS place,
      CASE WHEN EXISTS (SELECT 1 FROM "option" o WHERE o.battle_id = v.battle_id AND o.image_url IS NOT NULL) THEN 'photo' ELSE 'text' END AS kind,
      count(*)::int AS n
    FROM vote v WHERE v.created_at > ${since} AND ${voteOK} AND NOT v.flagged
    GROUP BY 1, 2 ORDER BY 3 DESC`);

  // How deep people go into the deck.
  const depth = await db.execute<{ bucket: string; views: number }>(sql`
    SELECT CASE WHEN p IS NULL THEN 'unknown' WHEN p <= 5 THEN '1–5' WHEN p <= 10 THEN '6–10' WHEN p <= 20 THEN '11–20' WHEN p <= 50 THEN '21–50' ELSE '50+' END AS bucket,
      count(*)::int AS views, COALESCE(min(p), 100000) AS o
    FROM (SELECT (e.props->>'pos')::int AS p FROM analytics_event e WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${notBot}) t
    GROUP BY 1 ORDER BY o`);

  const methods = await db.execute<{ method: string; n: number }>(sql`
    SELECT COALESCE(e.props->>'method', 'other') AS method, count(*)::int AS n
    FROM analytics_event e WHERE e.name = 'vote_cast' AND e.created_at > ${since} AND ${notBot}
    GROUP BY 1 ORDER BY 2 DESC`);

  // Acquisition: where visits came from, and how many of those visitors voted.
  const sources = await db.execute<{ source: string; sessions: number; visitors: number; voters: number }>(sql`
    WITH s AS (
      SELECT COALESCE(NULLIF(e.props->>'utm_source', ''), NULLIF(e.props->>'referrerHost', ''), 'direct') AS source,
        ${WHO_E} AS who
      FROM ${EV_FROM} WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}
    ),
    vv AS (SELECT DISTINCT ${WHO_V} AS who FROM ${V_FROM} WHERE v.created_at > ${since} AND NOT v.flagged AND ${voteOK})
    SELECT source, count(*)::int AS sessions, count(DISTINCT who)::int AS visitors,
      count(DISTINCT who) FILTER (WHERE who IN (SELECT who FROM vv))::int AS voters
    FROM s GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);

  // Next-day return: of people first seen on a day, how many visited again the next day.
  const retention = await db.execute<{ day: string; new_visitors: number; back_d1: number }>(sql`
    WITH a AS (
      SELECT ${WHO_E} AS who, (e.created_at AT TIME ZONE 'America/New_York')::date AS d
      FROM ${EV_FROM} WHERE e.name IN ('session_start', 'page_view') AND e.created_at > ${since} AND ${notBot}
        AND ${WHO_E} IS NOT NULL
      GROUP BY 1, 2
    ), f AS (SELECT who, min(d) AS first FROM a GROUP BY 1)
    SELECT to_char(f.first, 'MM-DD') AS day, count(*)::int AS new_visitors,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM a WHERE a.who = f.who AND a.d = f.first + 1))::int AS back_d1
    FROM f GROUP BY f.first ORDER BY f.first`);

  const topEngaging = await db.execute<{ slug: string; title: string; score: number; voters: number; returns: number; votes_a: number; votes_b: number; seed: boolean; kind: string }>(sql`
    SELECT b.slug, b.title, b.engagement_score AS score, b.engagement_voters AS voters, b.engagement_returns AS returns,
      b.votes_a, b.votes_b, b.id LIKE 'seed_%' AS seed,
      CASE WHEN count(o.image_url) = 2 THEN 'photo' WHEN count(o.image_url) = 0 THEN 'text' ELSE 'mixed' END AS kind
    FROM battle b LEFT JOIN "option" o ON o.battle_id = b.id
    WHERE b.engagement_voters >= 3 AND b.status <> 'DELETED'
    GROUP BY b.id ORDER BY b.engagement_score DESC LIMIT 15`);

  // Splits on real votes only (≥ 10 real votes): closest to 50/50 and most one-sided.
  const splits = (dir: "ASC" | "DESC") =>
    db.execute<{ slug: string; title: string; a: number; b: number; total: number; gap: number }>(sql`
      SELECT b.slug, b.title,
        count(*) FILTER (WHERE v.side = 'A')::int AS a, count(*) FILTER (WHERE v.side = 'B')::int AS b, count(*)::int AS total,
        abs(count(*) FILTER (WHERE v.side = 'A') - count(*) FILTER (WHERE v.side = 'B'))::float / count(*) AS gap
      FROM battle b JOIN vote v ON v.battle_id = b.id
      WHERE ${voteOK} AND NOT v.flagged AND b.status <> 'DELETED'
      GROUP BY b.id HAVING count(*) >= 10
      ORDER BY gap ${sql.raw(dir)}, count(*) DESC LIMIT 8`);
  const [closest, lopsided] = await Promise.all([splits("ASC"), splits("DESC")]);

  // By AI tag: how each theme / stakes level performs (votes and views in the window).
  const byTag = (key: "theme" | "stakes") =>
    db.execute<{ tag: string; battles: number; real_votes: number; views: number; voted_views: number; score: number | null }>(sql`
      SELECT b.tags->'brain'->>${key} AS tag, count(DISTINCT b.id)::int AS battles,
        COALESCE(sum(rv.n), 0)::int AS real_votes,
        COALESCE(sum(cv.views), 0)::int AS views, COALESCE(sum(cv.voted), 0)::int AS voted_views,
        avg(b.engagement_score) FILTER (WHERE b.engagement_voters >= 3)::float AS score
      FROM battle b
      LEFT JOIN LATERAL (SELECT count(*) AS n FROM vote v WHERE v.battle_id = b.id AND v.created_at > ${since} AND ${voteOK} AND NOT v.flagged) rv ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS views, count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM vote v WHERE v.battle_id = b.id
            AND ((e.user_id IS NOT NULL AND v.user_id = e.user_id) OR (e.device_id IS NOT NULL AND v.device_id = e.device_id))
        )) AS voted
        FROM analytics_event e
        WHERE e.name = 'card_shown' AND e.props->>'battleId' = b.id AND e.created_at > ${since} AND ${notBot}
      ) cv ON true
      WHERE b.tags ? 'brain' AND b.status <> 'DELETED' AND ${battleOK}
      GROUP BY 1 ORDER BY 3 DESC`);
  const [byTheme, byStakes, [untagged]] = await Promise.all([
    byTag("theme"),
    byTag("stakes"),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM battle WHERE status <> 'DELETED' AND NOT (tags ? 'brain')`),
  ]);

  const [daily, visitSources] = await Promise.all([dailyNumbers(scope), visitsBySource(scope)]);

  return { view: scope.view, cleanFrom: scope.cleanFrom, daily, visitSources, byTheme, byStakes, untagged: untagged?.n ?? 0, days, tiles, byKind, votePlaces, depth, methods, sources, retention, topEngaging, closest, lopsided };
}

type Scope = Awaited<ReturnType<typeof brainScope>>;

export type DayRow = { day: string; visitors: number; visits: number; signups: number; votes: number; voters: number; posts: number };

/** Day by day (New York days, newest first): visitors, visits, sign-ups, votes, people who voted, battles posted. */
async function dailyNumbers(scope: Scope): Promise<DayRow[]> {
  const { since, ev, vt, bt, us } = scope;
  const day = (col: SQL) => sql`to_char((${col} AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD')`;
  const rows = await db.execute<DayRow>(sql`
    WITH days AS (
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day
      FROM generate_series((${since}::timestamptz AT TIME ZONE ${TZ})::date, (now() AT TIME ZONE ${TZ})::date, interval '1 day') d
    ),
    s AS (
      SELECT ${day(sql`e.created_at`)} AS day, count(*)::int AS visits, count(DISTINCT ${WHO_E})::int AS visitors
      FROM ${EV_FROM} WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev} GROUP BY 1
    ),
    g AS (
      SELECT ${day(sql`u.onboarded_at`)} AS day, count(*)::int AS signups
      FROM "user" u WHERE u.onboarded_at > ${since} AND ${us} GROUP BY 1
    ),
    v AS (
      SELECT ${day(sql`v.created_at`)} AS day, count(*)::int AS votes, count(DISTINCT ${WHO_V})::int AS voters
      FROM ${V_FROM} WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} GROUP BY 1
    ),
    p AS (
      SELECT ${day(sql`b.created_at`)} AS day, count(*)::int AS posts
      FROM battle b WHERE b.created_at > ${since} AND ${bt} GROUP BY 1
    )
    SELECT days.day, COALESCE(s.visitors, 0) AS visitors, COALESCE(s.visits, 0) AS visits, COALESCE(g.signups, 0) AS signups,
      COALESCE(v.votes, 0) AS votes, COALESCE(v.voters, 0) AS voters, COALESCE(p.posts, 0) AS posts
    FROM days LEFT JOIN s USING (day) LEFT JOIN g USING (day) LEFT JOIN v USING (day) LEFT JOIN p USING (day)
    ORDER BY days.day DESC`);
  return [...rows];
}

export type VisitSourceRow = { source: Source; label: string; visits: number; visitors: number; today: number; yesterday: number; detail: string };

/**
 * Where visits came from, using each visit's own tags (an ad click, utm_source, or the referring site); the same
 * classifier as "Sign-ups by source". `today` / `yesterday` count visitors on those New York days.
 */
async function visitsBySource(scope: Scope): Promise<VisitSourceRow[]> {
  const { since, ev } = scope;
  const rows = await db.execute<{ props: Record<string, unknown>; who: string | null; day: string; today: string; yesterday: string }>(sql`
    SELECT e.props, ${WHO_E} AS who,
      to_char((e.created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day,
      to_char((now() AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS today,
      to_char((now() AT TIME ZONE ${TZ})::date - 1, 'YYYY-MM-DD') AS yesterday
    FROM ${EV_FROM} WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev}
    ORDER BY e.created_at DESC LIMIT 200000`);
  const by = new Map<Source, { visits: number; who: Set<string>; today: Set<string>; yesterday: Set<string>; hosts: Map<string, number> }>();
  for (const r of rows) {
    const p: Record<string, unknown> = { ...(r.props ?? {}), first: undefined };
    const src = classifySource(p);
    const b = by.get(src) ?? { visits: 0, who: new Set(), today: new Set(), yesterday: new Set(), hosts: new Map() };
    b.visits++;
    const who = r.who ?? `anon${b.visits}`;
    b.who.add(who);
    if (r.day === r.today) b.today.add(who);
    if (r.day === r.yesterday) b.yesterday.add(who);
    const tag = String(p.utm_source ?? p.referrerHost ?? (p.twclid ? "twclid" : ""));
    if (tag) b.hosts.set(tag, (b.hosts.get(tag) ?? 0) + 1);
    by.set(src, b);
  }
  return [...by.entries()]
    .map(([source, b]) => ({
      source,
      label: source === "unknown" ? "Unknown" : SOURCE_LABELS[source],
      visits: b.visits,
      visitors: b.who.size,
      today: b.today.size,
      yesterday: b.yesterday.size,
      detail: [...b.hosts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([h, n]) => `${h} (${n})`).join(", "),
    }))
    .sort((a, b) => b.visits - a.visits);
}
