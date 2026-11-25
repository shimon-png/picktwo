/**
 * "People like you" result bar (About-you plan §3, Nov 25 2026): how people of the viewer's sex and age range voted
 * on a battle. Uses the narrowest group with enough real votes (sex × age, then sex alone); hidden otherwise.
 * Pure; tested in tests/unit/like-you.test.ts.
 */
import { AGE_RANGES } from "./constants";

export type LikeYouVote = { side: "A" | "B"; sex: string | null; age: string | null };
export type LikeYouScore = { label: string; a: number; b: number; total: number };
export type LikeYou = ({ kind: "score" } & LikeYouScore) | { kind: "locked"; question: "sex" | "age"; label: string };

const SEX_PLURAL: Record<string, string> = { FEMALE: "Women", MALE: "Men" };
export const ageLabel = (id: string | null | undefined) => AGE_RANGES.find((a) => a.id === id)?.label ?? null;

export function likeYouLabel(sex: string | null | undefined, age: string | null | undefined): string | null {
  const s = sex ? SEX_PLURAL[sex] : null;
  if (!s) return null;
  const a = ageLabel(age);
  return a ? `${s} ${a}` : s;
}

function score(votes: LikeYouVote[], label: string): LikeYouScore {
  const a = votes.filter((v) => v.side === "A").length;
  const total = votes.length;
  const pa = total ? Math.round((100 * a) / total) : 0;
  return { label, a: pa, b: total ? 100 - pa : 0, total };
}

/** The narrowest group (sex × age, then sex) with at least `min` votes, or null. */
export function likeYouScore(votes: LikeYouVote[], me: { sex?: string | null; age?: string | null }, min: number): LikeYouScore | null {
  if (!me.sex || !SEX_PLURAL[me.sex]) return null;
  const sameSex = votes.filter((v) => v.sex === me.sex);
  if (me.age) {
    const narrow = sameSex.filter((v) => v.age === me.age);
    if (narrow.length >= min) return score(narrow, likeYouLabel(me.sex, me.age)!);
  }
  if (sameSex.length >= min) return score(sameSex, likeYouLabel(me.sex, null)!);
  return null;
}

/**
 * What the bar shows: a score; or, when the person skipped the question that would unlock it, a locked bar that
 * opens that card again ("Tell us your age to see"); else nothing.
 */
export function likeYouView(
  votes: LikeYouVote[],
  me: { sex?: string | null; age?: string | null },
  skipped: { sex: boolean; age: boolean },
  min: number,
): LikeYou | null {
  const s = likeYouScore(votes, me, min);
  if (s) return { kind: "score", ...s };
  if (!me.sex && skipped.sex) return { kind: "locked", question: "sex", label: "Tell us if you're a woman or man to see" };
  if (me.sex && !me.age && skipped.age) return { kind: "locked", question: "age", label: "Tell us your age to see" };
  return null;
}
