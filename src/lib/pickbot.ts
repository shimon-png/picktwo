/**
 * Pickbot (PRD docs/plans/pickbot-prd.html, Nov 2026): the pure rules shared by the server and the chat UI. Which
 * step comes next (profile questions, general vs tailored, quick battles, the answer), the quick-battle picker, the
 * classifier and answer validators, cost math, the anonymity scrub for crowd drafts and the free-answer cap.
 * No I/O; tested in tests/unit/pickbot.test.ts.
 */
import { ABOUT_QUESTION_IDS, type AboutQuestionId } from "./about";
import { THEMES } from "./brain-tags";

/** The shared poster of crowd battles made in Pickbot (Shimon, Nov 2026: one honest identity, not random handles). */
export const PICKBOT_HANDLE = "askedviapickbot";
export const PICKBOT_NAME = "Asked via Pickbot";

export type Theme = (typeof THEMES)[number];
export type Scope = "decision" | "advice" | "off_topic" | "sensitive";
export type Extended = "kids" | "housing" | "work";
export const EXTENDED_FIELDS: readonly Extended[] = ["kids", "housing", "work"];

/** What the small model says about a question. */
export type Classification = { scope: Scope; theme: Theme; extended: Extended[]; title: string; crisis: boolean };

/** Choices the asker made in a thread (thread.state). */
export type ThreadState = {
  /** Older threads only (the skip link and the general/tailored choice are gone since Nov 26). */
  skipGates?: boolean;
  choice?: "general" | "tailored";
  /** "Not now" during the quick battles. */
  stopBattles?: boolean;
  /** After a general answer: "Want a better answer?" → quick battles to the target, then a tailored answer. */
  retailor?: boolean;
  /** Started from a "People like you are asking" preset (lib/asking.ts). Posting it to the crowd retires the preset. */
  preset?: string;
  /** "Get answers from the crowd" (Alex, Nov 27 2026): true = post to the crowd after the answer. Older threads: unset. */
  crowd?: boolean;
};

export type Step =
  | { type: "off_topic" }
  | { type: "gate"; q: AboutQuestionId; index: number; total: number }
  | { type: "battles"; left: number }
  | { type: "answer"; kind: AnswerKind };
export type AnswerKind = "tailored" | "general";

/**
 * The profile cards Pickbot needs before any answer (Shimon, Nov 26 2026): every about-you card, no skipping. Race and
 * party offer "Prefer not to say", which counts as answered.
 */
export function neededQuestions(): AboutQuestionId[] {
  return [...ABOUT_QUESTION_IDS];
}

export function answerKind(votes: number, target: number): AnswerKind {
  return votes >= target ? "tailored" : "general";
}

/**
 * The next step before an answer (Shimon, Nov 26 2026):
 *  1. every missing profile card, one at a time in the chat (no skip);
 *  2. then the answer right away: "tailored" if the taste profile is complete (`target` battles), else "general";
 *  3. after a general answer, "Want a better answer?" (`retailor`) → quick battles until `target` (stop any time),
 *     then a fresh tailored answer.
 */
export function nextStep(a: {
  c: Classification;
  known: Partial<Record<AboutQuestionId, unknown>>;
  votes: number;
  target: number;
  state: ThreadState;
}): Step {
  if (a.c.scope === "off_topic") return { type: "off_topic" };
  const needed = neededQuestions();
  const missing = needed.filter((q) => !a.known[q]);
  if (missing.length) return { type: "gate", q: missing[0], index: needed.length - missing.length + 1, total: needed.length };
  const left = Math.max(0, a.target - a.votes);
  if (a.state.retailor && left > 0 && !a.state.stopBattles) return { type: "battles", left };
  return { type: "answer", kind: answerKind(a.votes, a.target) };
}

/** Roughly how long the quick battles take ("~2 min"), at ~10 seconds a battle. */
export function battlesTime(left: number): string {
  const s = left * 10;
  return s < 60 ? `~${Math.max(10, Math.round(s / 10) * 10)} sec` : `~${Math.round(s / 60)} min`;
}

/** Quick battles for the chat: ones matching the question's theme first (in feed order), then the rest. */
export function pickQuickBattles<T extends { id: string; theme: string | null }>(feed: T[], theme: Theme, n: number): T[] {
  const same = feed.filter((b) => b.theme === theme && theme !== "other");
  const rest = feed.filter((b) => !same.includes(b));
  return [...same, ...rest].slice(0, Math.max(0, n));
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Turn the classifier's JSON into a safe Classification; unknown values fall back to a plain decision question. */
export function parseClassification(raw: unknown, question: string): Classification {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const scope = (["decision", "advice", "off_topic", "sensitive"] as const).find((s) => s === r.scope) ?? "decision";
  const theme = (THEMES as readonly string[]).includes(String(r.theme)) ? (r.theme as Theme) : "other";
  const extended = Array.isArray(r.extended) ? EXTENDED_FIELDS.filter((f) => (r.extended as unknown[]).includes(f)) : [];
  const title = str(r.title, 80) || question.trim().slice(0, 80);
  return { scope, theme, extended, title, crisis: r.crisis === true };
}

export type Confidence = "sure" | "fairly_sure" | "toss_up";
/** The structured answer (PRD §6.4). Field order is the streaming order: the pick shows first. */
export type Answer = { pick: string; why: string; crowd: string; confidence: Confidence; flip: string; care: string };

export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    pick: { type: "string", description: "One clear choice in a few words, or 'It depends on …' only when truly balanced." },
    why: { type: "string", description: "2–3 short sentences tying the pick to this person's traits and situation." },
    crowd: { type: "string", description: "One sentence on how people like them voted on the similar battles given, using only those numbers. Empty if none were given." },
    confidence: { type: "string", enum: ["sure", "fairly_sure", "toss_up"] },
    flip: { type: "string", description: "The one condition that would change the pick." },
    care: { type: "string", description: "For health, legal, money or safety topics: a short line suggesting a professional or resources. Otherwise empty." },
  },
  required: ["pick", "why", "crowd", "confidence", "flip", "care"],
  additionalProperties: false,
} as const;

export function parseAnswer(raw: unknown): Answer | null {
  const r = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!r || !str(r.pick, 200)) return null;
  const confidence = (["sure", "fairly_sure", "toss_up"] as const).find((c) => c === r.confidence) ?? "fairly_sure";
  return { pick: str(r.pick, 200), why: str(r.why, 900), crowd: str(r.crowd, 400), confidence, flip: str(r.flip, 300), care: str(r.care, 400) };
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = { sure: "Sure", fairly_sure: "Fairly sure", toss_up: "Toss-up" };

/**
 * A string field from JSON that is still streaming in (`{"pick": "Dress A, the gr`), for showing the answer as it
 * arrives. Returns the decoded text so far, or "" before the field starts.
 */
export function partialField(json: string, key: string): string {
  const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)("?)`).exec(json);
  if (!m) return "";
  let body = m[1];
  if (!m[2]) body = body.replace(/\\(u[0-9a-fA-F]{0,3})?$/, ""); // drop a half-received escape at the end
  try {
    return JSON.parse(`"${body}"`) as string;
  } catch {
    return body;
  }
}

/** Price per million tokens (input, output), Nov 2026. */
export const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
};

export type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

/** Dollars for one call (cache reads at 0.1×, cache writes at 1.25×). */
export function callCost(model: string, u: Usage): number {
  const p = MODEL_PRICES[model];
  if (!p) return 0;
  const input = (u.input_tokens ?? 0) + 0.1 * (u.cache_read_input_tokens ?? 0) + 1.25 * (u.cache_creation_input_tokens ?? 0);
  return (input * p.in + (u.output_tokens ?? 0) * p.out) / 1_000_000;
}

/** Economy `pickbotModelOpus`: 0 = Sonnet 5.5 (launch choice, Shimon Nov 2026), 1 = Opus 5.5. */
export const answerModel = (opus: number) => (opus ? "claude-opus-5-5" : "claude-sonnet-5-5");
export const SMALL_MODEL = "claude-haiku-5-5";

/**
 * Safety net on crowd drafts (after the model's own anonymizing): strips emails, phone numbers, @handles and links,
 * so an identifying detail the model missed can't reach the public battle. Returns the text and what it removed.
 */
export function scrubIdentifiers(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const rules: [RegExp, string][] = [
    [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "email"],
    [/https?:\/\/\S+|www\.\S+/gi, "link"],
    [/(?:\+?\d[\s().-]?){7,}\d/g, "phone number"],
    [/(^|\s)@\w{2,}/g, "username"],
  ];
  let out = text;
  for (const [re, label] of rules) {
    out = out.replace(re, (m, lead) => {
      if (!removed.includes(label)) removed.push(label);
      return typeof lead === "string" && label === "username" ? lead : "";
    });
  }
  return { text: out.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim(), removed };
}

/** Free answers left today (Plus = unlimited, shown as null). */
export function answersLeft(usedToday: number, cap: number, plus: boolean): number | null {
  return plus ? null : Math.max(0, cap - usedToday);
}

/** A Pickbot crowd battle's results go back to the asker when it closes or reaches `atVotes` votes, once. */
export function resultsDue(b: { status: string; votes: number; delivered: boolean }, atVotes: number): boolean {
  return !b.delivered && (b.status !== "OPEN" || b.votes >= atVotes);
}

/** Did the crowd agree with Pickbot? `side` = the option Pickbot's pick became in the crowd draft. null = tie or unknown. */
export function crowdAgreed(side: "A" | "B" | null | undefined, votesA: number, votesB: number): boolean | null {
  if (!side || votesA === votesB) return null;
  return side === (votesA > votesB ? "A" : "B");
}
