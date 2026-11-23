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
 *   No seed votes or seed battles, no email-less (seed / "post as") accounts, no admins or their browsers, no bots.
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
    vt: sql`COALESCE(v.source, '') <> 'seed' AND v.battle_id NOT LIKE 'seed_%' AND v.created_at >= ${cleanFrom}
      AND ${notIn(sql`v.user_id`, ids)} AND ${notIn(sql`v.device_id`, devs)} AND ${realUser(sql`v.user_id`)}`,
    bt: sql`b.id NOT LIKE 'seed_%' AND b.created_at >= ${cleanFrom} AND ${notIn(sql`b.author_id`, ids)} AND ${realUser(sql`b.author_id`)}`,
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

  const [tiles] = await db.execute<Record<string, number | null>>(sql`
    SELECT
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}) AS sessions,
      (SELECT count(DISTINCT COALESCE(e.user_id, e.device_id))::int FROM analytics_event e WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}) AS visitors,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${notBot}) AS views,
      (SELECT count(*)::int FROM vote v WHERE v.created_at > ${since} AND ${voteOK} AND NOT v.flagged) AS real_votes,
      (SELECT count(*)::int FROM vote v WHERE v.created_at > ${since} AND v.source = 'feed' AND NOT v.flagged AND ${voteOK}) AS deck_votes,
      (SELECT count(*)::int FROM vote v WHERE v.source = 'seed') AS seed_votes_all,
      (SELECT count(*)::int FROM skip s WHERE s.created_at > ${since} AND s.battle_id NOT LIKE ${view === "clean" ? "seed_%" : ""}) AS skips,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'signup_gate_shown' AND e.created_at > ${since} AND ${notBot}) AS gates,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'onboarding_completed' AND e.created_at > ${since} AND ${notBot}) AS signups,
      (SELECT count(*)::int FROM analytics_event e WHERE e.name = 'vote_changed' AND e.created_at > ${since} AND ${notBot}) AS changed,
      (SELECT count(*)::int FROM battle b WHERE b.created_at > ${since} AND ${battleOK}) AS real_battles,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v.dwell_ms)::float FROM vote v WHERE v.created_at > ${since} AND v.source = 'feed' AND v.dwell_ms IS NOT NULL AND ${voteOK}) AS median_pick_ms
  `);

  // Text vs photo: a view converts when the same person (user or device) voted on that battle.
  const byKind = await db.execute<{ kind: string; views: number; voted: number; median_ms: number | null }>(sql`
    SELECT e.props->>'kind' AS kind, count(*)::int AS views,
      count(v.id)::int AS voted,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY v.dwell_ms)::float AS median_ms
    FROM analytics_event e
    LEFT JOIN LATERAL (
      SELECT v.id, v.dwell_ms FROM vote v
      WHERE v.battle_id = e.props->>'battleId'
        AND ((e.user_id IS NOT NULL AND v.user_id = e.user_id) OR (e.device_id IS NOT NULL AND v.device_id = e.device_id))
      LIMIT 1
    ) v ON true
    WHERE e.name = 'card_shown' AND e.created_at > ${since} AND ${notBot}
    GROUP BY 1 ORDER BY 2 DESC`);

  // How deep people go into the deck.
  const depth = await db.execute<{ bucket: string; views: number }>(sql`
    SELECT CASE WHEN p <= 5 THEN '1–5' WHEN p <= 10 THEN '6–10' WHEN p <= 20 THEN '11–20' WHEN p <= 50 THEN '21–50' ELSE '50+' END AS bucket,
      count(*)::int AS views, min(p) AS o
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
        COALESCE(e.user_id, e.device_id) AS who, e.user_id, e.device_id
      FROM analytics_event e WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${notBot}
    )
    SELECT source, count(*)::int AS sessions, count(DISTINCT who)::int AS visitors,
      count(DISTINCT who) FILTER (WHERE EXISTS (
        SELECT 1 FROM vote v WHERE v.created_at > ${since} AND ${voteOK}
          AND ((s.user_id IS NOT NULL AND v.user_id = s.user_id) OR (s.device_id IS NOT NULL AND v.device_id = s.device_id))
      ))::int AS voters
    FROM s GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);

  // Next-day return: of people first seen on a day, how many visited again the next day.
  const retention = await db.execute<{ day: string; new_visitors: number; back_d1: number }>(sql`
    WITH a AS (
      SELECT COALESCE(e.user_id, e.device_id) AS who, (e.created_at AT TIME ZONE 'America/New_York')::date AS d
      FROM analytics_event e WHERE e.name IN ('session_start', 'page_view') AND e.created_at > ${since} AND ${notBot}
        AND COALESCE(e.user_id, e.device_id) IS NOT NULL
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
    WHERE b.engagement_voters >= 3 AND b.status <> 'DELETED' AND ${battleOK}
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

  // By AI tag: how each theme / stakes level performs (all-time votes, views in the window).
  const byTag = (key: "theme" | "stakes") =>
    db.execute<{ tag: string; battles: number; real_votes: number; views: number; voted_views: number; score: number | null }>(sql`
      SELECT b.tags->'brain'->>${key} AS tag, count(DISTINCT b.id)::int AS battles,
        COALESCE(sum(rv.n), 0)::int AS real_votes,
        COALESCE(sum(cv.views), 0)::int AS views, COALESCE(sum(cv.voted), 0)::int AS voted_views,
        avg(b.engagement_score) FILTER (WHERE b.engagement_voters >= 3)::float AS score
      FROM battle b
      LEFT JOIN LATERAL (SELECT count(*) AS n FROM vote v WHERE v.battle_id = b.id AND ${voteOK} AND NOT v.flagged) rv ON true
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

  return { view: scope.view, cleanFrom: scope.cleanFrom, daily, visitSources, byTheme, byStakes, untagged: untagged?.n ?? 0, days, tiles, byKind, depth, methods, sources, retention, topEngaging, closest, lopsided };
}

type Scope = Awaited<ReturnType<typeof brainScope>>;

export type DayRow = { day: string; visitors: number; visits: number; signups: number; votes: number; voters: number; posts: number };

/** Day by day (New York days, newest first): visitors, visits, sign-ups, votes, people who voted, battles posted. */
async function dailyNumbers(scope: Scope): Promise<DayRow[]> {
  const { since, ev, vt, bt } = scope;
  const day = (col: SQL) => sql`to_char((${col} AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD')`;
  const rows = await db.execute<DayRow>(sql`
    WITH days AS (
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day
      FROM generate_series((${since}::timestamptz AT TIME ZONE ${TZ})::date, (now() AT TIME ZONE ${TZ})::date, interval '1 day') d
    ),
    s AS (
      SELECT ${day(sql`e.created_at`)} AS day, count(*)::int AS visits, count(DISTINCT COALESCE(e.user_id, e.device_id))::int AS visitors
      FROM analytics_event e WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev} GROUP BY 1
    ),
    g AS (
      SELECT ${day(sql`e.created_at`)} AS day, count(*)::int AS signups
      FROM analytics_event e WHERE e.name = 'onboarding_completed' AND e.created_at > ${since} AND ${ev} GROUP BY 1
    ),
    v AS (
      SELECT ${day(sql`v.created_at`)} AS day, count(*)::int AS votes, count(DISTINCT COALESCE(v.user_id, v.device_id))::int AS voters
      FROM vote v WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt} GROUP BY 1
    ),
    p AS (
      SELECT ${day(sql`b.created_at`)} AS day, count(*)::int AS posts
      FROM battle b WHERE b.created_at > ${since} AND b.status <> 'DELETED' AND ${bt} GROUP BY 1
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
    SELECT e.props, COALESCE(e.user_id, e.device_id) AS who,
      to_char((e.created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day,
      to_char((now() AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS today,
      to_char((now() AT TIME ZONE ${TZ})::date - 1, 'YYYY-MM-DD') AS yesterday
    FROM analytics_event e WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev}
    ORDER BY e.created_at DESC LIMIT 50000`);
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
