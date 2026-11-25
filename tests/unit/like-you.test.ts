import { describe, expect, it } from "vitest";
import { likeYouLabel, likeYouScore, likeYouView, type LikeYouVote } from "@/lib/like-you";

const many = (n: number, v: Omit<LikeYouVote, "side">, aShare: number): LikeYouVote[] =>
  Array.from({ length: n }, (_, i) => ({ ...v, side: i < Math.round(n * aShare) ? "A" : "B" }));

describe("likeYouScore", () => {
  const votes = [
    ...many(20, { sex: "FEMALE", age: "AGE_25_34" }, 0.7),
    ...many(10, { sex: "FEMALE", age: "AGE_35_44" }, 0.2),
    ...many(30, { sex: "MALE", age: "AGE_25_34" }, 0.5),
    ...many(5, { sex: null, age: null }, 1),
  ];
  it("uses sex × age when that group has enough votes", () => {
    expect(likeYouScore(votes, { sex: "FEMALE", age: "AGE_25_34" }, 20)).toEqual({ label: "Women 25–34", a: 70, b: 30, total: 20 });
  });
  it("falls back to sex alone, then nothing", () => {
    expect(likeYouScore(votes, { sex: "FEMALE", age: "AGE_35_44" }, 20)).toEqual({ label: "Women", a: 53, b: 47, total: 30 });
    expect(likeYouScore(votes, { sex: "FEMALE", age: "AGE_35_44" }, 40)).toBeNull();
    expect(likeYouScore(votes, { sex: null }, 1)).toBeNull();
  });
  it("labels", () => {
    expect(likeYouLabel("MALE", "AGE_65_PLUS")).toBe("Men 65+");
    expect(likeYouLabel("UNDISCLOSED", "AGE_25_34")).toBeNull();
  });
});

describe("likeYouView", () => {
  const votes = many(25, { sex: "FEMALE", age: "AGE_25_34" }, 0.6);
  it("score when known; locked only after a skip", () => {
    expect(likeYouView(votes, { sex: "FEMALE", age: "AGE_25_34" }, { sex: false, age: false }, 20)).toMatchObject({ kind: "score", label: "Women 25–34" });
    expect(likeYouView(votes, {}, { sex: false, age: false }, 20)).toBeNull();
    expect(likeYouView(votes, {}, { sex: true, age: false }, 20)).toMatchObject({ kind: "locked", question: "sex" });
    expect(likeYouView([], { sex: "FEMALE" }, { sex: false, age: true }, 20)).toMatchObject({ kind: "locked", question: "age" });
  });
});
