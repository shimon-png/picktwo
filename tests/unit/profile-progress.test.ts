import { describe, expect, it } from "vitest";
import { profileProgress, progressLine, withAnswer, withVote } from "@/lib/profile-progress";

describe("profileProgress", () => {
  it("starts empty", () => {
    const p = profileProgress(0, {}, 30);
    expect(p).toMatchObject({ votes: 0, left: 30, missing: ["sex", "age", "relationship", "zip"], pct: 0, complete: false });
    expect(progressLine(p)).toBe("30 more battles to your full profile");
  });

  it("counts votes and core answers as one bar", () => {
    const p = profileProgress(17, { sex: "FEMALE", age: "25-34" }, 30);
    expect(p.left).toBe(13);
    expect(p.missing).toEqual(["relationship", "zip"]);
    expect(p.pct).toBeCloseTo(19 / 34);
  });

  it("caps votes at the target and asks for what's left", () => {
    const p = profileProgress(55, { sex: "MALE" }, 30);
    expect(p.left).toBe(0);
    expect(p.complete).toBe(false);
    expect(p.pct).toBeCloseTo(31 / 34);
    expect(progressLine(p)).toBe("3 quick questions to finish your profile");
  });

  it("is complete with 30 votes and the four answers", () => {
    const p = profileProgress(30, { sex: "MALE", age: "18-24", relationship: "SINGLE", zip: "10001" }, 30);
    expect(p).toMatchObject({ complete: true, pct: 1 });
    expect(progressLine(p)).toBe("Profile complete");
  });

  it("ignores empty answers and handles odd inputs", () => {
    expect(profileProgress(-3, { sex: "" }, 0)).toMatchObject({ votes: 0, target: 1, left: 1, missing: ["sex", "age", "relationship", "zip"] });
    expect(progressLine(profileProgress(29, {}, 30))).toBe("1 more battle to your full profile");
  });

  it("moves by one on a vote and drops answered questions", () => {
    const p = withVote(profileProgress(29, { sex: "FEMALE", age: "18-24", relationship: "SINGLE" }, 30));
    expect(p).toMatchObject({ votes: 30, left: 0, missing: ["zip"], complete: false });
    const done = withAnswer(p, "zip");
    expect(done).toMatchObject({ missing: [], complete: true, pct: 1 });
    expect(withAnswer(done, "zip")).toEqual(done);
  });
});
