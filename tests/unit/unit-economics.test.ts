import { describe, expect, it } from "vitest";
import { money, unitEconomics, whatIf, type UeAssumptions } from "@/server/services/unit-economics-rules";

const A: UeAssumptions = { ueAdCpm: 4, ueVotesPerAd: 5, ueSponsoredSharePct: 10, ueSponsoredCpm: 20, ueSignupValue: 1.5, ueLifetimeVisits: 1.5 };

describe("unitEconomics", () => {
  it("matches the worked example: 5.8 votes per visit, 1.5 visits, 5% sign-ups", () => {
    // 1000 visitors, 1000 visits (5.8 votes per visit), 50 sign-ups; lifetime visits set to 1.5.
    const u = unitEconomics({ visitors: 1000, visits: 1000, votes: 5800, signups: 50, costPerVisitor: 0.002 }, A);
    expect(u.lifetimeVotes).toBeCloseTo(8.7);
    expect(u.revenue.ads).toBeCloseTo(0.00696, 5);
    expect(u.revenue.sponsored).toBeCloseTo(0.0174, 5);
    expect(u.revenue.signups).toBeCloseTo(0.075, 5);
    expect(u.breakEven).toBeCloseTo(0.00696 + 0.0174 + 0.075 - 0.002, 5);
  });
  it("uses measured visits per visitor when lifetime visits is 0", () => {
    const u = unitEconomics({ visitors: 100, visits: 150, votes: 600, signups: 0, costPerVisitor: null }, { ...A, ueLifetimeVisits: 0 });
    expect(u.lifetimeVisits).toBe(1.5);
    expect(u.lifetimeVotes).toBe(6); // = votes per visitor when lifetime is measured
    expect(u.costKnown).toBe(false);
  });
  it("no visitors gives zeros, never NaN", () => {
    const u = unitEconomics({ visitors: 0, visits: 0, votes: 0, signups: 0, costPerVisitor: null }, A);
    expect(u.breakEven).toBe(0);
  });
  it("what-ifs move the right way", () => {
    const w = whatIf({ visitors: 1000, visits: 1000, votes: 5800, signups: 50, costPerVisitor: 0 }, A);
    expect(w.doubleSignupRate - w.base).toBeCloseTo(0.075, 5);
    expect(w.signupValueX3 - w.base).toBeCloseTo(0.15, 5);
    expect(w.oneMoreVisit).toBeGreaterThan(w.base);
  });
  it("money format", () => {
    expect(money(0.10396)).toBe("$0.104");
    expect(money(0.0042)).toBe("$0.0042");
    expect(money(1.234)).toBe("$1.23");
    expect(money(-0.05)).toBe("−$0.050");
  });
});
