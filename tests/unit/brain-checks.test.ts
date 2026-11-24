import { describe, expect, it } from "vitest";
import { brainChecks, type BrainNumbers } from "@/server/services/brain-checks";

const good: BrainNumbers = {
  visits: 10,
  visitors: 7,
  votes: 30,
  voters: 5,
  signups: 2,
  battles: 1,
  daily: [
    { visits: 6, visitors: 5, votes: 20, voters: 4, signups: 1, posts: 1 },
    { visits: 4, visitors: 3, votes: 10, voters: 2, signups: 1, posts: 0 },
  ],
  visitSources: [
    { visits: 7, visitors: 5 },
    { visits: 3, visitors: 3 },
  ],
  byKind: [
    { seen: 20, voted: 15 },
    { seen: 10, voted: 8 },
  ],
  rawSources: [{ sessions: 10, visitors: 7, voters: 5 }],
  signupSourcesTotal: 2,
};

describe("brainChecks", () => {
  it("passes when every table reconciles with the tiles", () => {
    expect(brainChecks(good).filter((c) => !c.ok)).toEqual([]);
  });

  it("flags Text vs photo votes above the votes tile (the Nov 24 bug)", () => {
    const bad = { ...good, votes: 20, daily: [{ ...good.daily[0], votes: 20 }, { ...good.daily[1], votes: 0 }] };
    const failed = brainChecks(bad).filter((c) => !c.ok).map((c) => c.rule);
    expect(failed).toEqual(["Text vs photo: Voted ≤ Votes tile"]);
  });

  it("flags day-by-day totals that don't add up", () => {
    const bad = { ...good, visits: 11 };
    const failed = brainChecks(bad).filter((c) => !c.ok).map((c) => c.rule);
    expect(failed).toContain("Day-by-day visits add up to the Visits tile");
    expect(failed).toContain("Visits by source add up to the Visits tile");
  });

  it("flags more voters than votes and a sign-up total mismatch", () => {
    const bad = { ...good, voters: 31, signupSourcesTotal: 3 };
    const failed = brainChecks(bad).filter((c) => !c.ok).map((c) => c.rule);
    expect(failed).toContain("People who voted ≤ Votes");
    expect(failed).toContain("Sign-ups by source total = Sign-ups tile");
  });

  it("skips the sign-ups-by-source rule when windows differ", () => {
    const { signupSourcesTotal: _omit, ...rest } = good;
    void _omit;
    expect(brainChecks(rest).some((c) => c.rule.startsWith("Sign-ups by source"))).toBe(false);
  });
});
