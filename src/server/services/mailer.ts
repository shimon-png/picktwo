import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { emailLog, users, type User } from "../db/schema";
import { sendEmail } from "../email";
import * as T from "../email-templates";
import { track } from "../analytics";
import { appUrl } from "@/lib/utils";
import { getEconomy } from "./config";
import {
  EMAIL_KINDS,
  capBlock,
  groupEnabled,
  inQuietHours,
  localTime,
  needsAddress,
  nextLocalHour,
  timeZoneFor,
  withUtm,
  type EmailGroup,
  type EmailKind,
} from "./email-rules";

/**
 * Every lifecycle email goes through `deliver()`: preferences → postal-address rule → once-only log → quiet hours →
 * "they're in the app right now" skip → caps/budget → send with one-click unsubscribe → `email_sent` event.
 * Sign-in codes don't come through here (they must always send).
 */

/** Data each email kind needs; stored as the payload when an email waits for quiet hours to end. */
export type EmailData = {
  battle_live: { title: string; slug: string };
  vote_milestone: { title: string; slug: string; n: number; labelA: string; labelB: string; votesA: number; votesB: number; topReason: string | null };
  needs_votes: { title: string; slug: string; votes: number };
  results_in: { title: string; slug: string; labelA: string; labelB: string; votesA: number; votesB: number; reasons: string[] };
  pickbot_results: { threadId: string; title: string; labelA: string; labelB: string; votesA: number; votesB: number; agreed: boolean | null };
  loop_reminder: { title: string; slug: string; labelA: string; labelB: string; n: number };
  voter_updates: { outcomes: (Omit<T.VoterOutcome, "url"> & { slug: string })[]; helpful: (Omit<T.HelpfulItem, "url"> & { slug: string })[]; results?: (Omit<T.FinalResult, "url"> & { slug: string })[] };
  welcome: { name: string };
  first_battle_nudge: { examples: { title: string; slug: string }[] };
  tier_up: { tier: string };
  weekly: {
    battles: { title: string; slug: string; sub: string }[];
    outcomes: { title: string; slug: string; sub: string }[];
    points: number;
    tierLine: string;
  };
  dm_request: { name: string; handle: string };
};

const WHY: Record<EmailGroup, string> = {
  battles: "You're getting this because you posted a battle on crowdpick.",
  voted: "You're getting this because you voted on this battle on crowdpick.",
  weekly: "You're getting the weekly roundup because you use crowdpick.",
  tips: "You're getting this because you have a crowdpick account.",
  messages: "You're getting this because someone who follows you wants to message you on crowdpick.",
  always: "You're getting this because you just created a crowdpick account.",
};

async function render<K extends EmailKind>(kind: K, d: EmailData[K]): Promise<T.Built> {
  const e = await getEconomy();
  const link = (path: string) => withUtm(appUrl(path), kind);
  switch (kind) {
    case "battle_live": {
      const x = d as EmailData["battle_live"];
      return T.battleLive({ title: x.title, url: link(`/b/${x.slug}`), shareText: `Help me choose: ${x.title}` });
    }
    case "vote_milestone": {
      const x = d as EmailData["vote_milestone"];
      return T.voteMilestone({ ...x, url: link(`/b/${x.slug}`) });
    }
    case "needs_votes": {
      const x = d as EmailData["needs_votes"];
      return T.needsVotes({ ...x, url: link(`/b/${x.slug}`) });
    }
    case "results_in": {
      const x = d as EmailData["results_in"];
      return T.resultsIn({ ...x, reportUrl: link(`/b/${x.slug}/report`), loopPoints: e.loopClosedPoints });
    }
    case "loop_reminder": {
      const x = d as EmailData["loop_reminder"];
      return T.loopReminder({ ...x, reportUrl: link(`/b/${x.slug}/report`), loopPoints: e.loopClosedPoints });
    }
    case "voter_updates": {
      const x = d as EmailData["voter_updates"];
      return T.voterUpdates({
        outcomes: x.outcomes.map((o) => ({ ...o, url: link(`/b/${o.slug}`) })),
        helpful: x.helpful.map((h) => ({ ...h, url: link(`/b/${h.slug}`) })),
        results: (x.results ?? []).map((r) => ({ ...r, url: link(`/b/${r.slug}`) })),
        voteUrl: link("/vote"),
      });
    }
    case "welcome": {
      const x = d as EmailData["welcome"];
      return T.welcome({ name: x.name, voteUrl: link("/vote"), postUrl: link("/post"), loopPoints: e.loopClosedPoints });
    }
    case "first_battle_nudge": {
      const x = d as EmailData["first_battle_nudge"];
      return T.firstBattleNudge({ postUrl: link("/post"), examples: x.examples.map((b) => ({ title: b.title, url: link(`/b/${b.slug}`) })) });
    }
    case "tier_up":
      return T.tierUp({ tier: (d as EmailData["tier_up"]).tier, postUrl: link("/post") });
    case "weekly": {
      const x = d as EmailData["weekly"];
      return T.weekly({
        ...x,
        voteUrl: link("/vote"),
        battles: x.battles.map((b) => ({ ...b, url: link(`/b/${b.slug}`) })),
        outcomes: x.outcomes.map((b) => ({ ...b, url: link(`/b/${b.slug}`) })),
      });
    }
    case "pickbot_results": {
      const x = d as EmailData["pickbot_results"];
      return T.pickbotResults({ ...x, url: link(`/ask/${x.threadId}`) });
    }
    case "dm_request": {
      const x = d as EmailData["dm_request"];
      return T.dmRequest({ name: x.name, url: link(`/messages/${x.handle}`) });
    }
  }
  throw new Error(`Unknown email kind ${kind}`);
}

// ---------------- Unsubscribe ----------------

function sign(userId: string, group: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "dev").update(`unsub:${userId}:${group}`).digest("base64url").slice(0, 24);
}

export function unsubscribeUrl(userId: string, group: EmailGroup, api = false) {
  const q = `u=${encodeURIComponent(userId)}&g=${group}&t=${sign(userId, group)}`;
  return appUrl(api ? `/api/email/unsubscribe?${q}` : `/email/unsubscribe?${q}`);
}

export function verifyUnsubscribe(userId: string, group: string, token: string) {
  const want = Buffer.from(sign(userId, group));
  const got = Buffer.from(token || "");
  return want.length === got.length && timingSafeEqual(want, got);
}

export type UnsubGroup = Exclude<EmailGroup, "always">;
export const UNSUB_GROUPS: UnsubGroup[] = ["battles", "voted", "weekly", "tips", "messages"];

/** Turn one email group off (or on) for a user. "battles" is the notifyEmail column. */
export async function setEmailGroup(userId: string, group: UnsubGroup, on: boolean) {
  if (group === "battles") await db.update(users).set({ notifyEmail: on }).where(eq(users.id, userId));
  else
    await db
      .update(users)
      .set({ emailPrefs: sql`${users.emailPrefs} || ${JSON.stringify({ [group]: on })}::jsonb` })
      .where(eq(users.id, userId));
}

// ---------------- Deliver ----------------

const ENGAGEMENT_KINDS = (Object.keys(EMAIL_KINDS) as EmailKind[]).filter((k) => EMAIL_KINDS[k].engagement);
const ALL_KINDS = Object.keys(EMAIL_KINDS) as EmailKind[];
const REALTIME: EmailKind[] = ["vote_milestone", "dm_request"];

async function lastSeen(userId: string): Promise<Date | null> {
  const [r] = await db.execute<{ at: string | null }>(sql`
    SELECT GREATEST(
      (SELECT last_active_at FROM "user" WHERE id = ${userId}),
      (SELECT max(created_at) FROM analytics_event WHERE user_id = ${userId} AND name IN ('page_view', 'session_start'))
    ) AS at`);
  return r?.at ? new Date(r.at) : null;
}

async function counts(userId: string, now: Date) {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [r] = await db.execute<{ user_today: number; user_week: number; global_today: number }>(sql`
    SELECT
      count(*) FILTER (WHERE user_id = ${userId} AND kind IN (${sql.join(ENGAGEMENT_KINDS.map((k) => sql`${k}`), sql`, `)}) AND sent_at > ${new Date(now.getTime() - 86400_000).toISOString()})::int AS user_today,
      count(*) FILTER (WHERE user_id = ${userId} AND kind IN (${sql.join(ENGAGEMENT_KINDS.map((k) => sql`${k}`), sql`, `)}) AND sent_at > ${new Date(now.getTime() - 7 * 86400_000).toISOString()})::int AS user_week,
      count(*) FILTER (WHERE sent_at >= ${dayStart.toISOString()} AND kind IN (${sql.join(ALL_KINDS.map((k) => sql`${k}`), sql`, `)}))::int AS global_today
    FROM email_log WHERE status = 'SENT' AND sent_at > ${new Date(now.getTime() - 7 * 86400_000).toISOString()}`);
  return { userToday: r?.user_today ?? 0, userWeek: r?.user_week ?? 0, globalToday: r?.global_today ?? 0 };
}

export type DeliverResult = "sent" | "queued" | "duplicate" | "skipped" | "failed";

async function finish(id: string, status: "SENT" | "SKIPPED" | "FAILED", reason: string | null, extra: { providerId?: string } = {}) {
  await db
    .update(emailLog)
    .set({ status, reason, sentAt: status === "SENT" ? new Date() : null, providerId: extra.providerId ?? null })
    .where(eq(emailLog.id, id));
}

/**
 * Decide about and (maybe) send one email. `ref` makes it once-only per user (e.g. the battle id).
 * Never throws: email problems must not break the action that triggered them.
 */
export async function deliver<K extends EmailKind>(user: User, kind: K, ref: string, data: EmailData[K], opts: { now?: Date; rowId?: string } = {}): Promise<DeliverResult> {
  try {
    const now = opts.now ?? new Date();
    const meta = EMAIL_KINDS[kind];
    let rowId = opts.rowId;
    if (!rowId) {
      const [row] = await db
        .insert(emailLog)
        .values({ userId: user.id, kind, ref, status: "QUEUED", payload: data as Record<string, unknown> })
        .onConflictDoNothing({ target: [emailLog.userId, emailLog.kind, emailLog.ref] })
        .returning({ id: emailLog.id });
      if (!row) return "duplicate";
      rowId = row.id;
    }
    if (!user.email || user.bannedAt) return (await finish(rowId, "SKIPPED", "no_email"), "skipped");
    if (!groupEnabled(meta.group, user)) return (await finish(rowId, "SKIPPED", "prefs"), "skipped");
    if (needsAddress(kind, process.env.MAIL_POSTAL_ADDRESS)) return (await finish(rowId, "SKIPPED", "no_postal_address"), "skipped");

    const e = await getEconomy();
    if (REALTIME.includes(kind) && !opts.rowId) {
      const seen = await lastSeen(user.id);
      if (seen && now.getTime() - seen.getTime() < e.emailActiveSkipMinutes * 60_000) return (await finish(rowId, "SKIPPED", "active_in_app"), "skipped");
    }
    if (!meta.ignoresQuietHours) {
      const tz = timeZoneFor(user.country, user.region);
      if (inQuietHours(localTime(now, tz).hour, e.emailQuietStart, e.emailQuietEnd)) {
        await db.update(emailLog).set({ sendAfter: nextLocalHour(now, tz, e.emailQuietEnd) }).where(eq(emailLog.id, rowId));
        return "queued";
      }
    }
    const block = capBlock(kind, await counts(user.id, now), e);
    if (block) return (await finish(rowId, "SKIPPED", block), "skipped");

    const built = await render(kind, data);
    const group = meta.group;
    const unsub = group === "always" ? null : unsubscribeUrl(user.id, group);
    const { html, text } = T.layout(built, {
      why: WHY[group],
      unsubscribeUrl: unsub,
      settingsUrl: appUrl("/settings#email"),
      postalAddress: process.env.MAIL_POSTAL_ADDRESS?.trim() || null,
    });
    const headers: Record<string, string> =
      group === "always" ? {} : { "List-Unsubscribe": `<${unsubscribeUrl(user.id, group, true)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
    const res = await sendEmail({ to: user.email, subject: built.subject, html, text, headers }, { devLog: `[${kind}] ${built.text}` });
    if (!res.ok) return (await finish(rowId, "FAILED", "provider"), "failed");
    await finish(rowId, "SENT", null, { providerId: res.id });
    track("email_sent", { kind, ref, group }, { userId: user.id });
    return "sent";
  } catch (err) {
    console.error("[mailer]", kind, ref, err);
    return "failed";
  }
}

/** Convenience: deliver to a user id (loads the user). */
export async function deliverTo<K extends EmailKind>(userId: string, kind: K, ref: string, data: EmailData[K]) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  return u ? deliver(u, kind, ref, data) : "skipped";
}

/** Send emails that were waiting for quiet hours to end. Runs hourly. */
export async function flushQueued(now = new Date()) {
  const rows = await db
    .select({ id: emailLog.id, userId: emailLog.userId, kind: emailLog.kind, ref: emailLog.ref, payload: emailLog.payload })
    .from(emailLog)
    .where(and(eq(emailLog.status, "QUEUED"), lte(emailLog.sendAfter, now), inArray(emailLog.kind, ALL_KINDS)))
    .limit(200);
  let sent = 0;
  for (const r of rows) {
    const [u] = await db.select().from(users).where(eq(users.id, r.userId));
    if (!u) continue;
    if ((await deliver(u, r.kind as EmailKind, r.ref, r.payload as never, { now, rowId: r.id })) === "sent") sent++;
  }
  return sent;
}

// ---------------- Batched voter updates (E6 + E7) ----------------

const VOTER_ITEM = "voter_item";

/** Queue an outcome/helpful item for a voter; the hourly job sends one combined email per person. */
export async function queueVoterItem(
  userId: string,
  ref: string,
  item:
    | { type: "outcome"; data: EmailData["voter_updates"]["outcomes"][number] }
    | { type: "helpful"; data: EmailData["voter_updates"]["helpful"][number] }
    | { type: "result"; data: NonNullable<EmailData["voter_updates"]["results"]>[number] },
) {
  try {
    await db
      .insert(emailLog)
      .values({ userId, kind: VOTER_ITEM, ref, status: "QUEUED", payload: item as unknown as Record<string, unknown>, sendAfter: new Date(Date.now() + 30 * 60_000) })
      .onConflictDoNothing({ target: [emailLog.userId, emailLog.kind, emailLog.ref] });
  } catch (err) {
    console.error("[mailer] queueVoterItem", err);
  }
}

/** Combine each person's waiting outcome/helpful items into one "How it turned out" email. */
export async function flushVoterUpdates(now = new Date()) {
  const rows = await db
    .select({ id: emailLog.id, userId: emailLog.userId, payload: emailLog.payload })
    .from(emailLog)
    .where(and(eq(emailLog.kind, VOTER_ITEM), eq(emailLog.status, "QUEUED"), lte(emailLog.sendAfter, now)))
    .limit(1000);
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  let sent = 0;
  for (const [userId, items] of byUser) {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) continue;
    const data: EmailData["voter_updates"] = { outcomes: [], helpful: [], results: [] };
    for (const it of items) {
      const p = it.payload as { type: string; data: never };
      if (p.type === "outcome") data.outcomes.push(p.data);
      else if (p.type === "result") data.results!.push(p.data);
      else data.helpful.push(p.data);
    }
    // At most 5 final results in one email, closest splits first are just as good as any; keep the newest.
    data.results = data.results!.slice(-5);
    const res = await deliver(u, "voter_updates", `batch:${items.map((i) => i.id).sort()[0]}`, data, { now });
    if (res === "sent") sent++;
    await db
      .update(emailLog)
      .set({ status: "SKIPPED", reason: `batched:${res}` })
      .where(inArray(emailLog.id, items.map((i) => i.id)));
  }
  return sent;
}

/** How many emails went out today (UTC), for the admin page. */
export async function emailsSentToday(now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailLog)
    .where(and(eq(emailLog.status, "SENT"), gte(emailLog.sentAt, dayStart)));
  return r?.n ?? 0;
}
