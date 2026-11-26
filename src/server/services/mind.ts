/**
 * "What's on your mind this week?" (lib/mind.ts has the rules). Rows live in `profile_answer` with `via = 'mind'`
 * (question `mind`: answer = topic, status shown / answered / skipped; question `mind_nudge`: the sign-up card was
 * shown; question `mind_text`: what they typed after "Other", private, admins see it in the Brain), so a guest's rows move to the account on sign-in with the about-you answers (`moveDeviceAnswers`), and the
 * about-you stats (which count `via = 'card'`) are untouched. `mindHoldoutPct` never see the card.
 */
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { profileAnswers } from "../db/schema";
import { getEconomy } from "./config";
import { inHoldout } from "./ranking";
import { track } from "../analytics";
import { tasteProfileFor } from "./taste-profile";
import { AppError } from "../errors";
import { activeMind, cleanMindText, isMindTopic, mindCardDue, mindNudgeDue, MIND_OTHER, type MindRow, type MindTopic } from "@/lib/mind";
import type { User } from "../db/schema";

type Viewer = { user: User | null; deviceId: string | null };

export const mindArm = (v: Viewer, pct: number) => (inHoldout(`mind:${v.user?.id ?? v.deviceId ?? ""}`, pct) ? "holdout" : "card");

const owner = (v: Viewer) =>
  v.user
    ? v.deviceId
      ? or(eq(profileAnswers.userId, v.user.id), eq(profileAnswers.deviceId, v.deviceId))
      : eq(profileAnswers.userId, v.user.id)
    : eq(profileAnswers.deviceId, v.deviceId!);

/** The latest topic row, with the nudge time if the sign-up card was shown after it. */
export async function mindRow(v: Viewer): Promise<MindRow | null> {
  if (!v.user && !v.deviceId) return null;
  const rows = await db
    .select({ q: profileAnswers.question, answer: profileAnswers.answer, status: profileAnswers.status, at: profileAnswers.createdAt, updatedAt: profileAnswers.updatedAt })
    .from(profileAnswers)
    .where(and(owner(v), eq(profileAnswers.via, "mind"), inArray(profileAnswers.question, ["mind", "mind_nudge", "mind_text"])))
    .orderBy(desc(profileAnswers.createdAt))
    .limit(10);
  const last = rows.find((r) => r.q === "mind");
  if (!last) return null;
  const nudge = rows.find((r) => r.q === "mind_nudge" && r.at >= last.at);
  const typed = rows.find((r) => r.q === "mind_text" && r.at >= last.at);
  const topic = last.status === "answered" && isMindTopic(last.answer) ? last.answer : null;
  return { at: last.at, topic, text: topic === MIND_OTHER ? (typed?.answer ?? null) : null, answeredAt: topic ? (last.updatedAt ?? last.at) : null, nudgedAt: nudge?.at ?? null };
}

/** The topic (and, for "Other", the typed words) steering this person's deck right now; null = none or holdout. Never throws. */
export async function activeMindTopic(v: Viewer): Promise<{ topic: MindTopic; text: string | null } | null> {
  try {
    const e = await getEconomy();
    if (e.mindBoost <= 1 || mindArm(v, e.mindHoldoutPct) === "holdout") return null;
    const row = await mindRow(v);
    const topic = activeMind(row, new Date(), e.mindDays);
    return topic ? { topic, text: row?.text ?? null } : null;
  } catch (err) {
    console.error("[mind] active", err);
    return null;
  }
}

async function votesSince(v: Viewer, since: Date): Promise<number> {
  const at = since.toISOString();
  const [r] = v.user
    ? await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vote WHERE user_id = ${v.user.id} AND created_at > ${at}`)
    : await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vote v
        WHERE (v.device_id = ${v.deviceId} OR v.user_id = (SELECT d.user_id FROM device d WHERE d.id = ${v.deviceId})) AND v.created_at > ${at}`);
  return Number(r?.n ?? 0);
}

/** `axes`: the person's real taste traits so far (shown blurred behind the sign-up button). */
export type MindAfterVote = { kind: "ask" } | { kind: "nudge"; topic: MindTopic; votes: number; axes: { id: string; score: number }[] };

/**
 * After a new deck vote (`votes` = the person's total so far): the sign-up nudge, the topic card, or nothing.
 * Records the showing. Never throws: the vote already counted.
 */
export async function mindAfterVote(v: Viewer, votes: number): Promise<MindAfterVote | null> {
  if (!v.user && !v.deviceId) return null;
  try {
    const e = await getEconomy();
    if (mindArm(v, e.mindHoldoutPct) === "holdout") return null;
    const last = await mindRow(v);
    const now = new Date();
    const values = { userId: v.user?.id ?? null, deviceId: v.user ? null : v.deviceId, via: "mind", atVotes: votes };
    if (last?.answeredAt && !v.user) {
      const since = await votesSince(v, last.answeredAt);
      if (mindNudgeDue({ signedIn: false, last, votesSince: since, now }, e)) {
        await db.insert(profileAnswers).values({ ...values, question: "mind_nudge", status: "shown" });
        const t = await tasteProfileFor(v).catch(() => null);
        return { kind: "nudge", topic: last.topic!, votes, axes: (t?.axes ?? []).map(({ id, score }) => ({ id, score })) };
      }
    }
    if (!mindCardDue({ votes, last, now }, e)) return null;
    await db.insert(profileAnswers).values({ ...values, question: "mind", status: "shown" });
    return { kind: "ask" };
  } catch (err) {
    console.error("[mind] after vote", err);
    return null;
  }
}

/** Save the topic picked (or a skip: null) on the card that was shown; "Other" comes with what they typed. */
export async function answerMind(v: Viewer, topic: MindTopic | null, rawText?: string | null) {
  if (!v.user && !v.deviceId) throw new AppError("VALIDATION", "Please enable cookies");
  if (topic !== null && !isMindTopic(topic)) throw new AppError("VALIDATION", "Pick one of the answers");
  const text = topic === MIND_OTHER ? cleanMindText(rawText) : null;
  if (topic === MIND_OTHER && !text) throw new AppError("VALIDATION", "Type what's on your mind");
  const status = topic ? "answered" : "skipped";
  const [shown] = await db
    .select({ id: profileAnswers.id })
    .from(profileAnswers)
    .where(and(owner(v), eq(profileAnswers.via, "mind"), eq(profileAnswers.question, "mind"), eq(profileAnswers.status, "shown")))
    .orderBy(desc(profileAnswers.createdAt))
    .limit(1);
  if (shown) await db.update(profileAnswers).set({ answer: topic, status, updatedAt: new Date() }).where(eq(profileAnswers.id, shown.id));
  else await db.insert(profileAnswers).values({ userId: v.user?.id ?? null, deviceId: v.user ? null : v.deviceId, question: "mind", answer: topic, status, via: "mind" });
  if (text) await db.insert(profileAnswers).values({ userId: v.user?.id ?? null, deviceId: v.user ? null : v.deviceId, question: "mind_text", answer: text, status: "answered", via: "mind" });
  // Never the typed text in an event (free text stays in profile_answer); just its length.
  track(topic ? "mind_answered" : "mind_skipped", topic ? { topic, ...(text ? { chars: text.length } : {}) } : {}, { userId: v.user?.id, deviceId: v.deviceId });
  return { ok: true, topic };
}
