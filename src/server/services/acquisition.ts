import { sql } from "drizzle-orm";
import { db } from "../db";
import { getEconomy } from "./config";
import { classifySource, isEngaged, SOURCE_LABELS, type Source } from "./acquisition-rules";

export type SourceRow = {
  source: Source;
  label: string;
  signups: number;
  engaged: number;
  /** Signed up long enough ago to have had the full engagement window. */
  matured: number;
  engagedMatured: number;
  avgVotes: number;
  postedPct: number;
  active7: number;
};

/**
 * Sign-ups in the last `days`, split by where each person first came from (X campaign vs organic etc.), and how many
 * became engaged. Real accounts only (email, not banned). First visit = the earliest `session_start` on the account or
 * any browser linked to it; that event's `first` (the browser's very first visit) wins when present.
 */
export async function signupSources(days = 30) {
  const e = await getEconomy();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const windowDays = e.engagedWindowDays;
  const rows = await db.execute<{
    id: string;
    signed_up: string;
    touch: Record<string, unknown> | null;
    vote_days: number;
    votes: number;
    posted: boolean;
    active7: boolean;
  }>(sql`
    SELECT u.id, u.onboarded_at AS signed_up,
      ft.props AS touch,
      (SELECT count(DISTINCT v.created_at::date)::int FROM vote v
        WHERE v.user_id = u.id AND v.created_at < u.onboarded_at + make_interval(days => ${windowDays})) AS vote_days,
      (SELECT count(*)::int FROM vote v
        WHERE v.user_id = u.id AND v.created_at < u.onboarded_at + make_interval(days => ${windowDays})) AS votes,
      EXISTS (SELECT 1 FROM battle b WHERE b.author_id = u.id AND b.id NOT LIKE 'seed_%'
        AND b.created_at < u.onboarded_at + make_interval(days => ${windowDays})) AS posted,
      EXISTS (SELECT 1 FROM vote v WHERE v.user_id = u.id AND v.created_at > now() - interval '7 days') AS active7
    FROM "user" u
    LEFT JOIN LATERAL (
      SELECT e.props FROM analytics_event e
      WHERE e.name = 'session_start'
        AND COALESCE((e.props->>'bot')::boolean, false) = false
        AND (e.user_id = u.id OR e.device_id IN (SELECT d.id FROM device d WHERE d.user_id = u.id))
      ORDER BY e.created_at ASC LIMIT 1
    ) ft ON true
    WHERE u.onboarded_at > ${since} AND u.email IS NOT NULL AND u.banned_at IS NULL`);

  const now = Date.now();
  const by = new Map<Source, SourceRow>();
  for (const r of rows) {
    const source = classifySource(r.touch);
    const row =
      by.get(source) ??
      ({ source, label: SOURCE_LABELS[source], signups: 0, engaged: 0, matured: 0, engagedMatured: 0, avgVotes: 0, postedPct: 0, active7: 0 } as SourceRow);
    const engaged = isEngaged({ voteDays: r.vote_days, postedBattle: r.posted }, e.engagedMinVoteDays);
    const matured = now - new Date(r.signed_up).getTime() >= windowDays * 86400_000;
    row.signups++;
    row.engaged += engaged ? 1 : 0;
    row.matured += matured ? 1 : 0;
    row.engagedMatured += matured && engaged ? 1 : 0;
    row.avgVotes += r.votes;
    row.postedPct += r.posted ? 1 : 0;
    row.active7 += r.active7 ? 1 : 0;
    by.set(source, row);
  }
  const order: Source[] = ["x_campaign", "x_organic", "direct", "referral", "other_campaign", "unknown"];
  const list = order.filter((s) => by.has(s)).map((s) => {
    const r = by.get(s)!;
    return { ...r, avgVotes: r.signups ? r.avgVotes / r.signups : 0, postedPct: r.signups ? r.postedPct / r.signups : 0 };
  });
  const total = list.reduce(
    (t, r) => ({ signups: t.signups + r.signups, engaged: t.engaged + r.engaged, active7: t.active7 + r.active7 }),
    { signups: 0, engaged: 0, active7: 0 },
  );
  // Engaged users overall (any sign-up date): voted on minDays+ different days in the last 30 days, or posted a battle in them.
  const [overall] = await db.execute<{ engaged30: number; active7: number; accounts: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM (
        SELECT v.user_id AS id FROM vote v JOIN "user" u ON u.id = v.user_id
        WHERE v.created_at > now() - interval '30 days' AND u.email IS NOT NULL AND u.banned_at IS NULL
        GROUP BY v.user_id HAVING count(DISTINCT v.created_at::date) >= ${e.engagedMinVoteDays}
        UNION
        SELECT b.author_id FROM battle b JOIN "user" u ON u.id = b.author_id
        WHERE b.created_at > now() - interval '30 days' AND b.id NOT LIKE 'seed_%' AND u.email IS NOT NULL AND u.banned_at IS NULL
      ) x) AS engaged30,
      (SELECT count(DISTINCT v.user_id)::int FROM vote v JOIN "user" u ON u.id = v.user_id
        WHERE v.created_at > now() - interval '7 days' AND u.email IS NOT NULL) AS active7,
      (SELECT count(*)::int FROM "user" u WHERE u.onboarded_at IS NOT NULL AND u.email IS NOT NULL AND u.banned_at IS NULL) AS accounts`);
  return { days, windowDays, minVoteDays: e.engagedMinVoteDays, rows: list, total, overall };
}
