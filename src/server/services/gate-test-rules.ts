import { hashUnit } from "./ranking";

/**
 * Sign-up gate A/B test, pure rules (tested in tests/unit/gate-test.test.ts).
 * A = control: after the free votes, a sign-up wall that can't be skipped (what we had before the test).
 * B = soft: after the free votes, a sign-up dialog that can be closed; voting goes on, and it shows again every
 *     `every` votes.
 */
export type GateArm = "control" | "soft";
export const GATE_EXPERIMENT = "signup_gate_v1";
export const ARM_LABELS: Record<GateArm, string> = { control: "A · must sign up", soft: "B · can close" };

/** Random but stable: the same browser always lands in the same group. pct = share put in B. */
export function pickArm(unitId: string, pct: number): GateArm {
  if (pct <= 0) return "control";
  if (pct >= 100) return "soft";
  return hashUnit(`gate:${unitId}`) < pct / 100 ? "soft" : "control";
}

/**
 * A signed-out visitor's next new vote. `usedBefore` = votes they've already cast (free ones included).
 * allow: the vote goes through. prompt: show the closable sign-up dialog after this vote (group B only; group A's
 * wall is shown by the client once the free votes run out).
 */
export function gateDecision(arm: GateArm, usedBefore: number, limit: number, every: number): { allow: boolean; prompt: boolean } {
  if (arm === "control") return { allow: usedBefore < limit, prompt: false };
  const after = usedBefore + 1;
  const step = Math.max(1, every);
  return { allow: true, prompt: after >= limit && (after - limit) % step === 0 };
}

export type GateVisitor = { day: string; arm: GateArm; votes: number; sawGate: boolean; signedUp: boolean };
export type GateCell = { visitors: number; votes: number; avgVotes: number; reachedGate: number; signups: number; signupRate: number };
export type GateDay = { day: string; control: GateCell; soft: GateCell };

function cell(list: GateVisitor[]): GateCell {
  const visitors = list.length;
  const votes = list.reduce((t, v) => t + v.votes, 0);
  const signups = list.filter((v) => v.signedUp).length;
  return {
    visitors,
    votes,
    avgVotes: visitors ? votes / visitors : 0,
    reachedGate: list.filter((v) => v.sawGate).length,
    signups,
    signupRate: visitors ? signups / visitors : 0,
  };
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Two-sided p-value that two rates differ (two-proportion z-test). null when there isn't enough data. */
export function twoProportionP(x1: number, n1: number, x2: number, n2: number): number | null {
  if (n1 < 1 || n2 < 1) return null;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return null;
  return 2 * (1 - normCdf(Math.abs(x1 / n1 - x2 / n2) / se));
}

/** Two-sided p-value that two means differ (Welch, normal approximation; fine for the sample sizes we'll judge on). */
export function meansP(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const mean = (x: number[]) => x.reduce((t, v) => t + v, 0) / x.length;
  const variance = (x: number[], m: number) => x.reduce((t, v) => t + (v - m) ** 2, 0) / (x.length - 1);
  const ma = mean(a);
  const mb = mean(b);
  const se = Math.sqrt(variance(a, ma) / a.length + variance(b, mb) / b.length);
  if (!se) return null;
  return 2 * (1 - normCdf(Math.abs(ma - mb) / se));
}

/** Day-by-day and overall numbers per group, plus whether the differences are real (p < 0.05). */
export function summarizeGateTest(visitors: GateVisitor[]) {
  const days = [...new Set(visitors.map((v) => v.day))].sort().reverse();
  const by = (arm: GateArm, day?: string) => visitors.filter((v) => v.arm === arm && (!day || v.day === day));
  const daily: GateDay[] = days.map((day) => ({ day, control: cell(by("control", day)), soft: cell(by("soft", day)) }));
  const a = by("control");
  const b = by("soft");
  const total = { control: cell(a), soft: cell(b) };
  const lift = (x: number, y: number) => (x ? (y - x) / x : null);
  return {
    daily,
    total,
    signupP: twoProportionP(total.control.signups, total.control.visitors, total.soft.signups, total.soft.visitors),
    votesP: meansP(
      a.map((v) => v.votes),
      b.map((v) => v.votes),
    ),
    /** B vs A, as a share of A (0.2 = B is 20% higher). */
    signupLift: lift(total.control.signupRate, total.soft.signupRate),
    votesLift: lift(total.control.avgVotes, total.soft.avgVotes),
  };
}
