/**
 * "What's on your mind this week?" (Alex + Shimon, Nov 26 2026). One tap-to-answer card in the Vote deck; the topic
 * picked steers the next battles toward it (via the AI theme tags in `battle.tags.brain`, plus a few words for
 * topics the taxonomy has no theme for, like gifts). After a run of votes with that in mind, a signed-out person
 * gets the "We're starting to really understand you" card that opens sign-up. Pure; tested in tests/unit/mind.test.ts.
 */
import type { BrainTags } from "./brain-tags";

export const MIND_TOPICS = [
  { id: "money", label: "Money" },
  { id: "dating", label: "Dating" },
  { id: "work", label: "Work" },
  { id: "family", label: "Family" },
  { id: "gifts", label: "Gifts" },
  { id: "home", label: "Where to live" },
] as const;
/** "Other" (Alex, Nov 26): typed in their own words; always last on the card, never shuffled. */
export const MIND_OTHER = "other" as const;
export const MIND_TEXT_MAX = 60;
export type MindTopic = (typeof MIND_TOPICS)[number]["id"] | typeof MIND_OTHER;
export const MIND_TOPIC_IDS = [...MIND_TOPICS.map((t) => t.id), MIND_OTHER] as unknown as [MindTopic, ...MindTopic[]];

/** AI themes that count as each topic. */
const THEMES: Record<MindTopic, readonly BrainTags["theme"][]> = {
  money: ["money"],
  dating: ["dating", "couples", "cheating_trust", "exes"],
  work: ["career", "school"],
  family: ["family_parenting", "weddings"],
  gifts: [],
  home: ["home"],
  other: [],
};

/** Words in the question or story that count too (for gifts, which has no AI theme, and to catch untagged battles). */
const WORDS: Record<MindTopic, RegExp> = {
  money: /\b(money|budget|salary|raise|debt|loan|savings?|invest\w*|splurge|afford\w*|pay(ing)? for|bills?|groceries|recession|inflation|paycheck|credit card)\b/i,
  dating: /\b(date|dating|tinder|hinge|bumble|boyfriend|girlfriend|crush|first date|situationship)\b/i,
  work: /\b(job|jobs|work|boss|coworker|career|offer|interview|promotion|quit|office|salary|laid off|layoffs?|unemployed|hiring)\b/i,
  family: /\b(mom|dad|parents?|kids?|baby|sister|brother|in-laws?|mother-in-law|family|toddler)\b/i,
  gifts: /\b(gifts?|presents?|birthday|anniversary|christmas|holiday shopping|stocking|secret santa|valentine'?s?)\b/i,
  home: /\b(apartment|rent|lease|move|moving|neighbou?rhood|house|condo|roommates?|city|suburbs?|mortgage)\b/i,
  other: /(?!)/,
};

/** Words too common to steer by. */
const STOP = new Set(
  "about after again also always because been being but can could did does doing dont each from have having here into just know like make maybe more most much need only other really should some still than that their them then there these they thing things this those though through very want what when where which while will with would your youre".split(" "),
);

/** Tidy a typed answer: one line, no links, at most MIND_TEXT_MAX characters; null if nothing is left. */
export function cleanMindText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim().slice(0, MIND_TEXT_MAX);
  return t.length >= 2 ? t : null;
}

/** The words of a typed answer worth matching battles on (4+ letters, not stop words), at most 6. */
export function mindWords(text: string | null | undefined): string[] {
  if (!text) return [];
  const words = text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [];
  return [...new Set(words.map((w) => w.replace(/'s$/, "").replace(/'/g, "")).filter((w) => w.length >= 4 && !STOP.has(w)))].slice(0, 6);
}

/** The listed topics a typed answer is really about (e.g. "my rent is going up" → home), by the same words. */
export function topicsInText(text: string | null | undefined): MindTopic[] {
  if (!text) return [];
  return MIND_TOPICS.map((t) => t.id).filter((id) => WORDS[id].test(text));
}

export const isMindTopic = (v: unknown): v is MindTopic => typeof v === "string" && (MIND_TOPIC_IDS as readonly string[]).includes(v);

/** Does this battle fit the topic? By its AI theme first, else by the words in its question / story. */
export function matchesMind(topic: MindTopic, b: { theme?: string | null; title: string; context?: string | null }, text?: string | null): boolean {
  if (topic === MIND_OTHER) {
    // Typed answer: a battle with one of its words (as a word start, so "wedding" finds "weddings"), or on a topic
    // the answer names.
    const hay = `${b.title} ${b.context ?? ""}`.toLowerCase();
    if (mindWords(text).some((w) => new RegExp(`\\b${w.replace(/[^a-z-]/g, "")}`).test(hay))) return true;
    return topicsInText(text).some((t) => matchesMind(t, b));
  }
  if (b.theme && (THEMES[topic] as readonly string[]).includes(b.theme)) return true;
  return WORDS[topic].test(`${b.title} ${b.context ?? ""}`);
}

/** The person's latest "on your mind" row: when it was shown, and the topic (null = skipped or not answered yet). */
export type MindRow = { at: Date; topic: MindTopic | null; text?: string | null; answeredAt: Date | null; nudgedAt: Date | null };

export type MindRules = { mindAt: number; mindDays: number; mindNudgeAfter: number };

const DAY = 86400_000;

/**
 * Ask now? From `mindAt` votes on (0 = off), once per `mindDays` ("this week"): any showing in that window, answered
 * or not, waits for the next one.
 */
export function mindCardDue(a: { votes: number; last: MindRow | null; now: Date }, r: MindRules): boolean {
  if (r.mindAt <= 0 || a.votes < r.mindAt) return false;
  return !a.last || a.now.getTime() - a.last.at.getTime() >= r.mindDays * DAY;
}

/** The topic steering the deck right now: answered within `mindDays`. */
export function activeMind(last: MindRow | null, now: Date, days: number): MindTopic | null {
  if (!last?.topic || !last.answeredAt) return null;
  return now.getTime() - last.answeredAt.getTime() < days * DAY ? last.topic : null;
}

/**
 * Show "We're starting to really understand you, sign up to see your personality map"? Signed-out only, once per
 * topic pick, after `mindNudgeAfter` votes since they picked it (0 = off).
 */
export function mindNudgeDue(a: { signedIn: boolean; last: MindRow | null; votesSince: number; now: Date }, r: MindRules): boolean {
  if (a.signedIn || r.mindNudgeAfter <= 0) return false;
  if (!activeMind(a.last, a.now, r.mindDays) || a.last!.nudgedAt) return false;
  return a.votesSince >= r.mindNudgeAfter;
}

/** Feed score multiplier: battles on the person's topic rise by `boost` (1 = off). */
export function mindFactor(topic: MindTopic | null, b: Parameters<typeof matchesMind>[1], boost: number, text?: string | null): number {
  if (!topic || boost <= 1) return 1;
  return matchesMind(topic, b, text) ? boost : 1;
}

export const mindLabel = (t: MindTopic) => (t === MIND_OTHER ? "Other" : (MIND_TOPICS.find((x) => x.id === t)?.label ?? t));
