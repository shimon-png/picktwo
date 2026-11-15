import { describe, it, expect } from "vitest";
import { loopFactor, posterPriority, priorityFactor, priorityTier, voteQualityIssue, isValidReason, reminderDue } from "@/server/services/priority";

const base = {
  signedIn: true,
  isOwnBattle: false,
  dwellMs: 3000,
  recentVotesInWindow: 0,
  lifetimeVotes: 0,
  lifetimeSideAShare: 0.5,
  minDwellMs: 1500,
  burstMaxVotes: 10,
  degenerateMinVotes: 30,
  degenerateRatio: 0.9,
};

describe("loop factor (PRD 5.4)", () => {
  it("penalises open loops progressively", () => {
    expect(loopFactor(0)).toBe(1);
    expect(loopFactor(1)).toBe(0.6);
    expect(loopFactor(2)).toBe(0.3);
    expect(loopFactor(3)).toBe(0.1);
    expect(loopFactor(9)).toBe(0.1);
  });
});

describe("poster priority", () => {
  it("is clamped between 0.1 and 1", () => {
    expect(posterPriority(0)).toBe(0.1);
    expect(posterPriority(200)).toBeCloseTo(1);
    expect(posterPriority(10_000)).toBe(1);
  });
  it("increases with balance", () => {
    expect(posterPriority(50)).toBeGreaterThan(posterPriority(10));
  });
});

describe("priority factor", () => {
  it("boost doubles, open loops reduce (A-14)", () => {
    const clean = priorityFactor({ ppBalance: 50, openLoops: 0, boostActive: false });
    const loops3 = priorityFactor({ ppBalance: 50, openLoops: 3, boostActive: false });
    const boosted = priorityFactor({ ppBalance: 50, openLoops: 0, boostActive: true });
    expect(loops3).toBeLessThan(clean);
    expect(loops3).toBeCloseTo(clean * 0.1);
    expect(boosted).toBeCloseTo(clean * 2);
  });
  it("tier explains open loops", () => {
    expect(priorityTier(50, 2).reason).toMatch(/open loop/);
    expect(priorityTier(200, 0).tier).toBe("High");
  });
});

describe("vote quality (PRD 5.5)", () => {
  it("accepts a normal vote", () => expect(voteQualityIssue(base)).toBeNull());
  it("rejects anonymous", () => expect(voteQualityIssue({ ...base, signedIn: false })).toBe("anonymous"));
  it("rejects too-fast votes", () => expect(voteQualityIssue({ ...base, dwellMs: 500 })).toBe("too_fast"));
  it("rejects bursts", () => expect(voteQualityIssue({ ...base, recentVotesInWindow: 10 })).toBe("burst"));
  it("rejects degenerate always-A voters", () =>
    expect(voteQualityIssue({ ...base, lifetimeVotes: 40, lifetimeSideAShare: 0.95 })).toBe("degenerate"));
  it("rejects degenerate always-B voters", () =>
    expect(voteQualityIssue({ ...base, lifetimeVotes: 40, lifetimeSideAShare: 0.02 })).toBe("degenerate"));
});

describe("reasons", () => {
  it("requires minimum length and not junk", () => {
    expect(isValidReason("short", 15)).toBe(false);
    expect(isValidReason("aaaaaaaaaaaaaaaaaaaa", 15)).toBe(false);
    expect(isValidReason("She loves building things", 15)).toBe(true);
  });
});

describe("report-back reminders (A-11)", () => {
  const deadline = new Date("2026-12-01T12:00:00Z");
  const at = (h: number) => new Date(deadline.getTime() + h * 3600_000);
  it("fires at +2h, +48h, +7d and stops after 3", () => {
    expect(reminderDue(deadline, 0, at(1))).toBe(false);
    expect(reminderDue(deadline, 0, at(2))).toBe(true);
    expect(reminderDue(deadline, 1, at(10))).toBe(false);
    expect(reminderDue(deadline, 1, at(48))).toBe(true);
    expect(reminderDue(deadline, 2, at(168))).toBe(true);
    expect(reminderDue(deadline, 3, at(1000))).toBe(false);
  });
});
