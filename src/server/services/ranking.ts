/** Pure feed-ranking math (PRD 9.1–9.2). Unit tested. */
export type RankInput = {
  categoryId: string;
  kidAgeTags: string[];
  authorCountry: string | null;
  isFriend: boolean;
  isFollowed: boolean;
  votes: number;
  hoursUntilDeadline: number;
  hoursSincePublish: number;
  priorityFactor: number;
};

export type ViewerProfile = {
  categoryShare: Record<string, number>; // share of last 100 votes per category (0..1)
  kidAges: string[];
  country: string | null;
};

export function relevance(v: ViewerProfile, b: RankInput): number {
  const categoryAffinity = Math.max(0.1, v.categoryShare[b.categoryId] ?? 0);
  let audienceMatch = 0.5;
  if (b.kidAgeTags.length) {
    if (!v.kidAges.length) audienceMatch = 0.4;
    else audienceMatch = b.kidAgeTags.some((t) => v.kidAges.includes(t)) ? 1 : 0;
  }
  const regionMatch = !v.country || !b.authorCountry ? 0.5 : v.country.toLowerCase() === b.authorCountry.toLowerCase() ? 1 : 0.3;
  const socialProximity = b.isFriend ? 1 : b.isFollowed ? 0.6 : 0;
  return 0.35 * categoryAffinity + 0.35 * audienceMatch + 0.15 * regionMatch + 0.15 * socialProximity;
}

export function feedScore(v: ViewerProfile, b: RankInput): number {
  const urgency = 1 / (1 + Math.max(0, b.hoursUntilDeadline) / 6);
  const needVotes = 1 / (1 + b.votes / 10);
  const freshness = Math.exp(-b.hoursSincePublish / 48);
  return relevance(v, b) * (0.4 * urgency + 0.4 * needVotes + 0.2 * freshness) * b.priorityFactor;
}

/** Diversity pass: ≤2 consecutive from one category, ≤1 per author per 10 cards. */
export function diversify<T extends { categoryId: string; authorId: string }>(sorted: T[], limit: number): T[] {
  const out: T[] = [];
  const pool = [...sorted];
  while (out.length < limit && pool.length) {
    const recentAuthors = new Set(out.slice(-9).map((x) => x.authorId));
    const last2 = out.slice(-2).map((x) => x.categoryId);
    const blockedCat = last2.length === 2 && last2[0] === last2[1] ? last2[0] : null;
    let idx = pool.findIndex((x) => !recentAuthors.has(x.authorId) && x.categoryId !== blockedCat);
    if (idx === -1) idx = pool.findIndex((x) => !recentAuthors.has(x.authorId));
    if (idx === -1) idx = 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/** FNV-1a 32-bit hash → [0, 1). Deterministic, so a seed gives a stable order. */
function hashUnit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** Spread of the per-viewer shuffle: scores are multiplied by a factor in [SHUFFLE_MIN, SHUFFLE_MIN + 1). */
export const SHUFFLE_MIN = 0.6;

/**
 * Per-viewer random multiplier for a battle's feed score, so every viewer sees
 * a different order. Deterministic for (seed, battleId), so the order holds
 * still while the seed does (one viewer, one day). The spread (~2.7x max ratio)
 * shuffles battles of similar score while a boost (2x) still lifts a battle on average.
 */
export function shuffleFactor(seed: string, battleId: string): number {
  return SHUFFLE_MIN + hashUnit(`${seed}:${battleId}`);
}

/** Seed for a viewer's shuffle: their account or device, rotated daily (UTC). */
export function shuffleSeed(viewerKey: string, now: Date): string {
  return `${viewerKey}:${now.toISOString().slice(0, 10)}`;
}

/**
 * Data brain Phase 3: multiplier from Shimon's engagement score (0–1, starts at the 0.2 prior). A battle at the
 * prior is unchanged; better ones rise, worse ones sink, clamped to [0.5, 2]. weight 0 = off.
 */
export function engagementFactor(score: number, weight: number, prior = 0.2): number {
  if (!weight || !Number.isFinite(score)) return 1;
  return Math.min(2, Math.max(0.5, 1 + weight * (score - prior)));
}

/** Stable holdout assignment: the same account/device is always in or out. pct in [0, 100]. */
export function inHoldout(viewerKey: string, pct: number): boolean {
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  return hashUnit(`holdout:${viewerKey}`) < pct / 100;
}
