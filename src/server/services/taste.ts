/**
 * Pure taste-similarity math (no DB) — unit tested.
 * Two voters' similarity = how often they picked the same side on battles they both voted on.
 */

/** Minimum battles in common before someone shows up as a taste twin. */
export const TASTE_MIN_SHARED = 3;

/** Plain agreement percentage, for display. */
export function agreementPct(agree: number, shared: number): number {
  return shared > 0 ? Math.round((100 * agree) / shared) : 0;
}

/**
 * Ranking score: the lower bound of the 95% Wilson interval for the agreement rate.
 * Rewards both a high rate and more evidence, so 9/10 ranks above 1/1 and 30/40 above 3/4.
 */
export function similarityScore(agree: number, shared: number): number {
  if (shared <= 0) return 0;
  const z = 1.96;
  const p = agree / shared;
  const z2 = z * z;
  const centre = p + z2 / (2 * shared);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * shared)) / shared);
  return Math.max(0, (centre - margin) / (1 + z2 / shared));
}

export type TwinRow = { id: string; shared: number; agree: number };

/** Keep people with enough battles in common and sort best match first (ties: more in common, then id). */
export function rankTwins<T extends TwinRow>(rows: T[], minShared = TASTE_MIN_SHARED): (T & { pct: number; score: number })[] {
  return rows
    .filter((r) => r.shared >= minShared)
    .map((r) => ({ ...r, pct: agreementPct(r.agree, r.shared), score: similarityScore(r.agree, r.shared) }))
    .sort((a, b) => b.score - a.score || b.shared - a.shared || a.id.localeCompare(b.id));
}
