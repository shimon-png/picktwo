import { describe, it, expect } from "vitest";
import { feedScore, relevance, diversify, type RankInput, type ViewerProfile } from "@/server/services/ranking";
import { isCorrectVote, reputationScore } from "@/server/services/reputation";
import { scrub } from "@/server/services/export";

const viewer: ViewerProfile = { categoryShare: { gifts: 0.8 }, kidAges: ["AGE_5_8"], country: "US" };
const b: RankInput = {
  categoryId: "gifts",
  kidAgeTags: ["AGE_5_8"],
  authorCountry: "US",
  isFriend: false,
  isFollowed: false,
  votes: 2,
  hoursUntilDeadline: 5,
  hoursSincePublish: 1,
  priorityFactor: 1,
};

describe("relevance (PRD 9.1)", () => {
  it("rewards matching kid age", () => {
    expect(relevance(viewer, b)).toBeGreaterThan(relevance(viewer, { ...b, kidAgeTags: ["AGE_13_17"] }));
  });
  it("rewards friends", () => {
    expect(relevance(viewer, { ...b, isFriend: true })).toBeGreaterThan(relevance(viewer, b));
  });
});

describe("feed score (PRD 9.2)", () => {
  it("prefers urgent battles with few votes", () => {
    expect(feedScore(viewer, b)).toBeGreaterThan(feedScore(viewer, { ...b, votes: 200, hoursUntilDeadline: 150 }));
  });
  it("is proportional to priority factor (open loops rank lower)", () => {
    const clean = feedScore(viewer, b);
    const penalised = feedScore(viewer, { ...b, priorityFactor: 0.1 });
    expect(penalised).toBeCloseTo(clean * 0.1);
  });
});

describe("diversify", () => {
  it("limits one card per author per 10 and 2 consecutive per category", () => {
    const items = [
      { id: 1, categoryId: "gifts", authorId: "x" },
      { id: 2, categoryId: "gifts", authorId: "x" },
      { id: 3, categoryId: "gifts", authorId: "y" },
      { id: 4, categoryId: "gifts", authorId: "z" },
      { id: 5, categoryId: "names", authorId: "w" },
    ];
    const out = diversify(items, 5);
    expect(out.map((o) => o.id).slice(0, 2)).toEqual([1, 3]);
    expect(out[2].categoryId).toBe("names");
  });
});

describe("reputation (PRD 9.4)", () => {
  it("correctness", () => {
    expect(isCorrectVote("A", "A", "UP")).toBe(true);
    expect(isCorrectVote("B", "A", "UP")).toBe(false);
    expect(isCorrectVote("B", "A", "DOWN")).toBe(true);
    expect(isCorrectVote("A", "A", "DOWN")).toBe(false);
  });
  it("is smoothed", () => {
    expect(reputationScore(0, 0)).toBe(0.5);
    expect(reputationScore(10, 10)).toBeCloseTo(12 / 14);
  });
});

describe("export scrubbing (PRD 13.5)", () => {
  it("removes emails, phones, urls and handles", () => {
    const s = scrub("Email me at jo@x.com or 555-123-4567, see https://a.b/c, ask @maya")!;
    expect(s).not.toMatch(/jo@x\.com|555|https|@maya/);
  });
});
