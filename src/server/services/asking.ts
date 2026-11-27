/**
 * "People like you are asking" card (lib/asking.ts has the bank, the picker and the rules). This file gathers what we
 * know about the viewer (about-you answers, the ad / campaign tags of their visits, the season), drops presets that
 * are retired (posted to the crowd from Pickbot) or that they already voted on, and returns the questions for the deck.
 */
import { and, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { askingSuggestions, battles, options, pickbotThreads, type User } from "../db/schema";
import { track } from "../analytics";
import { pickbotConfigured, writeAskingQuestions } from "./pickbot-ai";
import { zipPlace } from "./zip";
import { getEconomy } from "./config";
import { knownAnswers } from "./about";
import { pickbotAccess } from "./pickbot";
import { activeMindTopic } from "./mind";
import { MIND_OTHER, mindWords, topicsInText } from "@/lib/mind";
import { ASKING_PRESETS, parseAiAsking, pickAsking, presetBattleId, shownIds, topTopics, type AskingTopic } from "@/lib/asking";

type Viewer = { user: User | null; deviceId: string | null };

/** A preset (backed by a battle: `slug`, `a`, `b`), or an AI-written question (`id` "ai_…", no battle; Pickbot only). */
export type AskingItem = { id: string; q: string; context: string | null; slug: string; a: string; b: string };
export type AskingCardData = {
  /** battle = vote right here and see the crowd (guests, no Pickbot); pickbot = open Pickbot with the question. */
  mode: "battle" | "pickbot";
  at: number;
  every: number;
  /** Three questions per showing; each showing gets the next group. */
  rounds: AskingItem[][];
};

/** Presets someone took from the card into Pickbot and posted to the crowd. Never shown again (Shimon). */
export async function retiredPresetIds(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ p: sql<string>`${pickbotThreads.state}->>'preset'` })
    .from(pickbotThreads)
    .where(and(isNotNull(pickbotThreads.battleId), sql`${pickbotThreads.state}->>'preset' IS NOT NULL`));
  return new Set(rows.map((r) => r.p).filter(Boolean));
}

/** Presets whose battle this person (account, else browser and the account it was linked to) already voted on. */
async function votedPresetIds(v: Viewer): Promise<Set<string>> {
  if (!v.user && !v.deviceId) return new Set();
  const who = v.user
    ? sql`(v.user_id = ${v.user.id}${v.deviceId ? sql` OR v.device_id = ${v.deviceId}` : sql``})`
    : sql`(v.device_id = ${v.deviceId} OR v.user_id = (SELECT d.user_id FROM device d WHERE d.id = ${v.deviceId}))`;
  const rows = await db.execute<{ id: string }>(sql`SELECT v.battle_id AS id FROM vote v WHERE v.battle_id LIKE 'ask\\_%' AND ${who}`);
  return new Set(rows.map((r) => String(r.id).slice(4)));
}

/** Ad / campaign words from this person's recent visits (utm_*, landing page, referrer; first visit included). */
async function campaignWords(v: Viewer): Promise<string> {
  if (!v.user && !v.deviceId) return "";
  const who = v.user ? sql`user_id = ${v.user.id}` : sql`device_id = ${v.deviceId}`;
  const rows = await db.execute<{ props: Record<string, unknown> }>(
    sql`SELECT props FROM analytics_event WHERE name = 'session_start' AND ${who} ORDER BY created_at DESC LIMIT 5`,
  );
  const keys = ["utm_source", "utm_campaign", "utm_content", "utm_term", "landing", "referrer"];
  const words: string[] = [];
  for (const r of rows) {
    const p = r.props ?? {};
    for (const src of [p, (p.first ?? {}) as Record<string, unknown>]) for (const k of keys) if (typeof src[k] === "string") words.push(src[k] as string);
  }
  return words.join(" ").replace(/[_\-/+]/g, " ").toLowerCase();
}

function nyMonth(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "numeric" }).format(now));
}
function nyDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

/** This person's rows: their account, else their browser. `col` is a fixed table prefix ("v."), never user input. */
const who = (v: Viewer, col: "" | "v." = "") => (v.user ? sql`${sql.raw(col)}user_id = ${v.user.id}` : sql`${sql.raw(col)}device_id = ${v.deviceId}`);

/** Preset ids the card showed this person in the last few days, so each showing brings new questions. */
async function recentlyShown(v: Viewer, days = 3): Promise<Set<string>> {
  if (!v.user && !v.deviceId) return new Set();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await db.execute<{ ids: string | null }>(
    sql`SELECT props->>'ids' AS ids FROM analytics_event WHERE name = 'asking_shown' AND ${who(v)} AND created_at >= ${since} ORDER BY created_at DESC LIMIT 30`,
  );
  return shownIds([...rows]);
}

/** Topics of the battles this person voted on lately (AI themes). */
async function recentVoteThemes(v: Viewer): Promise<{ themes: (string | null)[]; titles: string[] }> {
  if (!v.user && !v.deviceId) return { themes: [], titles: [] };
  const rows = await db.execute<{ theme: string | null; title: string; picked: string | null }>(sql`
    SELECT b.tags->'brain'->>'theme' AS theme, b.title, o.label AS picked FROM vote v JOIN battle b ON b.id = v.battle_id
    LEFT JOIN option o ON o.battle_id = v.battle_id AND o.side = v.side
    WHERE ${who(v, "v.")} AND b.id NOT LIKE 'ask\\_%' ORDER BY v.created_at DESC LIMIT 30`);
  // "title → what they picked", so the questions follow how they vote, not just what they saw.
  return { themes: rows.map((r) => r.theme), titles: rows.slice(0, 15).map((r) => (r.picked ? `${r.title} → picked "${r.picked}"` : r.title)) };
}

/** What this person took to Pickbot lately: themes (to change the subject), titles and presets (never re-shown). */
async function pickbotHistory(user: User | null) {
  if (!user) return { themes: [] as string[], titles: [] as string[], presets: new Set<string>() };
  const rows = await db
    .select({ title: pickbotThreads.title, c: pickbotThreads.classification, state: pickbotThreads.state, at: pickbotThreads.createdAt })
    .from(pickbotThreads)
    .where(eq(pickbotThreads.userId, user.id))
    .orderBy(desc(pickbotThreads.createdAt))
    .limit(30);
  const recent = rows.filter((r) => r.at.getTime() > Date.now() - 14 * 86400_000);
  return {
    themes: recent.map((r) => r.c?.theme).filter((t): t is NonNullable<typeof t> => !!t),
    titles: rows.map((r) => r.title).filter(Boolean),
    presets: new Set(rows.map((r) => r.state?.preset).filter((p): p is string => !!p)),
  };
}

/**
 * AI-written questions for a signed-in person (Alex, Nov 27 2026: "a very dynamic and evolving AI-driven prompt"):
 * Haiku writes today's rounds from their profile ranges, recent votes and what they asked Pickbot, never repeating
 * an earlier day's questions or anything they asked. Cached one row per person per New York day. null = use presets.
 */
async function aiRounds(user: User, ctx: { day: string; month: number; n: number; rounds: number; known: Record<string, string | null | undefined>; votes: string[]; pickbot: { themes: string[]; titles: string[] } }) {
  if (!pickbotConfigured()) return null;
  const [cached] = await db.select().from(askingSuggestions).where(and(eq(askingSuggestions.userId, user.id), eq(askingSuggestions.day, ctx.day)));
  if (cached?.rounds?.length) return cached.rounds;
  const earlier = await db
    .select({ rounds: askingSuggestions.rounds })
    .from(askingSuggestions)
    .where(eq(askingSuggestions.userId, user.id))
    .orderBy(desc(askingSuggestions.createdAt))
    .limit(5);
  const already = [...ctx.pickbot.titles, ...earlier.flatMap((r) => r.rounds.flat())].slice(0, 80);
  const profile = {
    sex: ctx.known.sex === "MALE" ? "man" : ctx.known.sex === "FEMALE" ? "woman" : null,
    "age range": ctx.known.age ? ctx.known.age.replace("AGE_", "").replace("_PLUS", "+").replace("_", "–") : null,
    relationship: ctx.known.relationship?.toLowerCase() ?? null,
    kids: ctx.known.kids?.toLowerCase() ?? null,
    home: ctx.known.housing?.toLowerCase() ?? null,
    work: ctx.known.work?.toLowerCase() ?? null,
    region: zipPlace(user.zipCode),
  };
  const month = new Date(2026, ctx.month - 1, 1).toLocaleString("en-US", { month: "long" });
  const { questions, stats } = await writeAskingQuestions({
    count: ctx.n * ctx.rounds + 3,
    profile,
    month,
    recentVotes: ctx.votes,
    pickbotTopics: ctx.pickbot.themes.length ? [...new Set(ctx.pickbot.themes)] : [],
    already,
  });
  const rounds = parseAiAsking(questions, { n: ctx.n, rounds: ctx.rounds, already });
  if (!rounds.length) return null;
  await db
    .insert(askingSuggestions)
    .values({ userId: user.id, day: ctx.day, rounds, model: stats?.model ?? null, costUsd: stats?.costUsd ?? null })
    .onConflictDoNothing();
  track("asking_ai_written", { rounds: rounds.length, questions: rounds.flat().length, model: stats?.model ?? "fake", costUsd: stats?.costUsd ?? 0 }, { userId: user.id });
  return rounds;
}

/**
 * The card for this viewer, or null (economy `askingCard` = 0, or nothing left to show). `topic` = the "What's on
 * your mind this week?" answer when the caller has it (that card can refetch via GET /api/asking?topic=…).
 */
export async function askingFor(v: Viewer, opts: { topic?: AskingTopic | null; now?: Date; ai?: boolean } = {}): Promise<AskingCardData | null> {
  const e = await getEconomy();
  if (!e.askingCard || e.askingAt <= 0) return null;
  const now = opts.now ?? new Date();
  const [known, retired, voted, words, access, mind, shown, recent, history] = await Promise.all([
    knownAnswers(v),
    retiredPresetIds(),
    votedPresetIds(v),
    campaignWords(v),
    v.user ? pickbotAccess(v.user) : Promise.resolve({ ok: false as const }),
    opts.topic === undefined ? activeMindTopic(v).catch(() => null) : Promise.resolve(null),
    recentlyShown(v).catch(() => new Set<string>()),
    recentVoteThemes(v).catch(() => ({ themes: [], titles: [] })),
    pickbotHistory(v.user).catch(() => ({ themes: [], titles: [], presets: new Set<string>() })),
  ]);
  const mode = access.ok ? "pickbot" : "battle";
  // Signed in with Pickbot: questions written for this person (the deck's refetch asks for them; cached per day).
  if (mode === "pickbot" && opts.ai && v.user) {
    try {
      const ai = await aiRounds(v.user, {
        day: nyDay(now),
        month: nyMonth(now),
        n: e.askingCount,
        rounds: Math.max(1, e.askingRounds),
        known: known as Record<string, string | null | undefined>,
        votes: recent.titles,
        pickbot: history,
      });
      if (ai?.length)
        return { mode, at: e.askingAt, every: e.askingEvery, rounds: ai.map((r, ri) => r.map((q, qi) => ({ id: `ai_${ri}_${qi}`, q, context: null, slug: "", a: "", b: "" }))) };
    } catch (err) {
      console.error("[asking ai]", err);
    }
  }
  // "What's on your mind this week?" (lib/mind.ts): its topics match the bank's, except "home" (where to live),
  // which steers by words instead, and "Other", which uses a listed topic its typed words name, plus the words.
  const picked = mind?.topic === MIND_OTHER ? (topicsInText(mind.text)[0] ?? null) : (mind?.topic ?? null);
  const mindTopic = opts.topic !== undefined ? opts.topic : picked === "home" ? null : ((picked as AskingTopic | null) ?? null);
  const typed = mind?.topic === MIND_OTHER ? mindWords(mind.text).join(" ") : "";
  const campaign = [words, picked === "home" ? "rent apartment housing house move city" : "", typed].filter(Boolean).join(" ");
  // Only presets whose battle is live (the card votes on it before sign-up).
  const live = await db
    .select({ id: battles.id, slug: battles.slug, side: options.side, label: options.label })
    .from(battles)
    .innerJoin(options, eq(options.battleId, battles.id))
    .where(and(inArray(battles.id, ASKING_PRESETS.map((p) => presetBattleId(p.id))), eq(battles.status, "OPEN"), gt(battles.deadline, now)));
  const slugs = new Map(live.map((r) => [r.id, r.slug]));

  const base = [...retired, ...voted, ...history.presets, ...ASKING_PRESETS.filter((p) => !slugs.has(presetBattleId(p.id))).map((p) => p.id)];
  // Questions shown in the last few days step aside, unless that leaves too few.
  const fresh = new Set([...base, ...shown]);
  const exclude = ASKING_PRESETS.filter((p) => !fresh.has(p.id)).length >= e.askingCount ? fresh : new Set(base);
  const interests = topTopics(recent.themes);
  const avoid = topTopics(history.themes, 3);
  const key = v.user?.id ?? v.deviceId ?? "anon";
  const rounds: AskingItem[][] = [];
  for (let r = 0; r < Math.max(1, e.askingRounds); r++) {
    const picks = pickAsking({ exclude, sex: known.sex, age: known.age, month: nyMonth(now), campaign, topic: mindTopic, interests, avoid, n: e.askingCount, seed: `asking:${key}:${nyDay(now)}:${r}` });
    if (!picks.length) break;
    picks.forEach((p) => exclude.add(p.id));
    rounds.push(picks.map((p) => ({ id: p.id, q: p.q, context: p.context ?? null, slug: slugs.get(presetBattleId(p.id))!, a: p.a, b: p.b })));
  }
  if (!rounds.length) return null;
  return { mode, at: e.askingAt, every: e.askingEvery, rounds };
}
