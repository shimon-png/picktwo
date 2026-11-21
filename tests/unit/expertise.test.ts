import { describe, it, expect } from "vitest";
import { expertTier, isExpertVoter, nextTier, canPostBattle, clampBattleHours, latestDeadline, sideScore } from "@/server/services/expertise";
import { ECONOMY_DEFAULTS } from "@/lib/constants";
import { createBattleInput } from "@/lib/validators";

const t = { proAt: 20, expertAt: 50, superExpertAt: 100 };

describe("expert tiers", () => {
  it("uses 20 / 50 / 100 correct picks", () => {
    expect(expertTier(0, t)).toBe("NONE");
    expect(expertTier(19, t)).toBe("NONE");
    expect(expertTier(20, t)).toBe("PRO");
    expect(expertTier(49, t)).toBe("PRO");
    expect(expertTier(50, t)).toBe("EXPERT");
    expect(expertTier(99, t)).toBe("EXPERT");
    expect(expertTier(100, t)).toBe("SUPER");
    expect(expertTier(5000, t)).toBe("SUPER");
  });
  it("defaults match the business rule", () => {
    expect(ECONOMY_DEFAULTS.proAt).toBe(20);
    expect(ECONOMY_DEFAULTS.expertAt).toBe(50);
    expect(ECONOMY_DEFAULTS.superExpertAt).toBe(100);
    expect(ECONOMY_DEFAULTS.maxBattleHours).toBe(120);
    expect(ECONOMY_DEFAULTS.maxUnreportedBattles).toBe(3);
  });
  it("counts Expert and above (not Pro) as expert voters", () => {
    expect(isExpertVoter(49, t)).toBe(false);
    expect(isExpertVoter(50, t)).toBe(true);
    expect(isExpertVoter(150, t)).toBe(true);
  });
  it("reports the next tier", () => {
    expect(nextTier(12, t)).toEqual({ tier: "PRO", needed: 8 });
    expect(nextTier(20, t)).toEqual({ tier: "EXPERT", needed: 30 });
    expect(nextTier(99, t)).toEqual({ tier: "SUPER", needed: 1 });
    expect(nextTier(100, t)).toBeNull();
  });
});

describe("posting gate", () => {
  it("blocks at 3 unreported closed battles, each report frees a slot", () => {
    expect(canPostBattle(0, 3)).toBe(true);
    expect(canPostBattle(2, 3)).toBe(true);
    expect(canPostBattle(3, 3)).toBe(false);
    expect(canPostBattle(7, 3)).toBe(false);
  });
  it("0 turns the gate off", () => {
    expect(canPostBattle(10, 0)).toBe(true);
  });
});

describe("battle length", () => {
  it("caps at 5 days", () => {
    expect(clampBattleHours(168, 120)).toBe(120);
    expect(clampBattleHours(24, 120)).toBe(24);
    expect(clampBattleHours(0, 120)).toBe(1);
    const c = new Date("2026-11-21T00:00:00Z");
    expect(latestDeadline(c, 120).toISOString()).toBe("2026-11-26T00:00:00.000Z");
  });
  it("validator cuts longer requests to 5 days instead of refusing", () => {
    const base = {
      title: "Jeans or suit?",
      options: [{ label: "Jeans" }, { label: "Suit" }],
      visibility: "PUBLIC",
      tags: {},
    };
    expect(createBattleInput.safeParse({ ...base, deadlineHours: 120 }).success).toBe(true);
    expect(createBattleInput.parse({ ...base, deadlineHours: 168 }).deadlineHours).toBe(120);
  });
});

describe("side score", () => {
  it("returns null with no votes, else rounded shares", () => {
    expect(sideScore(0, 0)).toBeNull();
    expect(sideScore(7, 3)).toEqual({ a: 70, b: 30, total: 10 });
  });
});
