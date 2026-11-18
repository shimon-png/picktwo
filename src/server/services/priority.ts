/**
 * Pure Priority Queue math (PRD 5.4). No DB access — unit tested.
 */
export function loopFactor(openLoops: number): number {
  if (openLoops <= 0) return 1.0;
  if (openLoops === 1) return 0.6;
  if (openLoops === 2) return 0.3;
  return 0.1;
}

export function posterPriority(ppBalance: number, cap = 200): number {
  const v = Math.log2(1 + Math.max(0, ppBalance)) / Math.log2(1 + cap);
  return Math.min(1, Math.max(0.1, v));
}

export function priorityFactor(opts: { ppBalance: number; openLoops: number; boostActive: boolean; cap?: number }) {
  return posterPriority(opts.ppBalance, opts.cap) * loopFactor(opts.openLoops) * (opts.boostActive ? 2 : 1);
}

export type PriorityTier = { tier: "High" | "Normal" | "Low"; reason: string };

export function priorityTier(ppBalance: number, openLoops: number, cap = 200): PriorityTier {
  const f = priorityFactor({ ppBalance, openLoops, boostActive: false, cap });
  if (openLoops > 0) {
    const tier = f >= 0.5 ? "Normal" : "Low";
    return { tier, reason: `${openLoops} open loop${openLoops > 1 ? "s" : ""} — close ${openLoops > 1 ? "them" : "it"} to rank higher` };
  }
  if (f >= 0.7) return { tier: "High", reason: "You've been helping a lot — thank you!" };
  if (f >= 0.45) return { tier: "Normal", reason: "Vote on a few battles to rank higher" };
  return { tier: "Low", reason: "Vote on others' battles to earn priority" };
}

/** Quality-vote check (PRD 5.5). Returns null if the vote earns points, otherwise the reason it doesn't. */
export function voteQualityIssue(opts: {
  signedIn: boolean;
  isOwnBattle: boolean;
  dwellMs: number | undefined;
  recentVotesInWindow: number;
  lifetimeVotes: number;
  lifetimeSideAShare: number;
  minDwellMs: number;
  burstMaxVotes: number;
  degenerateMinVotes: number;
  degenerateRatio: number;
}): "anonymous" | "own" | "too_fast" | "burst" | "degenerate" | null {
  if (!opts.signedIn) return "anonymous";
  if (opts.isOwnBattle) return "own";
  if ((opts.dwellMs ?? 0) < opts.minDwellMs) return "too_fast";
  if (opts.recentVotesInWindow >= opts.burstMaxVotes) return "burst";
  if (
    opts.lifetimeVotes >= opts.degenerateMinVotes &&
    (opts.lifetimeSideAShare > opts.degenerateRatio || opts.lifetimeSideAShare < 1 - opts.degenerateRatio)
  )
    return "degenerate";
  return null;
}

export function isValidReason(reason: string | undefined | null, minChars: number): boolean {
  if (!reason) return false;
  const r = reason.trim();
  if (r.length < minChars) return false;
  if (/^(.)\1+$/.test(r.replace(/\s/g, ""))) return false;
  return true;
}

/** Report-back reminder schedule (PRD 7.4 O-6): deadline +2h, +48h, +7d. */
export const REMINDER_OFFSETS_HOURS = [2, 48, 168];
export function reminderDue(deadline: Date, reminderCount: number, now = new Date()): boolean {
  if (reminderCount >= REMINDER_OFFSETS_HOURS.length) return false;
  return now.getTime() >= deadline.getTime() + REMINDER_OFFSETS_HOURS[reminderCount] * 3600_000;
}

/**
 * Display tier for the ⚡ meter (crowdpick redesign): Normal → High → Top by balance.
 * Progress is how far the balance is through the current tier (Top is always 100%).
 */
export type PointsTierName = "Normal" | "High" | "Top";
export type PointsTier = {
  tier: PointsTierName;
  next: PointsTierName | null;
  toNext: number;
  progress: number;
  /** Fill 0–1 for each of the three segment bars (Normal / High / Top). */
  segments: [number, number, number];
};

export function pointsTier(points: number, highAt = 20, topAt = 40): PointsTier {
  const p = Math.max(0, Math.floor(points));
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const segments: [number, number, number] = [clamp(p / highAt), clamp((p - highAt) / (topAt - highAt)), p >= topAt ? 1 : 0];
  if (p >= topAt) return { tier: "Top", next: null, toNext: 0, progress: 1, segments };
  if (p >= highAt) return { tier: "High", next: "Top", toNext: topAt - p, progress: (p - highAt) / (topAt - highAt), segments };
  return { tier: "Normal", next: "High", toNext: highAt - p, progress: p / highAt, segments };
}
