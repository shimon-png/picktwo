/**
 * Pickbot threads (PRD docs/plans/pickbot-prd.html). One thread per question:
 *   ask → profile questions (one at a time, skippable) → general or tailored → quick battles → Claude's answer →
 *   follow-ups, 👍/👎 → "ask the crowd" draft → anonymous battle → results back in the thread.
 * Signed-in only (Shimon: nothing before sign-up). Access: admins always; everyone else when economy `pickbotOpen`
 * is 1 and they're not in the `pickbotHoldoutPct` holdout. Free answers per day `pickbotFreePerDay` (Plus: unlimited).
 * Pure rules in lib/pickbot.ts (tested); Claude calls in pickbot-ai.ts; crowd numbers in pickbot-crowd.ts.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { battles, options, pickbotMessages, pickbotThreads, profileAnswers, users, votes, type User } from "../db/schema";
import { AppError } from "../errors";
import { track } from "../analytics";
import { isAdmin } from "../viewer";
import { getEconomy } from "./config";
import { inHoldout } from "./ranking";
import { answerAbout, knownAnswers } from "./about";
import { voteTotal, tasteProfileFor } from "./taste-profile";
import { getFeed } from "./feed";
import { createBattle, screenPhotoUrls } from "./battles";
import { reportOutcome } from "./outcomes";
import { notify } from "./notifications";
import { deliver } from "./mailer";
import { zipPlace } from "./zip";
import { similarBattles } from "./pickbot-crowd";
import { sendPush } from "./push";
import { classifyQuestion, draftCrowdBattle, pickbotConfigured, streamAnswer, type CrowdDraft, type ProfileForAi, type Turn } from "./pickbot-ai";
import {
  answerModel,
  answersLeft,
  crowdAgreed,
  nextStep,
  pickQuickBattles,
  resultsDue,
  type Answer,
  type AnswerKind,
  type Step,
  type ThreadState,
} from "@/lib/pickbot";
import { profileProgress } from "@/lib/profile-progress";
import { promoPosition } from "@/lib/pickbot-promo";
import { ABOUT_QUESTIONS, type AboutQuestionId } from "@/lib/about";
import { likeYouLabel } from "@/lib/like-you";
import { AGE_RANGE_IDS } from "@/lib/constants";

type Thread = typeof pickbotThreads.$inferSelect;
type Message = typeof pickbotMessages.$inferSelect;

export const isPlus = (u: User | null) => !!u?.plusUntil && u.plusUntil.getTime() > Date.now();

export type Access = { ok: true } | { ok: false; reason: "signin" | "unconfigured" | "closed" | "holdout" };

export async function pickbotAccess(user: User | null): Promise<Access> {
  if (!pickbotConfigured()) return { ok: false, reason: "unconfigured" };
  if (!user) return { ok: false, reason: "signin" };
  if (isAdmin(user)) return { ok: true };
  const e = await getEconomy();
  if (!e.pickbotOpen) return { ok: false, reason: "closed" };
  if (inHoldout(`pickbot:${user.id}`, e.pickbotHoldoutPct)) return { ok: false, reason: "holdout" };
  return { ok: true };
}

/**
 * The "Ask Pickbot" deck card for this person: their tested position, or null when it shouldn't show (signed out,
 * no Pickbot access, turned off, already shown once, or they've already asked Pickbot).
 */
export async function pickbotPromoFor(user: User | null): Promise<{ at: number } | null> {
  if (!user) return null;
  try {
    const e = await getEconomy();
    if (!e.pickbotPromo || !(await pickbotAccess(user)).ok) return null;
    const [r] = await db.execute<{ seen: boolean; asked: boolean }>(sql`
      SELECT EXISTS (SELECT 1 FROM analytics_event WHERE name = 'pickbot_promo_shown' AND user_id = ${user.id}) AS seen,
        EXISTS (SELECT 1 FROM pickbot_thread WHERE user_id = ${user.id}) AS asked`);
    if (r?.seen || r?.asked) return null;
    return { at: promoPosition(user.id) };
  } catch (err) {
    console.error("[pickbot promo]", err);
    return null;
  }
}

/** Whether to show the Ask tab: same rule as access, but quiet for the signed-out (they see it and get sign-up). */
export async function showAskTab(user: User | null) {
  const a = await pickbotAccess(user);
  return a.ok || (!a.ok && a.reason === "signin");
}

async function requireAccess(user: User | null): Promise<User> {
  const a = await pickbotAccess(user);
  if (a.ok) return user!;
  if (a.reason === "signin") throw new AppError("UNAUTHORIZED", "Sign up to ask Pickbot");
  throw new AppError("FORBIDDEN", a.reason === "unconfigured" ? "Pickbot isn't set up yet." : "Pickbot isn't available for you yet.");
}

const NY_TODAY = sql`(date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York')`;

async function answersToday(userId: string) {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM pickbot_message m JOIN pickbot_thread t ON t.id = m.thread_id
    WHERE t.user_id = ${userId} AND m.kind = 'answer' AND m.created_at >= ${NY_TODAY}`);
  return Number(r?.n ?? 0);
}

async function crowdToday(userId: string) {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM pickbot_thread t JOIN battle b ON b.id = t.battle_id
    WHERE t.user_id = ${userId} AND b.created_at >= ${NY_TODAY}`);
  return Number(r?.n ?? 0);
}

export async function answersLeftFor(user: User) {
  const e = await getEconomy();
  return answersLeft(await answersToday(user.id), e.pickbotFreePerDay, isPlus(user) || isAdmin(user));
}

async function ownThread(user: User, id: string): Promise<Thread> {
  const [t] = await db.select().from(pickbotThreads).where(and(eq(pickbotThreads.id, id), eq(pickbotThreads.userId, user.id)));
  if (!t) throw new AppError("NOT_FOUND", "Question not found");
  return t;
}

async function addMessage(threadId: string, m: Omit<typeof pickbotMessages.$inferInsert, "threadId">) {
  const [row] = await db.insert(pickbotMessages).values({ threadId, ...m }).returning();
  await db.update(pickbotThreads).set({ updatedAt: new Date() }).where(eq(pickbotThreads.id, threadId));
  return row;
}

const OFF_TOPIC =
  "I'm best at choices and opinions: what to pick, what to do, whether something is OK. Try asking me something like “Which of these two jackets?” or “Should I text him back?”";
const CRISIS =
  "If you or someone else might be in danger, please reach out now: call or text 988 (Suicide & Crisis Lifeline, US) or your local emergency number. You don't have to sort this out alone.";

async function screen(user: User, photos: string[]) {
  const verdict = await screenPhotoUrls(user, photos);
  if (verdict.verdict === "review") throw new AppError("VALIDATION", "We couldn't check one of your photos. Try another, or ask without it.");
}

/** A new question: screen photos, classify, open the thread. Off-topic and crisis replies are added right away. */
export async function askPickbot(userIn: User | null, input: { text: string; photos: string[] }) {
  const user = await requireAccess(userIn);
  if ((await answersLeftFor(user)) === 0) throw new AppError("LIMIT_REACHED", "You've used today's free answers. Come back tomorrow for more.");
  await screen(user, input.photos);
  const { c, stats } = await classifyQuestion(input.text, input.photos);
  const [t] = await db.insert(pickbotThreads).values({ userId: user.id, title: c.title, classification: c, state: {} }).returning();
  await addMessage(t.id, { role: "USER", kind: "question", text: input.text, photos: input.photos, model: stats?.model, costUsd: stats?.costUsd, inputTokens: stats?.inputTokens, outputTokens: stats?.outputTokens });
  if (c.crisis) await addMessage(t.id, { role: "BOT", kind: "note", text: CRISIS });
  if (c.scope === "off_topic") await addMessage(t.id, { role: "BOT", kind: "note", text: OFF_TOPIC });
  track("pickbot_asked", { threadId: t.id, photos: input.photos.length, chars: input.text.length, scope: c.scope, theme: c.theme, crisis: c.crisis, followUp: false }, { userId: user.id });
  return { id: t.id };
}

/** A follow-up in the same thread (same decision, same profile). */
export async function followUp(userIn: User | null, id: string, input: { text: string; photos: string[] }) {
  const user = await requireAccess(userIn);
  const t = await ownThread(user, id);
  if (t.classification.scope === "off_topic") throw new AppError("VALIDATION", "Start a new question for that one.");
  if ((await answersLeftFor(user)) === 0) throw new AppError("LIMIT_REACHED", "You've used today's free answers. Come back tomorrow for more.");
  await screen(user, input.photos);
  await addMessage(t.id, { role: "USER", kind: "question", text: input.text, photos: input.photos });
  track("pickbot_asked", { threadId: t.id, photos: input.photos.length, chars: input.text.length, followUp: true }, { userId: user.id });
  return { ok: true };
}

/**
 * Every about-you answer the person has given: profile columns plus the answers kept only in profile_answer
 * (education, race, party). "Prefer not to say" counts as answered.
 */
async function pickbotKnown(user: User): Promise<Partial<Record<AboutQuestionId, string>>> {
  const [cols, rows] = await Promise.all([
    knownAnswers({ user, deviceId: null }),
    db
      .select({ q: profileAnswers.question, a: profileAnswers.answer })
      .from(profileAnswers)
      .where(and(eq(profileAnswers.userId, user.id), eq(profileAnswers.status, "answered"))),
  ]);
  const out: Partial<Record<AboutQuestionId, string>> = { ...cols };
  for (const r of rows) if (r.a && !out[r.q as AboutQuestionId]) out[r.q as AboutQuestionId] = r.a;
  return out;
}

/** Where the thread stands: still collecting (a Step), an answer is due (incl. follow-ups), or done. */
async function threadStep(user: User, t: Thread, msgs: Message[]): Promise<Step | { type: "done" }> {
  const lastQ = msgs.findLastIndex((m) => m.kind === "question");
  const lastA = msgs.findLastIndex((m) => m.kind === "answer");
  const e = await getEconomy();
  // After an answer: done, unless there's a follow-up waiting or the asker said yes to "Want a better answer?".
  if (lastA >= 0 && !t.state.retailor) {
    if (lastQ > lastA) return { type: "answer", kind: (msgs[lastA].answer?.kind ?? "general") as AnswerKind };
    return { type: "done" };
  }
  const [known, votes] = await Promise.all([pickbotKnown(user), voteTotal({ user, deviceId: null })]);
  return nextStep({ c: t.classification, known, votes, target: e.tasteFullAt, state: t.state });
}

/** Everything the thread page needs. */
export async function threadView(userIn: User | null, id: string) {
  const user = await requireAccess(userIn);
  const t = await ownThread(user, id);
  const msgs = await db.select().from(pickbotMessages).where(eq(pickbotMessages.threadId, t.id)).orderBy(asc(pickbotMessages.createdAt));
  const e = await getEconomy();
  const [step, known, votes, left] = await Promise.all([
    threadStep(user, t, msgs),
    pickbotKnown(user),
    voteTotal({ user, deviceId: null }),
    answersLeftFor(user),
  ]);
  let quick: Awaited<ReturnType<typeof quickBattles>> = [];
  if (step.type === "battles") quick = await quickBattles(user, t, step.left);
  let crowd: null | { slug: string; title: string; status: string; votesA: number; votesB: number; labelA: string; labelB: string; deadline: string; outcome: string | null } = null;
  if (t.battleId) {
    const [b] = await db
      .select({ slug: battles.slug, title: battles.title, status: battles.status, votesA: battles.votesA, votesB: battles.votesB, deadline: battles.deadline })
      .from(battles)
      .where(eq(battles.id, t.battleId));
    const opts = await db.select({ side: options.side, label: options.label }).from(options).where(eq(options.battleId, t.battleId));
    const [o] = await db.execute<{ chosen: string }>(sql`SELECT chosen FROM outcome WHERE battle_id = ${t.battleId}`);
    if (b)
      crowd = {
        ...b,
        deadline: b.deadline.toISOString(),
        labelA: opts.find((x) => x.side === "A")?.label ?? "A",
        labelB: opts.find((x) => x.side === "B")?.label ?? "B",
        outcome: o?.chosen ?? null,
      };
  }
  const crowdAllowed = t.classification.scope !== "sensitive" && !t.classification.crisis;
  return {
    thread: { id: t.id, title: t.title, createdAt: t.createdAt.toISOString(), scope: t.classification.scope, theme: t.classification.theme, state: t.state },
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role,
      kind: m.kind,
      text: m.text,
      photos: m.photos,
      answer: m.answer,
      data: m.data,
      rating: m.rating,
      createdAt: m.createdAt.toISOString(),
    })),
    step,
    gate:
      step.type === "gate"
        ? {
            q: step.q,
            title: ABOUT_QUESTIONS[step.q].title,
            options: ABOUT_QUESTIONS[step.q].options,
            kind: ABOUT_QUESTIONS[step.q].kind,
            zipGuess: step.q === "zip" ? null : null,
          }
        : null,
    quick,
    progress: profileProgress(votes, known, e.tasteFullAt),
    answersLeft: left,
    crowdAllowed,
    crowd,
  };
}

export type ThreadView = Awaited<ReturnType<typeof threadView>>;

/** Real open battles from the person's own feed, the question's theme first (PRD §6.3). Votes count as usual. */
async function quickBattles(user: User, t: Thread, left: number) {
  const feed = await getFeed({ user, deviceId: null }, { limit: 30 });
  if (!feed.length) return [];
  const themes = await db
    .select({ id: battles.id, theme: sql<string | null>`${battles.tags}->'brain'->>'theme'` })
    .from(battles)
    .where(inArray(battles.id, feed.map((f) => f.id)));
  const byId = new Map(themes.map((r) => [r.id, r.theme]));
  return pickQuickBattles(
    feed.map((f) => ({ ...f, theme: byId.get(f.id) ?? null })),
    t.classification.theme,
    Math.min(left, 5),
  ).map(({ id, slug, title, imageA, imageB, labelA, labelB, votesA, votesB }) => ({ id, slug, title, imageA, imageB, labelA, labelB, votesA, votesB }));
}

/** A profile card answered in the chat. Every card is needed before an answer, so there's no skip (Shimon, Nov 26). */
export async function answerGate(userIn: User | null, id: string, input: { question: AboutQuestionId; answer: string | null; label: string | null; kidAges?: string[] }) {
  const user = await requireAccess(userIn);
  const t = await ownThread(user, id);
  const q = ABOUT_QUESTIONS[input.question];
  if (input.answer == null) throw new AppError("VALIDATION", "Pick one of the answers");
  await addMessage(t.id, { role: "BOT", kind: "note", text: q.title, data: { gate: q.id } });
  await answerAbout({ user, deviceId: null }, { question: input.question, answer: input.answer, kidAges: input.kidAges, via: "pickbot" });
  await addMessage(t.id, { role: "USER", kind: "note", text: input.label ?? input.answer });
  track("pickbot_gate_answered", { threadId: t.id, question: q.id }, { userId: user.id });
  return { ok: true };
}

/**
 * "Want a better answer?" after a general answer: `retailor` starts the quick battles toward the full taste profile
 * (a tailored answer follows at the target); `stop` = "Not now", back to the finished thread.
 */
export async function chooseStep(userIn: User | null, id: string, action: "retailor" | "stop") {
  const user = await requireAccess(userIn);
  const t = await ownThread(user, id);
  const state: ThreadState = action === "stop" ? { ...t.state, retailor: false, stopBattles: false } : { ...t.state, retailor: true, stopBattles: false };
  await db.update(pickbotThreads).set({ state }).where(eq(pickbotThreads.id, t.id));
  await addMessage(t.id, { role: "USER", kind: "note", text: action === "stop" ? "Not now" : "Yes, give me a better answer" });
  track(action === "stop" ? "pickbot_battles_stopped" : "pickbot_choice", { threadId: t.id, choice: action }, { userId: user.id });
  return { ok: true };
}

const LABEL: Record<string, Record<string, string>> = {
  sex: { MALE: "man", FEMALE: "woman" },
  relationship: { SINGLE: "single", DATING: "dating", TAKEN: "in a relationship", MARRIED: "married" },
  housing: { RENT: "rents", OWN: "owns their home", FAMILY: "lives with family" },
  work: { STUDENT: "student", WORKING: "working", BOTH: "student and working", NEITHER: "not working or studying" },
};

async function profileForAi(user: User, extended: string[]): Promise<{ p: ProfileForAi; likeLabel: string | null }> {
  const e = await getEconomy();
  const taste = await tasteProfileFor({ user, deviceId: null });
  const age = user.ageRange ? (user.ageRange.replace("AGE_", "").replace("_PLUS", "+").replace("_", "–") as string) : null;
  return {
    p: {
      sex: user.sex ? (LABEL.sex[user.sex] ?? null) : null,
      ageRange: age,
      relationship: user.relationship ? LABEL.relationship[user.relationship] : null,
      region: zipPlace(user.zipCode),
      kids: extended.includes("kids") ? (user.kidsStatus ?? null) : null,
      housing: extended.includes("housing") && user.housing ? LABEL.housing[user.housing] : null,
      work: extended.includes("work") && user.workStatus ? LABEL.work[user.workStatus] : null,
      battlesAnswered: taste?.votes ?? 0,
      target: e.tasteFullAt,
      traits: (taste?.axes ?? []).map((a) => ({ left: a.left, right: a.right, score: a.score })),
      typeName: taste?.name ?? null,
    },
    likeLabel: likeYouLabel(user.sex, user.ageRange),
  };
}

/**
 * Stream the answer for the thread's open question. `onText` gets the raw JSON as it arrives. Saves the answer with
 * model, tokens, cost and latency; returns what the UI needs once it's done.
 */
export async function answerThread(userIn: User | null, id: string, onText: (chunk: string) => void) {
  const user = await requireAccess(userIn);
  const t = await ownThread(user, id);
  const msgs = await db.select().from(pickbotMessages).where(eq(pickbotMessages.threadId, t.id)).orderBy(asc(pickbotMessages.createdAt));
  const step = await threadStep(user, t, msgs);
  if (step.type !== "answer") throw new AppError("CONFLICT", "Pickbot isn't ready to answer yet.");
  if ((await answersLeftFor(user)) === 0) throw new AppError("LIMIT_REACHED", "You've used today's free answers. Come back tomorrow for more.");
  const e = await getEconomy();
  const { p, likeLabel } = await profileForAi(user, t.classification.extended);
  const similar = t.classification.scope === "off_topic" ? [] : await similarBattles(t.classification.theme, user, e.pickbotSimilarBattles, e.pickbotMinCrowdVotes);
  const turns: Turn[] = msgs
    .filter((m) => m.kind === "question" || m.kind === "answer")
    .map((m) => (m.kind === "answer" ? { role: "BOT", text: JSON.stringify(m.answer), photos: [] } : { role: "USER", text: m.text, photos: m.photos }));
  // A re-answer after "tailor it" has no new question: ask for the tailored version (the API needs a user turn last).
  if (turns.at(-1)?.role === "BOT") turns.push({ role: "USER", text: "I answered more battles, so my taste profile is fuller now. Answer the same question again, tailored to me.", photos: [] });
  const model = answerModel(e.pickbotModelOpus);
  const { answer, stats } = await streamAnswer({ model, kind: step.kind, profile: p, similar, likeLabel, turns }, onText);
  if (t.state.retailor) await db.update(pickbotThreads).set({ state: { ...t.state, retailor: false } }).where(eq(pickbotThreads.id, t.id));
  const shown = similar.slice(0, 3).map(({ slug, title, a, b, votesA, votesB, likeA, likeB }) => ({ slug, title, a, b, votesA, votesB, likeA, likeB }));
  const row = await addMessage(t.id, {
    role: "BOT",
    kind: "answer",
    text: answer.pick,
    answer: { ...answer, kind: step.kind },
    data: { similar: shown, likeLabel },
    model: stats.model,
    inputTokens: stats.inputTokens,
    outputTokens: stats.outputTokens,
    costUsd: stats.costUsd,
    latencyMs: stats.latencyMs,
  });
  track(
    "pickbot_answered",
    { threadId: t.id, kind: step.kind, model: stats.model, latencyMs: stats.latencyMs, inputTokens: stats.inputTokens, outputTokens: stats.outputTokens, costUsd: stats.costUsd, similar: similar.length, confidence: answer.confidence },
    { userId: user.id },
  );
  return { messageId: row.id, kind: step.kind, answer, similar: shown, likeLabel, answersLeft: await answersLeftFor(user) };
}

export async function rateAnswer(userIn: User | null, messageId: string, rating: "UP" | "DOWN", note?: string) {
  const user = await requireAccess(userIn);
  const [m] = await db
    .select({ id: pickbotMessages.id, threadId: pickbotMessages.threadId, model: pickbotMessages.model })
    .from(pickbotMessages)
    .innerJoin(pickbotThreads, eq(pickbotThreads.id, pickbotMessages.threadId))
    .where(and(eq(pickbotMessages.id, messageId), eq(pickbotThreads.userId, user.id), eq(pickbotMessages.kind, "answer")));
  if (!m) throw new AppError("NOT_FOUND", "Answer not found");
  await db.update(pickbotMessages).set({ rating, ratingNote: note?.trim().slice(0, 200) || null }).where(eq(pickbotMessages.id, m.id));
  track("pickbot_rated", { threadId: m.threadId, rating, model: m.model, withNote: !!note?.trim() }, { userId: user.id });
  return { ok: true };
}

export async function listThreads(userIn: User | null, limit = 50) {
  const user = await requireAccess(userIn);
  const rows = await db.execute<{
    id: string;
    title: string;
    updated_at: string;
    kind: string | null;
    slug: string | null;
    status: string | null;
    votes: number | null;
    deadline: string | null;
    results_at: string | null;
  }>(sql`
    SELECT t.id, t.title, t.updated_at::text,
      (SELECT m.answer->>'kind' FROM pickbot_message m WHERE m.thread_id = t.id AND m.kind = 'answer' ORDER BY m.created_at DESC LIMIT 1) AS kind,
      b.slug, b.status::text, (b.votes_a + b.votes_b) AS votes, b.deadline::text, t.results_at::text
    FROM pickbot_thread t LEFT JOIN battle b ON b.id = t.battle_id
    WHERE t.user_id = ${user.id} ORDER BY t.updated_at DESC LIMIT ${limit}`);
  return [...rows];
}

export async function deleteThread(userIn: User | null, id: string) {
  const user = await requireAccess(userIn);
  const t = await ownThread(user, id);
  // The crowd battle (if any) stays: it's anonymous and others voted on it. Only the private thread goes.
  await db.delete(pickbotThreads).where(eq(pickbotThreads.id, t.id));
  track("pickbot_thread_deleted", { threadId: t.id }, { userId: user.id });
  return { ok: true };
}

/** Daily: Pickbot questions are kept 12 months (privacy policy), then deleted. Crowd battles stay (they're anonymous). */
export async function purgeOldThreads(now = new Date()) {
  const cutoff = new Date(now.getTime() - 365 * 86400_000).toISOString();
  const gone = await db.execute(sql`DELETE FROM pickbot_thread WHERE updated_at < ${cutoff} RETURNING id`);
  return [...gone].length;
}

// ---------------- Phase 2: ask the crowd ----------------

function lastAnswer(msgs: Message[]): (Answer & { kind: AnswerKind }) | null {
  const m = msgs.findLast((x) => x.kind === "answer");
  return m?.answer ?? null;
}

/** Draft an anonymous battle from the thread for the asker to review (nothing is posted here). */
export async function draftCrowd(userIn: User | null, id: string) {
  const user = await requireAccess(userIn);
  const t = await ownThread(user, id);
  if (t.classification.scope === "sensitive" || t.classification.crisis) throw new AppError("FORBIDDEN", "This one stays private, so it can't go to the crowd.");
  if (t.battleId) throw new AppError("CONFLICT", "This question is already with the crowd.");
  const msgs = await db.select().from(pickbotMessages).where(eq(pickbotMessages.threadId, t.id)).orderBy(asc(pickbotMessages.createdAt));
  const ans = lastAnswer(msgs);
  if (!ans) throw new AppError("CONFLICT", "Get Pickbot's answer first.");
  const qs = msgs.filter((m) => m.kind === "question");
  const photos = qs.flatMap((m) => m.photos);
  const { draft, stats } = await draftCrowdBattle({ question: qs[0]?.text ?? t.title, followUps: qs.slice(1).map((m) => m.text), pick: ans.pick, photoCount: photos.length });
  const e = await getEconomy();
  const target = defaultTarget(user);
  const row = await addMessage(t.id, {
    role: "BOT",
    kind: "draft",
    text: draft.title,
    data: { draft, photos: photos.length >= 2 ? photos.slice(0, 2) : [], hours: e.pickbotCrowdHours, target },
    model: stats?.model,
    costUsd: stats?.costUsd,
    inputTokens: stats?.inputTokens,
    outputTokens: stats?.outputTokens,
  });
  track("pickbot_crowd_drafted", { threadId: t.id, removed: draft.removed.length }, { userId: user.id });
  return { messageId: row.id, draft, photos: photos.length >= 2 ? photos.slice(0, 2) : [], hours: e.pickbotCrowdHours, target };
}

/** People like the asker: same sex, their age range and the ones next to it. */
export function defaultTarget(u: Pick<User, "sex" | "ageRange">) {
  const t: { sexes?: ("MALE" | "FEMALE")[]; ageRanges?: (typeof AGE_RANGE_IDS)[number][] } = {};
  if (u.sex === "MALE" || u.sex === "FEMALE") t.sexes = [u.sex];
  const i = AGE_RANGE_IDS.indexOf(u.ageRange as (typeof AGE_RANGE_IDS)[number]);
  if (i >= 0) t.ageRanges = AGE_RANGE_IDS.slice(Math.max(0, i - 1), i + 2);
  return t;
}

/** Post the reviewed draft as an anonymous "Asked via Pickbot" battle. Only on the asker's explicit tap. */
export async function postCrowd(
  userIn: User | null,
  id: string,
  input: { title: string; context: string; a: string; b: string; withPhotos: boolean; hours: number; targetLikeMe: boolean },
) {
  const user = await requireAccess(userIn);
  if (!user.onboardedAt || !user.handle) throw new AppError("FORBIDDEN", "Finish setting up your profile first");
  const t = await ownThread(user, id);
  if (t.battleId) throw new AppError("CONFLICT", "This question is already with the crowd.");
  if (t.classification.scope === "sensitive" || t.classification.crisis) throw new AppError("FORBIDDEN", "This one stays private, so it can't go to the crowd.");
  const e = await getEconomy();
  const cap = isPlus(user) || isAdmin(user) ? e.pickbotPlusCrowdPerDay : e.pickbotCrowdPerDay;
  if ((await crowdToday(user.id)) >= cap) throw new AppError("LIMIT_REACHED", "You've asked the crowd today already. Try again tomorrow.");
  const [d] = await db
    .select()
    .from(pickbotMessages)
    .where(and(eq(pickbotMessages.threadId, t.id), eq(pickbotMessages.kind, "draft")))
    .orderBy(desc(pickbotMessages.createdAt))
    .limit(1);
  if (!d) throw new AppError("CONFLICT", "Make a draft first.");
  const data = d.data as { draft: CrowdDraft; photos: string[] };
  const photos = input.withPhotos ? data.photos : [];
  const created = await createBattle(
    user,
    {
      title: input.title,
      context: input.context,
      tags: input.targetLikeMe ? { target: defaultTarget(user) } : {},
      visibility: "PUBLIC",
      deadlineHours: Math.max(1, Math.min(input.hours, e.maxBattleHours)),
      options: [
        { label: input.a, imageUrl: photos[0] ?? undefined },
        { label: input.b, imageUrl: photos[1] ?? undefined },
      ],
    } as Parameters<typeof createBattle>[1],
    { pickbot: true },
  );
  const [battle] = await db.select({ id: battles.id }).from(battles).where(eq(battles.slug, created.slug));
  await db.update(pickbotThreads).set({ battleId: battle.id, pickSide: data.draft.pickSide }).where(eq(pickbotThreads.id, t.id));
  await addMessage(t.id, {
    role: "BOT",
    kind: "note",
    text: created.inReview
      ? "Thanks! A moderator checks it before it goes live (usually quick). I'll bring the results back here when the votes are in."
      : "Posted anonymously. I'll bring the results back here when the votes are in.",
  });
  track("pickbot_crowd_posted", { threadId: t.id, battleId: battle.id, photos: photos.length, targeted: input.targetLikeMe, hours: input.hours, inReview: created.inReview }, { userId: user.id });
  return { slug: created.slug, inReview: created.inReview };
}

/** The asker says what they picked: closes the loop on the crowd battle (points as usual, voters see "Asked via Pickbot"). */
export async function threadOutcome(userIn: User | null, id: string, chosen: "A" | "B" | "NEITHER") {
  const user = await requireAccess(userIn);
  const t = await ownThread(user, id);
  if (!t.battleId) throw new AppError("CONFLICT", "This question wasn't posted to the crowd.");
  const [b] = await db.select({ slug: battles.slug }).from(battles).where(eq(battles.id, t.battleId));
  if (!b) throw new AppError("NOT_FOUND", "Battle not found");
  const res = await reportOutcome(b.slug, user, { chosen, thumb: chosen === "NEITHER" ? null : "UP" }, { pickbotAsker: true });
  await addMessage(t.id, { role: "USER", kind: "note", text: chosen === "NEITHER" ? "I went with neither" : `I picked ${chosen}` });
  track("pickbot_outcome", { threadId: t.id, chosen }, { userId: user.id });
  return res;
}

/**
 * Hourly: crowd battles that closed or reached `pickbotResultsAt` votes get a results summary in the thread, an
 * Activity alert and an email (once per thread).
 */
export async function deliverPickbotResults(now = new Date()) {
  const e = await getEconomy();
  const rows = await db
    .select({ t: pickbotThreads, b: { id: battles.id, slug: battles.slug, title: battles.title, status: battles.status, votesA: battles.votesA, votesB: battles.votesB, deadline: battles.deadline } })
    .from(pickbotThreads)
    .innerJoin(battles, eq(battles.id, pickbotThreads.battleId))
    .where(and(isNotNull(pickbotThreads.battleId), isNull(pickbotThreads.resultsAt)))
    .limit(200);
  let n = 0;
  for (const { t, b } of rows) {
    const closed = b.status !== "OPEN" || b.deadline < now;
    if (!resultsDue({ status: closed ? "CLOSED" : "OPEN", votes: b.votesA + b.votesB, delivered: false }, e.pickbotResultsAt)) continue;
    if (b.votesA + b.votesB === 0 && closed) {
      await db.update(pickbotThreads).set({ resultsAt: now }).where(eq(pickbotThreads.id, t.id));
      await addMessage(t.id, { role: "BOT", kind: "note", text: "Your crowd question closed without votes this time. Want to try again with a shorter title?" });
      continue;
    }
    // Claim first so two cron runs can't both send.
    const claimed = await db
      .update(pickbotThreads)
      .set({ resultsAt: now })
      .where(and(eq(pickbotThreads.id, t.id), isNull(pickbotThreads.resultsAt)))
      .returning({ id: pickbotThreads.id });
    if (!claimed.length) continue;
    const [owner] = await db.select().from(users).where(eq(users.id, t.userId));
    if (!owner) continue;
    const summary = await resultsSummary(owner, b.id, t.pickSide);
    await addMessage(t.id, { role: "BOT", kind: "results", text: summary.line, data: summary });
    await notify(db, owner.id, "PICKBOT_RESULTS", { threadId: t.id, title: t.title, votes: summary.total });
    await deliver(owner, "pickbot_results", t.id, {
      threadId: t.id,
      title: t.title,
      labelA: summary.labelA,
      labelB: summary.labelB,
      votesA: summary.votesA,
      votesB: summary.votesB,
      agreed: summary.agreed,
    });
    await sendPush(owner.id, { title: "The crowd answered", body: summary.line, url: `/ask/${t.id}`, tag: `pickbot:${t.id}` });
    track("pickbot_results_delivered", { threadId: t.id, battleId: b.id, votes: summary.total, agreed: summary.agreed, closed }, { userId: owner.id });
    n++;
  }
  return n;
}

async function resultsSummary(owner: User, battleId: string, pickSide: "A" | "B" | null) {
  const [b] = await db.select({ votesA: battles.votesA, votesB: battles.votesB }).from(battles).where(eq(battles.id, battleId));
  const opts = await db.select({ side: options.side, label: options.label }).from(options).where(eq(options.battleId, battleId));
  const labelA = opts.find((o) => o.side === "A")?.label ?? "A";
  const labelB = opts.find((o) => o.side === "B")?.label ?? "B";
  const likeLabel = likeYouLabel(owner.sex, owner.ageRange);
  let like: { a: number; b: number } | null = null;
  if (owner.sex && owner.ageRange) {
    const [r] = await db.execute<{ a: number; b: number }>(sql`
      SELECT count(*) FILTER (WHERE v.side = 'A')::int AS a, count(*) FILTER (WHERE v.side = 'B')::int AS b
      FROM vote v JOIN "user" u ON u.id = v.user_id
      WHERE v.battle_id = ${battleId} AND NOT v.flagged AND u.sex = ${owner.sex} AND u.age_range = ${owner.ageRange}`);
    if (r && Number(r.a) + Number(r.b) >= 3) like = { a: Number(r.a), b: Number(r.b) };
  }
  const reasons = await db
    .select({ reason: votes.reason })
    .from(votes)
    .where(and(eq(votes.battleId, battleId), isNotNull(votes.reason), eq(votes.flagged, false)))
    .orderBy(desc(votes.createdAt))
    .limit(2);
  const total = b.votesA + b.votesB;
  const agreed = crowdAgreed(pickSide, b.votesA, b.votesB);
  const winner = b.votesA === b.votesB ? null : b.votesA > b.votesB ? labelA : labelB;
  const line = winner
    ? `The crowd is in: ${winner} won with ${Math.round((Math.max(b.votesA, b.votesB) / total) * 100)}% of ${total} votes.${agreed === true ? " You and I were on the same page." : agreed === false ? " The crowd went the other way from me." : ""}`
    : `The crowd is split down the middle (${total} votes).`;
  return { total, votesA: b.votesA, votesB: b.votesB, labelA, labelB, like, likeLabel, reasons: reasons.map((r) => r.reason!).filter(Boolean), agreed, line };
}
