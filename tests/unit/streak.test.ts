import { describe, expect, it } from "vitest";
import { isRollMilestone, rollLine } from "@/lib/streak";

describe("isRollMilestone", () => {
  it("fires at 10, 15, then every 20", () => {
    const hits = Array.from({ length: 100 }, (_, i) => i + 1).filter(isRollMilestone);
    expect(hits).toEqual([10, 15, 35, 55, 75, 95]);
  });
});

describe("rollLine", () => {
  it("starts with on a roll, then on fire, then cycles", () => {
    expect(rollLine(10)).toMatch(/on a roll/);
    expect(rollLine(15)).toMatch(/on fire/);
    expect(rollLine(35)).toBe("Unstoppable!");
    expect(rollLine(95)).toBe("Unstoppable!");
  });
});
