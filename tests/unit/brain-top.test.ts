import { describe, expect, it } from "vitest";
import { countKpi, funnelSteps, nyDayFraction, nyDayOf, ratioKpi, testBadge, valueKpi } from "@/server/services/brain-top-rules";

const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-11-${String(28 - i).padStart(2, "0")}`);

describe("ratioKpi", () => {
  it("compares the headline day with the pooled 7 days before it", () => {
    const rows = days(9).map((day, i) => ({ day, num: i === 0 ? 9 : 1, den: 10 }));
    const k = ratioKpi(rows);
    expect(k.now).toBeCloseTo(0.9);
    expect(k.avg).toBeCloseTo(0.1);
    expect(k.change).toBeCloseTo(8);
    expect(k.day).toBe("2026-11-28");
    expect(k.series).toHaveLength(9);
    expect(k.series.at(-1)).toBeCloseTo(0.9);
  });
  it("pools, so a tiny day doesn't swing the average", () => {
    const k = ratioKpi([
      { day: "d0", num: 1, den: 2 },
      { day: "d1", num: 1, den: 1 },
      { day: "d2", num: 0, den: 99 },
    ]);
    expect(k.avg).toBeCloseTo(0.01);
  });
  it("can headline an older day (next-day return needs a finished next day)", () => {
    const rows = days(10).map((day, i) => ({ day, num: i, den: 10 }));
    const k = ratioKpi(rows, 2);
    expect(k.day).toBe("2026-11-26");
    expect(k.now).toBeCloseTo(0.2);
    expect(k.series.at(-1)).toBeCloseTo(0.2);
  });
  it("handles no data", () => {
    expect(ratioKpi([]).now).toBeNull();
    expect(ratioKpi([{ day: "d", num: 0, den: 0 }]).now).toBeNull();
  });
});

describe("countKpi", () => {
  it("judges today by its pace", () => {
    const rows = days(8).map((day, i) => ({ day, n: i === 0 ? 50 : 100 }));
    const k = countKpi(rows, 0.5);
    expect(k.now).toBe(50);
    expect(k.avg).toBe(100);
    expect(k.change).toBeCloseTo(0);
  });
  it("no pace in the first hour", () => {
    expect(countKpi([{ day: "a", n: 1 }, { day: "b", n: 100 }], 0.01).change).toBeNull();
  });
});

describe("valueKpi", () => {
  it("measures change against the size of a negative average", () => {
    const k = valueKpi([{ day: "a", v: -0.01 }, { day: "b", v: -0.02 }], -0.02);
    expect(k.change).toBeCloseTo(0.5);
    expect(k.series).toEqual([-0.02, -0.01]);
  });
});

describe("New York day helpers", () => {
  it("uses New York time", () => {
    expect(nyDayOf(new Date("2026-11-28T03:00:00Z"))).toBe("2026-11-27");
    expect(nyDayFraction(new Date("2026-11-28T17:00:00Z"))).toBeCloseTo(0.5);
  });
});

describe("funnelSteps", () => {
  it("gives share of visitors and of the step before", () => {
    const s = funnelSteps({ visitors: 100, engaged: 40, voted: 20, voted3: 10, gate: 5, signed: 2, back: 8 });
    expect(s.map((x) => x.label)).toEqual(["Visitors", "Engaged", "Voted", "3+ votes", "Hit the wall", "Signed up", "Came back"]);
    expect(s[1].ofVisitors).toBeCloseTo(0.4);
    expect(s[2].fromPrev).toBeCloseTo(0.5);
    expect(s[0].fromPrev).toBeNull();
  });
});

describe("testBadge", () => {
  const arms = (a: number, b: number, n = 500) => [
    { label: "A", people: n, value: a },
    { label: "B", people: n, value: b },
  ];
  it("off, early, flat, winner", () => {
    expect(testBadge({ on: false, arms: arms(1, 2), p: 0.01 }).label).toBe("Off");
    expect(testBadge({ on: true, arms: arms(1, 2, 100), p: 0.01 }).label).toBe("Too early");
    expect(testBadge({ on: true, arms: arms(1, 2), p: null }).label).toBe("Too early");
    expect(testBadge({ on: true, arms: arms(1, 2), p: 0.3 }).label).toBe("No difference");
    expect(testBadge({ on: true, arms: arms(1, 2), p: 0.01 }).label).toBe("B ahead");
    expect(testBadge({ on: true, arms: arms(1, 2), p: 0.01, higherIsBetter: false }).label).toBe("A ahead");
  });
});
