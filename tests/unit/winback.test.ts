import { describe, expect, it } from "vitest";
import { isLapsing, lapseThreshold, usualGapDays } from "@/server/services/winback-rules";

describe("usualGapDays", () => {
  it("needs 3 active days", () => {
    expect(usualGapDays([1, 2])).toBeNull();
    expect(usualGapDays([5, 5, 6])).toBeNull();
  });
  it("is the median gap", () => {
    expect(usualGapDays([1, 2, 3, 4])).toBe(1);
    expect(usualGapDays([10, 1, 4, 7])).toBe(3);
    expect(usualGapDays([1, 2, 4, 8])).toBe(2);
    expect(usualGapDays([1, 2, 4, 8, 9])).toBe(1.5);
  });
});

describe("lapseThreshold / isLapsing", () => {
  it("uses twice the usual gap with a floor", () => {
    expect(lapseThreshold(1, 3)).toBe(3);
    expect(lapseThreshold(4, 3)).toBe(8);
    expect(lapseThreshold(null, 3)).toBe(6);
  });
  it("flags a daily voter after 3 quiet days, not after 2", () => {
    const days = [1, 2, 3, 4, 5];
    expect(isLapsing({ activeDays: days, today: 7, minIdle: 3, maxIdle: 30 }).lapsing).toBe(false);
    expect(isLapsing({ activeDays: days, today: 8, minIdle: 3, maxIdle: 30 }).lapsing).toBe(true);
  });
  it("leaves long-gone people alone", () => {
    expect(isLapsing({ activeDays: [1, 2, 3], today: 40, minIdle: 3, maxIdle: 30 }).lapsing).toBe(false);
  });
});
