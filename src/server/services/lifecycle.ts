import { and, desc, eq, gt, gte, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "../db";
import { battles, emailLog, options, outcomes, reasonHelpful, users, votes, type Battle } from "../db/schema";
import { getEconomy } from "./config";
import { getFeed } from "./feed";
import { pointsTier } from "./priority";
import { deliver, deliverTo, flushQueued, flushVoterUpdates, queueVoterItem } from "./mailer";
import { emailMilestones, isoWeekKey, localTime, pastHalfway, timeZoneFor } from "./email-rules";

/**
 * When each lifecycle email fires (docs/emails.md). Instant ones are called from API routes with `after()` so the
 * response isn't delayed; the rest run from the hourly and daily jobs (`/api/cron/hourly`, `/api/cron/daily`).
 */

async function labels(battleId: string) {
  const opts = await db.select({ side: options.side, label: options.label }).from(options).where(eq(options.battleId, battleId));
  return { labelA: opts.find((o) => o.side === "A")?.label ?? "A", labelB: opts.find((o) => o.side === "B")?.label ?? "B" };
}

async function topReasons(battleId: string, n: number) {
  const rows = await db
    .select({ text: votes.reason, helpful: sql<number>`(SELECT count(*)::int FROM reason_helpful rh WHERE rh.vote_id = ${votes.id})` })
    .from(votes)
    .where(and(eq(votes.battleId, battleId), isNotNull(votes.reason), eq(votes.reasonHidden, false)))
    .orderBy(desc(sql`(SELECT count(*) FROM reason_helpful rh WHERE rh.vote_id = ${votes.id})`), desc(votes.createdAt))
    .limit(n);
  return rows.map((r) => r.text!).filter(Boolean);
}

const publicTitle = (b: Battle) => b.title;

// ---------------- Instant ----------------

/** E1: right after publishing. */
export async function emailBattleLive(slug: string) {
  const [row] = await db.select({ b: battles, u: users }).from(battles).innerJoin(users, eq(users.id, battles.authorId)).where(eq(battles.slug, slug));
  if (!row) return;
  await deliver(row.u, "battle_live", row.b.id, { title: publicTitle(row.b), slug: row.b.slug });
}

/** E2: after a new vote, if the total just hit a milestone (max one per battle per `emailMilestoneGapHours`). */
export async function emailVoteMilestone(slug: string) {
  const [row] = await db.select({ b: battles, u: users }).from(battles).innerJoin(users, eq(users.id, battles.authorId)).where(eq(battles.slug, slug));
  if (!row || !row.u.email) return;
  const e = await getEconomy();
  const total = row.b.votesA + row.b.votesB;
  if (!emailMilestones(e).includes(total)) return;
  const since = new Date(Date.now() - e.emailMilestoneGapHours * 3600_000);
  const [recent] = await db
    .select({ id: emailLog.id })
    .from(emailLog)
    .where(and(eq(emailLog.userId, row.u.id), eq(emailLog.kind, "vote_milestone"), sql`${emailLog.ref} LIKE ${`${row.b.id}:%`}`, eq(emailLog.status, "SENT"), gte(emailLog.sentAt, since)));
  if (recent) return;
  await deliver(row.u, "vote_milestone", `${row.b.id}:${total}`, {
    title: publicTitle(row.b),
    slug: row.b.slug,
    n: total,
    ...(await labels(row.b.id)),
    votesA: row.b.votesA,
    votesB: row.b.votesB,
    topReason: (await topReasons(row.b.id, 1))[0] ?? null,
  });
}

/** E8: once, when sign-up finishes. */
export async function emailWelcome(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (u) await deliver(u, "welcome", "once", { name: u.name || u.handle || "there" });
}

/** Message request: someone who follows you wants to message you (no message text in the email). */
export async function emailDmRequest(toUserId: string, from: { name: string | null; handle: string | null }) {
  if (!from.handle) return;
  await deliverTo(toUserId, "dm_request", `from:${from.handle}`, { name: from.name || `@${from.handle}`, handle: from.handle });
}

/** E6: queue "how it turned out" for every signed-in voter (sent batched by the hourly job). */
export async function queueOutcomeEmails(slug: string) {
  const [row] = await db
    .select({ b: battles, o: outcomes, poster: users })
    .from(battles)
    .innerJoin(outcomes, eq(outcomes.battleId, battles.id))
    .innerJoin(users, eq(users.id, battles.authorId))
    .where(eq(battles.slug, slug));
  if (!row) return;
  const e = await getEconomy();
  const { labelA, labelB } = await labels(row.b.id);
  const picked = row.o.chosen === "A" ? labelA : row.o.chosen === "B" ? labelB : null;
  const voters = await db
    .select({ userId: votes.userId, side: votes.side })
    .from(votes)
    .innerJoin(users, eq(users.id, votes.userId))
    .where(and(eq(votes.battleId, row.b.id), isNotNull(votes.userId), isNotNull(users.email)));
  for (const v of voters) {
    const calledIt = row.o.thumb === "UP" && v.side === row.o.chosen;
    await queueVoterItem(v.userId!, `outcome:${row.b.id}`, {
      type: "outcome",
      data: {
        title: publicTitle(row.b),
        slug: row.b.slug,
        poster: row.poster.name || `@${row.poster.handle}`,
        picked,
        thumb: row.o.thumb,
        calledIt,
        points: calledIt ? e.calledItPoints : 0,
        note: row.o.note,
      },
    });
  }
}

/** E7: the poster marked someone's reason helpful. */
export async function queueHelpfulEmail(voteId: string) {
  const [row] = await db
    .select({ userId: votes.userId, b: battles })
    .from(votes)
    .innerJoin(battles, eq(battles.id, votes.battleId))
    .innerJoin(reasonHelpful, and(eq(reasonHelpful.voteId, votes.id), eq(reasonHelpful.isOwner, true)))
    .where(eq(votes.id, voteId));
  if (!row?.userId) return;
  const e = await getEconomy();
  await queueVoterItem(row.userId, `helpful:${voteId}`, { type: "helpful", data: { title: publicTitle(row.b), slug: row.b.slug, points: e.ownerHelpfulPoints } });
}

// ---------------- Hourly ----------------

const hasEmail = and(isNotNull(users.email), isNull(users.bannedAt));

/** E4: at the deadline — results + one-tap "which did you pick?". Replaces the old +2h reminder email. */
async function resultsIn(now: Date) {
  const rows = await db
    .select({ b: battles, u: users })
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(
      and(
        hasEmail,
        isNull(outcomes.id),
        lt(battles.deadline, now),
        gt(battles.deadline, new Date(now.getTime() - 48 * 3600_000)),
        notInArray(battles.status, ["DELETED", "HIDDEN"]),
        gt(sql`${battles.votesA} + ${battles.votesB}`, 0),
      ),
    )
    .limit(300);
  let n = 0;
  for (const { b, u } of rows) {
    const r = await deliver(u, "results_in", b.id, { title: b.title, slug: b.slug, ...(await labels(b.id)), votesA: b.votesA, votesB: b.votesB, reasons: await topReasons(b.id, 3) }, { now });
    if (r === "sent") n++;
  }
  return n;
}

/** E3: halfway through with few votes. */
async function needsVotes(now: Date) {
  const e = await getEconomy();
  const rows = await db
    .select({ b: battles, u: users })
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .where(
      and(
        hasEmail,
        eq(battles.status, "OPEN"),
        gt(battles.deadline, now),
        gt(battles.createdAt, new Date(now.getTime() - 7 * 86400_000)),
        lt(sql`${battles.votesA} + ${battles.votesB}`, e.emailNeedsVotesUnder),
      ),
    )
    .limit(300);
  let n = 0;
  for (const { b, u } of rows) {
    if (!pastHalfway(b.createdAt, b.deadline, now)) continue;
    if ((await deliver(u, "needs_votes", b.id, { title: b.title, slug: b.slug, votes: b.votesA + b.votesB }, { now })) === "sent") n++;
  }
  return n;
}

/** E10: someone crossed into High or Top priority in the last ~day (judged from the points ledger, so people who were
 * already there when this shipped don't get a "you just reached" email). Once per tier per person. */
async function tierUps(now: Date) {
  const e = await getEconomy();
  const since = new Date(now.getTime() - 25 * 3600_000).toISOString();
  const rows = await db
    .select({ u: users, gained: sql<number>`(SELECT coalesce(sum(delta), 0)::int FROM point_ledger pl WHERE pl.user_id = ${users.id} AND pl.created_at > ${since})` })
    .from(users)
    .where(and(hasEmail, isNotNull(users.onboardedAt), gte(users.ppBalance, e.tierHighAt)))
    .limit(500);
  let n = 0;
  for (const { u, gained } of rows) {
    const tier = pointsTier(u.ppBalance, e.tierHighAt, e.tierTopAt).tier;
    if (tier === "Normal") continue;
    const threshold = tier === "Top" ? e.tierTopAt : e.tierHighAt;
    if (u.ppBalance - gained >= threshold) continue; // was already in this tier a day ago
    if ((await deliver(u, "tier_up", tier, { tier }, { now })) === "sent") n++;
  }
  return n;
}

/** E12: Sunday 9 am local (config), once per ISO week, skipped when there's nothing to show. */
async function weeklyRoundups(now: Date) {
  const e = await getEconomy();
  const week = isoWeekKey(now);
  const rows = await db
    .select()
    .from(users)
    .where(and(hasEmail, isNotNull(users.onboardedAt), gt(users.lastActiveAt, new Date(now.getTime() - 60 * 86400_000))))
    .limit(2000);
  let n = 0;
  for (const u of rows) {
    const t = localTime(now, timeZoneFor(u.country, u.region));
    if (t.weekday !== e.emailWeeklyDay || t.hour !== e.emailWeeklyHour) continue;
    const [feed, done] = await Promise.all([
      getFeed({ user: u, deviceId: null }, { limit: 4 }),
      db
        .select({ b: battles, o: outcomes, side: votes.side })
        .from(votes)
        .innerJoin(battles, eq(battles.id, votes.battleId))
        .innerJoin(outcomes, eq(outcomes.battleId, battles.id))
        .where(and(eq(votes.userId, u.id), gt(outcomes.reportedAt, new Date(now.getTime() - 7 * 86400_000))))
        .limit(3),
    ]);
    const outcomesList = await Promise.all(
      done.map(async (d) => {
        const l = await labels(d.b.id);
        const picked = d.o.chosen === "A" ? l.labelA : d.o.chosen === "B" ? l.labelB : "neither";
        const called = d.o.thumb === "UP" && d.side === d.o.chosen;
        return { title: d.b.title, slug: d.b.slug, sub: `They picked ${picked}${called ? " — you called it!" : ""}` };
      }),
    );
    if (!feed.length && !outcomesList.length) continue;
    const tier = pointsTier(u.ppBalance, e.tierHighAt, e.tierTopAt);
    const res = await deliver(
      u,
      "weekly",
      week,
      {
        battles: feed.map((b) => ({ title: b.title, slug: b.slug, sub: `${b.votesA + b.votesB} votes so far` })),
        outcomes: outcomesList,
        points: u.ppBalance,
        tierLine: tier.next ? `${tier.toNext} ⚡ to ${tier.next} priority` : "Top priority",
      },
      { now },
    );
    if (res === "sent") n++;
  }
  return n;
}

export async function runHourlyEmails(now = new Date()) {
  return {
    resultsIn: await resultsIn(now),
    needsVotes: await needsVotes(now),
    voterUpdates: await flushVoterUpdates(now),
    queued: await flushQueued(now),
    tierUp: await tierUps(now),
    weekly: await weeklyRoundups(now),
  };
}

// ---------------- Daily ----------------

async function openExamples(limit: number) {
  const rows = await db
    .select({ title: battles.title, slug: battles.slug })
    .from(battles)
    .where(and(eq(battles.status, "OPEN"), eq(battles.visibility, "PUBLIC"), gt(battles.deadline, new Date())))
    .orderBy(desc(sql`${battles.votesA} + ${battles.votesB}`))
    .limit(limit);
  return rows;
}

/** E9: day 3 after sign-up with no battle posted. */
async function firstBattleNudges(now: Date) {
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        hasEmail,
        isNotNull(users.onboardedAt),
        lt(users.createdAt, new Date(now.getTime() - 3 * 86400_000)),
        gt(users.createdAt, new Date(now.getTime() - 5 * 86400_000)),
        sql`NOT EXISTS (SELECT 1 FROM battle b WHERE b.author_id = ${users.id})`,
      ),
    )
    .limit(500);
  if (!rows.length) return 0;
  const examples = await openExamples(3);
  let n = 0;
  for (const u of rows) if ((await deliver(u, "first_battle_nudge", "once", { examples }, { now })) === "sent") n++;
  return n;
}

export async function runDailyEmails(now = new Date()) {
  // Win-back emails are Alex's data-brain version (services/winback.ts, H16), run by the daily cron.
  return { firstBattle: await firstBattleNudges(now) };
}

/** E5: close-the-loop reminder emails (the in-app reminders run in `sendReminders`). */
export async function emailLoopReminder(battleId: string, n: number) {
  const [row] = await db.select({ b: battles, u: users }).from(battles).innerJoin(users, eq(users.id, battles.authorId)).where(eq(battles.id, battleId));
  if (!row) return;
  await deliver(row.u, "loop_reminder", `${battleId}:${n}`, { title: row.b.title, slug: row.b.slug, ...(await labels(battleId)), n });
}

