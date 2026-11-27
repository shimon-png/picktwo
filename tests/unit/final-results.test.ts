import { describe, expect, it } from "vitest";
import { finalResult } from "@/server/services/email-rules";
import { finalResults, voterUpdates } from "@/server/email-templates";

describe("finalResult", () => {
  it("rounds to 100 and says whether you were with the crowd", () => {
    expect(finalResult(2, 1, "A")).toEqual({ pctA: 67, pctB: 33, withCrowd: true });
    expect(finalResult(2, 1, "B")).toEqual({ pctA: 67, pctB: 33, withCrowd: false });
  });
  it("calls a tie a tie", () => {
    expect(finalResult(5, 5, "A").withCrowd).toBeNull();
  });
  it("handles no votes", () => {
    expect(finalResult(0, 0, "A")).toEqual({ pctA: 0, pctB: 0, withCrowd: null });
  });
});

describe("final results email", () => {
  const r = { title: "Fair split?", url: "https://x/b/1", labelA: "Fair", labelB: "Not fair", pctA: 70, pctB: 30, picked: "Fair", withCrowd: true };
  it("one result names the winner", () => {
    const m = finalResults([r], "https://x/vote");
    expect(m.subject).toBe("Results are in: Fair won 70%");
    expect(m.text).toContain("You were with the crowd");
    expect(m.body).toContain("Vote on new battles");
  });
  it("voter updates with only results use the results email", () => {
    expect(voterUpdates({ outcomes: [], helpful: [], results: [r, { ...r, withCrowd: false }] }).subject).toBe("Results are in for 2 battles you voted on");
  });
  it("mixed with outcomes adds a Final results section", () => {
    const m = voterUpdates({ outcomes: [{ title: "T", url: "u", poster: "@p", picked: "A", thumb: null, calledIt: false, points: 0, note: null }], helpful: [], results: [r] });
    expect(m.body).toContain("Final results");
  });
});
