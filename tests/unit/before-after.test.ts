import { describe, expect, it } from "vitest";
import { beforeAfter, change, isoDay, periodOf, type Day } from "@/server/services/before-after-rules";

const d = (day: string, visitors: number, votes: number, voters: number, signups: number): Day => ({ day, visitors, visits: visitors, signups, votes, voters, posts: 0 });

describe("before / after", () => {
  it("splits days around the change day (which counts as neither)", () => {
    expect(periodOf("2026-11-24", "2026-11-25")).toBe("before");
    expect(periodOf("2026-11-25", "2026-11-25")).toBe("launch");
    expect(periodOf("2026-11-26", "2026-11-25")).toBe("after");
    expect(isoDay(20261125)).toBe("2026-11-25");
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
