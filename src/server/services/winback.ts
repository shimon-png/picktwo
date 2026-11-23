/**
 * Data brain Phase 4: win back people who are drifting away (docs/brain/). Daily, find signed-in people
 * who have been away clearly longer than their own usual gap, pick 3 open battles for them from the same
 * ranking as their Vote deck (targeting, taste and engagement score included), and email them.
 * `winbackHoldoutPct` of lapsing people get no email, so the Brain page can compare who came back.
 * Off until the economy setting `winbackEmails` is 1. Rules in `winback-rules.ts` (pure, tested).
 */
import { inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { analyticsEvents, users } from "../db/schema";
import { getEconomy } from "./config";
import { getFeed } from "./feed";
import { inHoldout } from "./ranking";
import { isLapsing, WINBACK_UTM } from "./winback-rules";
import { ENGAGEMENT_TZ } from "./engagement-rules";
import { sendEmail, winbackEmail } from "../email";
import { appUrl } from "@/lib/utils";

const HISTORY_DAYS = 60;

type Candidate = { id: string; email: string; days: number[]; today: number };

/** Signed-in people with email on, not banned, whose last real vote falls in the lapse window and who had no win-back lately. */
async function candidates(e: { min: number; max: number; cooldown: number; limit: number }): Promise<Candidate[]> {
  const now = Date.now();
  const since = new Date(now - HISTORY_DAYS * 86400_000).toISOString();
  const newest = new Date(now - e.min * 86400_000).toISOString();
  const oldest = new Date(now - (e.max + 1) * 86400_000).toISOString();
  const cool = new Date(now - e.cooldown * 86400_000).toISOString();
  const rows = await db.execute<{ id: string; email: string; days: number[]; today: number }>(sql`
    SELECT u.id, u.email,
      array_agg(DISTINCT ((v.created_at AT TIME ZONE ${ENGAGEMENT_TZ})::date - DATE '2000-01-01')) AS days,
      ((now() AT TIME ZONE ${ENGAGEMENT_TZ})::date - DATE '2000-01-01') AS today
    FROM "user" u JOIN vote v ON v.user_id = u.id
    WHERE u.email IS NOT NULL AND u.notify_email AND u.banned_at IS NULL
      AND v.created_at > ${since} AND COALESCE(v.source, '') <> 'seed'
      AND NOT EXISTS (
        SELECT 1 FROM analytics_event a
        WHERE a.user_id = u.id AND a.name IN ('winback_sent', 'winback_holdout') AND a.created_at > ${cool}
      )
    GROUP BY u.id
    HAVING max(v.created_at) < ${newest} AND max(v.created_at) > ${oldest}
    LIMIT ${e.limit * 3}`);
  return rows.map((r) => ({ ...r, days: (r.days ?? []).map(Number), today: Number(r.today) }));
}

export async function sendWinbacks(opts: { dryRun?: boolean } = {}) {
  const e = await getEconomy();
  if (!e.winbackEmails && !opts.dryRun) return { enabled: false };
  const list = await candidates({ min: e.winbackMinIdleDays, max: e.winbackMaxIdleDays, cooldown: e.winbackCooldownDays, limit: e.winbackDailyMax });
  const lapsing = list
    .map((c) => ({ c, l: isLapsing({ activeDays: c.days, today: c.today, minIdle: e.winbackMinIdleDays, maxIdle: e.winbackMaxIdleDays }) }))
    .filter((x) => x.l.lapsing)
    .slice(0, e.winbackDailyMax);
  if (opts.dryRun) return { enabled: !!e.winbackEmails, lapsing: lapsing.length };

  const full = lapsing.length ? await db.select().from(users).where(inArray(users.id, lapsing.map((x) => x.c.id))) : [];
  const byId = new Map(full.map((u) => [u.id, u]));
  let sent = 0, held = 0, empty = 0;
  for (const { c, l } of lapsing) {
    const user = byId.get(c.id);
    if (!user) continue;
    const facts = { idleDays: l.idleDays, usualGap: l.usualGap, threshold: l.threshold };
    if (inHoldout(`winback:${c.id}`, e.winbackHoldoutPct)) {
      await db.insert(analyticsEvents).values({ name: "winback_holdout", userId: c.id, props: facts });
      held++;
      continue;
    }
    const feed = await getFeed({ user, deviceId: null }, { limit: 8 });
    const picks = feed.filter((b) => b.votesA + b.votesB > 0).concat(feed.filter((b) => b.votesA + b.votesB === 0)).slice(0, 3);
    if (!picks.length) {
      empty++;
      continue;
    }
    await sendEmail({
      to: c.email,
      ...winbackEmail(picks.map((b) => ({ title: b.title, votes: b.votesA + b.votesB, url: appUrl(`/b/${b.slug}?${WINBACK_UTM}`) }))),
    });
    await db.insert(analyticsEvents).values({ name: "winback_sent", userId: c.id, props: { ...facts, battleIds: picks.map((b) => b.id) } });
    sent++;
  }
  return { enabled: true, lapsing: lapsing.length, sent, held, empty };
}

/** For the Brain page: lapsing now, and who came back (voted) within 3 days of a win-back vs the holdout. */
export async function winbackStats() {
  const e = await getEconomy();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const rows = await db.execute<{ arm: string; people: number; back3: number }>(sql`
    SELECT CASE WHEN a.name = 'winback_sent' THEN 'email' ELSE 'holdout' END AS arm,
      count(*)::int AS people,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM vote v WHERE v.user_id = a.user_id AND v.created_at > a.created_at
          AND v.created_at < a.created_at + interval '3 days'
      ))::int AS back3
    FROM analytics_event a
    WHERE a.name IN ('winback_sent', 'winback_holdout') AND a.created_at > ${since}
    GROUP BY 1`);
  const dry = await sendWinbacks({ dryRun: true });
  return { enabled: !!e.winbackEmails, holdoutPct: e.winbackHoldoutPct, lapsingNow: "lapsing" in dry ? (dry.lapsing ?? 0) : 0, arms: rows };
}
