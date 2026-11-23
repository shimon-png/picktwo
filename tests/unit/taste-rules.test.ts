import { describe, expect, it } from "vitest";
import { addTraits, shares, topLifts } from "@/server/services/taste-rules";

describe("taste profiles", () => {
  it("counts and shares traits", () => {
    const c = addTraits(addTraits({}, ["romantic", "traditional"]), ["romantic"]);
    expect(c).toEqual({ romantic: 2, traditional: 1 });
    expect(shares(c).romantic).toBeCloseTo(2 / 3);
    expect(shares({})).toEqual({});
  });
  it("finds over-represented traits only", () => {
    const everyone = { tech_forward: 50, romantic: 50 };
    const group = { tech_forward: 30, romantic: 10 };
    const top = topLifts(group, everyone);
    expect(top).toHaveLength(1);
    expect(top[0].trait).toBe("tech_forward");
    expect(top[0].lift).toBeCloseTo(1.5);
  });
  it("ignores traits with too few mentions", () => {
    expect(topLifts({ rare: 2, common: 2 }, { rare: 100, common: 1000 })).toEqual([]);
  });
});
