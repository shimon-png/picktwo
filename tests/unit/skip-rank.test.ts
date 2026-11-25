import { describe, expect, it } from "vitest";
import { averagePickRate, pickRate, skipFactor } from "@/server/services/ranking";

describe("skip signal in the deck", () => {
  it("starts at the prior with no data", () => {
    expect(pickRate(0, 0, 0.8)).toBeCloseTo(0.8);
    expect(skipFactor(0, 0, 0.8, 2)).toBeCloseTo(1);
  });
  it("ranks voted-on battles above skipped ones", () => {
    const voted = skipFactor(40, 2, 0.8, 2);
    const skipped = skipFactor(10, 30, 0.8, 2);
    expect(voted).toBeGreaterThan(1);
    expect(skipped).toBeLessThan(1);
  });
  it("trusts more evidence over a small sample", () => {
    expect(skipFactor(0, 2, 0.8, 2)).toBeGreaterThan(skipFactor(0, 40, 0.8, 2));
  });
  it("is clamped and can be turned off", () => {
    expect(skipFactor(0, 1000, 0.8, 5)).toBe(0.5);
    expect(skipFactor(1000, 0, 0.3, 5)).toBe(2);
    expect(skipFactor(0, 1000, 0.8, 0)).toBe(1);
  });
  it("uses the real average once there is enough data", () => {
    expect(averagePickRate([{ votes: 30, skips: 10 }])).toBe(0.8); // < 50 decisions → fallback
    expect(averagePickRate([{ votes: 60, skips: 40 }], 0.8)).toBeCloseTo(0.6);
  });
});
