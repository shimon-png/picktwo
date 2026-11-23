import { describe, expect, it } from "vitest";
import { engagementScore, returnWeight, weightCaseSql, PRIOR } from "@/server/services/engagement-rules";

describe("engagement score", () => {
  it("weights next-day returns most", () => {
    expect(returnWeight(1)).toBeGreaterThan(returnWeight(2));
    expect(returnWeight(2)).toBeGreaterThan(returnWeight(3));
    expect(returnWeight(0)).toBe(0);
    expect(returnWeight(4)).toBe(0);
    expect(returnWeight(null)).toBe(0);
  });
  it("starts at the prior and moves with real voters", () => {
    expect(engagementScore(0, 0)).toBeCloseTo(PRIOR);
    expect(engagementScore(50, 50)).toBeGreaterThan(0.9);
    expect(engagementScore(0, 50)).toBeLessThan(0.05);
    // More evidence beats a lucky small sample.
    expect(engagementScore(40, 50)).toBeGreaterThan(engagementScore(2, 2));
  });
  it("never exceeds 1 even with bad inputs", () => {
    expect(engagementScore(10, 3)).toBeLessThanOrEqual(1);
  });
  it("builds a matching SQL CASE", () => {
    expect(weightCaseSql("v.d")).toBe("(CASE v.d WHEN 1 THEN 1 WHEN 2 THEN 0.6 WHEN 3 THEN 0.3 ELSE 0 END)");
  });
});
