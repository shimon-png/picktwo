import { describe, expect, it } from "vitest";
import { gapFactor, hotFactor } from "@/server/services/ranking";

describe("hotFactor", () => {
  it("lifts battles with real votes in the last day, capped", () => {
    expect(hotFactor(0, 2)).toBe(1);
    expect(hotFactor(5, 2)).toBe(2);
    expect(hotFactor(50, 2)).toBe(2);
    expect(hotFactor(2.5, 3)).toBe(2);
    expect(hotFactor(10, 1)).toBe(1);
  });
});

describe("gapFactor", () => {
  it("boosts battles that test a missing trait", () => {
    expect(gapFactor(["romantic"], ["romantic", "direct"], 3)).toBe(3);
    expect(gapFactor(["spender"], ["romantic"], 3)).toBe(1);
    expect(gapFactor(["romantic"], [], 3)).toBe(1);
    expect(gapFactor(["romantic"], ["romantic"], 1)).toBe(1);
  });
});
