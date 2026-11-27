import { describe, expect, it } from "vitest";
import { commentPatterns, isChipReason, voteBucket, type VoteFact } from "@/server/services/comments-rules";

const v = (o: Partial<VoteFact>): VoteFact => ({
  who: "p1",
  kind: "guest",
  sex: null,
  age: null,
  personVotes: 3,
  reason: null,
  photo: false,
  seedBattle: true,
  theme: null,
  ...o,
});

describe("comments rules", () => {
  it("buckets vote counts", () => {
    expect(voteBucket(1)).toBe("1–4 votes");
    expect(voteBucket(5)).toBe("5–14 votes");
    expect(voteBucket(30)).toBe("30–99 votes");
    expect(voteBucket(250)).toBe("100+ votes");
  });

  it("knows the old chips", () => {
    expect(isChipReason(" Just feels right ")).toBe(true);
    expect(isChipReason("Just feels right to me")).toBe(false);
  });

  it("counts votes, reasons and people per group", () => {
    const rows = [
      v({ who: "a", kind: "account", reason: "He's clearly wrong", sex: "FEMALE" }),
      v({ who: "a", kind: "account", reason: null, sex: "FEMALE" }),
      v({ who: "g", kind: "guest", reason: "More practical" }),
      v({ who: "g2", kind: "guest", reason: "   " }),
    ];
    const p = commentPatterns(rows);
    expect(p.totals).toEqual({ votes: 4, withReason: 2, typed: 1, chips: 1, people: 3, commenters: 2 });
    const acc = p.byKind.find((r) => r.group === "Signed-in person")!;
    expect(acc).toMatchObject({ votes: 2, withReason: 1, rate: 0.5, people: 1, commenters: 1, peopleRate: 1 });
    const guest = p.byKind.find((r) => r.group === "Guest (no account)")!;
    expect(guest).toMatchObject({ votes: 2, withReason: 1, people: 2, commenters: 1, peopleRate: 0.5 });
    expect(p.bySex.map((r) => r.group)).toEqual(["Female", "Unknown"]);
  });
});
