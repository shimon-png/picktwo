/**
 * "About you" cards in the Vote deck (About-you plan, Nov 25 2026): one tap-to-answer question at a time, shown as
 * the next card after a result, never two in a row. Shared by the server (which decides when) and the deck (which
 * shows them). Pure; tested in tests/unit/about.test.ts.
 */
import { AGE_RANGES, KID_AGES } from "./constants";

export const ABOUT_QUESTION_IDS = ["sex", "age", "relationship", "zip", "kids", "housing", "work"] as const;
export type AboutQuestionId = (typeof ABOUT_QUESTION_IDS)[number];

export type AboutOption = { id: string; label: string };
export type AboutQuestion = {
  id: AboutQuestionId;
  title: string;
  sub: string;
  /** Tap answers (the card splits into equal slices). The ZIP card is a text box instead. */
  options: AboutOption[];
  kind: "tap" | "zip";
  /** Only asked once the person has an account. */
  afterSignup: boolean;
  /** Economy key holding the vote number it's first asked after. */
  atKey: "aboutSexAt" | "aboutAgeAt" | "aboutRelationshipAt" | "aboutZipAt" | "aboutKidsAt" | "aboutHousingAt" | "aboutWorkAt";
};

export const RELATIONSHIP_OPTIONS = [
  { id: "SINGLE", label: "Single" },
  { id: "DATING", label: "Dating" },
  { id: "TAKEN", label: "Taken" },
  { id: "MARRIED", label: "Married" },
] as const;
export const HOUSING_OPTIONS = [
  { id: "RENT", label: "Rent" },
  { id: "OWN", label: "Own" },
  { id: "FAMILY", label: "Live with family" },
] as const;
export const WORK_OPTIONS = [
  { id: "STUDENT", label: "Student" },
  { id: "WORKING", label: "Working" },
  { id: "BOTH", label: "Both" },
  { id: "NEITHER", label: "Neither" },
] as const;
export const KIDS_CARD_OPTIONS = [
  { id: "NO", label: "No" },
  { id: "EXPECTING", label: "Expecting" },
  { id: "YES", label: "Yes" },
] as const;

export const ABOUT_QUESTIONS: Record<AboutQuestionId, AboutQuestion> = {
  sex: {
    id: "sex",
    title: "I'm a…",
    sub: "So we can show you how people like you voted.",
    options: [
      { id: "FEMALE", label: "Woman" },
      { id: "MALE", label: "Man" },
    ],
    kind: "tap",
    afterSignup: false,
    atKey: "aboutSexAt",
  },
  age: { id: "age", title: "I'm…", sub: "Narrows your “people like you” results.", options: [...AGE_RANGES], kind: "tap", afterSignup: false, atKey: "aboutAgeAt" },
  relationship: {
    id: "relationship",
    title: "Right now I'm…",
    sub: "Couples battles split very differently by this.",
    options: [...RELATIONSHIP_OPTIONS],
    kind: "tap",
    afterSignup: false,
    atKey: "aboutRelationshipAt",
  },
  zip: { id: "zip", title: "What's your ZIP?", sub: "See what people near you picked.", options: [], kind: "zip", afterSignup: false, atKey: "aboutZipAt" },
  kids: { id: "kids", title: "Kids?", sub: "Parents often pick differently.", options: [...KIDS_CARD_OPTIONS], kind: "tap", afterSignup: true, atKey: "aboutKidsAt" },
  housing: { id: "housing", title: "I…", sub: "Home battles split by this.", options: [...HOUSING_OPTIONS], kind: "tap", afterSignup: true, atKey: "aboutHousingAt" },
  work: { id: "work", title: "Right now I'm…", sub: "Last one for a while.", options: [...WORK_OPTIONS], kind: "tap", afterSignup: true, atKey: "aboutWorkAt" },
};

export const KID_AGE_CHOICES = KID_AGES;

/** Valid answer for a question (ZIP checked separately against the ZIP list). */
export function isValidAboutAnswer(q: AboutQuestionId, answer: string): boolean {
  if (q === "zip") return /^[0-9A-Za-z -]{3,10}$/.test(answer);
  return ABOUT_QUESTIONS[q].options.some((o) => o.id === answer);
}

export type AboutState = {
  /** Votes this person has cast so far, including the one just counted. */
  votes: number;
  signedIn: boolean;
  /** Questions already answered (by a card, sign-up or Settings). */
  answered: Set<AboutQuestionId>;
  /** Per question: how many times it was skipped, and at which vote count the last skip happened. */
  skipped: Map<AboutQuestionId, { times: number; atVotes: number }>;
  /** Vote count when the last about-you card was shown (null = never). */
  lastAskAt: number | null;
};

export type AboutSchedule = Record<AboutQuestion["atKey"], number> & { aboutMinGap: number; aboutSkipRetry: number };

/**
 * Which about-you card to show after this vote, if any. Rules: at its scheduled vote or later; not answered;
 * signed-in-only questions wait for an account; at least `aboutMinGap` votes since the last card (never two in a
 * row); a skipped question comes back once, `aboutSkipRetry` votes later, then never in the deck. Scheduled order
 * wins when several are due. A scheduled vote of 0 turns that question off.
 */
export function nextAboutCard(s: AboutState, sched: AboutSchedule): AboutQuestionId | null {
  if (s.lastAskAt != null && s.votes - s.lastAskAt < sched.aboutMinGap) return null;
  const due = ABOUT_QUESTION_IDS.map((id) => ABOUT_QUESTIONS[id])
    .filter((q) => sched[q.atKey] > 0)
    .sort((a, b) => sched[a.atKey] - sched[b.atKey]);
  for (const q of due) {
    if (s.votes < sched[q.atKey]) continue;
    if (s.answered.has(q.id)) continue;
    if (q.afterSignup && !s.signedIn) continue;
    const sk = s.skipped.get(q.id);
    if (sk && (sk.times >= 2 || s.votes - sk.atVotes < sched.aboutSkipRetry)) continue;
    return q.id;
  }
  return null;
}

/** A fresh random order for the answers each time (no answer gets the top spot more often). */
export function shuffled<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
