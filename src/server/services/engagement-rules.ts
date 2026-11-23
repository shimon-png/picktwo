/**
 * Shimon's engagement score (Nov 22 2026), pure parts. A battle is engaging when the people who voted on it
 * come back soon after: a return the next day counts most, then 2 days, then 3. Recomputed live for the
 * battles a returning person voted on, and in full by the daily job. Tested in tests/unit/engagement.test.ts.
 */

/** Calendar days are counted in this zone (most of the audience is US). */
export const ENGAGEMENT_TZ = "America/New_York";
/** Weight of a first return N days after voting (index = days). */
export const RETURN_WEIGHTS = [0, 1, 0.6, 0.3] as const;
export const MAX_RETURN_DAYS = RETURN_WEIGHTS.length - 1;
/** Smoothing: a battle starts at PRIOR and needs real voters to move away from it. */
export const PRIOR = 0.2;
export const PRIOR_WEIGHT = 5;

export function returnWeight(days: number | null | undefined): number {
  if (days == null || days < 1 || days > MAX_RETURN_DAYS) return 0;
  return RETURN_WEIGHTS[days];
}

/** Smoothed score in [0, 1]: (weighted returns + PRIOR·k) / (eligible voters + k). */
export function engagementScore(weightedReturns: number, eligibleVoters: number): number {
  const r = Math.max(0, Math.min(weightedReturns, eligibleVoters));
  return (r + PRIOR * PRIOR_WEIGHT) / (Math.max(0, eligibleVoters) + PRIOR_WEIGHT);
}

/** SQL CASE expression body for the weights, kept in sync with RETURN_WEIGHTS. */
export function weightCaseSql(col: string): string {
  const whens = RETURN_WEIGHTS.map((w, d) => (d === 0 ? "" : `WHEN ${d} THEN ${w}`)).filter(Boolean).join(" ");
  return `(CASE ${col} ${whens} ELSE 0 END)`;
}
