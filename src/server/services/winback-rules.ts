/**
 * Data brain Phase 4: win-back rules (pure, unit tested). A person is "lapsing" when they have been away
 * clearly longer than their own usual gap between active days, but not so long that an email is unwelcome.
 */

/** Median gap in days between consecutive active days (day numbers, any order); null with fewer than 3 active days. */
export function usualGapDays(activeDays: number[]): number | null {
  const d = [...new Set(activeDays)].sort((a, b) => a - b);
  if (d.length < 3) return null;
  const gaps = d.slice(1).map((x, i) => x - d[i]).sort((a, b) => a - b);
  const m = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[m] : (gaps[m - 1] + gaps[m]) / 2;
}

/** Days away after which this person counts as lapsing: twice their usual gap, never below `minIdle`. */
export function lapseThreshold(usualGap: number | null, minIdle: number, fallbackGap = 3): number {
  return Math.max(minIdle, Math.ceil(2 * (usualGap ?? fallbackGap)));
}

export function isLapsing(o: { activeDays: number[]; today: number; minIdle: number; maxIdle: number }): {
  lapsing: boolean;
  idleDays: number;
  usualGap: number | null;
  threshold: number;
} {
  const last = o.activeDays.length ? Math.max(...o.activeDays) : -Infinity;
  const idleDays = o.today - last;
  const usualGap = usualGapDays(o.activeDays);
  const threshold = lapseThreshold(usualGap, o.minIdle);
  return { lapsing: Number.isFinite(idleDays) && idleDays >= threshold && idleDays <= o.maxIdle, idleDays, usualGap, threshold };
}

/** Links in win-back emails carry these tags so the return shows up in `session_start` (source = winback). */
export const WINBACK_UTM = "utm_source=winback&utm_medium=email&utm_campaign=winback";
