/**
 * Profile bar (Pickbot PRD Phase 0, Nov 25 2026): one number for how complete someone's profile is, shown in the
 * Vote deck and on You. A complete profile = the four core about-you answers (sex, age, relationship, ZIP) plus
 * `target` battles answered (economy `tasteFullAt`, 30: where the full taste profile unlocks). Pure; tested in
 * tests/unit/profile-progress.test.ts.
 */
import type { AboutQuestionId } from "./about";

export const CORE_ABOUT: readonly AboutQuestionId[] = ["sex", "age", "relationship", "zip"];

export type ProfileProgress = {
  votes: number;
  target: number;
  /** Battles still to answer (0 once at target). */
  left: number;
  /** Core about-you questions not answered yet, in asking order. */
  missing: AboutQuestionId[];
  /** 0–1: votes up to target plus core answers, as one bar. */
  pct: number;
  complete: boolean;
};

export function profileProgress(votes: number, known: Partial<Record<AboutQuestionId, unknown>>, target: number): ProfileProgress {
  const t = Math.max(1, Math.floor(target));
  const v = Math.max(0, Math.floor(votes));
  const missing = CORE_ABOUT.filter((q) => !known[q]);
  const left = Math.max(0, t - v);
  const steps = t + CORE_ABOUT.length;
  const done = Math.min(v, t) + (CORE_ABOUT.length - missing.length);
  return { votes: v, target: t, left, missing, pct: done / steps, complete: left === 0 && missing.length === 0 };
}

/** The bar's one line, e.g. "8 more battles to your full profile". */
export function progressLine(p: ProfileProgress): string {
  if (p.complete) return "Profile complete";
  if (p.left > 0) return `${p.left} more battle${p.left === 1 ? "" : "s"} to your full profile`;
  return `${p.missing.length} quick question${p.missing.length === 1 ? "" : "s"} to finish your profile`;
}

const knownFrom = (p: ProfileProgress) => Object.fromEntries(CORE_ABOUT.filter((q) => !p.missing.includes(q)).map((q) => [q, true]));

/** After a new deck vote: computed on the client so the bar moves at once (the server count wins on reload). */
export function withVote(p: ProfileProgress): ProfileProgress {
  return profileProgress(p.votes + 1, knownFrom(p), p.target);
}

/** After an about-you answer: that question is no longer missing. */
export function withAnswer(p: ProfileProgress, q: AboutQuestionId): ProfileProgress {
  return profileProgress(p.votes, { ...knownFrom(p), [q]: true }, p.target);
}
