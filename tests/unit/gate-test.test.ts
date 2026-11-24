import { describe, expect, it } from "vitest";
import { gateDecision, meansP, normCdf, pickArm, summarizeGateTest, twoProportionP, type GateVisitor } from "@/server/services/gate-test-rules";

describe("pickArm", () => {
  it("is stable per browser and splits about evenly at 50%", () => {
    expect(pickArm("d_abc", 50)).toBe(pickArm("d_abc", 50));
    const ids = Array.from({ length: 4000 }, (_, i) => `d_${i.toString(16).padStart(32, "0")}${i}`);
    const soft = ids.filter((id) => pickArm(id, 50) === "soft").length / ids.length;
    expect(soft).toBeGreaterThan(0.46);
    expect(soft).toBeLessThan(0.54);
  });
  it("0% = everyone A, 100% = everyone B", () => {
    expect(pickArm("d_x", 0)).toBe("control");
    expect(pickArm("d_x", 100)).toBe("soft");
  });
});

describe("gateDecision", () => {
  it("A: free votes, then the wall", () => {
    expect(gateDecision("control", 4, 5, 5)).toEqual({ allow: true, prompt: false });
    expect(gateDecision("control", 5, 5, 5)).toEqual({ allow: false, prompt: false });
  });
  it("B: never blocked; the dialog shows on the 5th vote, then every 5", () => {
    const prompts = Array.from({ length: 21 }, (_, used) => gateDecision("soft", used, 5, 5))
      .map((d, used) => (d.allow ? (d.prompt ? used + 1 : 0) : -1))
      .filter((n) => n !== 0);
    expect(prompts).toEqual([5, 10, 15, 20]);
  });
});

describe("stats", () => {
  it("normCdf", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
  });
  it("two proportions: clear vs no difference", () => {
    expect(twoProportionP(100, 1000, 150, 1000)!).toBeLessThan(0.01);
    expect(twoProportionP(100, 1000, 102, 1000)!).toBeGreaterThan(0.5);
    expect(twoProportionP(0, 0, 1, 1)).toBeNull();
  });
  it("means", () => {
    const a = Array.from({ length: 200 }, (_, i) => 5 + (i % 3));
    const b = Array.from({ length: 200 }, (_, i) => 8 + (i % 3));
    expect(meansP(a, b)!).toBeLessThan(0.001);
    expect(meansP(a, [...a])!).toBeCloseTo(1, 5);
  });
});

describe("summarizeGateTest", () => {
  const v = (day: string, arm: "control" | "soft", votes: number, signedUp = false, sawGate = votes >= 5): GateVisitor => ({ day, arm, votes, signedUp, sawGate });
  it("per day and overall, newest day first, avg votes per visitor", () => {
    const s = summarizeGateTest([
      v("2026-11-24", "control", 5, true),
      v("2026-11-24", "control", 1),
      v("2026-11-24", "soft", 12),
      v("2026-11-25", "soft", 3),
    ]);
    expect(s.daily.map((d) => d.day)).toEqual(["2026-11-25", "2026-11-24"]);
    expect(s.daily[1].control).toMatchObject({ visitors: 2, votes: 6, avgVotes: 3, signups: 1, signupRate: 0.5, reachedGate: 1 });
    expect(s.daily[0].control.visitors).toBe(0);
    expect(s.total.soft).toMatchObject({ visitors: 2, votes: 15, avgVotes: 7.5, signups: 0 });
    expect(s.votesLift).toBeCloseTo(1.5);
    expect(s.signupLift).toBe(-1);
  });
});
