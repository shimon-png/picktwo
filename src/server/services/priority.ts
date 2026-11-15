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
