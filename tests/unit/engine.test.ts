import { describe, expect, it } from "vitest";
import { engagementFactor, inHoldout } from "@/server/services/ranking";

describe("engagementFactor", () => {
  it("is neutral at the prior or with weight 0", () => {
    expect(engagementFactor(0.2, 2)).toBe(1);
    expect(engagementFactor(0.9, 0)).toBe(1);
    expect(engagementFactor(Number.NaN, 2)).toBe(1);
  });
  it("boosts sticky battles and dampens others, clamped", () => {
    expect(engagementFactor(0.5, 2)).toBeCloseTo(1.6);
    expect(engagementFactor(0.1, 2)).toBeCloseTo(0.8);
    expect(engagementFactor(1, 5)).toBe(2);
    expect(engagementFactor(0, 5)).toBe(0.5);
  });
});

describe("inHoldout", () => {
  it("handles the edges", () => {
    expect(inHoldout("x", 0)).toBe(false);
    expect(inHoldout("x", 100)).toBe(true);
  });
  it("is stable per viewer and close to the target share", () => {
    expect(inHoldout("u_abc", 10)).toBe(inHoldout("u_abc", 10));
    let n = 0;
    for (let i = 0; i < 10000; i++) if (inHoldout(`dev_${i}`, 10)) n++;
    expect(n).toBeGreaterThan(800);
    expect(n).toBeLessThan(1200);
  });
});
