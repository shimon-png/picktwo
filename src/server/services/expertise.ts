/**
 * Close-the-loop rules and expert tiers. Pure, no DB access — unit tested.
 * Business rules and the reasoning behind them: docs/rules/close-the-loop-and-experts.md.
 */

export type ExpertTier = "NONE" | "PRO" | "EXPERT" | "SUPER";

export type TierThresholds = {
  proAt: number;
  expertAt: number;
  superExpertAt: number;
};

/** Status from a user's lifetime correct picks: 20 = Pro (check), 50 = Expert (gold), 100 = Super expert (diamond). */
export function expertTier(correctPicks: number, t: TierThresholds): ExpertTier {
  if (correctPicks >= t.superExpertAt) return "SUPER";
  if (correctPicks >= t.expertAt) return "EXPERT";
  if (correctPicks >= t.proAt) return "PRO";
  return "NONE";
}

export const TIER_LABEL: Record<ExpertTier, string> = {
  NONE: "",
  PRO: "Pro",
  EXPERT: "Expert",
  SUPER: "Super expert",
};

/** The "critics" group for the Expert score: Expert and above. Regular and Pro voters are the general crowd. */
export function isExpertVoter(correctPicks: number, t: TierThresholds): boolean {
  return correctPicks >= t.expertAt;
}

/** Next tier and how many more correct picks it takes (null at the top). */
export function nextTier(correctPicks: number, t: TierThresholds): { tier: ExpertTier; needed: number } | null {
  if (correctPicks < t.proAt) return { tier: "PRO", needed: t.proAt - correctPicks };
  if (correctPicks < t.expertAt) return { tier: "EXPERT", needed: t.expertAt - correctPicks };
  if (correctPicks < t.superExpertAt) return { tier: "SUPER", needed: t.superExpertAt - correctPicks };
  return null;
}

/**
 * Posting gate: a user may post while they have fewer than `max` closed battles with no reported choice.
 * Open battles never count, so there is no cap on how many can run at once.
 */
export function canPostBattle(unreportedClosed: number, max: number): boolean {
  return max <= 0 || unreportedClosed < max;
}

/** Battles run at most `maxHours` from creation. Clamps a requested length, in hours. */
export function clampBattleHours(requested: number, maxHours: number): number {
  return Math.min(Math.max(1, requested), maxHours);
}

/** Latest allowed deadline for a battle created at `createdAt`. */
export function latestDeadline(createdAt: Date, maxHours: number): Date {
  return new Date(createdAt.getTime() + maxHours * 3600_000);
}

/** Share of votes for each side, or null when nobody in the group voted. */
export function sideScore(a: number, b: number): { a: number; b: number; total: number } | null {
  const total = a + b;
  if (total === 0) return null;
  const pa = Math.round((a / total) * 100);
  return { a: pa, b: 100 - pa, total };
}
