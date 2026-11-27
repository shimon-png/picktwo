import { describe, expect, it } from "vitest";
import { beforeAfter, change, isoDay, parseChange, periodOf, summarize, type BaRow, type Day } from "@/server/services/before-after-rules";

const d = (day: string, visitors: number, votes: number, voters: number, signups: number): Day => ({ day, visitors, visits: visitors, signups, votes, voters, posts: 0 });
const row = (x: Day, period: BaRow["period"], weight = 1, label = x.day): BaRow => ({ ...x, period, weight, label });

describe("parseChange", () => {
  it("a day or a New York minute", () => {
    expect(parseChange(20261125)).toEqual({ day: "2026-11-25", time: null });
    expect(parseChange(202611251123)).toEqual({ day: "2026-11-25", time: "11:23" });
    expect(isoDay(202611251123)).toBe("2026-11-25");
  });
});

describe("day-only mode", () => {
  it("splits days around the change day (which counts as neither)", () => {
    expect(periodOf("2026-11-24", "2026-11-25")).toBe("before");
    expect(periodOf("2026-11-25", "2026-11-25")).toBe("launch");
    expect(periodOf("2026-11-26", "2026-11-25")).toBe("after");
  });
  it("per-day averages and ratios per period, newest day first, before capped", () => {
    const r = beforeAfter(
      [d("2026-11-20", 99, 99, 9, 9), d("2026-11-23", 10, 30, 5, 1), d("2026-11-24", 30, 30, 10, 1), d("2026-11-25", 50, 200, 20, 5), d("2026-11-26", 20, 100, 10, 4)],
      "2026-11-25",
      2,
    );
    expect(r.rows.map((x) => `${x.day}:${x.period}`)).toEqual(["2026-11-26:after", "2026-11-25:launch", "2026-11-24:before", "2026-11-23:before"]);
    expect(r.before).toMatchObject({ days: 2, visitors: 20, votes: 30, votesPerVisitor: 1.5, signupRate: 0.05 });
    expect(r.after).toMatchObject({ days: 1, visitors: 20, votes: 100, votesPerVisitor: 5, votesPerVoter: 10, signupRate: 0.2 });
    expect(change(r.before.votesPerVisitor, r.after.votesPerVisitor)).toBeCloseTo(2.333, 2);
    expect(change(0, 5)).toBeNull();
  });
});

describe("split change day", () => {
  it("the change day's halves sit on either side, After above Before, weighted as part-days", () => {
    const r = summarize([
      row(d("2026-11-24", 20, 40, 10, 2), "before"),
      row(d("2026-11-25", 10, 10, 5, 1), "before", 0.5, "2026-11-25 until 12:00"),
      row(d("2026-11-25", 10, 30, 6, 2), "after", 0.5, "2026-11-25 from 12:00"),
      row(d("2026-11-26", 5, 20, 4, 1), "after", 0.25),
    ]);
    expect(r.rows.map((x) => x.label)).toEqual(["2026-11-26", "2026-11-25 from 12:00", "2026-11-25 until 12:00", "2026-11-24"]);
    // Before: 30 visitors over 1.5 days; After: 15 visitors over 0.75 days.
    expect(r.before).toMatchObject({ days: 1.5, visitors: 20, votes: 100 / 3 });
    expect(r.after).toMatchObject({ days: 0.8, visitors: 20, votes: 50 / 0.75, votesPerVisitor: 50 / 15 });
  });
});
