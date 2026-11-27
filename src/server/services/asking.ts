/**
 * "People like you are asking" card (lib/asking.ts has the bank, the picker and the rules). This file gathers what we
 * know about the viewer (about-you answers, the ad / campaign tags of their visits, the season), drops presets that
 * are retired (posted to the crowd from Pickbot) or that they already voted on, and returns the questions for the deck.
 */
import { and, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { battles, options, pickbotThreads, type User } from "../db/schema";
import { getEconomy } from "./config";
import { knownAnswers } from "./about";
import { pickbotAccess } from "./pickbot";
import { activeMindTopic } from "./mind";
import { MIND_OTHER, mindWords, topicsInText } from "@/lib/mind";
import { ASKING_PRESETS, pickAsking, presetBattleId, type AskingTopic } from "@/lib/asking";

type Viewer = { user: User | null; deviceId: string | null };

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

/**
 * The card for this viewer, or null (economy `askingCard` = 0, or nothing left to show). `topic` = the "What's on
 * your mind this week?" answer when the caller has it (that card can refetch via GET /api/asking?topic=…).
 */
export async function askingFor(v: Viewer, opts: { topic?: AskingTopic | null; now?: Date } = {}): Promise<AskingCardData | null> {
  const e = await getEconomy();
  if (!e.askingCard || e.askingAt <= 0) return null;
  const now = opts.now ?? new Date();
  const [known, retired, voted, words, access, mind] = await Promise.all([
    knownAnswers(v),
    retiredPresetIds(),
    votedPresetIds(v),
    campaignWords(v),
    v.user ? pickbotAccess(v.user) : Promise.resolve({ ok: false as const }),
    opts.topic === undefined ? activeMindTopic(v).catch(() => null) : Promise.resolve(null),
  ]);
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

  const exclude = new Set([...retired, ...voted, ...ASKING_PRESETS.filter((p) => !slugs.has(presetBattleId(p.id))).map((p) => p.id)]);
  const key = v.user?.id ?? v.deviceId ?? "anon";
  const rounds: AskingItem[][] = [];
  for (let r = 0; r < Math.max(1, e.askingRounds); r++) {
    const picks = pickAsking({ exclude, sex: known.sex, age: known.age, month: nyMonth(now), campaign, topic: mindTopic, n: e.askingCount, seed: `asking:${key}:${nyDay(now)}:${r}` });
    if (!picks.length) break;
    picks.forEach((p) => exclude.add(p.id));
    rounds.push(picks.map((p) => ({ id: p.id, q: p.q, context: p.context ?? null, slug: slugs.get(presetBattleId(p.id))!, a: p.a, b: p.b })));
  }
  if (!rounds.length) return null;
  return { mode: access.ok ? "pickbot" : "battle", at: e.askingAt, every: e.askingEvery, rounds };
}
